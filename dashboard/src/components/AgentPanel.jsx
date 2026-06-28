const AgentPanel = ({ recommendation, loading }) => {
  const cardStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "24px",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, color: "var(--text-muted)", fontSize: "14px" }}>
        Agent thinking...
      </div>
    );
  }

  if (!recommendation) return null;

  // Split recommendation into summary and remediation
  const parts = recommendation.split("[Remediation]");
  const summaryPart = parts[0].replace("[Anomaly Summary]", "").trim();
  const remediationPart = parts.length > 1 ? parts[1].trim() : "";

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
          AI Analysis
        </div>
        <div className="badge" style={{ color: "var(--accent-indigo)", borderColor: "var(--accent-indigo)" }}>
          LLaMA · Groq
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7 }}>
        
        {/* Anomaly Summary Section */}
        {summaryPart && (
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>ANOMALY SUMMARY</div>
            <div style={{ borderLeft: "2px solid var(--accent-yellow)", background: "rgba(251,191,36,0.05)", padding: "12px" }}>
              {summaryPart}
            </div>
          </div>
        )}

        {/* Remediation Section */}
        {remediationPart && (
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>REMEDIATION</div>
            <div style={{ borderLeft: "2px solid var(--accent-indigo)", background: "rgba(129,140,248,0.05)", padding: "12px" }}>
              {remediationPart}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AgentPanel;
