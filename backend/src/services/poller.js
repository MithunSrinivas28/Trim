const { docker, listRunningContainers } = require('./docker');
const ContainerMetric = require('../models/ContainerMetric');

const calculateCPUPercent = (stats) => {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const numCPUs = stats.cpu_stats.online_cpus || 1;

  // Guard against division by zero — happens when container just started
  if (systemDelta <= 0 || cpuDelta < 0) return 0;

  return (cpuDelta / systemDelta) * numCPUs * 100;
};

const calculateMemoryPercent = (stats) => {
  const usage = stats.memory_stats.usage || 0;
  const limit = stats.memory_stats.limit || 1;
  return (usage / limit) * 100;
};

const collectStats = async () => {
  const containers = await listRunningContainers();

  for (const containerInfo of containers) {
    try {
      const container = docker.getContainer(containerInfo.Id);
      const stats = await container.stats({ stream: false });
      const inspection = await container.inspect();

      // Extract resource limits from Docker HostConfig
      const nanoCpus = inspection.HostConfig?.NanoCpus || 0;
      const memoryBytes = inspection.HostConfig?.Memory || 0;
      const cpuLimit = nanoCpus > 0 ? nanoCpus / 1e9 : 0;         // NanoCpus → number of CPUs
      const memoryLimit = memoryBytes > 0 ? memoryBytes / (1024 * 1024) : 0; // bytes → MB

      const metric = new ContainerMetric({
        containerId:   containerInfo.Id.slice(0, 12),
        name:          containerInfo.Names[0].replace('/', ''),
        image:         containerInfo.Image,
        cpuPercent:    parseFloat(calculateCPUPercent(stats).toFixed(2)),
        memoryPercent: parseFloat(calculateMemoryPercent(stats).toFixed(2)),
        restartCount:  containerInfo.RestartCount || 0,
        cpuLimit:      parseFloat(cpuLimit.toFixed(4)),
        memoryLimit:   parseFloat(memoryLimit.toFixed(2)),
        timestamp:     new Date(),
      });

      await metric.save();
      console.log(`[${metric.name}] CPU: ${metric.cpuPercent}% | MEM: ${metric.memoryPercent}% — saved`);
    } catch (err) {
      console.error(`[poller] skipped one reading: ${err.message}`);
    }
  }
};

const startPolling = () => {
  console.log('Poller started — collecting stats every 10s...');
  collectStats();
  setInterval(collectStats, 10000);
};

module.exports = { startPolling };