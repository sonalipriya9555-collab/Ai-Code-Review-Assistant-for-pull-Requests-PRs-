/**
 * api.js
 * Thin abstraction over fetch() for talking to the backend REST API.
 * Keeps every URL and error-handling decision in one place so the rest
 * of the frontend never calls fetch() directly.
 */

const API = (() => {
  const BASE_URL = "http://localhost:5000";

  /**
   * Internal helper: performs a fetch with a timeout and normalizes
   * network/parse failures into a consistent error shape.
   */
  async function request(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      clearTimeout(timer);

      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        // Response had no JSON body (e.g. a proxy error page)
        data = null;
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error:
            (data && (data.error || data.message)) ||
            `Server responded with status ${response.status}.`,
          details: (data && data.details) || null,
        };
      }

      return { ok: true, status: response.status, data };
    } catch (err) {
      clearTimeout(timer);

      if (err.name === "AbortError") {
        return { ok: false, status: 0, error: "Request timed out. Is the backend running?" };
      }

      // Typically a network error: backend offline / CORS / DNS failure
      return {
        ok: false,
        status: 0,
        error: "Could not reach the backend. Make sure it's running on http://localhost:5000.",
      };
    }
  }

  /**
   * GET /api/health
   */
  async function checkHealth() {
    return request("/api/health", { method: "GET" }, 5000);
  }

  /**
   * POST /api/review
   * @param {string} code
   * @param {string} language
   */
  async function analyzeCode(code, language) {
    return request("/api/review", {
      method: "POST",
      body: JSON.stringify({ code, language }),
    });
  }

  return { checkHealth, analyzeCode, BASE_URL };
})();