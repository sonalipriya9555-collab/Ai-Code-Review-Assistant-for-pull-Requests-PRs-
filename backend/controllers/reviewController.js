/**
 * reviewController.js
 * Handles the request/response cycle for code review requests, delegating
 * the actual analysis work to services/codeReviewService.js.
 */

const { validateReviewRequest } = require("../utils/validators");
const { reviewCode } = require("../services/codeReviewService");

/**
 * POST /api/review
 */
async function postReview(req, res) {
  try {
    const { valid, errors } = validateReviewRequest(req.body);

    if (!valid) {
      return res.status(400).json({
        success: false,
        error: "Validation failed.",
        details: errors,
      });
    }

    const { code, language } = req.body;

    const result = reviewCode(code, language.toLowerCase());

    return res.status(200).json({
      success: true,
      score: result.score,
      summary: result.summary,
      issues: result.issues,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error("Error in postReview:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error while reviewing code.",
    });
  }
}

module.exports = {
  postReview,
};