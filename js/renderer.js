/**
 * Renderer — Canvas sky region + DOM UI region.
 * Handles all visual updates driven by game state.
 */
class Renderer {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._w = 0;
    this._h = 0;
    this._clouds = [];
    this._planeX = 0.5; // normalized 0-1
    this._planeY = 0.7; // normalized 0-1
    this._planeScale = 1.0;
    this._planeImg = null;
    this._planeOpacity = 1.0;
    this._bgColor = '#87CEEB';
    this._primaryColor = '#003366';
    this._reducedMotion = false;
    this._cloudOffset = 0;
    this._highlightedZoneIndex = -1; // which answer zone the plane is over
    this._showGhostLetters = true; // hide after answer submitted
    this._hintText = ''; // instruction text drawn in sky
    this._prevPlaneX = 0.5; // for tilt based on movement direction
    this._highlightingEnabled = false; // don't highlight until player moves
    this._onZoneHover = null; // callback when highlight changes
  }

  init(container) {
    this._canvas = document.getElementById('sky-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    // Generate clouds
    for (let i = 0; i < 8; i++) {
      this._clouds.push({
        x: Math.random(),
        y: Math.random() * 0.7,
        w: 60 + Math.random() * 80,
        h: 20 + Math.random() * 20,
        speed: 0.01 + Math.random() * 0.02,
      });
    }
  }

  _resize() {
    const rect = this._canvas.parentElement.getBoundingClientRect();
    this._w = rect.width;
    this._h = rect.height;
    this._canvas.width = this._w * (window.devicePixelRatio || 1);
    this._canvas.height = this._h * (window.devicePixelRatio || 1);
    this._ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  }

  setConfig(config) {
    this._bgColor = config.backgroundColor || '#87CEEB';
    this._primaryColor = config.primaryColor || '#003366';
    document.documentElement.style.setProperty('--primary', this._primaryColor);
    document.documentElement.style.setProperty('--bg-sky', this._bgColor);
    // Load custom plane sprite if provided
    if (config.planeSprite) {
      const img = new Image();
      img.onload = () => { this._planeImg = img; };
      img.src = config.planeSprite;
    }
  }

  setReducedMotion(enabled) {
    this._reducedMotion = enabled;
  }

  /**
   * Render the sky canvas — background, clouds, plane.
   * Called every frame.
   */
  renderSky(dt) {
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;
    if (!w || !h) return;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4a90d9');
    grad.addColorStop(0.5, this._bgColor);
    grad.addColorStop(1, '#b8d8f8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Clouds — drift downward to simulate climbing
    if (!this._reducedMotion) {
      this._cloudOffset += (dt || 0.016) * 30;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const c of this._clouds) {
      const cx = c.x * w;
      let cy = (this._reducedMotion ? c.y * h : ((c.y * h + this._cloudOffset * c.speed * 60) % (h + c.h * 2)) - c.h);
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + c.w * 0.3, cy - c.h * 0.3, c.w * 0.35, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - c.w * 0.25, cy + c.h * 0.1, c.w * 0.3, c.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sky road — perspective path from plane toward highlighted sky letter
    if (this._highlightingEnabled && this._highlightedZoneIndex >= 0 && this._showGhostLetters) {
      this._drawSkyRoad(ctx, w, h);
    }

    // Ghost letters A B C D in sky above plane, aligned with answer zones
    if (this._showGhostLetters) this._drawGhostLetters(ctx, w, h);

    // Hint text in sky region
    if (this._hintText) {
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(this._hintText, w / 2, h * 0.92);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Plane
    this._drawPlane(ctx, w, h);

    // Update answer zone highlights based on plane position
    this._updateZoneHighlight();
  }

  _drawGhostLetters(ctx, w, h) {
    const labels = ['A', 'B', 'C', 'D'];
    const zones = document.querySelectorAll('.answer-zone');
    if (zones.length < 4) return;
    const canvasRect = this._canvas.getBoundingClientRect();
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Position centered between toolbar (~50px) and plane position
    const skyLetterY = (50 + this._planeY * h) / 2;
    for (let i = 0; i < 4; i++) {
      const zoneRect = zones[i].getBoundingClientRect();
      const zoneCenterX = (zoneRect.left + zoneRect.width / 2 - canvasRect.left) / canvasRect.width * w;
      // White glow when this zone is highlighted
      if (i === this._highlightedZoneIndex) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffcc00';
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,204,0,0.6)';
      }
      ctx.fillText(labels[i], zoneCenterX, skyLetterY);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawSkyRoad(ctx, w, h) {
    const zones = document.querySelectorAll('.answer-zone');
    if (this._highlightedZoneIndex < 0 || this._highlightedZoneIndex >= zones.length) return;
    const canvasRect = this._canvas.getBoundingClientRect();
    const zoneRect = zones[this._highlightedZoneIndex].getBoundingClientRect();
    const targetX = (zoneRect.left + zoneRect.width / 2 - canvasRect.left) / canvasRect.width * w;
    const skyLetterY = (50 + this._planeY * h) / 2;
    const planeX = this._planeX * w;
    const planeY = this._planeY * h + 20;

    // Perspective trapezoid from plane to sky letter
    const roadWidthBottom = 30;
    const roadWidthTop = 8;
    ctx.fillStyle = 'rgba(200,30,30,0.35)';
    ctx.beginPath();
    ctx.moveTo(planeX - roadWidthBottom, planeY);
    ctx.lineTo(targetX - roadWidthTop, skyLetterY + 20);
    ctx.lineTo(targetX + roadWidthTop, skyLetterY + 20);
    ctx.lineTo(planeX + roadWidthBottom, planeY);
    ctx.closePath();
    ctx.fill();
  }

  _updateZoneHighlight() {
    if (!this._highlightingEnabled) return;
    const zones = document.querySelectorAll('.answer-zone');
    if (zones.length < 4) return;
    const canvasRect = this._canvas.getBoundingClientRect();
    const planeScreenX = canvasRect.left + this._planeX * canvasRect.width;
    const planeW = 120; // approximate plane width matching new wider sprite
    let newHighlight = -1;
    for (let i = 0; i < zones.length; i++) {
      const zr = zones[i].getBoundingClientRect();
      const zoneCenterX = zr.left + zr.width / 2;
      if (Math.abs(planeScreenX - zoneCenterX) < zr.width * 0.6) {
        newHighlight = i;
        break;
      }
    }
    if (newHighlight !== this._highlightedZoneIndex) {
      zones.forEach((z, i) => {
        if (i === newHighlight) z.classList.add('drag-hover');
        else z.classList.remove('drag-hover');
      });
      this._highlightedZoneIndex = newHighlight;
      if (newHighlight >= 0 && this._onZoneHover) this._onZoneHover(newHighlight);
    }
  }

  clearZoneHighlights() {
    document.querySelectorAll('.answer-zone').forEach(z => z.classList.remove('drag-hover'));
    this._highlightedZoneIndex = -1;
  }

  showNextButton(callback, label) {
    const btn = document.getElementById('btn-next-question');
    btn.textContent = label || 'NEXT QUESTION \u25B6';
    btn.classList.remove('hidden');
    btn.onclick = () => { btn.onclick = null; callback(); };
  }

  hideNextButton() {
    const btn = document.getElementById('btn-next-question');
    btn.classList.add('hidden');
    btn.onclick = null;
  }

  _drawPlane(ctx, w, h) {
    if (this._planeOpacity <= 0) return;
    const px = this._planeX * w;
    const py = this._planeY * h;
    const scale = this._planeScale;

    // Tilt based on movement direction, not absolute position
    const dx = this._planeX - this._prevPlaneX;
    const tilt = Math.max(-0.5, Math.min(0.5, dx * 15));
    this._prevPlaneX = this._planeX;

    ctx.save();
    ctx.globalAlpha = this._planeOpacity;
    ctx.translate(px, py);
    ctx.rotate(tilt);

    if (this._planeImg) {
      const imgW = 160 * scale;
      const imgH = 80 * scale;
      ctx.drawImage(this._planeImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
      return;
    }

    // Fallback drawn plane
    const wingSpan = 80 * scale;
    const bodyLen = 40 * scale;

    // Fuselage — wider, flatter
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 0.35, bodyLen * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings — wide span
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.2, bodyLen * 0.05);
    ctx.lineTo(-wingSpan, bodyLen * 0.25);
    ctx.lineTo(-wingSpan * 0.85, bodyLen * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.2, bodyLen * 0.05);
    ctx.lineTo(wingSpan, bodyLen * 0.25);
    ctx.lineTo(wingSpan * 0.85, bodyLen * 0.08);
    ctx.closePath();
    ctx.fill();

    // Tail
    ctx.fillStyle = this._primaryColor;
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.1, -bodyLen * 0.55);
    ctx.lineTo(0, -bodyLen * 0.8);
    ctx.lineTo(bodyLen * 0.1, -bodyLen * 0.55);
    ctx.closePath();
    ctx.fill();

    // Engines under wings
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.ellipse(-wingSpan * 0.5, bodyLen * 0.18, bodyLen * 0.08, bodyLen * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wingSpan * 0.5, bodyLen * 0.18, bodyLen * 0.08, bodyLen * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit windows
    ctx.fillStyle = '#6ab0e8';
    ctx.beginPath();
    ctx.ellipse(0, -bodyLen * 0.4, bodyLen * 0.14, bodyLen * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Set plane position (normalized 0-1).
   */
  setPlanePosition(x, y) {
    this._planeX = x;
    this._planeY = y;
    this._highlightingEnabled = true;
  }

  setPlaneScale(s) {
    this._planeScale = s;
  }

  resetPlane() {
    this._planeX = 0.5;
    this._planeY = 0.7;
    this._planeScale = 1.0;
    this._planeOpacity = 1.0;
    this._highlightingEnabled = false;
    this._prevPlaneX = 0.5;
  }

  // --- DOM UI Methods ---

  renderStartScreen(config) {
    const title = document.getElementById('start-title');
    const subtitle = document.getElementById('start-subtitle');
    const logo = document.getElementById('start-logo');
    const instructions = document.getElementById('start-instructions');
    const nameInput = document.getElementById('name-input');

    if (title) title.textContent = config.title || 'Keep Climbing';
    if (subtitle) subtitle.textContent = config.subtitle || '';
    if (config.logo) {
      logo.src = config.logo;
      logo.classList.remove('hidden');
      // Hide redundant title text when logo is present
      if (title) title.style.display = 'none';
    }
    if (config.instructionText) instructions.innerHTML = config.instructionText.replace(/\.\s+/g, '.<br>');
    else instructions.innerHTML = 'Steer the plane to the correct answer.<br>Correct answers climb higher!';
    if (config.requirePlayerName) nameInput.classList.remove('hidden');
    else nameInput.classList.add('hidden');

    this._showOverlay('start-screen');
  }

  renderQuestion(question, highlightedZone) {
    document.getElementById('question-text').textContent = question.question;
    const zones = document.querySelectorAll('.answer-zone');
    const labels = ['A', 'B', 'C', 'D'];
    zones.forEach((z, i) => {
      const label = labels[i];
      z.querySelector('.zone-text').textContent = question.options[label];
      z.className = 'answer-zone';
      z.removeAttribute('disabled');
      // Don't highlight any zone on load — wait for player input
      z.setAttribute('aria-label', `${label}: ${question.options[label]}`);
    });
    // Show instruction hint in the HUD bar
    const hudFb = document.getElementById('hud-feedback');
    hudFb.className = 'hud-item hud-hint';
    hudFb.textContent = 'Steer the plane to the correct answer';
    // Hide sky caption
    const caption = document.getElementById('feedback-caption');
    caption.className = 'hidden';
    caption.textContent = '';
    // Hide quiz-region explanation box
    const expBox = document.getElementById('explanation-box');
    expBox.className = 'hidden';
    expBox.textContent = '';
    this._showGhostLetters = true;
    this.clearZoneHighlights();
    this.hideNextButton();
  }

  renderHUD(score, streak, multiplier, questionNum, total) {
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-question').textContent = `${questionNum} / ${total}`;
  }

  renderAltitudeMeter(level, total) {
    const pct = total > 0 ? (level / total) * 100 : 0;
    document.getElementById('altitude-fill').style.height = pct + '%';
    document.getElementById('altitude-label').textContent = `${level}/${total}`;
  }

  renderFeedback(result, explanation, showExplanations) {
    const zones = document.querySelectorAll('.answer-zone');
    const labels = ['A', 'B', 'C', 'D'];
    zones.forEach((z, i) => {
      const label = labels[i];
      if (result.correct && label === result.correctAnswer) {
        z.classList.add('correct');
      } else if (!result.correct) {
        if (label === result.correctAnswer) z.classList.add('correct');
        if (label === result.selectedAnswer) z.classList.add('incorrect');
        if (label !== result.correctAnswer && label !== result.selectedAnswer) z.classList.add('dimmed');
      } else {
        z.classList.add('dimmed');
      }
      z.setAttribute('disabled', 'true');
    });

    // Feedback in HUD bar
    const hudFb = document.getElementById('hud-feedback');
    if (result.correct) {
      hudFb.className = 'hud-item hud-correct';
      hudFb.textContent = 'Correct \u2014 climbing higher!';
    } else {
      hudFb.className = 'hud-item hud-incorrect';
      hudFb.textContent = 'Incorrect \u2014 the answer was ' + result.correctAnswer;
    }

    // Hide sky caption
    const caption = document.getElementById('feedback-caption');
    caption.className = 'hidden';
    caption.textContent = '';

    // Explanation in quiz region if available
    const expBox = document.getElementById('explanation-box');
    if (showExplanations && explanation) {
      expBox.className = 'feedback-explanation';
      expBox.textContent = explanation;
    } else {
      expBox.className = 'hidden';
      expBox.textContent = '';
    }

    // Clear drag highlights, hide ghost letters
    this.clearZoneHighlights();
    this._showGhostLetters = false;
    this._hintText = '';
  }

  renderTimerBar(pct) {
    document.getElementById('timer-fill').style.width = (pct * 100) + '%';
  }

  hideTimerBar() {
    document.getElementById('timer-bar').style.display = 'none';
  }

  showTimerBar() {
    document.getElementById('timer-bar').style.display = '';
  }

  renderCompletionScreen(results, i18n) {
    const screen = document.getElementById('complete-screen');
    document.getElementById('final-score').textContent = results.totalScore;
    document.getElementById('final-rating').textContent = 'Your rank is: ' + results.performanceRating;

    const stats = document.getElementById('final-stats');
    stats.innerHTML = `
      <div class="stat-item"><div class="stat-value">${results.correctCount}/${results.totalQuestions}</div><div class="stat-label">Correct</div></div>
      <div class="stat-item"><div class="stat-value">${results.percentage}%</div><div class="stat-label">Accuracy</div></div>
      <div class="stat-item"><div class="stat-value">${results.longestStreak}</div><div class="stat-label">Best Streak</div></div>
      <div class="stat-item"><div class="stat-value">${results.totalTimeSeconds}s</div><div class="stat-label">Time</div></div>
    `;

    // Category breakdown
    const catDiv = document.getElementById('category-breakdown');
    catDiv.innerHTML = '';
    if (results.categoryBreakdown && results.categoryBreakdown.length > 0) {
      for (const cat of results.categoryBreakdown) {
        catDiv.innerHTML += `<div class="category-row"><span>${cat.category}</span><span>${cat.correct}/${cat.total} (${cat.percentage}%)</span></div>`;
      }
    }

    // Buttons
    const btns = document.getElementById('complete-buttons');
    btns.innerHTML = '';
    const playAgain = document.createElement('button');
    playAgain.className = 'btn btn-primary';
    playAgain.id = 'btn-play-again';
    playAgain.textContent = i18n ? i18n.t('playAgain') : 'Play Again';
    btns.appendChild(playAgain);

    if (results.missedCount > 0) {
      const retry = document.createElement('button');
      retry.className = 'btn';
      retry.id = 'btn-retry-missed';
      retry.textContent = i18n ? i18n.t('retryMissed') : 'Retry Missed';
      btns.appendChild(retry);
    }

    const review = document.createElement('button');
    review.className = 'btn';
    review.id = 'btn-review';
    review.textContent = i18n ? i18n.t('reviewAnswers') : 'Review Answers';
    btns.appendChild(review);

    const download = document.createElement('button');
    download.className = 'btn';
    download.id = 'btn-download';
    download.textContent = i18n ? i18n.t('downloadResults') : 'Download Results';
    btns.appendChild(download);

    const copy = document.createElement('button');
    copy.className = 'btn';
    copy.id = 'btn-copy';
    copy.textContent = i18n ? i18n.t('copyResults') : 'Copy Results';
    btns.appendChild(copy);

    const clear = document.createElement('button');
    clear.className = 'btn';
    clear.id = 'btn-clear-data';
    clear.textContent = i18n ? i18n.t('clearData') : 'Clear My Data';
    btns.appendChild(clear);

    this._showOverlay('complete-screen');
  }

  renderReviewScreen(answers, questions) {
    const screen = document.getElementById('review-screen');
    let html = '<h2>Review Answers</h2>';
    for (const a of answers) {
      const q = questions[a.questionIndex];
      if (!q) continue;
      const cls = a.correct ? 'review-correct' : 'review-incorrect';
      html += `<div class="review-item ${cls}">
        <div class="review-question">${a.questionIndex + 1}. ${q.question}</div>
        <div class="review-answer">Your answer: ${a.selectedAnswer || 'No answer'} — ${a.selectedAnswer ? q.options[a.selectedAnswer] : ''}</div>
        <div class="review-answer">Correct: ${a.correctAnswer} — ${q.options[a.correctAnswer]}</div>
        ${q.explanation ? `<div class="review-answer" style="opacity:0.7;margin-top:4px">${q.explanation}</div>` : ''}
      </div>`;
    }
    html += '<div class="btn-group"><button class="btn btn-primary" id="btn-back-results">Back to Results</button></div>';
    screen.innerHTML = html;
    this._showOverlay('review-screen');
  }

  renderLoadingProgress(percent) {
    const bar = document.getElementById('loading-bar');
    const fill = document.getElementById('loading-fill');
    bar.classList.remove('hidden');
    fill.style.width = percent + '%';
  }

  hideLoading() {
    document.getElementById('loading-bar').classList.add('hidden');
  }

  // Overlay management
  _showOverlay(id) {
    const overlays = document.querySelectorAll('.overlay');
    overlays.forEach(o => o.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }

  hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
  }

  showPauseOverlay() { this._showOverlay('pause-screen'); }
  hidePauseOverlay() { document.getElementById('pause-screen').classList.add('hidden'); }
  showHelpOverlay() { this._showOverlay('help-screen'); }
  hideHelpOverlay() { document.getElementById('help-screen').classList.add('hidden'); }
  showResumePrompt() { this._showOverlay('resume-screen'); }
  hideResumePrompt() { document.getElementById('resume-screen').classList.add('hidden'); }

  /**
   * Update mute button icon.
   */
  updateMuteButton(muted) {
    const btn = document.getElementById('btn-mute');
    if (btn) {
      btn.innerHTML = muted ? '&#x1F507;' : '&#x1F50A;';
      btn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    }
  }
}

window.Renderer = Renderer;
