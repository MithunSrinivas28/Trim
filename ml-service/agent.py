import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain.tools import tool
from langchain.agents import create_react_agent, AgentExecutor
from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate

# Load .env from the same directory as this file
load_dotenv(Path(__file__).resolve().parent / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


# ── Tool 1: Query anomalies from MongoDB ──────────────────────────────
@tool
def query_anomalies(container_id: str) -> str:
    """Query the last 20 metrics for a container and flag anomalous readings
    where cpuPercent > 80 OR memoryPercent > 80."""
    client = MongoClient("mongodb://localhost:27017")
    db = client["trim"]
    collection = db["containermetrics"]

    docs = list(
        collection
        .find({"containerId": container_id}, {"_id": 0, "cpuPercent": 1, "memoryPercent": 1, "timestamp": 1})
        .sort("timestamp", -1)
        .limit(20)
    )

    if not docs:
        return f"No data found for container {container_id}"

    total = len(docs)
    anomalies = [d for d in docs if d.get("cpuPercent", 0) > 80 or d.get("memoryPercent", 0) > 80]
    anomaly_count = len(anomalies)
    max_cpu = max(d.get("cpuPercent", 0) for d in docs)
    max_mem = max(d.get("memoryPercent", 0) for d in docs)

    return (
        f"Checked {total} readings for container {container_id}. "
        f"{anomaly_count} anomalous readings detected (CPU > 80% or Memory > 80%). "
        f"Max CPU: {max_cpu:.1f}%, Max Memory: {max_mem:.1f}%."
    )


# ── Tool 2: Ask LLM for remediation advice ────────────────────────────
@tool
def suggest_remediation(summary: str) -> str:
    """Given a summary of container metrics, suggest a concrete remediation action
    such as scale down, alert on-call, or reallocate resources."""
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama3-8b-8192",
    )

    messages = [
        ("system", (
            "You are a DevOps assistant. Given container metrics, suggest one concrete "
            "remediation action: scale down, alert on-call, or reallocate resources. "
            "Be specific and brief — one paragraph max."
        )),
        ("human", summary),
    ]

    response = llm.invoke(messages)
    return response.content


# ── ReAct agent ────────────────────────────────────────────────────────
REACT_PROMPT = PromptTemplate.from_template(
    """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}"""
)


def run_agent(container_id: str) -> str:
    """Run the ReAct agent: first query anomalies, then suggest remediation."""
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama3-8b-8192",
    )

    tools = [query_anomalies, suggest_remediation]

    agent = create_react_agent(
        llm=llm,
        tools=tools,
        prompt=REACT_PROMPT,
    )

    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        max_iterations=4,
        handle_parsing_errors=True,
    )

    result = executor.invoke({
        "input": (
            f"Container {container_id} may have resource issues. "
            f"First query its anomalies, then based on what you find, suggest a remediation."
        )
    })

    return result["output"]
