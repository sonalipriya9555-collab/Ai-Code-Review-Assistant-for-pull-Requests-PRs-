/**
 * ui.js
 * DOM rendering helpers: toasts, backend status pill, review results,
 * PR dashboard cards, session dashboard, sample code, and small
 * interaction utilities (mobile nav, issue card expand/collapse, copy
 * button). main.js wires these into event listeners and API calls.
 */

const UI = (() => {
  // -----------------------------------------------------------------------
  // Sample code snippets shown by the "Sample Code" button
  // -----------------------------------------------------------------------
  const SAMPLE_CODE = {
    javascript: `function loginUser(username, password) {
  var query = "SELECT * FROM users WHERE user='" + username + "'";
  if (password == "admin123") {
    console.log("Backdoor login used");
  }
  try {
    eval(userInput);
  } catch (e) {}
  return query;
}`,
    typescript: `function loginUser(username: string, password: string) {
  const apiKey = "sk_live_51Hexample000000000000";
  console.log("Logging in", username);
  if (password == "admin123") {
    return true;
  }
  return false;
}`,
    python: `def login_user(username, password):
    api_key = "sk_live_51Hexample000000000000"
    print("Logging in", username)
    try:
        os.system("echo " + username)
    except:
        pass
    return True`,
    java: `public class Login {
    public boolean login(String user, String pass) {
        String password = "admin123";
        System.out.println("Checking login for " + user);
        if (pass == password) {
            return true;
        }
        return false;
    }
}`,
    cpp: `#include <iostream>
using namespace std;

bool login(string user, string pass) {
    string password = "admin123";
    cout << "Checking login for " << user << endl;
    for (int i = 0; i < 100; i++) {
        for (int j = 0; j < 100; j++) {
            // nested loop
        }
    }
    return pass == password;
}`,
  };

  function getSampleCode(language) {
    return SAMPLE_CODE[language] || SAMPLE_CODE.javascript;
  }

  // -----------------------------------------------------------------------
  // Toasts
  // -----------------------------------------------------------------------
  function showToast(message, type = "info", duration = 4000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // -----------------------------------------------------------------------
  // Backend status pill
  // -----------------------------------------------------------------------
  function setBackendStatus(status) {
    const pill = document.getElementById("backendStatus");
    if (!pill) return;

    pill.classList.remove("status-pill--online", "status-pill--offline", "status-pill--checking");

    if (status === "online") {
      pill.classList.add("status-pill--online");
      pill.innerHTML = `<span class="status-dot"></span> Backend Online`;
    } else if (status === "offline") {
      pill.classList.add("status-pill--offline");
      pill.innerHTML = `<span class="status-dot"></span> Backend Offline`;
    } else {
      pill.classList.add("status-pill--checking");
      pill.innerHTML = `<span class="status-dot"></span> Checking backend…`;
    }
  }

  // -----------------------------------------------------------------------
  // Hero stats (animated count-up)
  // -----------------------------------------------------------------------
  function animateStat(el, targetValue, suffix = "") {
    const duration = 900;
    const start = performance.now();
    const startValue = 0;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(startValue + (targetValue - startValue) * eased);
      el.textContent = `${value}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function setHeroStats({ prsReviewed, bugsDetected, securityIssues, avgReviewTime }) {
    const prsEl = document.querySelector('[data-stat="prsReviewed"]');
    const bugsEl = document.querySelector('[data-stat="bugsDetected"]');
    const secEl = document.querySelector('[data-stat="securityIssues"]');
    const avgEl = document.querySelector('[data-stat="avgReviewTime"]');

    if (prsEl) animateStat(prsEl, prsReviewed);
    if (bugsEl) animateStat(bugsEl, bugsDetected);
    if (secEl) animateStat(secEl, securityIssues);
    if (avgEl) avgEl.textContent = `${avgReviewTime.toFixed(1)}s`;
  }

  // -----------------------------------------------------------------------
  // Code editor gutter (line numbers)
  // -----------------------------------------------------------------------
  function refreshGutter() {
    const textarea = document.getElementById("codeInput");
    const gutter = document.getElementById("editorGutter");
    if (!textarea || !gutter) return;

    const lineCount = textarea.value.split("\n").length || 1;
    const numbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");
    gutter.textContent = numbers;
  }

  // -----------------------------------------------------------------------
  // Review results rendering
  // -----------------------------------------------------------------------
  function scoreColor(score) {
    if (score >= 80) return "#35e08c";
    if (score >= 50) return "#ffd166";
    return "#ff4d6d";
  }

  function renderReviewResult(result) {
    const placeholder = document.getElementById("reviewPlaceholder");
    const content = document.getElementById("reviewContent");
    placeholder.style.display = "none";
    content.hidden = false;

    // Score ring
    const circumference = 2 * Math.PI * 52; // r=52
    const ringFg = document.getElementById("scoreRingFg");
    const offset = circumference - (result.score / 100) * circumference;
    ringFg.style.stroke = scoreColor(result.score);
    // Force reflow so the transition plays from full offset each time
    ringFg.style.strokeDasharray = `${circumference}`;
    ringFg.style.strokeDashoffset = `${circumference}`;
    requestAnimationFrame(() => {
      ringFg.style.strokeDashoffset = `${offset}`;
    });

    document.getElementById("scoreValue").textContent = result.score;
    document.getElementById("scoreSummary").textContent = result.summary;

    // Metrics
    document.getElementById("metricBugs").textContent = result.metrics.bugs;
    document.getElementById("metricSecurity").textContent = result.metrics.security;
    document.getElementById("metricPerformance").textContent = result.metrics.performance;
    document.getElementById("metricQuality").textContent = result.metrics.quality;

    // Issues list
    renderIssuesList(result.issues);
  }

  function renderIssuesList(issues) {
    const list = document.getElementById("issuesList");
    list.innerHTML = "";

    if (!issues || issues.length === 0) {
      list.innerHTML = `<p style="color: var(--text-low);">No issues found. Nice work! ✨</p>`;
      return;
    }

    issues.forEach((issue, idx) => {
      const card = document.createElement("div");
      card.className = "issue-card";
      card.dataset.severity = issue.severity;

      card.innerHTML = `
        <div class="issue-card__header" data-toggle="${idx}">
          <span class="issue-card__severity">${issue.severity}</span>
          <span class="issue-card__line">Line ${issue.line}</span>
          <span class="issue-card__title">${escapeHtml(issue.title)}</span>
          <span class="issue-card__chevron">⌄</span>
        </div>
        <div class="issue-card__body">
          <p><strong>Problem:</strong> ${escapeHtml(issue.title)}</p>
          <p>${escapeHtml(issue.description)}</p>
          <div class="issue-card__suggestion">
            <span class="issue-card__suggestion-text">${escapeHtml(issue.suggestion)}</span>
            <button class="copy-btn" data-copy="${escapeHtml(issue.suggestion)}">Copy</button>
          </div>
        </div>
      `;

      list.appendChild(card);
    });

    // Expand/collapse
    list.querySelectorAll(".issue-card__header").forEach((header) => {
      header.addEventListener("click", () => {
        header.closest(".issue-card").classList.toggle("open");
      });
    });

    // Copy suggestion buttons
    list.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = btn.getAttribute("data-copy");
        navigator.clipboard
          .writeText(text)
          .then(() => showToast("Suggestion copied to clipboard.", "success", 2200))
          .catch(() => showToast("Could not copy to clipboard.", "error", 2200));
      });
    });
  }

  function resetReviewUI() {
    document.getElementById("reviewContent").hidden = true;
    document.getElementById("reviewPlaceholder").style.display = "block";
    document.getElementById("issuesList").innerHTML = "";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Pull Request dashboard cards (static demo data for the hackathon demo)
  // -----------------------------------------------------------------------
  const DEMO_PRS = [
    {
      number: 142,
      title: "Fix authentication validation",
      author: "@arjun-dev",
      status: "open",
      changedFiles: 6,
      reviewStatus: "AI Reviewed",
      score: 92,
    },
    {
      number: 138,
      title: "Add rate limiting middleware",
      author: "@priya-k",
      status: "merged",
      changedFiles: 3,
      reviewStatus: "AI Reviewed",
      score: 88,
    },
    {
      number: 135,
      title: "Refactor payment service",
      author: "@leo-chen",
      status: "review",
      changedFiles: 11,
      reviewStatus: "In Review",
      score: 64,
    },
    {
      number: 129,
      title: "Fix SQL injection in search endpoint",
      author: "@morgan-t",
      status: "merged",
      changedFiles: 2,
      reviewStatus: "AI Reviewed",
      score: 97,
    },
    {
      number: 121,
      title: "Add unit tests for review engine",
      author: "@sofia-r",
      status: "open",
      changedFiles: 8,
      reviewStatus: "AI Reviewed",
      score: 79,
    },
    {
      number: 118,
      title: "Optimize nested loop in report generator",
      author: "@dan-w",
      status: "review",
      changedFiles: 4,
      reviewStatus: "Pending",
      score: 55,
    },
  ];

  function statusBadgeClass(status) {
    if (status === "open") return "pr-badge--open";
    if (status === "merged") return "pr-badge--merged";
    return "pr-badge--review";
  }

  function renderPrGrid() {
    const grid = document.getElementById("prGrid");
    if (!grid) return;

    grid.innerHTML = DEMO_PRS.map(
      (pr) => `
      <div class="pr-card glass-panel">
        <div class="pr-card__top">
          <div>
            <span class="pr-card__number">PR #${pr.number}</span>
            <h3 class="pr-card__title">${escapeHtml(pr.title)}</h3>
          </div>
          <span class="pr-badge ${statusBadgeClass(pr.status)}">${pr.status}</span>
        </div>
        <div class="pr-card__meta">
          <span>Author: <strong>${escapeHtml(pr.author)}</strong></span>
          <span>Files changed: <strong>${pr.changedFiles}</strong></span>
          <span>Review: <strong>${escapeHtml(pr.reviewStatus)}</strong></span>
        </div>
        <div class="pr-card__score">
          <div class="pr-card__score-bar">
            <div class="pr-card__score-fill" style="width:${pr.score}%"></div>
          </div>
          <span class="pr-card__score-value">${pr.score}/100</span>
        </div>
      </div>
    `
    ).join("");
  }

  // -----------------------------------------------------------------------
  // Session dashboard (built from actual review runs during this visit)
  // -----------------------------------------------------------------------
  const sessionState = {
    reviews: [], // { score, issuesCount, security, bugs, timestamp }
  };

  function recordReviewInSession(result) {
    sessionState.reviews.push({
      score: result.score,
      issuesCount: result.issues.length,
      security: result.metrics.security,
      bugs: result.metrics.bugs,
      timestamp: new Date(),
    });
    renderDashboard();
  }

  function renderDashboard() {
    const totalPrsEl = document.getElementById("dashTotalPrs");
    const issuesFoundEl = document.getElementById("dashIssuesFound");
    const securityIssuesEl = document.getElementById("dashSecurityIssues");
    const avgScoreEl = document.getElementById("dashAvgScore");
    const recentList = document.getElementById("recentList");

    const reviews = sessionState.reviews;
    const totalIssues = reviews.reduce((sum, r) => sum + r.issuesCount, 0);
    const totalSecurity = reviews.reduce((sum, r) => sum + r.security, 0);
    const avgScore = reviews.length
      ? Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length)
      : null;

    if (totalPrsEl) totalPrsEl.textContent = 12 + reviews.length; // demo PRs + live reviews
    if (issuesFoundEl) issuesFoundEl.textContent = totalIssues;
    if (securityIssuesEl) securityIssuesEl.textContent = totalSecurity;
    if (avgScoreEl) avgScoreEl.textContent = avgScore === null ? "—" : `${avgScore}/100`;

    if (recentList) {
      if (reviews.length === 0) {
        recentList.innerHTML = `<li class="recent-list__empty">No reviews yet this session. Run one from the Code Review tab.</li>`;
      } else {
        recentList.innerHTML = reviews
          .slice()
          .reverse()
          .slice(0, 8)
          .map(
            (r) => `
            <li>
              <span>${r.timestamp.toLocaleTimeString()}</span>
              <span>${r.issuesCount} issue(s)</span>
              <span>Score: ${r.score}/100</span>
            </li>
          `
          )
          .join("");
      }
    }

    renderSeverityChart();
  }

  function renderSeverityChart() {
    const canvas = document.getElementById("severityChart");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth || 400;
    const height = canvas.height || 220;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    // Pull from the last rendered issues list if available via data attr,
    // otherwise fall back to demo distribution so the chart isn't empty.
    const demoDistribution = { critical: 3, high: 5, medium: 8, low: 10, info: 6 };
    const source = sessionState.lastIssueCounts || demoDistribution;
    Object.assign(counts, source);

    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const max = Math.max(...values, 1);
    const barWidth = width / (labels.length * 1.8);
    const gap = barWidth * 0.8;
    const colors = {
      critical: "#ff4d6d",
      high: "#ff9a52",
      medium: "#ffd166",
      low: "#6bd6ff",
      info: "#9aa4c7",
    };

    labels.forEach((label, i) => {
      const barHeight = (values[i] / max) * (height - 40);
      const x = i * (barWidth + gap) + gap;
      const y = height - barHeight - 24;

      ctx.fillStyle = colors[label];
      ctx.beginPath();
      const radius = 4;
      ctx.moveTo(x, y + barHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#b3b9d6";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, x + barWidth / 2, height - 8);
      ctx.fillText(String(values[i]), x + barWidth / 2, y - 6);
    });
  }

  function setLastIssueCounts(issues) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    issues.forEach((issue) => {
      if (counts[issue.severity] !== undefined) counts[issue.severity] += 1;
    });
    sessionState.lastIssueCounts = counts;
  }

  // -----------------------------------------------------------------------
  // Mobile nav toggle + active link highlighting
  // -----------------------------------------------------------------------
  function initNav() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");

    if (toggle && links) {
      toggle.addEventListener("click", () => {
        links.classList.toggle("open");
      });

      links.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          links.classList.remove("open");
          links.querySelectorAll("a").forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        });
      });
    }
  }

  return {
    getSampleCode,
    showToast,
    setBackendStatus,
    setHeroStats,
    refreshGutter,
    renderReviewResult,
    resetReviewUI,
    renderPrGrid,
    renderDashboard,
    recordReviewInSession,
    setLastIssueCounts,
    initNav,
  };
})();