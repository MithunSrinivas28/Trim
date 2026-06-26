const mongoose = require('mongoose');

const containerMetricSchema = new mongoose.Schema({
  containerId:    { type: String, required: true },
  name:           { type: String, required: true },
  image:          { type: String },
  cpuPercent:     { type: Number, required: true },
  memoryPercent:  { type: Number, required: true },
  restartCount:   { type: Number, default: 0 },
  cpuLimit:       { type: Number, default: 0 },
  memoryLimit:    { type: Number, default: 0 },
  timestamp:      { type: Date, default: Date.now },
});

// Index on containerId + timestamp — makes time-range queries fast
containerMetricSchema.index({ containerId: 1, timestamp: -1 });

module.exports = mongoose.model('ContainerMetric', containerMetricSchema);