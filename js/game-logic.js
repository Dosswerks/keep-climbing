/**
 * GameLogic — Pure logic: scoring, streaks, progression, ratings.
 * No DOM or rendering dependencies.
 */
class GameLogic {
  constructor(totalQuestions, timeLimitPerQuestion) {
    this._total = totalQuestions;
    this._timeLimit = timeLimitPerQuestion;
    this.reset();
  }

  reset() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.multiplier = 1;
    this.longestStreak = 0;
    this.altitude = 0;
    this.answers = [];
    this._startTime = Date.now();
  }

  /**
   * Submit an answer for the current question.
   * @param {string|null} selectedAnswer - 'A','B','C','D' or null (timeout)
   * @param {string} correctAnswer - The correct answer label
   * @param {number} [timeSpent=0] - Seconds spent on this question
   * @param {string} [category] - Optional category
   * @returns {AnswerResult}
   */
  submitAnswer(selectedAnswer, correctAnswer, timeSpent = 0, category) {
    const correct = selectedAnswer === correctAnswer;
    const reason = selectedAnswer === null ? 'timeout' : (correct ? 'correct' : 'incorrect');

    if (correct) {
      this.streak++;
      if (this.streak > this.longestStreak) this.longestStreak = this.streak;
      this._updateMultiplier();
      this.altitude++;
    } else {
      this.streak = 0;
      this.multiplier = 1;
    }

    const pointsAwarded = correct ? this.calculateScore(true, timeSpent) : 0;
    this.score += pointsAwarded;

    const record = {
      questionIndex: this.currentQuestionIndex,
      category: category || null,
      selectedAnswer,
      correctAnswer,
      correct,
      reason,
      timeSpent,
      pointsAwarded,
    };
    this.answers.push(record);
    this.currentQuestionIndex++;

    return {
      correct,
      reason,
      correctAnswer,
      pointsAwarded,
      newScore: this.score,
      newStreak: this.streak,
      newMultiplier: this.multiplier,
    };
  }

  /**
   * Calculate points for a correct answer.
   * @param {boolean} correct
   * @param {number} [timeSpent=0]
   * @returns {number}
   */
  calculateScore(correct, timeSpent = 0) {
    if (!correct) return 0;
    let points = 100 * this.multiplier;
    // Time bonus when time limit is enabled
    if (this._timeLimit && this._timeLimit > 0 && timeSpent > 0) {
      const pct = timeSpent / this._timeLimit;
      if (pct < 0.25) points += 50;
      else if (pct < 0.5) points += 25;
    }
    return points;
  }

  _updateMultiplier() {
    if (this.streak >= 5) this.multiplier = 3;
    else if (this.streak >= 3) this.multiplier = 2;
    else this.multiplier = 1;
  }

  getMultiplier() {
    return this.multiplier;
  }

  /**
   * Get performance rating based on percentage correct.
   * @param {number} percentage - 0-100
   * @returns {string}
   */
  getPerformanceRating(percentage) {
    if (percentage >= 90) return 'Captain';
    if (percentage >= 70) return 'First Officer';
    return 'Cadet';
  }

  getProgress() {
    return {
      currentQuestionIndex: this.currentQuestionIndex,
      score: this.score,
      streak: this.streak,
      longestStreak: this.longestStreak,
      multiplier: this.multiplier,
      altitude: this.altitude,
      answers: [...this.answers],
    };
  }

  /**
   * Restore progress from saved state.
   */
  restoreProgress(progress) {
    this.currentQuestionIndex = progress.currentQuestionIndex || 0;
    this.score = progress.score || 0;
    this.streak = progress.streak || 0;
    this.longestStreak = progress.longestStreak || 0;
    this.multiplier = progress.multiplier || 1;
    this.altitude = progress.altitude || 0;
    this.answers = progress.answers ? [...progress.answers] : [];
  }

  /**
   * Get per-category accuracy breakdown.
   * @returns {CategoryResult[]}
   */
  getCategoryBreakdown() {
    const cats = {};
    for (const a of this.answers) {
      const cat = a.category || 'General';
      if (!cats[cat]) cats[cat] = { category: cat, total: 0, correct: 0 };
      cats[cat].total++;
      if (a.correct) cats[cat].correct++;
    }
    return Object.values(cats).map(c => ({
      ...c,
      percentage: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
    }));
  }

  /**
   * Get indices of incorrectly answered questions (for Retry Missed).
   * @returns {number[]}
   */
  getMissedQuestions() {
    return this.answers.filter(a => !a.correct).map(a => a.questionIndex);
  }

  getTotalTime() {
    return Math.round((Date.now() - this._startTime) / 1000);
  }
}

window.GameLogic = GameLogic;
