/**
 * InputManager — Normalizes mouse, touch, keyboard into GameAction types.
 * Handles tap vs drag, keyboard navigation, enable/disable per state.
 */
class InputManager {
  constructor() {
    this._enabled = false;
    this._callbacks = [];
    this._focusedZone = 0; // 0=A, 1=B, 2=C, 3=D
    this._dragging = false;
    this._dragStart = null;
    this._dragThresholdPx = 10;
    this._dragThresholdMs = 200;
    this._bound = {};
  }

  init(canvas, answerContainer) {
    this._canvas = canvas;
    this._answerContainer = answerContainer;
    this._zones = document.querySelectorAll('.answer-zone');

    // Keyboard
    this._bound.keydown = (e) => this._onKeyDown(e);
    document.addEventListener('keydown', this._bound.keydown);

    // Mouse/touch on canvas for plane dragging
    this._bound.pointerdown = (e) => this._onPointerDown(e);
    this._bound.pointermove = (e) => this._onPointerMove(e);
    this._bound.pointerup = (e) => this._onPointerUp(e);
    canvas.addEventListener('pointerdown', this._bound.pointerdown);
    canvas.addEventListener('pointermove', this._bound.pointermove);
    canvas.addEventListener('pointerup', this._bound.pointerup);
    canvas.addEventListener('pointercancel', this._bound.pointerup);

    // Click on answer zones
    this._zones.forEach((z, i) => {
      z.addEventListener('click', () => {
        if (!this._enabled) return;
        const labels = ['A', 'B', 'C', 'D'];
        this._emit({ type: 'SELECT_ANSWER', answer: labels[i] });
      });
    });
  }

  enable() { this._enabled = true; }
  disable() { this._enabled = false; }

  onAction(callback) { this._callbacks.push(callback); }

  _emit(action) {
    for (const cb of this._callbacks) {
      try { cb(action); } catch (e) { console.error('InputManager callback error:', e); }
    }
  }

  _onKeyDown(e) {
    // Don't intercept keys when a text input has focus
    const active = document.activeElement;
    if (active && active.id === 'name-input') return;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    if (!this._enabled) {
      // Allow start/resume keys
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._emit({ type: 'START' });
      }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._focusedZone = (this._focusedZone + 3) % 4; // wrap left
        this._highlightFocused();
        this._emit({ type: 'NAVIGATE', direction: 'left' });
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._focusedZone = (this._focusedZone + 1) % 4; // wrap right
        this._highlightFocused();
        this._emit({ type: 'NAVIGATE', direction: 'right' });
        break;
      case 'Enter':
        e.preventDefault();
        const labels = ['A', 'B', 'C', 'D'];
        this._emit({ type: 'SELECT_ANSWER', answer: labels[this._focusedZone] });
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        this._emit({ type: 'PAUSE' });
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        this._emit({ type: 'HELP' });
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        this._emit({ type: 'MUTE_TOGGLE' });
        break;
      case 'Escape':
        e.preventDefault();
        this._emit({ type: 'RESUME' });
        break;
    }
  }

  _highlightFocused() {
    this._zones.forEach((z, i) => {
      if (i === this._focusedZone) z.focus();
    });
  }

  resetFocus() {
    this._focusedZone = 0;
    this._highlightFocused();
  }

  _onPointerDown(e) {
    if (!this._enabled) return;
    this._dragging = true;
    this._dragStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    this._emit({ type: 'DRAG_START', x: e.clientX, y: e.clientY });
  }

  _onPointerMove(e) {
    if (!this._enabled || !this._dragging) return;
    this._emit({ type: 'DRAG_MOVE', x: e.clientX, y: e.clientY });
  }

  _onPointerUp(e) {
    if (!this._dragging) return;
    this._dragging = false;
    if (!this._enabled) return;

    const dx = e.clientX - this._dragStart.x;
    const dy = e.clientY - this._dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - this._dragStart.time;

    if (dist < this._dragThresholdPx && elapsed < this._dragThresholdMs) {
      // Tap — check if over an answer zone
      this._checkTapOnZone(e.clientX, e.clientY);
    } else {
      // Drag end — check overlap with answer zones
      this._emit({ type: 'DRAG_END', x: e.clientX, y: e.clientY });
    }
  }

  _checkTapOnZone(x, y) {
    const labels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < this._zones.length; i++) {
      const rect = this._zones[i].getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        this._emit({ type: 'SELECT_ANSWER', answer: labels[i] });
        return;
      }
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._bound.keydown);
    if (this._canvas) {
      this._canvas.removeEventListener('pointerdown', this._bound.pointerdown);
      this._canvas.removeEventListener('pointermove', this._bound.pointermove);
      this._canvas.removeEventListener('pointerup', this._bound.pointerup);
    }
  }
}

window.InputManager = InputManager;
