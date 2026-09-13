/**
 * validators.js
 * Small, dependency-free validation helpers for the /api/review endpoint.
 */

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "c++",
];

const DEFAULT_MAX_CODE_LENGTH = 20000;

/**
 * Validates the body of a POST /api/review request.
 * @param {object} body - The parsed JSON request body.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateReviewRequest(body) {
  const errors = [];
  const maxLength = Number(process.env.MAX_CODE_LENGTH) || DEFAULT_MAX_CODE_LENGTH;

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a JSON object."] };
  }

  const { code, language } = body;

  if (code === undefined || code === null) {
    errors.push("Field 'code' is required.");
  } else if (typeof code !== "string") {
    errors.push("Field 'code' must be a string.");
  } else if (code.trim().length === 0) {
    errors.push("Field 'code' cannot be empty.");
  } else if (code.length > maxLength) {
    errors.push(`Field 'code' exceeds the maximum allowed length of ${maxLength} characters.`);
  }

  if (language === undefined || language === null) {
    errors.push("Field 'language' is required.");
  } else if (typeof language !== "string") {
    errors.push("Field 'language' must be a string.");
  } else if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    errors.push(
      `Field 'language' must be one of: ${SUPPORTED_LANGUAGES.join(", ")}.`
    );
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateReviewRequest,
  SUPPORTED_LANGUAGES,
};