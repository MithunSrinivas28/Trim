const AgentPanel = ({ recommendation, loading }) => {
  if (loading) {
    return (
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "24px",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        Agent thinking...
      </div>
    );
  }

  if (!recommendation) return null;

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
        padding: "24px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "15px", color: "#fff", marginBottom: "4px" }}>
        AI Remediation
      </div>

      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
        Powered by LLaMA 3 via Groq
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#fff",
          lineHeight: 1.6,
          borderLeft: "3px solid #6366f1",
          paddingLeft: "12px",
        }}
      >
        {recommendation}
      </div>
    </div>
  );
};

export default AgentPanel;
