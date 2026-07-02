# Trim — Container Resource Optimizer

Trim solves a real cloud infrastructure problem — containers that are over-allocated. Most teams set CPU and memory limits generously at deployment and never revisit them. Trim watches actual container usage, forecasts real peak demand using an LSTM model, calculates the AWS cost of the gap, and runs a LangChain ReAct agent that observes the data and autonomously recommends a remediation action — scale down, alert on-call, or reallocate. The output isn't just a health monitor. It's a cost analysis with an AI that tells you what to do about it.

---

## What It Does

The pipeline is straightforward once you see the full picture. Docker gets polled every 10 seconds — every running container's CPU and memory usage is sampled, computed from raw tick deltas, and written to MongoDB. An Express API sits on top of that data and serves it to a React dashboard that renders live container cards, a forecast chart, a cost card, and an agent panel.

On the ML side, a FastAPI service trains an LSTMForecaster on real container data. It takes the last 20 readings of CPU and memory, predicts the next 10 timesteps, computes the p95 of those predictions, and maps that to the cheapest AWS EC2 instance that covers the forecasted load. That's the cost recommendation — not what the container is using right now, but what it will need, and how much you're overpaying.

Then a LangChain ReAct agent with two tools — `query_anomalies()` and `suggest_remediation()` — runs on demand per container and returns a concrete action recommendation powered by Groq LLaMA 3. The agent isn't just pattern-matching. It reasons about what it sees, decides which tools to call, and produces a final recommendation in plain English.

---

## Architecture

<img width="1774" height="887" alt="ChatGPT Image Jun 29, 2026, 03_25_25 AM" src="https://github.com/user-attachments/assets/f8b1b0ab-13e4-48f2-abcd-79d201731f1e" />


---

## Tech Stack

- **Backend** — Node.js, Express, Dockerode, Mongoose, MongoDB
- **ML Service** — Python 3.11, FastAPI, PyTorch, scikit-learn, LangChain, LangGraph, Groq (LLaMA 3)
- **Dashboard** — React, Vite, Recharts, Axios

---

## The Backend

Dockerode connects via the named pipe `//./pipe/docker_engine` on Windows. The polling loop runs every 10 seconds and computes CPU usage from raw tick deltas — this is the same math `docker stats` uses internally. You can't read CPU percentage directly from the Docker API; you derive it from cumulative CPU counts between two successive reads. The delta in container CPU ticks divided by the delta in system CPU ticks, multiplied by the number of available cores, gives you the actual CPU percentage. Memory is simpler — `usage` divided by `limit` gives you the ratio.

To get the configured resource limits, `container.inspect()` pulls `HostConfig.NanoCpus` and `HostConfig.Memory`. These are stored as `cpuLimit` (NanoCpus / 1e9, converting nanosecond CPU quota to cores) and `memoryLimit` (raw bytes converted to MB). These limits are what the cost calculation is based on — not just current usage, but what the container is *allocated*, which is almost always more than what it actually needs.

A compound index on `containerId` + `timestamp` keeps time-range queries fast. Without it, every metrics fetch would be a collection scan once you have tens of thousands of readings.

The `/api/containers/:id/recommend` route proxies to the ML service. The backend never does cost math itself — it delegates entirely to the ML service and returns whatever comes back. This keeps the boundary clean: the backend owns data collection, the ML service owns analysis.

One practical bug worth mentioning: the first poll after a container starts has zero previous CPU ticks, which produces NaN when you try to compute the delta ratio. The fix is simple — guard against zero denominators and return 0 instead of computing the ratio. It's the kind of thing that only shows up in production when a container restarts mid-polling cycle.

---

## The ML Service

### Forecasting Model

The task changed from anomaly detection ("was this normal?") to resource forecasting ("what will this container need?"). That shift changes everything about the model architecture.

The old approach used an LSTM Autoencoder that reconstructed sequences to measure how abnormal they were — high reconstruction error meant anomaly. But that doesn't answer the question I actually care about: how much resource does this container need going forward?

The new `LSTMForecaster` is a many-to-many sequence model. It takes 20 consecutive readings of CPU and memory (shape: `(batch, 20, 2)`) and outputs the next 10 predicted timesteps (shape: `(batch, 10, 2)`). Hidden size is 64. Training is supervised — I build sliding window pairs where X is 20 readings and Y is the following 10. MSE loss drives the optimization. The p95 of the 10 predicted values is the forecast — the usage level that covers 95% of expected load. That's the number the cost engine uses.

### EC2 Cost Mapping

After forecasting, the p95 memory prediction is converted to GB and matched against a hardcoded lookup table of AWS t3 instances — nano through xlarge, ranging from $3.80 to $121.47 per month. The cheapest instance whose memory capacity covers the forecast is recommended.

The waste percentage is how much of the current allocation sits above that forecast. If a container is allocated 4 GB but the p95 forecast says it only needs 1.2 GB, that's a lot of money being burned on headroom nobody uses.

### The ReAct Agent

LangChain ReAct (Reason + Act) runs a loop: the agent thinks about what it needs, calls a tool, observes the result, thinks again, and produces a final answer.

Two tools power the agent:

- **`query_anomalies(container_id)`** — queries MongoDB directly for the last 20 readings and flags any where CPU or memory exceeded 80%. It returns a plain-English summary of what it found: how many anomalies, what the peak values were, and whether the pattern is trending up or stable.

