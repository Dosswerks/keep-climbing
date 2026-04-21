/**
 * AnimationManager — requestAnimationFrame loop, animation queue,
 * speed multiplier, reduced-motion fallbacks.
 */
class AnimationManager {
  constructor() {
    this._running = false;
    this._rafId = null;
    this._lastTime = 0;
    this._frameCallbacks = [];
    this._queue = [];
    this._speedMultiplier = 1.0;
    this._reducedMotion = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _tick() {
    if (!this._running) return;
    const now = performance.now();
    const dt = (now - this._lastTime) / 1000; // seconds
    this._lastTime = now;

    // Process animation queue
    for (let i = this._queue.length - 1; i >= 0; i--) {
      const anim = this._queue[i];
      anim.elapsed += dt * this._speedMultiplier;
      const progress = Math.min(anim.elapsed / anim.duration, 1);
      try {
        anim.update(progress);
      } catch (e) {
        console.error('Animation error, skipping to end:', e);
        try { anim.update(1); } catch (_) {}
      }
      if (progress >= 1) {
        this._queue.splice(i, 1);
        if (anim.onComplete) {
          try { anim.onComplete(); } catch (e) { console.error('Animation onComplete error:', e); }
        }
      }
    }

    // Frame callbacks
    for (const cb of this._frameCallbacks) {
      try { cb(dt); } catch (e) { console.error('Frame callback error:', e); }
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  /**
   * Queue an animation.
   * @param {object} animation - { duration (seconds), update(progress), onComplete() }
   */
  queueAnimation(animation) {
    if (this._reducedMotion) {
      // Reduced motion: skip to end immediately
      try { animation.update(1); } catch (e) {}
      if (animation.onComplete) {
        setTimeout(() => animation.onComplete(), 50);
      }
      return;
    }
    animation.elapsed = 0;
    animation.duration = animation.duration / this._speedMultiplier;
    this._queue.push(animation);
  }

  setSpeedMultiplier(speed) {
    this._speedMultiplier = Math.max(0.5, Math.min(2.0, speed));
  }

  setReducedMotion(enabled) {
    this._reducedMotion = enabled;
  }

  isReducedMotion() { return this._reducedMotion; }

  /**
   * Register a per-frame callback.
   * @param {Function} callback - (deltaTime) => void
   */
  onFrame(callback) {
    this._frameCallbacks.push(callback);
  }

  /**
   * Remove a per-frame callback.
   */
  offFrame(callback) {
    this._frameCallbacks = this._frameCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Check if any animations are currently running.
   */
  isAnimating() {
    return this._queue.length > 0;
  }

  clearQueue() {
    // Complete all queued animations immediately
    for (const anim of this._queue) {
      try { anim.update(1); } catch (e) {}
      if (anim.onComplete) {
        try { anim.onComplete(); } catch (e) {}
      }
    }
    this._queue = [];
  }
}

window.AnimationManager = AnimationManager;
