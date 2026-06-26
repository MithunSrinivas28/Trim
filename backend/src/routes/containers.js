const express = require('express');
const router = express.Router();
const ContainerMetric = require('../models/ContainerMetric');

// GET /api/containers — latest stat snapshot for each container
router.get('/', async (req, res) => {
  try {
    // Get all unique containerIds, then fetch the most recent doc for each
    const containerIds = await ContainerMetric.distinct('containerId');

    const latest = await Promise.all(
      containerIds.map(id =>
        ContainerMetric.findOne({ containerId: id }).sort({ timestamp: -1 })
      )
    );

    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:id/metrics — last 50 readings for one container
router.get('/:id/metrics', async (req, res) => {
  try {
    const metrics = await ContainerMetric
      .find({ containerId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:id/recommend — proxy to ML service for cost recommendation
router.get('/:id/recommend', async (req, res) => {
  try {
    const mlResponse = await fetch(`http://localhost:8000/recommend/${req.params.id}`);
    const data = await mlResponse.json();
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'ML service unavailable' });
  }
});

module.exports = router;