- **`suggest_remediation(summary)`** — sends that summary to Groq's LLaMA 3 8B model with a DevOps assistant system prompt and gets back a concrete one-paragraph recommendation. The recommendation is specific: scale down to a smaller instance, alert the on-call engineer, reallocate resources, or do nothing if the container is healthy.

The agent decides the order of tool calls and whether both tools are needed. Max 4 iterations prevent runaway loops. The result is a single, actionable recommendation grounded in real data — not a generic "consider optimizing your resources" response.

> **Note on implementation:** The final implementation uses a direct two-step pipeline rather than a ReAct loop — `query_anomalies()` queries MongoDB, then `suggest_remediation()` calls the LLM directly. This was due to free-tier Groq models lacking reliable tool-calling support. The architecture retains the two-tool design and LLM-powered remediation. In production, this would use a paid model (GPT-4o or Claude) with full ReAct loop support.

---

## The Dashboard

The dashboard opens to a grid of container cards, each showing live CPU and memory usage as progress bars, the container name, image, and restart count. Clicking a card loads the detail view.

The detail view has three panels. `MetricsChart` renders the last 50 readings as a Recharts line chart — CPU and memory over time, so you can see trends and spikes at a glance. Below that, `CostCard` shows the recommended EC2 instance type, the estimated monthly cost rendered in green, and the waste percentage highlighted in yellow. `AgentPanel` displays the LLaMA 3 remediation recommendation with an indigo left-border accent — it visually separates the AI recommendation from the raw metrics.

Two custom hooks drive the data flow. `useRecommendation` polls `/api/containers/:id/recommend` every 30 seconds to keep the cost card fresh. `useAgent` fetches `/agent/:id` once per container selection — no polling, because agent calls are slow (the ReAct loop involves multiple LLM calls), and one fetch is enough to get the recommendation.

I went with raw CSS over Tailwind because Tailwind v3 had config conflicts with Vite during development. Rather than fight the tooling, I wrote the styles by hand. It's more verbose but zero config headaches.


## Performance Benchmarks

Trim is built to handle heavy data ingestion and ML workloads without blocking the main dashboard. We ran a local benchmark suite to measure throughput and latency across the stack:

| Component | Operation | Workload / Data | Latency |
| :--- | :--- | :--- | :--- |
| **MongoDB** | Batch Insert | 10,000 container metrics | **1.92 s** |
| **MongoDB** | Time-Series Query | Fetch last 50 readings (dashboard load) | **240 ms** |
| **PyTorch ML** | LSTM Model Training | 200 historical readings (50 epochs) | **33.49 s** |
| **PyTorch ML** | 10-Step Inference | Forward pass sliding window | **728 ms** |
| **Groq Agent** | End-to-End Orchestration | DB query + LLaMA 3.1 analysis + JSON response | **1.92 s** |

*Note: Training is intentionally heavy. Because it takes ~33 seconds per container, Trim runs all model training asynchronously in a dedicated background thread every 10 minutes, ensuring the API and dashboard remain perfectly responsive.*
---

## Project Structure

```
trim/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── models/ContainerMetric.js
│   │   ├── services/docker.js
│   │   ├── services/poller.js
│   │   ├── routes/containers.js
│   │   └── index.js
│   └── package.json
│
├── ml-service/
│   ├── main.py
│   ├── model.py
│   ├── data.py
│   ├── agent.py
│   └── requirements.txt
│
└── dashboard/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── ContainerCard.jsx
    │   │   ├── MetricsChart.jsx
    │   │   ├── CostCard.jsx
    │   │   └── AgentPanel.jsx
    │   ├── hooks/
    │   │   ├── useContainers.js
    │   │   ├── useRecommendation.js
    │   │   └── useAgent.js
    │   └── App.jsx
    └── package.json
```

---

## Running Locally

### Prerequisites

- Node.js
- Python 3.11
- MongoDB
- Docker Desktop

Four terminals, start in this order:

### Terminal 1 — MongoDB

```bash
mongod
```

### Terminal 2 — Backend

```bash
cd backend
npm install
node src/index.js
```

Runs on [http://localhost:3001](http://localhost:3001). Watch for `MongoDB connected` and `Poller started`.

### Terminal 3 — ML Service

```bash
cd ml-service
py -3.11 -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs on [http://localhost:8000](http://localhost:8000).

### Terminal 4 — Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Runs on [http://localhost:5173](http://localhost:5173).

### First Run

Wait 3–4 minutes for the poller to build up 30+ readings per container. Then train the model for a container:

```bash
# PowerShell
Invoke-RestMethod -Method POST http://localhost:8000/train/{containerId}
```

Then open the dashboard, click a container card, and the CostCard and AgentPanel will populate.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/containers` | Latest snapshot per running container |
| `GET` | `/api/containers/:id/metrics` | Last 50 readings for a container |
| `GET` | `/api/containers/:id/recommend` | Proxies to ML `/recommend` — EC2 suggestion + cost |
| `GET` | `/health` | ML service health check |
| `POST` | `/train/:id` | Train LSTMForecaster on container history |
| `GET` | `/forecast/:id` | 10-step prediction + p95 CPU and memory |
| `GET` | `/recommend/:id` | Cheapest EC2 instance + monthly cost + waste % |
| `GET` | `/agent/:id` | ReAct agent recommendation for a container |
