/**
 * server.js
 * Entry point for the AI Code Review Assistant backend.
 *
 * Run with:
 *   npm install
 *   npm start
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health");
const reviewRoutes = require("./routes/review");

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// --- Middleware ---------------------------------------------------------

app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Simple request logger (helpful during hackathon demos)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Routes --------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Code Review Assistant API. See /api/health and /api/review.",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/review", reviewRoutes);

// --- 404 handler -----------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// --- Global error handler ---------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Code Review Assistant backend running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   CORS origin allowed: ${CORS_ORIGIN}`);
});