import { useState } from "react";
import Navbar from "./components/Navbar";
import ContainerCard from "./components/ContainerCard";
import MetricsChart from "./components/MetricsChart";
import CostCard from "./components/CostCard";
import AgentPanel from "./components/AgentPanel";
import { useContainers } from "./hooks/useContainers";
import { useRecommendation } from "./hooks/useRecommendation";
import { useAgent } from "./hooks/useAgent";

function App() {
  const containers = useContainers();
  const [selected, setSelected] = useState(null);

  const selectedContainer = containers.find(c => c.containerId === selected);
  const { data: recData, loading: recLoading } = useRecommendation(selected);
  const { recommendation, loading: agentLoading } = useAgent(selected);

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <Navbar />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "12px",
        padding: "20px 24px"
      }}>
        {containers.map((c) => (
          <ContainerCard
            key={c.containerId}
            container={c}
            selected={selected === c.containerId}
            onClick={() => setSelected(c.containerId)}
          />
        ))}
      </div>
      <MetricsChart
        containerId={selected}
        containerName={selectedContainer?.name}
      />
      <div className="detail-section">
        <CostCard data={recData} loading={recLoading} />
        <AgentPanel recommendation={recommendation} loading={agentLoading} />
      </div>
    </div>
  );
}

export default App;