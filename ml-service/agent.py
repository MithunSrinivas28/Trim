import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

client = MongoClient("mongodb://localhost:27017")
db = client["trim"]
collection = db["containermetrics"]

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY")
)

def query_anomalies(container_id: str) -> str:
    docs = list(
        collection
        .find({"containerId": container_id}, {"_id": 0, "cpuPercent": 1, "memoryPercent": 1})
        .sort("timestamp", -1)
        .limit(20)
    )
    if not docs:
        return f"No data found for container {container_id}"
    anomalies = [d for d in docs if d.get("cpuPercent", 0) > 80 or d.get("memoryPercent", 0) > 80]
    max_cpu = max(d.get("cpuPercent", 0) for d in docs)
    max_mem = max(d.get("memoryPercent", 0) for d in docs)
    return (
        f"Checked 20 readings for container {container_id}. "
        f"{len(anomalies)} anomalous readings detected (CPU > 80% or Memory > 80%). "
        f"Max CPU: {max_cpu:.2f}%, Max Memory: {max_mem:.2f}%."
    )

def suggest_remediation(summary: str) -> str:
    messages = [
        SystemMessage(content="You are a DevOps assistant. Given container metrics, suggest one concrete remediation action: scale down, alert on-call, or reallocate resources. Be specific and brief — one paragraph max."),
        HumanMessage(content=summary)
    ]
    response = llm.invoke(messages)
    return response.content

def run_agent(container_id: str) -> str:
    summary = query_anomalies(container_id)
    recommendation = suggest_remediation(summary)
    return f"[Anomaly Summary]\n{summary}\n\n[Remediation]\n{recommendation}"
