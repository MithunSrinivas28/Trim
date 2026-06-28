import { useState } from "react";

const ContainerCard = ({ container, selected, onClick }) => {
  const { name, cpuPercent, memoryPercent, restartCount, isAnomaly } = container;
  const [hovered, setHovered] = useState(false);

  const cardStyle = {
    background: selected ? "var(--bg-hover)" : "var(--bg-card)",
    border: `1px solid ${selected ? "var(--accent-blue)" : (hovered ? "var(--border-accent)" : "var(--border)")}`,
    borderRadius: "var(--radius)",
    padding: "20px",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
  };

  return (
    <div 
      style={cardStyle} 
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{name}</span>
        {isAnomaly && (
          <span style={{ display: "flex", alignItems: "center", color: "var(--accent-red)", fontSize: "12px", gap: "4px" }}>
            <span className="status-dot" style={{ background: "var(--accent-red)", margin: 0 }} /> Anomaly
          </span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
        <span>CPU</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{cpuPercent}%</span>
      </div>
      <div style={{ width: "100%", height: "3px", background: "var(--border)", borderRadius: "999px", marginBottom: "16px" }}>
        <div style={{ height: "3px", background: cpuPercent > 80 ? "var(--accent-red)" : "var(--accent-blue)", borderRadius: "999px", transition: "width 0.5s", width: `${Math.min(cpuPercent, 100)}%` }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
        <span>Memory</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{memoryPercent}%</span>
      </div>
      <div style={{ width: "100%", height: "3px", background: "var(--border)", borderRadius: "999px", marginBottom: "16px" }}>
        <div style={{ height: "3px", background: "var(--accent-indigo)", borderRadius: "999px", transition: "width 0.5s", width: `${Math.min(memoryPercent, 100)}%` }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
        <span>Restarts</span>
        <span className="badge">{restartCount}</span>
      </div>
    </div>
  );
};

export default ContainerCard;