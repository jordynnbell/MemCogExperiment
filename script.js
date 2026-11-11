(() => {
  "use strict";

  const WORD_LISTS = [
    ["apple", "hammer", "river", "candle", "bicycle", "rabbit"],
    ["garden", "pencil", "ocean", "guitar", "window", "turtle"],
    ["coffee", "ladder", "forest", "button", "lemon", "sailboat"]
  ];

  const STRATEGIES = [
    {
      id: "maintenance_rehearsal",
      name: "Maintenance rehearsal",
      instruction: "As each word appears, repeat it silently to yourself several times. Focus on keeping the word active in your mind. Do not create a personal connection or a mental picture deliberately."
    },
    {
      id: "self_reference",
      name: "Self-reference",
      instruction: "As each word appears, think about how it relates to you personally. For example, consider whether you own it, use it, have seen it, or associate it with a memory. Make a brief connection to your own life."
    },
    {
      id: "mental_imagery",
      name: "Mental imagery",
      instruction: "As each word appears, create a vivid mental image of it. Imagine its shape, color, texture, and setting. Try to picture the object clearly in your mind."
    }
  ];

  const WORD_DURATION_MS = 4000;
  const DISTRACTOR_SECONDS = 30;
  const $ = (id) => document.getElementById(id);
  const sections = ["welcome", "instructions", "study", "transition", "distractor", "recall", "results"];
  let session = null;
  let currentBlock = 0;
  let currentWord = 0;
  let studyTimeout = null;
  let distractorInterval = null;
  let distractorSecondsLeft = DISTRACTOR_SECONDS;
  let startingNumber = null;

  function showSection(id) {
    sections.forEach(section => $(section).classList.toggle("hidden", section !== id));
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startSession() {
    const strategies = shuffle(STRATEGIES);
    const lists = shuffle(WORD_LISTS);
    const now = new Date();
    session = {
      session_id: `MEM-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7)}`,
      started_at: now.toISOString(),
      blocks: strategies.map((strategy, index) => ({
        strategy,
        words: shuffle(lists[index]).map((word, wordIndex) => ({
          word, word_order: wordIndex + 1, recalled: false, matched_response: ""
        }))
      })),
      distractor_start: null,
      distractor_responses: "",
      recall_text: "",
      completed_at: null
    };
    currentBlock = 0;
    currentWord = 0;
    showInstructions();
  }

  function showInstructions() {
    const block = session.blocks[currentBlock];
    $("block-counter").textContent = `BLOCK ${currentBlock + 1} OF 3`;
    $("strategy-title").textContent = block.strategy.name;
    $("strategy-description").textContent = block.strategy.instruction;
    showSection("instructions");
  }

  function startBlock() {
    currentWord = 0;
    showSection("study");
    presentWord();
  }

  function presentWord() {
    const block = session.blocks[currentBlock];
    if (currentWord >= block.words.length) {
      clearTimeout(studyTimeout);
      $("transition-copy").textContent = currentBlock < 2
        ? `You have finished the ${block.strategy.name} block. Take a brief breath before the next block.`
        : "You have finished all three study blocks. Next is a 30-second counting task.";
      showSection("transition");
      return;
    }
    const trial = block.words[currentWord];
    $("study-progress").textContent = `Word ${currentWord + 1} of 6`;
    $("study-strategy").textContent = block.strategy.name;
    $("study-progress-bar").style.width = `${(currentWord / 6) * 100}%`;
    $("study-word").textContent = trial.word;
    studyTimeout = setTimeout(() => {
      currentWord++;
      $("study-progress-bar").style.width = `${(currentWord / 6) * 100}%`;
      presentWord();
    }, WORD_DURATION_MS);
  }

  function beginDistractor() {
    startingNumber = Math.floor(Math.random() * 900) + 100;
    $("starting-number").textContent = startingNumber;
    $("counting-input").value = "";
    $("counting-input").disabled = false;
    $("distractor-timer").textContent = DISTRACTOR_SECONDS;
    distractorSecondsLeft = DISTRACTOR_SECONDS;
    session.distractor_start = startingNumber;
    $("start-distractor-btn").disabled = true;
    $("start-distractor-btn").textContent = "Task in progress…";
    $("counting-input").focus();
    distractorInterval = setInterval(() => {
      distractorSecondsLeft--;
      $("distractor-timer").textContent = distractorSecondsLeft;
      if (distractorSecondsLeft <= 0) {
        clearInterval(distractorInterval);
        session.distractor_responses = $("counting-input").value.trim();
        $("counting-input").disabled = true;
        showSection("recall");
        $("recall-input").focus();
      }
    }, 1000);
  }

  function normalize(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  }

  function splitResponses(text) {
    return text.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
  }

  function typoMatches(response, target) {
    const a = normalize(response), b = normalize(target);
    if (!a || !b) return false;
    if (a === b) return true;
    // A conservative spelling tolerance: one edit for short words, up to two for longer words.
    const allowed = b.length >= 8 ? 2 : 1;
    return Math.abs(a.length - b.length) <= allowed && levenshtein(a, b) <= allowed;
  }

  function scoreRecall() {
    const responses = splitResponses($("recall-input").value);
    const usedResponseIndices = new Set();
    const allTrials = [];

    session.blocks.forEach(block => {
      block.words.forEach(trial => {
        let matchedIndex = -1;
        for (let i = 0; i < responses.length; i++) {
          if (!usedResponseIndices.has(i) && typoMatches(responses[i], trial.word)) {
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex >= 0) {
          trial.recalled = true;
          trial.matched_response = responses[matchedIndex];
          usedResponseIndices.add(matchedIndex);
        }
        allTrials.push({
          word: trial.word,
          strategy: block.strategy.name,
          strategy_id: block.strategy.id,
          word_order: trial.word_order,
          recalled: trial.recalled,
          matched_response: trial.matched_response
        });
      });
    });

    session.recall_text = $("recall-input").value;
    session.completed_at = new Date().toISOString();
    renderResults(allTrials, responses.length);
  }

  function renderResults(trials, responseCount) {
    const scores = session.blocks.map(block => {
      const recalled = block.words.filter(word => word.recalled).length;
      return { name: block.strategy.name, recalled, total: block.words.length, percent: Math.round(recalled / 6 * 100) };
    });
    const total = trials.filter(trial => trial.recalled).length;
    $("session-meta").textContent = `Session ${session.session_id} · Completed ${new Date(session.completed_at).toLocaleString()}`;
    $("score-cards").innerHTML = scores.map(score => `
      <div class="score-card">
        <h3>${escapeHtml(score.name)}</h3>
        <div class="score-value">${score.recalled}/6</div>
        <p>${score.percent}% recalled</p>
      </div>`).join("");
    $("overall-score").textContent = `Overall recall: ${total} of 18 words (${Math.round(total / 18 * 100)}%). ${responseCount} response item(s) entered.`;
    $("results-rows").innerHTML = trials.map(trial => `
      <tr>
        <td>${escapeHtml(trial.word)}</td>
        <td>${escapeHtml(trial.strategy)}</td>
        <td>${trial.recalled ? "Yes" : "No"}</td>
        <td>${escapeHtml(trial.matched_response || "—")}</td>
      </tr>`).join("");
    showSection("results");
    session.trials = trials;
    session.scores = scores;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, headers, rows) {
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSummary() {
    const headers = [
      "session_id", "started_at", "completed_at",
      "maintenance_rehearsal_recalled", "maintenance_rehearsal_total",
      "self_reference_recalled", "self_reference_total",
      "mental_imagery_recalled", "mental_imagery_total",
      "overall_recalled", "overall_total", "distractor_start_number",
      "distractor_responses", "recall_responses"
    ];
    const scoreById = Object.fromEntries(session.blocks.map(block => [
      block.strategy.id, block.words.filter(word => word.recalled).length
    ]));
    const row = [
      session.session_id, session.started_at, session.completed_at,
      scoreById.maintenance_rehearsal, 6,
      scoreById.self_reference, 6,
      scoreById.mental_imagery, 6,
      session.trials.filter(trial => trial.recalled).length, 18,
      session.distractor_start, session.distractor_responses, session.recall_text
    ];
    downloadCsv("memory_encoding_summary.csv", headers, [row]);
  }

  function downloadTrials() {
    const headers = [
      "session_id", "started_at", "completed_at", "trial_number",
      "strategy", "strategy_id", "word_order_within_block",
      "studied_word", "recalled", "matched_response"
    ];
    const rows = session.trials.map((trial, index) => [
      session.session_id, session.started_at, session.completed_at, index + 1,
      trial.strategy, trial.strategy_id, trial.word_order,
      trial.word, trial.recalled, trial.matched_response
    ]);
    downloadCsv("memory_encoding_trial_level.csv", headers, rows);
  }

  $("begin-btn").addEventListener("click", startSession);
  $("start-block-btn").addEventListener("click", startBlock);
  $("next-block-btn").addEventListener("click", () => {
    if (currentBlock < 2) {
      currentBlock++;
      showInstructions();
    } else {
      $("start-distractor-btn").disabled = false;
      $("start-distractor-btn").textContent = "Start 30-second task";
      showSection("distractor");
      // Select the number before the task starts so it is visible to the participant.
      startingNumber = Math.floor(Math.random() * 900) + 100;
      $("starting-number").textContent = startingNumber;
      session.distractor_start = startingNumber;
    }
  });
  $("start-distractor-btn").addEventListener("click", beginDistractor);
  $("submit-recall-btn").addEventListener("click", () => {
    if (!$("recall-input").value.trim()) {
      if (!window.confirm("You have not entered any words. Submit an empty recall response?")) return;
    }
    scoreRecall();
  });
  $("summary-download-btn").addEventListener("click", downloadSummary);
  $("trials-download-btn").addEventListener("click", downloadTrials);
  $("restart-btn").addEventListener("click", () => {
    if (studyTimeout) clearTimeout(studyTimeout);
    if (distractorInterval) clearInterval(distractorInterval);
    $("counting-input").disabled = false;
    $("recall-input").value = "";
    startSession();
  });
})();
