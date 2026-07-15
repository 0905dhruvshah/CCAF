(function () {
  "use strict";

  // ---------- Domain metadata (must match questions.js domain keys) ----------
  const DOMAINS = {
    agentic:    { name: "Agentic Architecture & Orchestration", weight: 27 },
    claudecode: { name: "Claude Code Configuration & Workflows", weight: 20 },
    prompt:     { name: "Prompt Engineering & Structured Output", weight: 20 },
    tools:      { name: "Tool Design & MCP Integration", weight: 18 },
    context:    { name: "Context Management & Reliability", weight: 15 }
  };
  const DOMAIN_ORDER = ["agentic", "claudecode", "prompt", "tools", "context"];

  const EXAM_MINUTES = 120;
  const PASS_SCORE = 720;
  const STORAGE_KEY = "ccaf_exam_state_v1";
  const HISTORY_KEY = "ccaf_exam_history_v1";

  // ---------- State ----------
  let state = null; // active exam/practice state
  let timerInterval = null;

  // ---------- Utilities ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function letterFor(i) { return String.fromCharCode(65 + i); }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
  }

  function saveState() {
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory(entry) {
    const hist = loadHistory();
    hist.unshift(entry);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 20))); } catch (e) { /* ignore */ }
  }

  // ---------- Screen navigation ----------
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  // ---------- Home screen render ----------
  function renderHome() {
    const list = document.getElementById("domain-weight-list");
    list.innerHTML = DOMAIN_ORDER.map(key => {
      const d = DOMAINS[key];
      return `<div class="dw-row">
        <span class="dw-name">${d.name}</span>
        <div class="dw-bar-track"><div class="dw-bar-fill" style="width:${d.weight}%"></div></div>
        <span class="dw-pct">${d.weight}%</span>
      </div>`;
    }).join("");

    const resumable = loadState();
    const resumeBanner = document.getElementById("resume-banner");
    if (resumable && resumable.mode === "full" && !resumable.finished) {
      resumeBanner.classList.remove("hidden");
      document.getElementById("resume-q").textContent = resumable.currentIndex + 1;
      document.getElementById("resume-time").textContent = formatTime(resumable.secondsRemaining);
    } else {
      resumeBanner.classList.add("hidden");
    }

    const hist = loadHistory();
    const histPanel = document.getElementById("history-panel");
    const histList = document.getElementById("history-list");
    if (hist.length) {
      histPanel.classList.remove("hidden");
      histList.innerHTML = hist.map(h => {
        const cls = h.pass ? "h-pass" : "h-fail";
        const label = h.pass ? "PASS" : "FAIL";
        return `<div class="history-row"><span>${h.date}</span><span>${h.mode === "full" ? "Full exam" : "Practice: " + (DOMAINS[h.domain] ? DOMAINS[h.domain].name : h.domain)}</span><span class="${cls}">${label} — ${h.score}/1000</span></div>`;
      }).join("");
    } else {
      histPanel.classList.add("hidden");
    }
  }

  function renderDomainSelect() {
    const list = document.getElementById("domain-select-list");
    list.innerHTML = DOMAIN_ORDER.map(key => {
      const d = DOMAINS[key];
      const count = QUESTION_BANK.filter(q => q.domain === key).length;
      return `<button class="domain-select-btn" data-domain="${key}">
        <span class="ds-name">${d.name}</span>
        <span class="ds-meta">${count} questions · ${d.weight}% of real exam</span>
      </button>`;
    }).join("");
    list.querySelectorAll(".domain-select-btn").forEach(btn => {
      btn.addEventListener("click", () => startPractice(btn.dataset.domain));
    });
  }

  // ---------- Starting an exam / practice session ----------
  function startFullExam() {
    const questions = shuffle(QUESTION_BANK).map(q => ({ ...q }));
    state = {
      mode: "full",
      questions,
      answers: new Array(questions.length).fill(null),
      flags: new Array(questions.length).fill(false),
      currentIndex: 0,
      secondsRemaining: EXAM_MINUTES * 60,
      startedAt: Date.now(),
      finished: false
    };
    saveState();
    beginExamUI();
  }

  function resumeFullExam() {
    const saved = loadState();
    if (!saved) return startFullExam();
    state = saved;
    beginExamUI();
  }

  function startPractice(domainKey) {
    const questions = shuffle(QUESTION_BANK.filter(q => q.domain === domainKey)).map(q => ({ ...q }));
    state = {
      mode: "practice",
      domain: domainKey,
      questions,
      answers: new Array(questions.length).fill(null),
      flags: new Array(questions.length).fill(false),
      currentIndex: 0,
      secondsRemaining: null,
      startedAt: Date.now(),
      finished: false
    };
    document.getElementById("timer-display").classList.add("hidden");
    document.getElementById("btn-submit").classList.remove("hidden");
    renderQuestion();
    showScreen("screen-exam");
  }

  function beginExamUI() {
    document.getElementById("timer-display").classList.remove("hidden");
    startTimer();
    renderQuestion();
    showScreen("screen-exam");
  }

  // ---------- Timer ----------
  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      if (!state || state.mode !== "full" || state.finished) { stopTimer(); return; }
      state.secondsRemaining -= 1;
      if (state.secondsRemaining <= 0) {
        state.secondsRemaining = 0;
        updateTimerDisplay();
        stopTimer();
        finishExam();
        return;
      }
      updateTimerDisplay();
      if (state.secondsRemaining % 5 === 0) saveState();
    }, 1000);
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function updateTimerDisplay() {
    const el = document.getElementById("timer-value");
    el.textContent = formatTime(state.secondsRemaining);
    el.classList.toggle("low-time", state.secondsRemaining < 300);
  }

  // ---------- Rendering a question ----------
  function renderQuestion() {
    const q = state.questions[state.currentIndex];
    const total = state.questions.length;
    const i = state.currentIndex;

    document.getElementById("progress-fill").style.width = ((i + 1) / total * 100) + "%";
    document.getElementById("progress-text").textContent = `Question ${i + 1} of ${total}`;
    document.getElementById("domain-tag").textContent = DOMAINS[q.domain] ? DOMAINS[q.domain].name : q.domain;
    document.getElementById("question-text").textContent = q.question;

    const answered = state.answers[i];
    const isPractice = state.mode === "practice";
    const showFeedback = isPractice && answered !== null;

    const optsHtml = q.options.map((opt, idx) => {
      let cls = "option-row";
      if (showFeedback) {
        cls += " disabled";
        if (idx === q.correct) cls += " correct";
        else if (idx === answered) cls += " incorrect";
      } else if (answered === idx) {
        cls += " selected";
      }
      return `<div class="${cls}" data-idx="${idx}">
        <span class="option-letter">${letterFor(idx)}</span>
        <span class="option-body">${opt}</span>
      </div>`;
    }).join("");
    document.getElementById("options-list").innerHTML = optsHtml;

    document.querySelectorAll("#options-list .option-row").forEach(row => {
      row.addEventListener("click", () => selectOption(parseInt(row.dataset.idx, 10)));
    });

    const feedbackBlock = document.getElementById("feedback-block");
    if (showFeedback) {
      feedbackBlock.classList.remove("hidden");
      const correct = answered === q.correct;
      const verdict = document.getElementById("feedback-verdict");
      verdict.textContent = correct ? "CORRECT" : `INCORRECT — correct answer is ${letterFor(q.correct)}`;
      verdict.className = "feedback-verdict " + (correct ? "is-correct" : "is-incorrect");
      document.getElementById("feedback-explanation").textContent = q.explanation;
    } else {
      feedbackBlock.classList.add("hidden");
    }

    document.getElementById("btn-prev").disabled = i === 0;
    document.getElementById("btn-flag").textContent = state.flags[i] ? "Unflag" : "Flag for review";
    document.getElementById("btn-next").classList.toggle("hidden", i === total - 1);
    document.getElementById("btn-submit").classList.toggle("hidden", i !== total - 1 && state.mode === "full");

    renderJumpGrid();
  }

  function selectOption(idx) {
    const q = state.questions[state.currentIndex];
    const i = state.currentIndex;
    if (state.mode === "practice" && state.answers[i] !== null) return; // locked after answering in practice
    state.answers[i] = idx;
    saveState();
    renderQuestion();
  }

  function renderJumpGrid() {
    const grid = document.getElementById("jump-grid");
    grid.innerHTML = state.questions.map((q, idx) => {
      let cls = "jump-cell";
      if (state.answers[idx] !== null) cls += " answered";
      if (state.flags[idx]) cls += " flagged";
      if (idx === state.currentIndex) cls += " current";
      return `<div class="${cls}" data-idx="${idx}">${idx + 1}</div>`;
    }).join("");
    grid.querySelectorAll(".jump-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        state.currentIndex = parseInt(cell.dataset.idx, 10);
        saveState();
        renderQuestion();
      });
    });
  }

  // ---------- Scoring ----------
  function computeResults() {
    const total = state.questions.length;
    let correctCount = 0;
    const domainStats = {};
    DOMAIN_ORDER.forEach(k => { domainStats[k] = { correct: 0, total: 0 }; });

    state.questions.forEach((q, idx) => {
      const d = domainStats[q.domain] || (domainStats[q.domain] = { correct: 0, total: 0 });
      d.total += 1;
      if (state.answers[idx] === q.correct) {
        d.correct += 1;
        correctCount += 1;
      }
    });

    const pct = total > 0 ? correctCount / total : 0;
    const scaled = Math.round(100 + pct * 900);
    return { correctCount, total, pct, scaled, domainStats };
  }

  // ---------- Finishing ----------
  function finishExam() {
    state.finished = true;
    const results = computeResults();
    const pass = results.scaled >= PASS_SCORE;

    if (state.mode === "full") {
      clearState();
      saveHistory({
        date: new Date().toLocaleString(),
        mode: "full",
        score: results.scaled,
        pass
      });
    } else {
      saveHistory({
        date: new Date().toLocaleString(),
        mode: "practice",
        domain: state.domain,
        score: results.scaled,
        pass
      });
    }

    renderResults(results, pass);
    showScreen("screen-results");
  }

  function renderResults(results, pass) {
    document.getElementById("verdict-word").textContent = pass ? "PASS" : "FAIL";
    document.getElementById("verdict-word").className = "verdict-word " + (pass ? "pass" : "fail");
    document.getElementById("score-value").textContent = results.scaled;

    const domainResultsEl = document.getElementById("domain-results");
    domainResultsEl.innerHTML = DOMAIN_ORDER
      .filter(k => results.domainStats[k] && results.domainStats[k].total > 0)
      .map(k => {
        const d = results.domainStats[k];
        const pct = d.total ? Math.round((d.correct / d.total) * 100) : 0;
        const barCls = pct >= 70 ? "good" : "weak";
        return `<div class="dr-row">
          <span class="dr-name">${DOMAINS[k].name}</span>
          <div class="dr-bar-track"><div class="dr-bar-fill ${barCls}" style="width:${pct}%"></div></div>
          <span class="dr-score">${d.correct}/${d.total}</span>
        </div>`;
      }).join("");

    document.getElementById("review-panel").classList.add("hidden");
    document.getElementById("review-list").innerHTML = state.questions.map((q, idx) => {
      const answered = state.answers[idx];
      const correct = answered === q.correct;
      const verdictCls = answered === null ? "skipped" : (correct ? "correct" : "incorrect");
      const verdictLabel = answered === null ? "SKIPPED" : (correct ? "CORRECT" : "INCORRECT");
      const optsHtml = q.options.map((opt, oi) => {
        let cls = "review-opt";
        if (oi === q.correct) cls += " correct-answer";
        else if (oi === answered) cls += " your-answer";
        return `<div class="${cls}">${letterFor(oi)}. ${opt}${oi === q.correct ? "  ← correct" : (oi === answered ? "  ← your answer" : "")}</div>`;
      }).join("");
      return `<div class="review-item">
        <div class="review-item-head">
          <span class="review-item-num">Q${idx + 1} · ${DOMAINS[q.domain] ? DOMAINS[q.domain].name : q.domain}</span>
          <span class="review-item-verdict ${verdictCls}">${verdictLabel}</span>
        </div>
        <p class="review-q">${q.question}</p>
        ${optsHtml}
        <p class="review-explain">${q.explanation}</p>
      </div>`;
    }).join("");
  }

  // ---------- Event wiring ----------
  function wireEvents() {
    document.getElementById("btn-start-full").addEventListener("click", startFullExam);
    document.getElementById("btn-start-practice").addEventListener("click", () => {
      renderDomainSelect();
      showScreen("screen-domain-select");
    });
    document.getElementById("btn-resume").addEventListener("click", resumeFullExam);
    document.getElementById("btn-discard").addEventListener("click", () => {
      clearState();
      renderHome();
    });

    document.querySelectorAll("[data-back]").forEach(btn => {
      btn.addEventListener("click", () => showScreen(btn.dataset.back));
    });

    document.getElementById("btn-prev").addEventListener("click", () => {
      if (state.currentIndex > 0) { state.currentIndex--; saveState(); renderQuestion(); }
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      if (state.currentIndex < state.questions.length - 1) { state.currentIndex++; saveState(); renderQuestion(); }
    });
    document.getElementById("btn-flag").addEventListener("click", () => {
      state.flags[state.currentIndex] = !state.flags[state.currentIndex];
      saveState();
      renderQuestion();
    });
    document.getElementById("btn-submit").addEventListener("click", () => {
      if (state.mode === "full") {
        const unanswered = state.answers.filter(a => a === null).length;
        document.getElementById("confirm-copy").textContent = unanswered > 0
          ? `You have ${unanswered} unanswered question(s). Once submitted, the exam ends and cannot be resumed.`
          : "All questions answered. Once submitted, the exam ends and cannot be resumed.";
        showScreen("screen-confirm");
      } else {
        finishExam();
      }
    });
    document.getElementById("btn-confirm-submit").addEventListener("click", () => {
      stopTimer();
      finishExam();
    });
    document.getElementById("btn-confirm-back").addEventListener("click", () => showScreen("screen-exam"));

    document.getElementById("btn-jump-toggle").addEventListener("click", () => {
      document.getElementById("jump-grid").classList.toggle("hidden");
    });

    document.getElementById("btn-review").addEventListener("click", () => {
      document.getElementById("review-panel").classList.remove("hidden");
    });
    document.getElementById("btn-retake").addEventListener("click", () => {
      renderHome();
      showScreen("screen-home");
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    wireEvents();
    renderHome();
    showScreen("screen-home");
  });
})();
