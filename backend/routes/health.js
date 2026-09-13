/**
 * routes/health.js
 * Defines the /api/health route used by the frontend to display the
 * "Backend Online / Offline" indicator.
 */

const express = require("express");
const router = express.Router();

// GET /api/health
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    status: "online",
    message: "AI Code Review Assistant backend is running.",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;