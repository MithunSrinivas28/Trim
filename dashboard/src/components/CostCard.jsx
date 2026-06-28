const CostCard = ({ data, loading }) => {
  const cardStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "24px",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, color: "var(--text-muted)", fontSize: "14px" }}>
        Calculating cost...
      </div>
    );
  }

  if (!data || data.error) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
          Cost Projection
        </div>
        <div className="badge">EC2 t3 family</div>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "24px" }}>
        {data.recommended_instance}
      </div>

      <div style={{ display: "flex", gap: "32px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>EST. MONTHLY</div>
          <div style={{ color: "var(--accent-green)", fontSize: "16px", fontWeight: 500 }}>${data.monthly_cost_usd?.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>OVER-ALLOCATED</div>
          <div style={{ color: "var(--accent-yellow)", fontSize: "16px", fontWeight: 500 }}>{data.current_waste_pct}%</div>
        </div>
      </div>
    </div>
  );
};

export default CostCard;
