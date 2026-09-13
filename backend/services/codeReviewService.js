/**
 * codeReviewService.js
 *
 * A local, rule-based "AI" code review engine. It scans submitted source
 * code line-by-line (and with a few whole-file heuristics) and reports
 * bugs, security issues, performance concerns and code-quality problems.
 *
 * This module is intentionally isolated from the Express layer so that a
 * real AI provider (OpenAI, Anthropic, etc.) can be dropped in later
 * without touching routes/controllers. See `reviewWithAI()` below for the
 * extension point.
 */

const SEVERITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
};

const SEVERITY_WEIGHTS = {
  [SEVERITY.CRITICAL]: 25,
  [SEVERITY.HIGH]: 15,
  [SEVERITY.MEDIUM]: 8,
  [SEVERITY.LOW]: 4,
  [SEVERITY.INFO]: 1,
};

/**
 * Adds an issue to the issues array with a consistent shape.
 */
function addIssue(issues, { severity, line, type, title, description, suggestion }) {
  issues.push({ severity, line, type, title, description, suggestion });
}

/**
 * Runs a set of line-based regex checks common across C-style languages
 * (JavaScript, TypeScript, Java, C++).
 */
function runCommonChecks(lines, language, issues) {
  let openFunctionLines = 0;
  let longestFunctionLength = 0;
  let currentFunctionStart = null;
  let braceDepth = 0;
  let loopDepthStack = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine;
    const trimmed = line.trim();
    const lineNumber = idx + 1;

    // eval() usage
    if (/\beval\s*\(/.test(trimmed) && language !== "python") {
      addIssue(issues, {
        severity: SEVERITY.CRITICAL,
        line: lineNumber,
        type: "security",
        title: "Unsafe eval() usage",
        description:
          "eval() executes arbitrary strings as code, which can allow injection of untrusted or malicious code.",
        suggestion:
          "Avoid eval(). Use JSON.parse() for data, or a safe expression parser if dynamic evaluation is truly required.",
      });
    }

    // console.log left in code
    if (/\bconsole\.(log|debug)\s*\(/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.LOW,
        line: lineNumber,
        type: "quality",
        title: "Leftover console statement",
        description:
          "console.log/debug statements are usually left over from debugging and can leak information in production.",
        suggestion:
          "Remove debug logging or replace it with a proper logging library (e.g. winston, pino) gated by log level.",
      });
    }

    // Hardcoded secrets / passwords / API keys
    if (
      /(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'`][^"'`]{3,}["'`]/i.test(
        trimmed
      )
    ) {
      addIssue(issues, {
        severity: SEVERITY.CRITICAL,
        line: lineNumber,
        type: "security",
        title: "Hardcoded credential detected",
        description:
          "A password, secret, or API key appears to be hardcoded directly in the source code.",
        suggestion:
          "Move secrets to environment variables (.env) and load them with dotenv. Never commit real secrets to source control.",
      });
    }

    // SQL injection patterns (string concatenation into a query)
    if (
      /(SELECT|INSERT|UPDATE|DELETE)\s+.*['"`]\s*\+/i.test(trimmed) ||
      /['"`]\s*\+\s*.*\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(trimmed) ||
      /query\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/i.test(trimmed)
    ) {
      addIssue(issues, {
        severity: SEVERITY.CRITICAL,
        line: lineNumber,
        type: "security",
        title: "Potential SQL injection",
        description:
          "SQL query strings appear to be built via concatenation or interpolation of user-controlled values.",
        suggestion:
          "Use parameterized queries or prepared statements (e.g. '?' placeholders or an ORM) instead of string building.",
      });
    }

    // Empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed) || /except\s*.*:\s*pass\b/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.MEDIUM,
        line: lineNumber,
        type: "bug",
        title: "Empty catch/except block",
        description:
          "Errors are being silently swallowed, which can hide bugs and make debugging very difficult.",
        suggestion:
          "At minimum, log the error. Ideally, handle it meaningfully or re-throw it if it cannot be handled here.",
      });
    }

    // Insecure HTTP URLs
    if (/["'`]http:\/\/(?!localhost|127\.0\.0\.1)[^"'`]+["'`]/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.MEDIUM,
        line: lineNumber,
        type: "security",
        title: "Insecure HTTP URL",
        description:
          "A plain HTTP URL was found. Traffic over HTTP is unencrypted and can be intercepted or tampered with.",
        suggestion: "Use HTTPS URLs for all external requests and resources.",
      });
    }

    // var usage (JS/TS quality)
    if (/^\s*var\s+/.test(line) && (language === "javascript" || language === "typescript")) {
      addIssue(issues, {
        severity: SEVERITY.INFO,
        line: lineNumber,
        type: "quality",
        title: "Use of 'var'",
        description:
          "'var' is function-scoped and can lead to confusing bugs. Modern JavaScript prefers block-scoped declarations.",
        suggestion: "Replace 'var' with 'let' or 'const' as appropriate.",
      });
    }

    // == instead of === (JS/TS)
    if (/[^=!]==[^=]/.test(line) && (language === "javascript" || language === "typescript")) {
      addIssue(issues, {
        severity: SEVERITY.LOW,
        line: lineNumber,
        type: "quality",
        title: "Loose equality operator",
        description:
          "'==' performs type coercion and can produce surprising results (e.g. '' == 0 is true).",
        suggestion: "Use strict equality '===' and '!==' instead.",
      });
    }

    // TODO / FIXME markers
    if (/\b(TODO|FIXME|XXX)\b/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.INFO,
        line: lineNumber,
        type: "quality",
        title: "Unresolved TODO/FIXME comment",
        description: "A TODO/FIXME marker suggests unfinished or provisional work.",
        suggestion: "Resolve the outstanding item or file a tracked issue before merging.",
      });
    }

    // Nested loop detection (rough heuristic via indentation-agnostic keyword tracking)
    if (/\b(for|while)\s*\(/.test(trimmed) || /\b(for|while)\b.*:\s*$/.test(trimmed)) {
      loopDepthStack.push(lineNumber);
      if (loopDepthStack.length === 2) {
        addIssue(issues, {
          severity: SEVERITY.MEDIUM,
          line: lineNumber,
          type: "performance",
          title: "Nested loop detected",
          description:
            "A loop nested inside another loop can lead to O(n^2) (or worse) time complexity on large inputs.",
          suggestion:
            "Consider using a hash map/set for lookups, memoization, or a more efficient algorithm to avoid nested iteration.",
        });
      }
    }
    if (/\}/.test(trimmed) && loopDepthStack.length > 0) {
      loopDepthStack.pop();
    }

    // Track function length (very rough, brace-based heuristic for C-style langs)
    if (/function\s+\w*\s*\(|=>\s*\{|\b\w+\s*\([^)]*\)\s*\{/.test(trimmed) && currentFunctionStart === null) {
      currentFunctionStart = lineNumber;
    }
  });

  // Very long function heuristic: if file has 60+ lines and no blank-line breaks, flag it
  if (lines.length > 60) {
    addIssue(issues, {
      severity: SEVERITY.MEDIUM,
      line: 1,
      type: "quality",
      title: "Very long function or file",
      description: `This submission spans ${lines.length} lines. Long functions are harder to read, test, and maintain.`,
      suggestion: "Break large functions into smaller, single-responsibility functions or modules.",
    });
  }

  // Missing error handling heuristic: async/await or promises without try/catch or .catch
  const hasAwait = /\bawait\b/.test(lines.join("\n"));
  const hasTryCatch = /\btry\s*\{/.test(lines.join("\n"));
  const hasDotCatch = /\.catch\s*\(/.test(lines.join("\n"));
  if (hasAwait && !hasTryCatch && !hasDotCatch) {
    addIssue(issues, {
      severity: SEVERITY.HIGH,
      line: 1,
      type: "bug",
      title: "Missing error handling around async code",
      description:
        "'await' is used without a surrounding try/catch or a '.catch()' handler, so rejected promises may crash the process or fail silently.",
      suggestion: "Wrap awaited calls in try/catch (or attach .catch()) and handle failures explicitly.",
    });
  }
}

/**
 * Python-specific checks that don't map well to the C-style regexes above.
 */
function runPythonChecks(lines, issues) {
  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    const lineNumber = idx + 1;

    if (/^\s*except\s*:\s*$/.test(rawLine)) {
      addIssue(issues, {
        severity: SEVERITY.MEDIUM,
        line: lineNumber,
        type: "bug",
        title: "Bare except clause",
        description: "A bare 'except:' catches every exception, including system-exiting ones like KeyboardInterrupt.",
        suggestion: "Catch specific exception types, e.g. 'except ValueError:'.",
      });
    }

    if (/\bprint\s*\(/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.LOW,
        line: lineNumber,
        type: "quality",
        title: "Leftover print statement",
        description: "print() calls are typically debugging leftovers and clutter production output.",
        suggestion: "Use the 'logging' module instead of print() for production code.",
      });
    }

    if (/^\s*def\s+\w+\([^)]*\):\s*$/.test(rawLine) === false && /os\.system\s*\(/.test(trimmed)) {
      addIssue(issues, {
        severity: SEVERITY.CRITICAL,
        line: lineNumber,
        type: "security",
        title: "Unsafe os.system() call",
        description: "os.system() runs a string in a shell, which is dangerous if any part of the string is user-controlled.",
        suggestion: "Use the 'subprocess' module with a list of arguments (avoid shell=True) instead.",
      });
    }
  });
}

/**
 * Detects unused variables with a simple heuristic: a `const`/`let`/`var`
 * declared name that never appears again elsewhere in the file.
 */
function detectUnusedVariables(lines, language, issues) {
  if (!["javascript", "typescript"].includes(language)) return;

  const fullText = lines.join("\n");
  const declarationRegex = /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=/g;
  let match;
  const seen = new Set();

  while ((match = declarationRegex.exec(fullText)) !== null) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);

    const usageRegex = new RegExp(`\\b${name}\\b`, "g");
    const occurrences = (fullText.match(usageRegex) || []).length;

    if (occurrences <= 1) {
      const lineNumber = fullText.slice(0, match.index).split("\n").length;
      addIssue(issues, {
        severity: SEVERITY.LOW,
        line: lineNumber,
        type: "quality",
        title: `Unused variable '${name}'`,
        description: `The variable '${name}' is declared but never used elsewhere in the code.`,
        suggestion: `Remove '${name}' if it is not needed, or use it as intended.`,
      });
    }
  }
}

/**
 * Computes an overall score (0-100) by subtracting weighted penalties for
 * each issue found, floored at 0.
 */
function computeScore(issues) {
  const penalty = issues.reduce(
    (sum, issue) => sum + (SEVERITY_WEIGHTS[issue.severity] || 0),
    0
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Builds the metrics summary object counting issues by category.
 */
function computeMetrics(issues) {
  return {
    bugs: issues.filter((i) => i.type === "bug").length,
    security: issues.filter((i) => i.type === "security").length,
    performance: issues.filter((i) => i.type === "performance").length,
    quality: issues.filter((i) => i.type === "quality").length,
  };
}

/**
 * Produces a one-line human-readable summary based on the worst issue found.
 */
function buildSummary(issues, score) {
  if (issues.length === 0) {
    return "No significant issues detected. Code looks clean!";
  }

  const hasCritical = issues.some((i) => i.severity === SEVERITY.CRITICAL);
  const hasHigh = issues.some((i) => i.severity === SEVERITY.HIGH);
  const securityCount = issues.filter((i) => i.type === "security").length;

  if (securityCount > 0 && hasCritical) {
    return `Critical security vulnerability detected. Immediate attention required (score: ${score}/100).`;
  }
  if (hasCritical) {
    return `Critical issues found that should be fixed before merging (score: ${score}/100).`;
  }
  if (hasHigh) {
    return `High-priority issues found. Review recommended before merging (score: ${score}/100).`;
  }
  return `Minor issues found. Code is mostly solid (score: ${score}/100).`;
}

/**
 * Main entry point: runs the full rule-based review pipeline on a code
 * submission and returns a structured result matching the API contract.
 *
 * @param {string} code
 * @param {string} language
 * @returns {{score:number, summary:string, issues:Array, metrics:object}}
 */
function reviewCode(code, language) {
  const normalizedLanguage = language.toLowerCase();
  const lines = code.split(/\r?\n/);
  const issues = [];

  runCommonChecks(lines, normalizedLanguage, issues);
  detectUnusedVariables(lines, normalizedLanguage, issues);

  if (normalizedLanguage === "python") {
    runPythonChecks(lines, issues);
  }

  // Sort issues by severity (critical first) then by line number
  const severityOrder = [
    SEVERITY.CRITICAL,
    SEVERITY.HIGH,
    SEVERITY.MEDIUM,
    SEVERITY.LOW,
    SEVERITY.INFO,
  ];
  issues.sort((a, b) => {
    const sevDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return a.line - b.line;
  });

  const score = computeScore(issues);
  const metrics = computeMetrics(issues);
  const summary = buildSummary(issues, score);

  return { score, summary, issues, metrics };
}

/**
 * EXTENSION POINT
 * ---------------
 * Swap `reviewCode()` for a call to a real AI provider here later, e.g.:
 *
 *   async function reviewWithAI(code, language) {
 *     const response = await fetch("https://api.openai.com/v1/chat/completions", {
 *       method: "POST",
 *       headers: {
 *         "Content-Type": "application/json",
 *         Authorization: `Bearer ${process.env.AI_API_KEY}`,
 *       },
 *       body: JSON.stringify({
 *         model: process.env.AI_MODEL || "gpt-4o-mini",
 *         messages: [
 *           { role: "system", content: "You are a senior code reviewer..." },
 *           { role: "user", content: `Review this ${language} code:\n${code}` },
 *         ],
 *       }),
 *     });
 *     const data = await response.json();
 *     // Parse data into the same { score, summary, issues, metrics } shape
 *     // returned by reviewCode() above so the rest of the app is unaffected.
 *   }
 *
 * The controller calls whichever function is exported as `reviewCode`,
 * so switching providers only requires changes in this file.
 */

module.exports = {
  reviewCode,
  SEVERITY,
};