/**
 * SHARED UTILITIES — Unified Auto-Driller Suite v4.0
 * Common functions used across all platform scripts.
 * Injected via meta.js reference or copied into each script.
 */

const SharedUtils = {
  log: (...args) => {
    if (SharedConfig.debug) console.log('[DRILLER]', new Date().toISOString(), ...args);
  },

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  randomDelay: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

  saveConfig: (CONFIG) => {
    Object.keys(CONFIG).forEach(key => GM_setValue(key, CONFIG[key]));
  },

  sanitizeText: (text) => text.replace(/[^a-zA-Z0-9\s.,!?-]/g, '').replace(/\s+/g, ' ').trim(),

  formatTime: (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  },

  extractMainTopic: (text, cache) => {
    if (!text || text.length < 20) return 'this topic';
    if (cache && cache.has(text)) return cache.get(text);

    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for',
      'of','with','by','from','as','is','was','are','were','been','be','have','has','had',
      'do','does','did','will','would','could','should','may','might','can','this','that',
      'these','those','it','its','they','them','their','here','there','when','where','why',
      'how','all','each','every','both','few','more','most','other','some','such']);

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const first = (sentences[0] || text).toLowerCase();
    const words = first.replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    const topic = words.slice(0, 3).join(' ') || 'this topic';

    if (cache) cache.set(text, topic);
    return topic;
  },

  selectWeightedPattern: (patterns, weights) => {
    const categories = Object.keys(patterns);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) { idx = i; break; }
    }
    const cat = categories[idx];
    return { category: cat, pattern: patterns[cat][Math.floor(Math.random() * patterns[cat].length)] };
  },

  /**
   * React-compatible input — uses native setter to bypass framework overrides.
   */
  setNativeValue: (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  /**
   * Typing simulation — character-by-character with random delay.
   */
  typeIntoInput: async (el, text, speed) => {
    el.focus();
    const isContentEditable = el.contentEditable === 'true';
    if (isContentEditable) el.textContent = '';
    else el.value = '';

    el.dispatchEvent(new Event('focus', { bubbles: true }));

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (isContentEditable) el.textContent += char;
      else el.value += char;

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));

      await SharedUtils.sleep(SharedUtils.randomDelay(speed - 20, speed + 30));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  /**
   * Export session data as JSON.
   */
  exportSession: (state, config) => {
    const data = {
      drillCount: state.drillCount,
      history: state.conversationHistory,
      config,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driller-session-${Date.now()}.json`;
    a.click();
  }
};

const SharedDOM = {
  findElement: (selectors) => {
    for (const sel of selectors) {
      try {
        if (sel.includes(':has-text')) {
          const [, base, text] = sel.match(/^(.+?):has-text\("(.+?)"\)$/);
          const els = document.querySelectorAll(base);
          const el = Array.from(els).find(e => e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
          if (el && SharedDOM.isVisible(el)) return el;
        } else {
          const el = document.querySelector(sel);
          if (el && SharedDOM.isVisible(el)) return el;
        }
      } catch (e) { /* skip bad selector */ }
    }
    return null;
  },

  isVisible: (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return el.offsetParent !== null && !el.disabled && !el.hasAttribute('disabled') &&
      style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  },

  waitForElement: async (selectors, timeout = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = SharedDOM.findElement(selectors);
      if (el) return el;
      await SharedUtils.sleep(100);
    }
    return null;
  }
};
