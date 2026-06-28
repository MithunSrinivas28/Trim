const Navbar = () => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: "52px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)"
  }}>
    <div style={{
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: "16px",
      color: "var(--text-primary)",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }}>
      <span style={{ color: "var(--accent-indigo)" }}>◈</span> Trim
    </div>
    <div style={{
      display: "flex",
      alignItems: "center",
      color: "var(--accent-green)",
      fontSize: "13px",
      fontWeight: 500
    }}>
      <span className="status-dot live" />
      Live
    </div>
  </div>
);

export default Navbar;