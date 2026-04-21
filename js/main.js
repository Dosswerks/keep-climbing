/**
 * main.js — Bootstrap, game loop, and orchestration.
 * Wires all managers together and drives the FSM through the full game flow.
 */
(function () {
  'use strict';

  // --- Manager instances ---
  const emitter = new EventEmitter();
  const configMgr = new ConfigManager();
  const questionLoader = new QuestionLoader();
  const fsm = new GameStateMachine(emitter);
  let gameLogic = null;
  let persistence = null;
  const audioMgr = new AudioManager();
  const animMgr = new AnimationManager();
  const renderer = new Renderer();
  const inputMgr = new InputManager();
  const a11y = new AccessibilityManager();
  const i18n = new I18nManager();

  let config = {};
  let playerName = '';
  let questionFilePath = 'sample-questions.json';
  let currentQuestion = null;
  let questionStartTime = 0;
  let feedbackTimer = null;
  let transitionTimer = null;
  let timerInterval = null;
  let pausedOverlayType = null; // 'pause' or 'help'
  let fullSessionAnswers = null; // preserved across retries
  let fullSessionQuestions = null; // preserved across retries

  // --- Public API ---
  window.KeepClimbing = {
    init(path) {
      questionFilePath = path || questionFilePath;
      return bootstrap();
    },
    on(event, cb) { emitter.on(event, cb); },
    off(event, cb) { emitter.off(event, cb); },
  };

  // --- Bootstrap ---
  async function bootstrap() {
    // Load language file
    await i18n.load('lang/en.json');

    // Init accessibility
    a11y.init();
    const reducedMotion = a11y.prefersReducedMotion();
    animMgr.setReducedMotion(reducedMotion);
    renderer.setReducedMotion(reducedMotion);

    // Load question file
    let qData;
    try {
      qData = await questionLoader.load(questionFilePath);
    } catch (e) {
      showError(e.message);
      return;
    }

    // Load config
    config = configMgr.load(qData.config);
    renderer.init(document.getElementById('game-container'));
    renderer.setConfig(config);
    renderer._onZoneHover = () => {
      if (fsm.currentState === 'QUESTION') audioMgr.playSFX('select');
    };

    // Set animation speed
    animMgr.setSpeedMultiplier(config.animationSpeed);

    // Timer bar visibility
    if (!config.timeLimitPerQuestion) renderer.hideTimerBar();
    else renderer.showTimerBar();

    // Init audio
    await audioMgr.init(config);
    audioMgr.registerSFX('correct', 'assets/audio/correct.mp3');
    audioMgr.registerSFX('incorrect', 'assets/audio/incorrect.mp3');
    audioMgr.registerSFX('celebration', 'assets/audio/celebration.mp3');
    audioMgr.registerSFX('jetoff', 'assets/audio/jetoff.mp3');
    audioMgr.registerSFX('select', 'assets/audio/select.mp3', 0.15);
    audioMgr.registerSFX('question', 'assets/audio/question.mp3');
    audioMgr.registerBackground('assets/audio/music.mp3');

    // Init persistence
    const gameId = qData.game_id || 'default';
    persistence = new PersistenceManager(gameId, 'anonymous');

    // Init game logic
    gameLogic = new GameLogic(questionLoader.getTotalCount(), config.timeLimitPerQuestion);

    // Init input
    inputMgr.init(
      document.getElementById('sky-canvas'),
      document.getElementById('answer-zones')
    );
    inputMgr.onAction(handleAction);

    // Wire up UI buttons
    wireButtons();

    // Start animation loop
    animMgr.onFrame((dt) => renderer.renderSky(dt));
    animMgr.start();

    // Show start screen
    renderer.renderStartScreen(config);
    renderer.renderHUD(0, 0, 1, 1, questionLoader.getTotalCount());
    renderer.renderAltitudeMeter(0, questionLoader.getTotalCount());

    // Check localStorage availability
    if (!persistence.isAvailable()) {
      a11y.showCaption(i18n.t('progressNotSaved'), 3000);
    }

    // Abandonment detection
    window.addEventListener('beforeunload', () => {
      if (['QUESTION', 'ANIMATING', 'FEEDBACK', 'TRANSITION'].includes(fsm.currentState)) {
        persistence.markAbandoned(gameLogic.currentQuestionIndex);
      }
    });

    emitter.emit('onGameReady', { questionCount: questionLoader.getTotalCount() });
  }

  // --- Button wiring ---
  function wireButtons() {
    document.getElementById('btn-start').addEventListener('click', startGame);
    // Prevent name input keystrokes from bubbling to game controls
    const nameInput = document.getElementById('name-input');
    nameInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); startGame(); }
    });
    document.getElementById('btn-mute').addEventListener('click', toggleMute);
    document.getElementById('btn-help').addEventListener('click', () => handleAction({ type: 'HELP' }));
    document.getElementById('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); handleAction({ type: 'PAUSE' }); });
    document.getElementById('btn-unpause').addEventListener('click', () => handleAction({ type: 'RESUME' }));
    document.getElementById('btn-close-help').addEventListener('click', () => handleAction({ type: 'RESUME' }));
    document.getElementById('btn-resume').addEventListener('click', resumeGame);
    document.getElementById('btn-start-over').addEventListener('click', startOver);
  }

  // --- Game flow ---
  function startGame() {
    audioMgr.unlockAudioContext();

    // Check player name
    if (config.requirePlayerName) {
      const nameEl = document.getElementById('name-input');
      playerName = (nameEl.value || '').trim();
      if (!playerName) { nameEl.focus(); return; }
      persistence.setPlayer(playerName);
    }

    // Check for saved progress
    const qData = questionLoader.getRaw();
    const version = qData ? qData.version : null;
    if (!persistence.isVersionMatch(version)) {
      persistence.clearData();
      a11y.showCaption(i18n.t('versionMismatch'), 3000);
    }

    const saved = persistence.loadProgress();
    if (saved && saved.currentQuestionIndex > 0 && saved.completionStatus !== 'finished') {
      renderer.showResumePrompt();
      fsm.transition('RESUME_PROMPT');
      return;
    }

    beginGame();
  }

  function resumeGame() {
    const saved = persistence.loadProgress();
    if (saved) {
      gameLogic.restoreProgress(saved);
    }
    questionLoader.shuffle(config.shuffle_questions);
    renderer.hideResumePrompt();
    fsm.transition('QUESTION');
    showQuestion();
    audioMgr.playBackground();
    emitter.emit('onGameStart', { resumed: true });
  }

  function startOver() {
    persistence.clearData();
    renderer.hideResumePrompt();
    beginGame();
  }

  function beginGame() {
    gameLogic.reset();
    fullSessionAnswers = null;
    fullSessionQuestions = null;
    fsm.reset(); // Ensure FSM is in START state
    questionLoader.shuffle(config.shuffle_questions);
    renderer.hideAllOverlays();
    renderer.hideNextButton();
    fsm.transition('QUESTION');
    showQuestion();
    audioMgr.playBackground();
    emitter.emit('onGameStart', { resumed: false });
  }

  function showQuestion() {
    const q = questionLoader.getQuestion(gameLogic.currentQuestionIndex);
    if (!q) {
      completeGame();
      return;
    }
    currentQuestion = q;
    questionStartTime = Date.now();
    renderer.renderQuestion(q);
    audioMgr.playSFX('question');
    renderer.renderHUD(gameLogic.score, gameLogic.streak, gameLogic.multiplier,
      gameLogic.currentQuestionIndex + 1, questionLoader.getTotalCount());
    renderer.renderAltitudeMeter(gameLogic.altitude, questionLoader.getTotalCount());
    renderer.resetPlane();
    inputMgr.enable();
    // Don't auto-highlight any zone — wait for player input
    a11y.updateAltitude(gameLogic.altitude, questionLoader.getTotalCount());

    // Timer
    if (config.timeLimitPerQuestion) {
      startTimer();
    }

    emitter.emit('onQuestionLoad', {
      questionIndex: gameLogic.currentQuestionIndex,
      category: q.category || null,
    });
  }

  function startTimer() {
    clearInterval(timerInterval);
    const limit = config.timeLimitPerQuestion * 1000;
    const start = Date.now();
    renderer.renderTimerBar(1);
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / limit);
      renderer.renderTimerBar(remaining);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        submitAnswer(null); // timeout
      }
    }, 100);
  }

  // --- Answer handling ---
  function submitAnswer(answer) {
    if (fsm.currentState !== 'QUESTION') return;
    inputMgr.disable();
    clearInterval(timerInterval);

    const timeSpent = (Date.now() - questionStartTime) / 1000;
    const result = gameLogic.submitAnswer(answer, currentQuestion.correctAnswer, timeSpent, currentQuestion.category);

    // Transition to ANIMATING
    fsm.transition('ANIMATING');

    emitter.emit('onAnswerSelected', {
      questionIndex: gameLogic.currentQuestionIndex - 1,
      selectedAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      correct: result.correct,
    });

    emitter.emit('onScoreUpdate', {
      score: result.newScore,
      streak: result.newStreak,
      multiplier: result.newMultiplier,
    });

    if (result.correct) {
      emitter.emit('onAltitudeChange', { altitude: gameLogic.altitude });
    }

    // Show feedback immediately alongside the animation
    const selectedAnswer = answer;
    renderer.renderFeedback(
      { correct: result.correct, correctAnswer: currentQuestion.correctAnswer, selectedAnswer },
      currentQuestion.explanation,
      config.showExplanations
    );

    // Determine the X position of the selected answer zone
    const answerX = getAnswerZoneNormalizedX(answer);
    const currentX = renderer._planeX;

    // Animate — plane moves to the answer column, then soars up (correct) or descends (incorrect)
    if (result.correct) {
      audioMgr.playSFX('correct');
      audioMgr.playSFX('jetoff');
      animMgr.queueAnimation({
        duration: 2,
        update(p) {
          const x = currentX + (answerX - currentX) * Math.min(p * 3, 1);
          renderer.setPlanePosition(x, 0.7 - p * 0.65);
          renderer.setPlaneScale(1 - p * 0.7);
          renderer._planeOpacity = 1 - p;
        },
        onComplete() { enterFeedback(result); },
      });
    } else {
      audioMgr.playSFX('incorrect');
      animMgr.queueAnimation({
        duration: 1.5,
        update(p) {
          const x = currentX + (answerX - currentX) * Math.min(p * 3, 1);
          renderer.setPlanePosition(x, 0.7 + p * 0.22);
          renderer.setPlaneScale(1 + p * 0.05);
        },
        onComplete() { enterFeedback(result); },
      });
    }
  }

  function enterFeedback(result) {
    if (fsm.currentState === 'PAUSED') return;
    fsm.transition('FEEDBACK');
    renderer.renderHUD(gameLogic.score, gameLogic.streak, gameLogic.multiplier,
      gameLogic.currentQuestionIndex, questionLoader.getTotalCount());
    renderer.renderAltitudeMeter(gameLogic.altitude, questionLoader.getTotalCount());

    // Save progress
    const progress = gameLogic.getProgress();
    progress.questionFileVersion = questionLoader.getRaw()?.version;
    progress.completionStatus = 'in_progress';
    persistence.saveProgress(progress);

    // Show advance button — "See Results" on final question, "NEXT QUESTION" otherwise
    const isLastQuestion = gameLogic.currentQuestionIndex >= questionLoader.getTotalCount();
    renderer.showNextButton(() => {
      renderer.hideNextButton();
      enterTransition();
    }, isLastQuestion ? 'SEE RESULTS \u2605' : 'NEXT QUESTION \u25B6');
  }

  function enterTransition() {
    if (fsm.currentState === 'PAUSED') return;
    fsm.transition('TRANSITION');
    renderer.resetPlane();

    // Instant transition — everything updates at once
    if (gameLogic.currentQuestionIndex >= questionLoader.getTotalCount()) {
      completeGame();
    } else {
      fsm.transition('QUESTION');
      showQuestion();
    }
  }

  function completeGame() {
    fsm.transition('COMPLETE');
    audioMgr.stopBackground();
    audioMgr.playSFX('celebration');

    // On first completion, snapshot the full session for review across retries
    if (!fullSessionAnswers) {
      fullSessionAnswers = [...gameLogic.answers];
      fullSessionQuestions = [];
      for (let i = 0; i < questionLoader.getTotalCount(); i++) {
        fullSessionQuestions.push(questionLoader.getQuestion(i));
      }
    } else {
      // Merge retry results back into full session — update answers for retried questions
      for (const retryAnswer of gameLogic.answers) {
        const q = questionLoader.getQuestion(retryAnswer.questionIndex);
        if (!q) continue;
        // Find matching question in full session by question text
        const fullIdx = fullSessionQuestions.findIndex(fq => fq && fq.question === q.question);
        if (fullIdx >= 0) {
          // Replace the answer record for this question
          const existingIdx = fullSessionAnswers.findIndex(a => a.questionIndex === fullIdx);
          if (existingIdx >= 0) {
            fullSessionAnswers[existingIdx] = { ...retryAnswer, questionIndex: fullIdx };
          }
        }
      }
    }

    const total = fullSessionQuestions.length;
    const correctCount = fullSessionAnswers.filter(a => a.correct).length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const rating = gameLogic.getPerformanceRating(percentage);
    const missedCount = fullSessionAnswers.filter(a => !a.correct).length;

    const results = {
      gameId: questionLoader.getRaw()?.game_id || 'default',
      playerName: playerName || 'anonymous',
      questionFileVersion: questionLoader.getRaw()?.version,
      totalScore: gameLogic.score,
      totalQuestions: total,
      correctCount,
      percentage,
      longestStreak: gameLogic.longestStreak,
      performanceRating: rating,
      totalTimeSeconds: gameLogic.getTotalTime(),
      completionStatus: 'finished',
      categoryBreakdown: getCategoryBreakdownFromAnswers(fullSessionAnswers, fullSessionQuestions),
      answers: fullSessionAnswers,
      missedCount,
      timestamp: new Date().toISOString(),
    };

    persistence.saveResults(results);
    // Clear in-progress data
    persistence.clearData();
    persistence.saveResults(results);

    renderer.renderCompletionScreen(results, i18n);
    wireCompletionButtons(results);

    emitter.emit('onGameComplete', results);
  }

  function wireCompletionButtons(results) {
    const playAgain = document.getElementById('btn-play-again');
    if (playAgain) playAgain.addEventListener('click', () => {
      fsm.transition('START');
      renderer.renderStartScreen(config);
      startGame();
    });

    const retry = document.getElementById('btn-retry-missed');
    if (retry) retry.addEventListener('click', () => retryMissed());

    const review = document.getElementById('btn-review');
    if (review) review.addEventListener('click', () => {
      renderer.renderReviewScreen(fullSessionAnswers || gameLogic.answers, fullSessionQuestions || []);
      wireReviewBack();
    });

    const download = document.getElementById('btn-download');
    if (download) download.addEventListener('click', () => {
      const json = persistence.exportResultsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keep-climbing-results-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const copy = document.getElementById('btn-copy');
    if (copy) copy.addEventListener('click', () => {
      const summary = persistence.copyResultsSummary();
      navigator.clipboard.writeText(summary).then(() => {
        a11y.showCaption('Results copied!', 1500);
      }).catch(() => {
        a11y.showCaption('Copy failed', 1500);
      });
    });

    const clear = document.getElementById('btn-clear-data');
    if (clear) clear.addEventListener('click', () => {
      persistence.clearData();
      a11y.showCaption(i18n.t('dataCleared'), 2000);
    });
  }

  function wireReviewBack() {
    const back = document.getElementById('btn-back-results');
    if (back) back.addEventListener('click', () => {
      renderer.renderCompletionScreen({
        totalScore: gameLogic.score,
        totalQuestions: questionLoader.getTotalCount(),
        correctCount: gameLogic.answers.filter(a => a.correct).length,
        percentage: Math.round((gameLogic.answers.filter(a => a.correct).length / questionLoader.getTotalCount()) * 100),
        longestStreak: gameLogic.longestStreak,
        performanceRating: gameLogic.getPerformanceRating(Math.round((gameLogic.answers.filter(a => a.correct).length / questionLoader.getTotalCount()) * 100)),
        totalTimeSeconds: gameLogic.getTotalTime(),
        categoryBreakdown: gameLogic.getCategoryBreakdown(),
        missedCount: gameLogic.getMissedQuestions().length,
      }, i18n);
      wireCompletionButtons({});
    });
  }

  function retryMissed() {
    const missed = fullSessionAnswers ? fullSessionAnswers.filter(a => !a.correct).map(a => a.questionIndex) : gameLogic.getMissedQuestions();
    if (missed.length === 0) return;
    // Get the missed questions from the full session
    const missedQuestions = missed.map(i => fullSessionQuestions ? fullSessionQuestions[i] : questionLoader.getQuestion(i)).filter(Boolean);
    questionLoader._questions = missedQuestions.map((q, i) => ({ ...q, _originalIndex: i }));
    questionLoader.shuffle(true);
    // Reset game logic for the subset
    gameLogic = new GameLogic(missedQuestions.length, config.timeLimitPerQuestion);
    renderer.hideAllOverlays();
    fsm.transition('QUESTION');
    showQuestion();
    audioMgr.playBackground();
  }

  function getAnswerZoneNormalizedX(answer) {
    const labels = ['A', 'B', 'C', 'D'];
    const idx = labels.indexOf(answer);
    if (idx < 0) return 0.5;
    const zones = document.querySelectorAll('.answer-zone');
    if (idx >= zones.length) return 0.5;
    const canvasRect = document.getElementById('sky-canvas').getBoundingClientRect();
    const zoneRect = zones[idx].getBoundingClientRect();
    return (zoneRect.left + zoneRect.width / 2 - canvasRect.left) / canvasRect.width;
  }

  function getCategoryBreakdownFromAnswers(answers, questions) {
    const cats = {};
    for (const a of answers) {
      const q = questions[a.questionIndex];
      const cat = (q && q.category) || a.category || 'General';
      if (!cats[cat]) cats[cat] = { category: cat, total: 0, correct: 0 };
      cats[cat].total++;
      if (a.correct) cats[cat].correct++;
    }
    return Object.values(cats).map(c => ({
      ...c,
      percentage: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
    }));
  }

  // --- Action handler ---
  function handleAction(action) {
    switch (action.type) {
      case 'SELECT_ANSWER':
        if (fsm.currentState === 'QUESTION') {
          submitAnswer(action.answer);
        } else if (fsm.currentState === 'FEEDBACK') {
          // Enter key during feedback advances to next question
          const nextBtn = document.getElementById('btn-next-question');
          if (nextBtn && nextBtn.onclick) nextBtn.onclick();
        }
        break;

      case 'DRAG_MOVE':
        if (fsm.currentState === 'QUESTION') {
          // Map screen X to normalized plane X
          const rect = document.getElementById('sky-canvas').getBoundingClientRect();
          const nx = (action.x - rect.left) / rect.width;
          renderer.setPlanePosition(Math.max(0.1, Math.min(0.9, nx)), 0.7);
        }
        break;

      case 'DRAG_END':
        if (fsm.currentState === 'QUESTION') {
          // Check which answer zone the plane overlaps
          const zones = document.querySelectorAll('.answer-zone');
          const labels = ['A', 'B', 'C', 'D'];
          const canvasRect = document.getElementById('sky-canvas').getBoundingClientRect();
          const planeScreenX = canvasRect.left + renderer._planeX * canvasRect.width;
          const planeW = 40; // approximate plane width in screen pixels

          let selected = null;
          for (let i = 0; i < zones.length; i++) {
            const zr = zones[i].getBoundingClientRect();
            const overlap = Math.min(planeScreenX + planeW / 2, zr.right) - Math.max(planeScreenX - planeW / 2, zr.left);
            if (overlap >= planeW * 0.5) {
              selected = labels[i];
              break;
            }
          }

          if (selected) {
            submitAnswer(selected);
          } else {
            // Snap back
            renderer.resetPlane();
          }
        }
        break;

      case 'PAUSE':
        if (fsm.currentState === 'QUESTION') {
          fsm.transition('PAUSED');
          pausedOverlayType = 'pause';
          renderer.showPauseOverlay();
          inputMgr.disable();
          animMgr.stop();
          audioMgr.pauseBackground();
          clearInterval(timerInterval);
          clearTimeout(feedbackTimer);
          clearTimeout(transitionTimer);
          emitter.emit('onGamePause', {});
        } else if (fsm.currentState === 'PAUSED' && pausedOverlayType === 'help') {
          // Swap to pause overlay
          renderer.hideHelpOverlay();
          renderer.showPauseOverlay();
          pausedOverlayType = 'pause';
        }
        break;

      case 'HELP':
        if (fsm.currentState === 'QUESTION') {
          fsm.transition('PAUSED');
          pausedOverlayType = 'help';
          renderer.showHelpOverlay();
          inputMgr.disable();
          animMgr.stop();
          audioMgr.pauseBackground();
          clearInterval(timerInterval);
          clearTimeout(feedbackTimer);
          clearTimeout(transitionTimer);
          emitter.emit('onGamePause', {});
        } else if (fsm.currentState === 'PAUSED' && pausedOverlayType === 'pause') {
          // Swap to help overlay
          renderer.hidePauseOverlay();
          renderer.showHelpOverlay();
          pausedOverlayType = 'help';
        }
        break;

      case 'RESUME':
        if (fsm.currentState === 'PAUSED') {
          fsm.transition('QUESTION');
          renderer.hidePauseOverlay();
          renderer.hideHelpOverlay();
          pausedOverlayType = null;
          inputMgr.enable();
          animMgr.start();
          audioMgr.resumeBackground();
          emitter.emit('onGameResume', {});
        }
        break;

      case 'START':
        if (fsm.currentState === 'START') {
          startGame();
        }
        break;

      case 'MUTE_TOGGLE':
        toggleMute();
        break;

      case 'NAVIGATE':
        // Handled by InputManager focus cycling
        break;
    }
  }

  function toggleMute() {
    const muted = !audioMgr.isMuted();
    audioMgr.setMuted(muted);
    renderer.updateMuteButton(muted);
  }

  function showError(msg) {
    const container = document.getElementById('game-container');
    container.innerHTML = `<div class="overlay"><h1>Error</h1><p>${msg}</p><button class="btn" onclick="location.reload()">Restart</button></div>`;
  }

  // Auto-init if question file path is in URL params
  const params = new URLSearchParams(window.location.search);
  questionFilePath = params.get('q') || 'sample-questions.json';
  bootstrap().catch(err => {
    console.error('Bootstrap failed:', err);
    const container = document.getElementById('game-container');
    if (container) container.innerHTML = `<div class="overlay"><h1>Error</h1><p>${err.message}</p><button class="btn" onclick="location.reload()">Restart</button></div>`;
  });

})();
