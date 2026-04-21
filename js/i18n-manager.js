/**
 * I18nManager — Loads language resource files, provides string lookup
 * with English fallback, RTL detection, and locale formatting.
 */
class I18nManager {
  constructor() {
    this._strings = {};
    this._rtl = false;
    this._locale = 'en';
  }

  /**
   * Load a language resource file.
   * @param {string} path - URL to the JSON language file.
   */
  async load(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to load language file: ${res.status}`);
      const data = await res.json();
      this._strings = data.strings || {};
      this._rtl = !!data.rtl;
      this._locale = data.locale || 'en';
    } catch (e) {
      console.warn('I18nManager: failed to load language file, using defaults', e);
    }
  }

  /**
   * Get a localized string by key, with optional placeholder replacement.
   * @param {string} key
   * @param {object} [params] - e.g. { current: 3, total: 10 }
   * @returns {string}
   */
  t(key, params) {
    let str = this._strings[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return str;
  }

  isRTL() { return this._rtl; }
  getLocale() { return this._locale; }
}

window.I18nManager = I18nManager;
