import numpy as np
from sklearn.preprocessing import MinMaxScaler
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["trim"]
collection = db["containermetrics"]

SEQUENCE_LENGTH = 20   # input window — 20 consecutive readings
FORECAST_HORIZON = 10  # prediction target — next 10 readings

def fetch_metrics(container_id: str, limit: int = 200):
    docs = list(
        collection
        .find({ "containerId": container_id }, { "_id": 0, "cpuPercent": 1, "memoryPercent": 1 })
        .sort("timestamp", 1)  # oldest first — order matters for sequences
        .limit(limit)
    )
    return docs

def build_sequences(docs):
    total_needed = SEQUENCE_LENGTH + FORECAST_HORIZON
    if len(docs) < total_needed:
        return None, None, None

    # Raw 2D array — shape (N, 2): [[cpu, mem], [cpu, mem], ...]
    raw = np.array([[d["cpuPercent"], d["memoryPercent"]] for d in docs])

    # Scale each feature to 0-1 independently
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(raw)

    # Supervised sliding window — X is input, Y is forecast target
    X, Y = [], []
    for i in range(len(scaled) - total_needed + 1):
        X.append(scaled[i : i + SEQUENCE_LENGTH])
        Y.append(scaled[i + SEQUENCE_LENGTH : i + total_needed])

    X = np.array(X, dtype=np.float32)
    Y = np.array(Y, dtype=np.float32)
    return X, Y, scaler