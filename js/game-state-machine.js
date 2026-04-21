/**
 * GameStateMachine — Enforces valid state transitions.
 * States: START, RESUME_PROMPT, QUESTION, ANIMATING, FEEDBACK, TRANSITION, PAUSED, COMPLETE
 */
class GameStateMachine {
  static VALID_TRANSITIONS = {
    START:         ['QUESTION', 'RESUME_PROMPT'],
    RESUME_PROMPT: ['QUESTION'],
    QUESTION:      ['ANIMATING', 'PAUSED'],
    ANIMATING:     ['FEEDBACK'],
    FEEDBACK:      ['TRANSITION'],
    TRANSITION:    ['QUESTION', 'COMPLETE'],
    PAUSED:        ['QUESTION'],
    COMPLETE:      ['START', 'QUESTION'],
  };

  /**
   * @param {EventEmitter} emitter
   */
  constructor(emitter) {
    this._state = 'START';
    this._emitter = emitter;
    this._callbacks = [];
  }

  get currentState() {
    return this._state;
  }

  /**
   * Check if a transition to the given state is valid.
   * @param {string} to
   * @returns {boolean}
   */
  canTransition(to) {
    const allowed = GameStateMachine.VALID_TRANSITIONS[this._state];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Attempt to transition to a new state.
   * @param {string} to
   * @returns {boolean} true if transition succeeded.
   */
  transition(to) {
    if (!this.canTransition(to)) return false;
    const from = this._state;
    this._state = to;
    const data = { from, to };
    // Fire registered callbacks synchronously
    for (const cb of this._callbacks) {
      try { cb(from, to); } catch (e) { console.error('State transition callback error:', e); }
    }
    // Fire via EventEmitter
    if (this._emitter) this._emitter.emit('onStateChange', data);
    return true;
  }

  /**
   * Register a callback for state transitions.
   * @param {Function} callback - (from, to) => void
   */
  onTransition(callback) {
    this._callbacks.push(callback);
  }

  /**
   * Reset to START state without firing events.
   */
  reset() {
    this._state = 'START';
  }
}

window.GameStateMachine = GameStateMachine;
