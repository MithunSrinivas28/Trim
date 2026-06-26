const CostCard = ({ data, loading }) => {
  if (loading) {
    return (
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "24px",
          color: "#9ca3af",
          fontSize: "14px",
        }}
      >
        Calculating cost...
      </div>
    );
  }

  if (!data || data.error) return null;

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
        padding: "24px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "15px", color: "#fff", marginBottom: "16px" }}>
        Cost Recommendation
      </div>

      <div style={{ fontSize: "20px", color: "#fff", fontWeight: 600, marginBottom: "8px" }}>
        {data.recommended_instance}
      </div>

      <div style={{ fontSize: "14px", color: "#4ade80", marginBottom: "4px" }}>
        ${data.monthly_cost_usd?.toFixed(2)} / month
      </div>

      <div style={{ fontSize: "14px", color: "#facc15" }}>
        {data.current_waste_pct}% over-allocated
      </div>
    </div>
  );
};

export default CostCard;
