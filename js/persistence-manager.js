/**
 * PersistenceManager — localStorage read/write with namespace keys.
 * Pattern: keepClimbing_{gameId}_{playerName}_progress / _results
 */
class PersistenceManager {
  constructor(gameId, playerName) {
    this._gameId = gameId || 'default';
    this._playerName = playerName || 'anonymous';
    this._available = PersistenceManager._checkAvailable();
  }

  static _checkAvailable() {
    try {
      const k = '__kc_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  isAvailable() { return this._available; }

  _key(suffix) {
    return `keepClimbing_${this._gameId}_${this._playerName}_${suffix}`;
  }

  setPlayer(name) { this._playerName = name || 'anonymous'; }

  /**
   * Save current game progress.
   */
  saveProgress(progress) {
    if (!this._available) return;
    try {
      const data = { ...progress, gameId: this._gameId, playerName: this._playerName, timestamp: new Date().toISOString() };
      localStorage.setItem(this._key('progress'), JSON.stringify(data));
    } catch (e) { console.warn('PersistenceManager: failed to save progress', e); }
  }

  /**
   * Load saved progress, or null if none exists.
   */
  loadProgress() {
    if (!this._available) return null;
    try {
      const raw = localStorage.getItem(this._key('progress'));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /**
   * Save final game results.
   */
  saveResults(results) {
    if (!this._available) return;
    try {
      const data = { ...results, gameId: this._gameId, playerName: this._playerName, timestamp: new Date().toISOString() };
      localStorage.setItem(this._key('results'), JSON.stringify(data));
    } catch (e) { console.warn('PersistenceManager: failed to save results', e); }
  }

  loadResults() {
    if (!this._available) return null;
    try {
      const raw = localStorage.getItem(this._key('results'));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /**
   * Check if saved progress version matches current Question File version.
   */
  isVersionMatch(currentVersion) {
    const saved = this.loadProgress();
    if (!saved) return true; // No saved data, no mismatch
    if (!currentVersion || !saved.questionFileVersion) return true;
    return saved.questionFileVersion === currentVersion;
  }

  /**
   * Mark progress as abandoned (called on beforeunload).
   */
  markAbandoned(questionIndex) {
    const saved = this.loadProgress();
    if (saved) {
      saved.completionStatus = 'abandoned';
      saved.abandonedAtQuestion = questionIndex;
      this.saveProgress(saved);
    }
  }

  /**
   * Clear all data for this game instance.
   */
  clearData() {
    if (!this._available) return;
    try {
      localStorage.removeItem(this._key('progress'));
      localStorage.removeItem(this._key('results'));
    } catch (e) { /* ignore */ }
  }

  /**
   * Export results as a JSON string.
   */
  exportResultsJSON() {
    const results = this.loadResults();
    return results ? JSON.stringify(results, null, 2) : '{}';
  }

  /**
   * Copy a human-readable summary to clipboard.
   * @returns {string} The summary text.
   */
  copyResultsSummary() {
    const r = this.loadResults();
    if (!r) return '';
    const lines = [
      `Keep Climbing — Results`,
      `Game: ${r.gameId || 'N/A'}`,
      r.playerName ? `Player: ${r.playerName}` : '',
      `Score: ${r.totalScore}`,
      `Correct: ${r.correctCount} / ${r.totalQuestions} (${r.percentage}%)`,
      `Longest Streak: ${r.longestStreak}`,
      `Rating: ${r.performanceRating}`,
      `Time: ${r.totalTimeSeconds}s`,
      `Date: ${r.timestamp}`,
    ].filter(Boolean).join('\n');
    return lines;
  }
}

window.PersistenceManager = PersistenceManager;
