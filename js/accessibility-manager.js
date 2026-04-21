/**
 * AccessibilityManager — ARIA live regions, focus management,
 * text captions for audio feedback, reduced motion coordination.
 */
class AccessibilityManager {
  constructor() {
    this._captionEl = null;
    this._captionTimeout = null;
  }

  init() {
    this._captionEl = document.getElementById('feedback-caption');
    // Detect prefers-reduced-motion
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this._reducedMotion = e.matches;
    });
  }

  prefersReducedMotion() {
    return this._reducedMotion;
  }

  /**
   * Show a text caption (for audio feedback accessibility).
   * @param {string} text
   * @param {number} [duration=2000] ms
   */
  showCaption(text, duration = 2000) {
    if (!this._captionEl) return;
    this._captionEl.textContent = text;
    this._captionEl.classList.add('visible');
    clearTimeout(this._captionTimeout);
    this._captionTimeout = setTimeout(() => {
      this._captionEl.classList.remove('visible');
    }, duration);
  }

  hideCaption() {
    if (!this._captionEl) return;
    this._captionEl.classList.remove('visible');
    clearTimeout(this._captionTimeout);
  }

  /**
   * Set focus to a specific answer zone.
   * @param {string} answer - 'A','B','C','D'
   */
  focusAnswerZone(answer) {
    const el = document.querySelector(`.answer-zone[data-answer="${answer}"]`);
    if (el) el.focus();
  }

  /**
   * Update ARIA attributes on the altitude meter.
   */
  updateAltitude(current, total) {
    const meter = document.getElementById('altitude-meter');
    if (meter) {
      meter.setAttribute('aria-valuenow', current);
      meter.setAttribute('aria-valuemax', total);
      meter.setAttribute('aria-label', `Altitude: ${current} of ${total}`);
    }
  }
}

window.AccessibilityManager = AccessibilityManager;
