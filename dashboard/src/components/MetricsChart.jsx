import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";

const MetricsChart = ({ containerId, containerName }) => {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    if (!containerId) return;

    const fetch = async () => {
      const res = await import("axios").then(m => m.default.get(`http://localhost:3001/api/containers/${containerId}/metrics`));
      setMetrics(res.data.reverse());
    };

    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [containerId]);

  if (!containerId) return (
    <div style={{ padding: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
      Click a container card to see its metrics
    </div>
  );

  const data = metrics.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    cpu: m.cpuPercent,
    memory: m.memoryPercent,
  }));

  return (
    <div style={{ margin: "0 24px 24px" }}>
      <div style={{ marginBottom: "16px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-secondary)" }}>
        {containerName} / last 50 readings
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            width={30}
          />
          <Tooltip
            contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-sm)" }}
            labelStyle={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "var(--font-sans)" }}
            itemStyle={{ color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-sans)" }}
          />
          <Line type="monotone" dataKey="cpu" stroke="var(--accent-blue)" strokeWidth={2} dot={false} name="CPU %" />
          <Line type="monotone" dataKey="memory" stroke="var(--accent-indigo)" strokeWidth={2} dot={false} name="Memory %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;