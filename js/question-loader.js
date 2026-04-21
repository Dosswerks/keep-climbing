/**
 * QuestionLoader — Fetches, validates, and shuffles Question Files.
 * Answer zone labels (A,B,C,D) stay fixed; only text content is shuffled.
 */
class QuestionLoader {
  constructor() {
    this._questions = [];
    this._shuffledOrder = [];
    this._raw = null;
  }

  /**
   * Fetch and validate a Question File.
   * @param {string} path - URL/path to the JSON file.
   * @returns {Promise<object>} The parsed Question File.
   */
  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load question file: ${res.status}`);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Question file contains malformed JSON.');
    }
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid question file: ${validation.errors.join('; ')}`);
    }
    this._raw = data;
    this._questions = data.questions.map((q, i) => ({ ...q, _originalIndex: i }));
    return data;
  }

  /**
   * Validate a Question File object.
   * @param {*} data
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object') { errors.push('Question file must be a JSON object'); return { valid: false, errors }; }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      errors.push('Question file must contain a non-empty "questions" array');
      return { valid: false, errors };
    }
    if (data.questions.length > 100) errors.push('Question file exceeds 100 question limit');

    const labels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const prefix = `Question ${i + 1}`;
      if (!q.question || typeof q.question !== 'string' || q.question.length < 10 || q.question.length > 200) {
        errors.push(`${prefix}: question text must be 10-200 characters`);
      }
      if (!q.options || typeof q.options !== 'object') {
        errors.push(`${prefix}: missing options object`);
      } else {
        for (const l of labels) {
          if (typeof q.options[l] !== 'string' || q.options[l].length < 1 || q.options[l].length > 80) {
            errors.push(`${prefix}: option ${l} must be 1-80 characters`);
          }
        }
      }
      if (!labels.includes(q.correctAnswer)) {
        errors.push(`${prefix}: correctAnswer must be A, B, C, or D`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Shuffle questions (respecting difficulty tiers if present) and answer positions.
   * @param {boolean} shuffleQuestions - Whether to shuffle question order.
   */
  shuffle(shuffleQuestions) {
    if (shuffleQuestions) {
      const hasDifficulty = this._questions.some(q => q.difficulty);
      if (hasDifficulty) {
        const tiers = { easy: [], medium: [], hard: [], other: [] };
        for (const q of this._questions) {
          const d = q.difficulty || 'other';
          (tiers[d] || tiers.other).push(q);
        }
        for (const k of Object.keys(tiers)) QuestionLoader._shuffleArray(tiers[k]);
        this._questions = [...tiers.easy, ...tiers.medium, ...tiers.hard, ...tiers.other];
      } else {
        QuestionLoader._shuffleArray(this._questions);
      }
    }
    // Shuffle answer positions for each question
    const labels = ['A', 'B', 'C', 'D'];
    for (const q of this._questions) {
      const entries = labels.map(l => ({ label: l, text: q.options[l] }));
      QuestionLoader._shuffleArray(entries);
      const newOptions = {};
      let newCorrect = q.correctAnswer;
      for (let i = 0; i < 4; i++) {
        newOptions[labels[i]] = entries[i].text;
        if (entries[i].label === q.correctAnswer) newCorrect = labels[i];
      }
      q.options = newOptions;
      q.correctAnswer = newCorrect;
    }
    this._shuffledOrder = this._questions.map(q => q._originalIndex);
  }

  getQuestion(index) {
    return this._questions[index] || null;
  }

  getTotalCount() {
    return this._questions.length;
  }

  getShuffledOrder() {
    return [...this._shuffledOrder];
  }

  getRaw() {
    return this._raw;
  }

  /**
   * Get a subset of questions by original indices (for Retry Missed).
   * @param {number[]} indices - Original question indices.
   * @returns {object[]}
   */
  getSubset(indices) {
    const set = new Set(indices);
    return this._questions.filter(q => set.has(q._originalIndex));
  }

  static _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

window.QuestionLoader = QuestionLoader;
