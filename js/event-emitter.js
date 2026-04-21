/**
 * EventEmitter — Simple synchronous pub/sub for game events.
 * Events fire synchronously after state updates, before rendering.
 */
class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  /**
   * Subscribe to a named event.
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  /**
   * Unsubscribe from a named event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Emit a named event synchronously.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (!this._listeners[event]) return;
    for (const cb of this._listeners[event]) {
      try { cb(data); } catch (e) { console.error(`EventEmitter error in '${event}':`, e); }
    }
  }
}

// Expose globally
window.EventEmitter = EventEmitter;
