/**
 * ConfigManager — Loads config from Question File, validates types/ranges,
 * applies defaults for missing or invalid fields.
 */
class ConfigManager {
  static DEFAULTS = {
    title: 'Keep Climbing',
    subtitle: '',
    logo: '',
    primaryColor: '#003366',
    backgroundColor: '#87CEEB',
    planeSprite: '',
    audioEnabled: true,
    timeLimitPerQuestion: null,
    shuffle_questions: true,
    animationSpeed: 1.0,
    showExplanations: true,
    showCategoryBreakdown: true,
    locale: '',
    requirePlayerName: false,
    instructionText: 'Steer the plane to the correct answer. Correct answers climb higher!',
  };

  constructor() {
    this.config = { ...ConfigManager.DEFAULTS };
  }

  /**
   * Load and validate config from a Question File's config object.
   * @param {object} raw - The config object from the Question File (may be undefined).
   * @returns {object} Validated config with defaults applied.
   */
  load(raw) {
    if (!raw || typeof raw !== 'object') {
      this.config = { ...ConfigManager.DEFAULTS };
      return this.config;
    }

    const c = { ...ConfigManager.DEFAULTS };

    if (typeof raw.title === 'string' && raw.title.length > 0) c.title = raw.title;
    if (typeof raw.subtitle === 'string') c.subtitle = raw.subtitle;
    if (typeof raw.logo === 'string') c.logo = raw.logo;
    if (typeof raw.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.primaryColor)) c.primaryColor = raw.primaryColor;
    if (typeof raw.backgroundColor === 'string' && raw.backgroundColor.length > 0) c.backgroundColor = raw.backgroundColor;
    if (typeof raw.planeSprite === 'string') c.planeSprite = raw.planeSprite;
    if (typeof raw.audioEnabled === 'boolean') c.audioEnabled = raw.audioEnabled;

    if (raw.timeLimitPerQuestion === null || (typeof raw.timeLimitPerQuestion === 'number' && raw.timeLimitPerQuestion >= 1)) {
      c.timeLimitPerQuestion = raw.timeLimitPerQuestion;
    }
    if (typeof raw.shuffle_questions === 'boolean') c.shuffle_questions = raw.shuffle_questions;
    if (typeof raw.animationSpeed === 'number' && raw.animationSpeed >= 0.5 && raw.animationSpeed <= 2.0) {
      c.animationSpeed = raw.animationSpeed;
    }
    if (typeof raw.showExplanations === 'boolean') c.showExplanations = raw.showExplanations;
    if (typeof raw.showCategoryBreakdown === 'boolean') c.showCategoryBreakdown = raw.showCategoryBreakdown;
    if (typeof raw.locale === 'string') c.locale = raw.locale;
    if (typeof raw.requirePlayerName === 'boolean') c.requirePlayerName = raw.requirePlayerName;
    if (typeof raw.instructionText === 'string' && raw.instructionText.length > 0) c.instructionText = raw.instructionText;

    this.config = c;
    return this.config;
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }
}

window.ConfigManager = ConfigManager;
