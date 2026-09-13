/**
 * routes/review.js
 * Defines the /api/review route.
 */

const express = require("express");
const router = express.Router();
const { postReview } = require("../controllers/reviewController");

// POST /api/review
router.post("/", postReview);

module.exports = router;