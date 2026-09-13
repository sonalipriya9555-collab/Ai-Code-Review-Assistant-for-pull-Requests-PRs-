/**
 * main.js
 * Wires up DOM events, talks to API.js, and drives UI.js rendering.
 * This is the only file that orchestrates the others.
 */

document.addEventListener("DOMContentLoaded", () => {
  UI.initNav();
  UI.renderPrGrid();
  UI.renderDashboard();
  UI.refreshGutter();

  // Seed hero stats (demo baseline; grows as real reviews run)
  UI.setHeroStats({
    prsReviewed: 482,
    bugsDetected: 1263,
    securityIssues: 214,
    avgReviewTime: 1.8,
  });

  checkBackendHealth();

  // Re-check health periodically so the pill stays accurate during a demo
  setInterval(checkBackendHealth, 15000);

  wireCodeEditor();
  wireHeroButtons();
});

// ---------------------------------------------------------------------------
// Backend health check
// ---------------------------------------------------------------------------
async function checkBackendHealth() {
  UI.setBackendStatus("checking");
  const result = await API.checkHealth();
  UI.setBackendStatus(result.ok ? "online" : "offline");
}

// ---------------------------------------------------------------------------
// Code editor + analyze flow
// ---------------------------------------------------------------------------
function wireCodeEditor() {
  const codeInput = document.getElementById("codeInput");
  const languageSelect = document.getElementById("languageSelect");
  const sampleBtn = document.getElementById("sampleCodeBtn");
  const clearBtn = document.getElementById("clearCodeBtn");
  const analyzeBtn = document.getElementById("analyzeCodeBtn");
  const resetBtn = document.getElementById("resetReviewBtn");
  const errorEl = document.getElementById("codeInputError");

  codeInput.addEventListener("input", UI.refreshGutter);
  codeInput.addEventListener("scroll", () => {
    document.getElementById("editorGutter").scrollTop = codeInput.scrollTop;
  });

  sampleBtn.addEventListener("click", () => {
    codeInput.value = UI.getSampleCode(languageSelect.value);
    UI.refreshGutter();
    errorEl.textContent = "";
  });

  clearBtn.addEventListener("click", () => {
    codeInput.value = "";
    UI.refreshGutter();
    errorEl.textContent = "";
  });

  resetBtn?.addEventListener("click", () => {
    UI.resetReviewUI();
  });

  analyzeBtn.addEventListener("click", () => runAnalysis(codeInput, languageSelect, analyzeBtn, errorEl));
}

async function runAnalysis(codeInput, languageSelect, analyzeBtn, errorEl) {
  const code = codeInput.value;
  const language = languageSelect.value;
  errorEl.textContent = "";

  // 1. Validate that code is entered
  if (!code || code.trim().length === 0) {
    errorEl.textContent = "Please enter some code before analyzing.";
    UI.showToast("Code input is empty.", "error");
    return;
  }

  if (code.length > 20000) {
    errorEl.textContent = "Code is too long (max 20,000 characters). Try a smaller snippet.";
    UI.showToast("Code exceeds the maximum length.", "error");
    return;
  }

  // 2. Show loading state
  setAnalyzing(analyzeBtn, true);

  const startTime = performance.now();

  // 3 & 4. Send to backend, receive result
  const result = await API.analyzeCode(code, language);

  setAnalyzing(analyzeBtn, false);

  if (!result.ok) {
    // Distinguish backend-offline vs validation vs server error
    if (result.status === 0) {
      UI.showToast(result.error || "Backend is offline.", "error", 5000);
      UI.setBackendStatus("offline");
    } else if (result.status === 400) {
      const details = (result.details || []).join(" ");
      errorEl.textContent = details || result.error;
      UI.showToast("Please fix the highlighted issues and try again.", "error");
    } else {
      UI.showToast(result.error || "Something went wrong on the server.", "error");
    }
    return;
  }

  const elapsedSeconds = (performance.now() - startTime) / 1000;

  // 5. Display the result dynamically
  UI.renderReviewResult(result.data);
  UI.setLastIssueCounts(result.data.issues);
  UI.recordReviewInSession(result.data);
  UI.showToast(`Review complete in ${elapsedSeconds.toFixed(1)}s.`, "success");

  // Scroll result into view on smaller screens
  document.getElementById("reviewResults").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setAnalyzing(button, isLoading) {
  const label = document.getElementById("analyzeBtnLabel");
  const spinner = document.getElementById("analyzeSpinner");
  button.disabled = isLoading;
  label.textContent = isLoading ? "Analyzing…" : "Analyze Code";
  spinner.classList.toggle("spinner--hidden", !isLoading);
}

// ---------------------------------------------------------------------------
// Hero buttons
// ---------------------------------------------------------------------------
function wireHeroButtons() {
  const startBtn = document.getElementById("startReviewBtn");
  const demoBtn = document.getElementById("viewDemoBtn");
  const codeInput = document.getElementById("codeInput");
  const languageSelect = document.getElementById("languageSelect");

  startBtn.addEventListener("click", () => {
    document.getElementById("code-review").scrollIntoView({ behavior: "smooth" });
    codeInput.focus();
  });

  demoBtn.addEventListener("click", () => {
    codeInput.value = UI.getSampleCode(languageSelect.value);
    UI.refreshGutter();
    document.getElementById("code-review").scrollIntoView({ behavior: "smooth" });
    UI.showToast("Sample code loaded. Click 'Analyze Code' to see it in action.", "info");
  });
}