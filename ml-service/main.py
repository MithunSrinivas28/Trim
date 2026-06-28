from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
import threading
import time
import torch
import torch.nn as nn
import numpy as np
from data import fetch_metrics, build_sequences, SEQUENCE_LENGTH, FORECAST_HORIZON
from model import LSTMForecaster
from agent import run_agent
from contextlib import asynccontextmanager

client = MongoClient("mongodb://localhost:27017")
db = client["trim"]
collection = db["containermetrics"]

models = {}

# ── EC2 lookup table for cost recommendations ─────────────────────────
EC2_INSTANCES = [
    {"name": "t3.nano",   "vcpu": 2,  "memory_gb": 0.5,  "monthly_usd": 3.80},
    {"name": "t3.micro",  "vcpu": 2,  "memory_gb": 1.0,  "monthly_usd": 7.59},
    {"name": "t3.small",  "vcpu": 2,  "memory_gb": 2.0,  "monthly_usd": 15.18},
    {"name": "t3.medium", "vcpu": 2,  "memory_gb": 4.0,  "monthly_usd": 30.37},
    {"name": "t3.large",  "vcpu": 2,  "memory_gb": 8.0,  "monthly_usd": 60.74},
    {"name": "t3.xlarge", "vcpu": 4,  "memory_gb": 16.0, "monthly_usd": 121.47},
]

def train_model(container_id: str, epochs: int = 50):
    docs = fetch_metrics(container_id, limit=200)
    X, Y, scaler = build_sequences(docs)

    if X is None:
        print(f"[startup] Not enough data for {container_id}, skipping")
        return

    X_tensor = torch.tensor(X)
    Y_tensor = torch.tensor(Y)
    model = LSTMForecaster()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        output = model(X_tensor)
        loss = criterion(output, Y_tensor)
        loss.backward()
        optimizer.step()

    models[container_id] = {"model": model, "scaler": scaler}
    print(f"[startup] Trained model for {container_id} — loss: {loss.item():.6f}")

def background_retrain():
    while True:
        time.sleep(600)
        print("[retrain] Running scheduled retrain for all containers...")
        known_ids = collection.distinct("containerId")
        for cid in known_ids:
            try:
                train_model(cid)
                print(f"[retrain] {cid} — done")
            except Exception as e:
                print(f"[retrain] {cid} — failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-train for all containers found in MongoDB on startup
    print("[startup] Auto-training models for all known containers...")
    container_ids = collection.distinct("containerId")
    for cid in container_ids:
        train_model(cid)
    print(f"[startup] Done — trained {len(container_ids)} models")
    
    t = threading.Thread(target=background_retrain, daemon=True)
    t.start()
    print("[startup] Background retrain thread started — runs every 10 minutes")
    
    yield  # app runs here

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ml-service running", "models_loaded": list(models.keys())}

# ── Train ──────────────────────────────────────────────────────────────
@app.post("/train/{container_id}")
def train(container_id: str, epochs: int = 50):
    docs = fetch_metrics(container_id, limit=200)
    X, Y, scaler = build_sequences(docs)
    if X is None:
        return {"error": "Not enough data"}

    X_tensor = torch.tensor(X)
    Y_tensor = torch.tensor(Y)
    model = LSTMForecaster()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        output = model(X_tensor)
        loss = criterion(output, Y_tensor)
        loss.backward()
        optimizer.step()

    models[container_id] = {"model": model, "scaler": scaler}
    return {"status": "trained", "container_id": container_id, "final_loss": loss.item()}

# ── Forecast ───────────────────────────────────────────────────────────
def _run_forecast(container_id: str):
    """Internal helper: runs the forecast and returns predictions + p95 in original scale."""
    if container_id not in models:
        return None, "No trained model for this container"

    docs = fetch_metrics(container_id, limit=50)
    if len(docs) < SEQUENCE_LENGTH:
        return None, "Not enough data (need at least 20 readings)"

    saved = models[container_id]
    model = saved["model"]
    scaler = saved["scaler"]

    # Prepare the most recent 20 readings
    raw = np.array([[d["cpuPercent"], d["memoryPercent"]] for d in docs])
    scaled = scaler.transform(raw)
    recent = scaled[-SEQUENCE_LENGTH:].astype(np.float32)
    X_tensor = torch.tensor(recent).unsqueeze(0)  # (1, 20, 2)

    model.eval()
    with torch.no_grad():
        forecast_scaled = model(X_tensor)  # (1, 10, 2)

    # Inverse-transform back to original scale
    forecast_np = forecast_scaled.squeeze(0).numpy()  # (10, 2)
    forecast_original = scaler.inverse_transform(forecast_np)

    predicted_steps = [
        {"step": i + 1, "cpuPercent": round(float(row[0]), 2), "memoryPercent": round(float(row[1]), 2)}
        for i, row in enumerate(forecast_original)
    ]

    p95_cpu = round(float(np.percentile(forecast_original[:, 0], 95)), 2)
    p95_memory = round(float(np.percentile(forecast_original[:, 1], 95)), 2)

    return {
        "container_id": container_id,
        "forecast_horizon": FORECAST_HORIZON,
        "predictions": predicted_steps,
        "p95_cpu": p95_cpu,
        "p95_memory": p95_memory,
    }, None

@app.get("/forecast/{container_id}")
def forecast(container_id: str):
    result, error = _run_forecast(container_id)
    if error:
        return {"error": error}
    return result

# ── Recommend ──────────────────────────────────────────────────────────
@app.get("/recommend/{container_id}")
def recommend(container_id: str):
    result, error = _run_forecast(container_id)
    if error:
        return {"error": error}

    p95_cpu = result["p95_cpu"]
    p95_memory = result["p95_memory"]

    # Convert p95_memory from percent → GB (assuming 8 GB container limit)
    needed_memory_gb = (p95_memory / 100.0) * 8.0

    # Pick the cheapest EC2 instance whose memory_gb covers the need
    recommended = None
    for instance in EC2_INSTANCES:
        if instance["memory_gb"] >= needed_memory_gb:
            recommended = instance
            break

    # Fallback to the largest if nothing fits
    if recommended is None:
        recommended = EC2_INSTANCES[-1]

    # Waste = how much of the instance's memory capacity is unused
    current_waste_pct = round(
        ((recommended["memory_gb"] - needed_memory_gb) / recommended["memory_gb"]) * 100, 1
    )

    return {
        "container_id": container_id,
        "p95_cpu": p95_cpu,
        "p95_memory": p95_memory,
        "needed_memory_gb": round(needed_memory_gb, 3),
        "recommended_instance": recommended["name"],
        "monthly_cost_usd": recommended["monthly_usd"],
        "current_waste_pct": current_waste_pct,
    }

# ── Agent ──────────────────────────────────────────────────────────────
@app.get("/agent/{container_id}")
def agent_endpoint(container_id: str):
    try:
        result = run_agent(container_id)
        return {"container_id": container_id, "recommendation": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})