/**
 * AudioManager — Background music loop, SFX, mute state, browser autoplay compliance.
 * Lazy-loads audio; graceful failure (continues without audio).
 */
class AudioManager {
  constructor() {
    this._muted = false;
    this._bgMusic = null;
    this._sfx = {};
    this._audioUnlocked = false;
    this._bgVolume = 0.3;
    this._sfxVolume = 0.7;
  }

  async init(config) {
    // Audio files are lazy-loaded; we just set up references
    this._audioEnabled = config.audioEnabled !== false;
  }

  /**
   * Register a sound effect.
   * @param {string} name - e.g. 'correct', 'incorrect'
   * @param {string} src - URL to audio file
   */
  registerSFX(name, src, volume) {
    if (!src) return;
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = volume !== undefined ? volume : this._sfxVolume;
      audio.src = src;
      this._sfx[name] = audio;
    } catch (e) { /* ignore */ }
  }

  /**
   * Register background music.
   * @param {string} src
   */
  registerBackground(src) {
    if (!src) return;
    try {
      this._bgMusic = new Audio();
      this._bgMusic.loop = true;
      this._bgMusic.volume = this._bgVolume;
      this._bgMusic.preload = 'auto';
      this._bgMusic.src = src;
    } catch (e) { /* ignore */ }
  }

  unlockAudioContext() {
    if (this._audioUnlocked) return;
    this._audioUnlocked = true;
    // Touch/click to unlock on iOS
    if (this._bgMusic) this._bgMusic.load();
    for (const s of Object.values(this._sfx)) s.load();
  }

  playBackground() {
    if (!this._audioEnabled || this._muted || !this._bgMusic) return;
    this._bgMusic.play().catch(() => {});
  }

  stopBackground() {
    if (this._bgMusic) {
      this._bgMusic.pause();
      this._bgMusic.currentTime = 0;
    }
  }

  pauseBackground() {
    if (this._bgMusic) this._bgMusic.pause();
  }

  resumeBackground() {
    if (!this._muted && this._bgMusic) this._bgMusic.play().catch(() => {});
  }

  /**
   * Play a named sound effect.
   * @param {string} name
   */
  playSFX(name) {
    if (!this._audioEnabled || this._muted) return;
    const s = this._sfx[name];
    if (!s) return;
    try {
      s.currentTime = 0;
      s.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._bgMusic) {
      if (muted) this._bgMusic.pause();
      else this._bgMusic.play().catch(() => {});
    }
  }

  isMuted() { return this._muted; }
}

window.AudioManager = AudioManager;
