// ==UserScript==
// @name         AI Auto-Driller Master
// @namespace    https://github.com/GlacierEQ
// @version      6.0.0
// @description  Progress-first cross-platform MoreShow engine: context recovery, deterministic next-best-action selection, current-source technical frontiers, execution/verification gates, retries, receipts, and isolated UI.
// @author       GlacierEQ
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @include      https://chatgpt.com/*
// @include      https://chat.openai.com/*
// @include      https://www.perplexity.ai/*
// @include      https://perplexity.ai/*
// @noframes
// @run-in       normal-tabs
// @match        https://grok.com/*
// @match        https://x.com/i/grok*
// @match        https://chat.deepseek.com/*
// @match        https://kimi.moonshot.cn/*
// @match        https://www.kimi.com/*
// @match        https://kimi.com/*
// @match        https://tongyi.aliyun.com/*
// @match        https://qianwen.aliyun.com/*
// @match        https://chat.qwen.ai/*
// @match        https://chat.cohere.com/*
// @match        https://www.notion.so/*
// @match        https://notion.so/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/GlacierEQ/ai-auto-driller-unified/main/scripts/auto-driller-master.user.js
// @updateURL    https://raw.githubusercontent.com/GlacierEQ/ai-auto-driller-unified/main/scripts/auto-driller-master.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '6.0.0';
  const INSTANCE_KEY = 'autoDrillerMasterV60';
  const STORE_KEY = 'auto-driller-master:v6';
  const LEGACY_STORE_KEY = 'auto-driller-master:v5';
  const HUD_ID = 'auto-driller-master-host';

  if (document.documentElement.dataset[INSTANCE_KEY] === '1') return;
  document.documentElement.dataset[INSTANCE_KEY] = '1';

  const DEFAULTS = Object.freeze({
    enabled: true,
    autoDrill: false,
    autoAccept: false,
    maxDrillDepth: 12,
    drillIntervalMs: 9000,
    userQuietMs: 10000,
    responseStableMs: 1600,
    contextAwareDrill: true,
    corpusRetrieval: true,
    corpusBridgeUrl: 'http://127.0.0.1:8765/search',
    corpusTimeoutMs: 2200,
    corpusTopK: 8,
    contextWindowChars: 12000,
    contextHistoryLimit: 20,
    requireFreshSources: true,
    minimumProgressScore: 55,
    sameFailureEscalation: 2,
    missionMaxChars: 6200,
    debug: false,
    minimized: false
  });

  const PLATFORM_DEFINITIONS = [
    {
      id: 'chatgpt', name: 'ChatGPT', color: '#10a37f',
      hosts: [/^(chatgpt\.com|chat\.openai\.com)$/],
      input: ['#prompt-textarea', '#prompt-textarea[contenteditable="true"]', '[data-testid="composer-input"]', 'textarea[placeholder*="Message" i]', '[contenteditable="true"][role="textbox"]', 'textarea'],
      submit: ['button[data-testid="send-button"]', 'button[data-testid="composer-send-button"]', 'button[aria-label*="Send" i]'],
      response: ['[data-message-author-role="assistant"]', 'main [data-message-author-role="assistant"]', 'article[data-testid^="conversation-turn"] [data-message-author-role="assistant"]', 'main article .markdown', 'main article'],
      strongResponseCount: 3,
      busy: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', '[class*="result-streaming"]']
    },
    {
      id: 'claude', name: 'Claude', color: '#d97757',
      hosts: [/^claude\.ai$/],
      input: ['div[contenteditable="true"][role="textbox"]', '.ProseMirror[contenteditable="true"]', 'textarea'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="assistant" i]', '[data-is-streaming]', '.font-claude-response', '.prose'],
      strongResponseCount: 3,
      busy: ['button[aria-label*="Stop" i]', '[data-is-streaming="true"]', '[class*="generating"]']
    },
    {
      id: 'gemini', name: 'Gemini', color: '#4285f4',
      hosts: [/^gemini\.google\.com$/],
      input: ['rich-textarea [contenteditable="true"]', '.ql-editor[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]', 'textarea'],
      submit: ['button[aria-label*="Send" i]', 'button[aria-label*="Submit" i]', '.send-button'],
      response: ['model-response', '[data-test-id*="model-response" i]', '.model-response-text', '.markdown'],
      strongResponseCount: 3,
      busy: ['button[aria-label*="Stop" i]', '[class*="loading"]', '[class*="generating"]']
    },
    {
      id: 'perplexity', name: 'Perplexity', color: '#20808d',
      hosts: [/^(www\.)?perplexity\.ai$/],
      input: ['textarea[placeholder*="Ask anything" i]', 'textarea[placeholder*="Ask" i]', 'textarea[role="textbox"]', '[contenteditable="true"][data-lexical-editor="true"]', '[contenteditable="true"][role="textbox"]', 'textarea'],
      submit: ['button[type="submit"]', 'button[data-testid*="submit" i]', 'button[aria-label*="Submit" i]', 'button[aria-label*="Send" i]', 'button[aria-label*="Ask" i]'],
      response: ['[data-testid*="answer" i]', 'main [data-testid*="answer" i]', 'main article [class*="prose"]', 'main article [class*="markdown"]', 'main article', '.prose'],
      strongResponseCount: 4,
      busy: ['[aria-busy="true"]', 'button[aria-label*="Stop" i]', '[class*="generating"]']
    },
    {
      id: 'grok', name: 'Grok', color: '#e11d8a',
      hosts: [/^grok\.com$/, /^x\.com$/],
      scope: (host, pathname) => host === 'grok.com' || /^\/i\/grok/.test(pathname),
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="message" i]', '[class*="response"]', '.markdown', '.prose'],
      strongResponseCount: 1,
      busy: ['button[aria-label*="Stop" i]', '[class*="generating"]', '[aria-busy="true"]']
    },
    {
      id: 'deepseek', name: 'DeepSeek', color: '#2563eb',
      hosts: [/^chat\.deepseek\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]'],
      submit: ['button[class*="send" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['.ds-markdown', '[class*="markdown"]', '[class*="response"]', '.prose'],
      strongResponseCount: 1,
      busy: ['ds-loading', 'button[aria-label*="Stop" i]', '[class*="loading"]', '[class*="generating"]']
    },
    {
      id: 'kimi', name: 'Kimi', color: '#6d5dfc',
      hosts: [/^(www\.)?kimi\.com$/, /^kimi\.moonshot\.cn$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="发送" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[class*="segment-content"]', '[class*="markdown"]', '[class*="response"]', '[class*="message"]'],
      strongResponseCount: 1,
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="typing"]']
    },
    {
      id: 'qwen', name: 'Qwen', color: '#615ced',
      hosts: [/^chat\.qwen\.ai$/, /^tongyi\.aliyun\.com$/, /^qianwen\.aliyun\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="发送" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[class*="answer"] [class*="markdown"]', '.markdown-body', '[class*="response"]', '[class*="message"]'],
      strongResponseCount: 1,
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="typing"]']
    },
    {
      id: 'cohere', name: 'Cohere', color: '#39594d',
      hosts: [/^chat\.cohere\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="assistant" i]', '[class*="response"]', '.markdown', '.prose'],
      strongResponseCount: 1,
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="spinner"]']
    },
    {
      id: 'notion', name: 'Notion AI', color: '#111827', manualOnly: true,
      hosts: [/^(www\.)?notion\.so$/],
      input: ['[role="dialog"] textarea', '[role="dialog"] [contenteditable="true"]'],
      submit: ['[role="dialog"] button[type="submit"]', '[role="dialog"] button[aria-label*="Send" i]'],
      response: ['[role="dialog"] [class*="notion-ai"]', '[role="dialog"] .notion-page-content', '[role="dialog"] .prose'],
      strongResponseCount: 1,
      busy: ['[role="dialog"] [aria-busy="true"]', '[role="dialog"] [class*="loading"]']
    },
    {
      id: 'local', name: 'Local LLM', color: '#a21caf',
      hosts: [/^localhost$/, /^127\.0\.0\.1$/],
      input: ['#chat-input', 'textarea[placeholder*="message" i]', 'textarea', 'div[contenteditable="true"][role="textbox"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]', '#send-button'],
      response: ['[data-message-role="assistant"]', '.message.assistant', '[class*="assistant"] .prose', '.prose'],
      strongResponseCount: 3,
      busy: ['button[aria-label*="Stop" i]', '[aria-busy="true"]', '[class*="generating"]']
    }
  ];

  const platform = PLATFORM_DEFINITIONS.find((candidate) => {
    const hostMatch = candidate.hosts.some((rule) => rule.test(location.hostname));
    return hostMatch && (!candidate.scope || candidate.scope(location.hostname, location.pathname));
  });
  if (!platform) return;

  const gmGetValue = typeof GM_getValue === 'function'
    ? GM_getValue
    : (key, fallback) => {
        try {
          const value = localStorage.getItem(key);
          return value === null ? fallback : JSON.parse(value);
        } catch {
          return fallback;
        }
      };
  const gmSetValue = typeof GM_setValue === 'function'
    ? GM_setValue
    : (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
      };
  const gmRegisterMenuCommand = typeof GM_registerMenuCommand === 'function'
    ? GM_registerMenuCommand
    : () => '';

  const storedConfig = gmGetValue(`${STORE_KEY}:config`, gmGetValue(`${LEGACY_STORE_KEY}:config`, {}));
  const config = { ...DEFAULTS, ...(storedConfig && typeof storedConfig === 'object' ? storedConfig : {}) };
  const clampNumber = (value, minimum, maximum, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
  };
  config.enabled = Boolean(config.enabled);
  config.autoDrill = Boolean(config.autoDrill);
  config.autoAccept = Boolean(config.autoAccept);
  // Context recovery is a hard invariant in v6; stale saved settings cannot disable it.
  config.contextAwareDrill = true;
  config.corpusRetrieval = true;
  config.corpusBridgeUrl = String(config.corpusBridgeUrl || DEFAULTS.corpusBridgeUrl).trim();
  config.corpusTimeoutMs = clampNumber(config.corpusTimeoutMs, 250, 10000, DEFAULTS.corpusTimeoutMs);
  config.corpusTopK = Math.round(clampNumber(config.corpusTopK, 1, 20, DEFAULTS.corpusTopK));
  config.contextWindowChars = Math.round(clampNumber(config.contextWindowChars, 1000, 30000, DEFAULTS.contextWindowChars));
  config.contextHistoryLimit = Math.round(clampNumber(config.contextHistoryLimit, 1, 50, DEFAULTS.contextHistoryLimit));
  config.requireFreshSources = config.requireFreshSources !== false;
  config.minimumProgressScore = Math.round(clampNumber(config.minimumProgressScore, 20, 95, DEFAULTS.minimumProgressScore));
  config.sameFailureEscalation = Math.round(clampNumber(config.sameFailureEscalation, 1, 5, DEFAULTS.sameFailureEscalation));
  config.missionMaxChars = Math.round(clampNumber(config.missionMaxChars, 2500, 10000, DEFAULTS.missionMaxChars));
  config.debug = Boolean(config.debug);
  config.minimized = Boolean(config.minimized);
  config.maxDrillDepth = Math.round(clampNumber(config.maxDrillDepth, 1, 50, DEFAULTS.maxDrillDepth));
  config.drillIntervalMs = clampNumber(config.drillIntervalMs, 3000, 120000, DEFAULTS.drillIntervalMs);
  config.userQuietMs = clampNumber(config.userQuietMs, 0, 120000, DEFAULTS.userQuietMs);
  config.responseStableMs = clampNumber(config.responseStableMs, 500, 10000, DEFAULTS.responseStableMs);
  if (platform.manualOnly) config.autoDrill = false;
  if (!platform.approval) config.autoAccept = false;

  const storedContextMemory = gmGetValue(`${STORE_KEY}:context-memory`, gmGetValue(`${LEGACY_STORE_KEY}:context-memory`, []));

  const state = {
    startedAt: Date.now(),
    drillCount: 0,
    processing: false,
    lastDrillAt: 0,
    consecutiveFailures: 0,
    sameProgressFailureCount: 0,
    lastProgressScore: null,
    lastProgressClass: 'UNASSESSED',
    lastRoute: 'NONE',
    lastMission: null,
    progressReceipts: [],
    backoffUntil: 0,
    lastTrustedActivityAt: 0,
    lastHandledHash: '',
    lastHumanUserHash: '',
    candidateHash: '',
    candidateSince: 0,
    operationGeneration: 0,
    baselineTimer: 0,
    currentUrl: location.href,
    history: [],
    contextMemory: Array.isArray(storedContextMemory) ? storedContextMemory.slice(-50) : [],
    lastContextPacket: null,
    audit: [],
    clickedApprovals: new WeakSet(),
    hudHost: null,
    shadow: null,
    ticker: null
  };

  const MISSION_PREFIX = '[MORE-SHOW MISSION v6]';

  const DOMAIN_RULES = Object.freeze([
    { id: 'coding', pattern: /\b(code|coding|repo|repository|github|git|commit|pull request|pr\b|typescript|javascript|python|rust|go\b|java\b|sdk|api|mcp|server|client|function|class|schema|migration|database|sql|build|ci\b|test|deploy|runtime|package|dependency|framework|library|compiler|architecture)\b/i },
    { id: 'debugging', pattern: /\b(debug|bug|error|exception|failed|failure|broken|regression|stack trace|traceback|doesn.?t work|not working|root cause)\b/i },
    { id: 'connector', pattern: /\b(connector|plugin|integration|provider|oauth|permission|scope|webhook|mcp|api|readback|receipt|manifest)\b/i },
    { id: 'research', pattern: /\b(research|source|evidence|paper|study|latest|current|recent|verify|compare|citation|documentation|specification|release notes)\b/i },
    { id: 'casework', pattern: /\b(case|evidence|complaint|claim|discovery|timeline|witness|record|custody|preservation|foia|subpoena|statute|damages|allegation)\b/i },
    { id: 'writing', pattern: /\b(write|rewrite|draft|essay|email|letter|proposal|report|article|post|document|brief)\b/i },
    { id: 'planning', pattern: /\b(plan|roadmap|strategy|design|architecture|workflow|blueprint|prioritize|next step)\b/i }
  ]);

  const ROUTE_PRIORITY = Object.freeze({
    REPAIR_ARCHITECTURE: 100,
    VERIFY_AND_REPAIR: 90,
    TECHNICAL_FRONTIER: 85,
    EXECUTE: 80,
    RESEARCH_AND_APPLY: 72,
    INTEGRATE: 66,
    DELIVER: 62,
    FALSIFY: 58,
    STOP: 10
  });

  const SOURCE_POLICY = `For technical/coding work where freshness can matter, search CURRENT PRIMARY SOURCES before selecting the implementation frontier. Prefer official specifications, official documentation, release notes/changelogs, and upstream source repositories. Find only developments that create concrete leverage for the active objective. Cite/link the sources you actually used. Never invent freshness, versions, APIs, releases, or source claims. If current-source retrieval is unavailable, say so and continue only with verified local/repository state.`;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const debug = (...args) => {
    if (config.debug) console.debug(`[AutoDriller:${platform.id}]`, ...args);
  };
  const persistConfig = () => gmSetValue(`${STORE_KEY}:config`, { ...config, autoDrill: platform.manualOnly ? false : config.autoDrill });

  const audit = (type, details = {}) => {
    const event = { at: new Date().toISOString(), type, platform: platform.id, url: location.href, ...details };
    state.audit.push(event);
    if (state.audit.length > 250) state.audit.splice(0, state.audit.length - 250);
    debug(type, details);
    updateHud();
  };

  const isVisible = (element) => {
    if (!element || element.nodeType !== 1 || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0 &&
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-disabled') !== 'true';
  };

  let cachedRoots = [document];
  let rootsCachedAt = 0;
  const collectRoots = () => {
    if (Date.now() - rootsCachedAt < 750) return cachedRoots;
    const roots = [document];
    const rootQueue = [document];
    const discoveredRoots = new Set(rootQueue);
    while (rootQueue.length) {
      const root = rootQueue.shift();
      const elements = root === document
        ? [document.documentElement, ...document.querySelectorAll('*')]
        : [...root.querySelectorAll('*')];
      for (const element of elements) {
        if (!element || element.nodeType !== 1 || !element.shadowRoot || discoveredRoots.has(element.shadowRoot)) continue;
        discoveredRoots.add(element.shadowRoot);
        roots.push(element.shadowRoot);
        rootQueue.push(element.shadowRoot);
      }
    }
    cachedRoots = roots;
    rootsCachedAt = Date.now();
    return roots;
  };

  const queryAll = (selectors) => {
    const found = [];
    const seen = new Set();
    for (const root of collectRoots()) {
      for (const selector of selectors) {
        try {
          for (const element of root.querySelectorAll(selector)) {
            if (!seen.has(element)) {
              seen.add(element);
              found.push(element);
            }
          }
        } catch (error) {
          debug('bad selector', selector, error);
        }
      }
    }
    return found;
  };

  const firstVisible = (selectors) => queryAll(selectors).find(isVisible) || null;
  const responseScore = (element) => {
    const parts = [];
    let cursor = element;
    for (let depth = 0; cursor && depth < 5; depth += 1, cursor = cursor.parentElement) {
      parts.push(
        cursor.getAttribute('data-message-author-role') || '',
        cursor.getAttribute('data-message-role') || '',
        cursor.getAttribute('data-testid') || '',
        cursor.getAttribute('aria-label') || '',
        cursor.getAttribute('role') || '',
        cursor.className || ''
      );
    }
    const signature = normalize(parts.join(' ')).toLowerCase();
    let score = 0;
    if (/(assistant|model|answer|response|claude|gemini|notion-ai)/.test(signature)) score += 12;
    if (/(markdown|prose)/.test(signature)) score += 2;
    if (/(message|segment-content|notion-ai|markdown-body|ds-markdown)/.test(signature)) score += 1;
    if (/(user|human|prompt|composer|input|navigation|sidebar)/.test(signature)) score -= 20;
    if (element.closest('form, textarea, [contenteditable="true"]')) score -= 30;
    return score;
  };
  const compareDocumentOrder = (left, right) => {
    const relation = left.compareDocumentPosition(right);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  };
  const lastVisible = (selectors, minLength = 0, minimumScore = Number.NEGATIVE_INFINITY) => {
    const matches = queryAll(selectors)
      .filter((element) => (
        isVisible(element) &&
        normalize(element.textContent).length >= minLength &&
        responseScore(element) >= minimumScore
      ))
      .sort((left, right) => responseScore(left) - responseScore(right) || compareDocumentOrder(left, right));
    return matches.length ? matches[matches.length - 1] : null;
  };

  const elementTag = (element) => String(element?.tagName || '').toLowerCase();
  const isFormControl = (element) => ['textarea', 'input'].includes(elementTag(element));

  const elementValue = (element) => {
    if (!element) return '';
    if (isFormControl(element)) return element.value || '';
    return element.isContentEditable ? element.innerText || element.textContent || '' : element.textContent || '';
  };

  const setFormControlValue = (element, value) => {
    const view = element.ownerDocument?.defaultView || window;
    const prototype = elementTag(element) === 'textarea'
      ? view.HTMLTextAreaElement?.prototype
      : view.HTMLInputElement?.prototype;
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : null;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setContentEditableValue = (element, value) => {
    element.focus();
    element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    range.deleteContents();
    range.insertNode(document.createTextNode(value));
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setInputValue = (element, value) => {
    element.focus();
    if (isFormControl(element)) {
      setFormControlValue(element, value);
    } else if (element.isContentEditable) {
      setContentEditableValue(element, value);
    } else {
      throw new Error(`Unsupported input element: ${element.tagName}`);
    }
  };

  const pressEnter = (element) => {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      element.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
      }));
    }
  };

  const getInput = () => firstVisible(platform.input);

  const getSubmitButton = (input) => {
    const configured = firstVisible(platform.submit);
    if (configured) return configured;
    let current = input;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const formSubmit = current.querySelector?.('button[type="submit"]');
      if (formSubmit && isVisible(formSubmit)) return formSubmit;
      const labeled = Array.from(current.querySelectorAll?.('button') || []).find((button) => {
        const label = normalize(`${button.textContent} ${button.getAttribute('aria-label')} ${button.getAttribute('title')}`).toLowerCase();
        return isVisible(button) && /(send|submit|发送|提交|arrow up)/i.test(label);
      });
      if (labeled) return labeled;
    }
    return null;
  };

  const getResponseCandidate = ({ allowFallback = false } = {}) => {
    const strongCount = Math.max(0, Math.min(platform.response.length, platform.strongResponseCount || 0));
    const strongSelectors = platform.response.slice(0, strongCount);
    const fallbackSelectors = platform.response.slice(strongCount);
    const strong = strongSelectors.length ? lastVisible(strongSelectors, 4, 1) : null;
    if (strong) return { element: strong, text: normalize(strong.textContent), strong: true };
    if (!allowFallback || !fallbackSelectors.length) return { element: null, text: '', strong: false };
    const fallback = lastVisible(fallbackSelectors, 4, 1);
    return { element: fallback, text: normalize(fallback?.textContent), strong: false };
  };

  const getResponseText = (allowFallback = false) => getResponseCandidate({ allowFallback }).text;
  const getDiagnostics = () => ({
    input: queryAll(platform.input).filter(isVisible).length,
    response: queryAll(platform.response).filter(isVisible).length,
    submit: queryAll(platform.submit).filter(isVisible).length
  });

  const hashText = (text) => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const isBusy = () => queryAll(platform.busy).some(isVisible);

  const waitUntil = async (predicate, timeoutMs, intervalMs = 120) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await predicate()) return true;
      } catch (error) {
        debug('wait predicate error', error);
      }
      await sleep(intervalMs);
    }
    return false;
  };

  const STOP_WORDS = new Set([
    'the','and','that','this','with','from','have','will','would','could','should','into','about','there',
    'their','what','when','where','which','while','your','youre','they','them','then','than','also','only',
    'using','used','does','doing','done','been','were','was','are','for','not','but','all','any','can',
    'just','really','very','some','thing','things','want','need','like','more','most','much','make','made'
  ]);

  const USER_MESSAGE_SELECTORS = Object.freeze([
    '[data-message-author-role="user"]',
    '[data-testid*="user-message" i]',
    '[data-testid*="human" i]',
    '[class*="user-message" i]',
    '[class*="message"][class*="user" i]'
  ]);

  const extractKeywords = (text, limit = 8) => {
    const raw = normalize(text);
    if (!raw) return [];

    const cleanKeyword = (value) => normalize(value).replace(/^[._:/#-]+|[._:/#-]+$/g, '');
    const properPhrases = [...raw.matchAll(/\b[A-Z][A-Za-z0-9_.-]+(?:\s+[A-Z][A-Za-z0-9_.-]+){1,3}\b/g)]
      .map((match) => cleanKeyword(match[0]))
      .filter((value) => value.length >= 5);
    const coveredTokens = new Set(
      properPhrases.flatMap((phrase) => phrase.toLowerCase().split(/\s+/).map(cleanKeyword).filter(Boolean))
    );

    const counts = new Map();
    const tokens = raw
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff_.:/#-]/g, ' ')
      .split(/\s+/)
      .map(cleanKeyword)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);

    const rankedTokens = [...counts.entries()]
      .sort((left, right) => {
        const leftScore = left[1] * 10 + Math.min(left[0].length, 18);
        const rightScore = right[1] * 10 + Math.min(right[0].length, 18);
        return rightScore - leftScore || left[0].localeCompare(right[0]);
      })
      .map(([token]) => token);

    const output = [];
    const seen = new Set();
    for (const candidate of [...properPhrases, ...rankedTokens]) {
      const cleaned = cleanKeyword(candidate);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      if (!cleaned.includes(' ') && coveredTokens.has(key)) continue;
      seen.add(key);
      output.push(cleaned);
      if (output.length >= limit) break;
    }
    return output;
  };

  const extractTopic = (text) => extractKeywords(text, 5).join(' ') || 'the current subject';

  const isGeneratedMissionText = (text) => normalize(text).startsWith(MISSION_PREFIX);

  const getLatestUserText = () => {
    const matches = queryAll(USER_MESSAGE_SELECTORS)
      .filter(isVisible)
      .map((element) => normalize(element.textContent || element.innerText || ''))
      .filter(Boolean);
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      if (!isGeneratedMissionText(matches[index])) return matches[index];
    }
    return '';
  };

  const collectPageContext = () => {
    const selectors = [...USER_MESSAGE_SELECTORS, ...platform.response, 'main article', '.markdown', '.prose'];
    const seen = new Set();
    const pieces = [];
    for (const element of queryAll(selectors).filter(isVisible)) {
      const text = normalize(element.textContent || element.innerText || '');
      if (!text || text.length < 3 || isGeneratedMissionText(text)) continue;
      const hash = hashText(text);
      if (seen.has(hash)) continue;
      seen.add(hash);
      pieces.push(text);
    }
    return pieces.join('\n').slice(-config.contextWindowChars);
  };

  const persistContextMemory = (entry) => {
    state.contextMemory.push(entry);
    if (state.contextMemory.length > 50) {
      state.contextMemory.splice(0, state.contextMemory.length - 50);
    }
    gmSetValue(`${STORE_KEY}:context-memory`, state.contextMemory);
  };

  const normalizeCorpusMatches = (payload) => {
    const source = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.matches)
        ? payload.matches
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.hits)
            ? payload.hits
            : [];

    return source
      .map((item) => {
        if (typeof item === 'string') return { text: normalize(item), title: '', score: null };
        if (!item || typeof item !== 'object') return null;
        const text = normalize(
          item.text || item.snippet || item.content || item.excerpt ||
          item.entry_text || item.span_text || item.message || ''
        );
        if (!text) return null;
        return {
          text,
          title: normalize(item.title || item.source_title || item.conversation_title || ''),
          score: Number.isFinite(Number(item.score)) ? Number(item.score) : null
        };
      })
      .filter(Boolean)
      .slice(0, config.corpusTopK);
  };

  const requestCorpusContext = ({ query, keywords, latestUserText }) => {
    if (!config.corpusRetrieval || !config.corpusBridgeUrl || typeof GM_xmlhttpRequest !== 'function') {
      return Promise.resolve({ status: 'unavailable', matches: [] });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      try {
        GM_xmlhttpRequest({
          method: 'POST',
          url: config.corpusBridgeUrl,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            query,
            keywords,
            latestUserText,
            platform: platform.id,
            pageUrl: location.href,
            limit: config.corpusTopK
          }),
          timeout: config.corpusTimeoutMs,
          onload: (response) => {
            if (response.status < 200 || response.status >= 300) {
              finish({ status: `http-${response.status}`, matches: [] });
              return;
            }
            try {
              finish({ status: 'ok', matches: normalizeCorpusMatches(JSON.parse(response.responseText || '{}')) });
            } catch {
              finish({ status: 'invalid-json', matches: [] });
            }
          },
          onerror: () => finish({ status: 'error', matches: [] }),
          ontimeout: () => finish({ status: 'timeout', matches: [] })
        });
      } catch {
        finish({ status: 'error', matches: [] });
      }
    });
  };

  const buildContextPacket = async (responseText) => {
    const latestUserText = getLatestUserText();
    const pageContext = collectPageContext();
    const memoryContext = state.contextMemory
      .slice(-config.contextHistoryLimit)
      .map((item) => [item.userText, item.mission || item.question, item.route, ...(item.keywords || [])].filter(Boolean).join(' '))
      .join('\n');

    const searchSeed = latestUserText || responseText;
    const keywords = extractKeywords(searchSeed, 8);
    const expandedKeywords = extractKeywords([searchSeed, pageContext, memoryContext].filter(Boolean).join('\n'), 12);
    const queryTerms = (keywords.length ? keywords : expandedKeywords).slice(0, 8);
    const query = queryTerms.join(' ');

    const corpus = await requestCorpusContext({ query, keywords: queryTerms, latestUserText });
    const corpusText = corpus.matches.map((match) => match.text).join('\n');
    const related = extractKeywords(corpusText, 8)
      .filter((candidate) => !queryTerms.some((term) => term.toLowerCase() === candidate.toLowerCase()))
      .slice(0, 4);

    const packet = {
      latestUserText,
      keywords: queryTerms,
      topic: extractTopic(searchSeed),
      related,
      corpusStatus: corpus.status,
      matches: corpus.matches,
      source: corpus.matches.length ? 'bridge' : 'local',
      localContextChars: pageContext.length
    };
    state.lastContextPacket = packet;
    return packet;
  };

  const classifyDomain = (text) => {
    const source = normalize(text);
    let best = { id: 'general', hits: 0 };
    for (const rule of DOMAIN_RULES) {
      const matches = source.match(new RegExp(rule.pattern.source, `${rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`}`));
      const hits = matches ? matches.length : 0;
      if (hits > best.hits) best = { id: rule.id, hits };
    }
    return best.id;
  };

  const responseSignals = (responseText, latestUserText = '') => {
    const response = normalize(responseText);
    const user = normalize(latestUserText);
    const combined = `${user}\n${response}`;
    const lower = combined.toLowerCase();
    const userCorrection = /(?:not making anything happen|nothing (?:is|was) happening|still (?:not|isn.?t)|you (?:didn.?t|did not)|wrong again|same (?:shit|thing|failure)|doesn.?t work|not working|stop (?:doing|repeating)|waste(?:d|ing)? (?:my )?time|not what i (?:asked|wanted|meant))/i.test(user);
    const actionEvidence = /\b(implemented|created|updated|patched|changed|wrote|committed|pushed|merged|deployed|executed|ran|installed|configured|fixed|repaired|materialized|synced|uploaded|saved|generated|migrated|removed|added|wired|bound|promoted)\b/i.test(response);
    const verificationEvidence = /\b(test(?:ed|s)?|pass(?:ed)?|verified|readback|receipt|assert(?:ed|ion)?|validation|validated|exit code|status|sha(?:256)?|checksum|health check|provider readback|regression)\b/i.test(response);
    const artifactEvidence = /(?:\bcommit\b|\bPR\s*#?\d+|\bpull request\b|\bmanifest\b|\bmigration\b|\bartifact\b|\breceipt\b|\b[a-f0-9]{7,40}\b|\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+)/i.test(response);
    const blockerEvidence = /\b(blocked|blocker|failed|failure|error|unavailable|missing|required|cannot|can.?t|unable|permission|auth(?:entication)? required|rate limit)\b/i.test(response);
    const uncertaintyEvidence = /\b(unverified|unknown|uncertain|assumption|inference|appears|probably|likely|might|may\b)/i.test(response);
    const sourceEvidence = /(?:https?:\/\/|\bcite\b|\bcitation\b|official docs|documentation|release notes|changelog|specification|upstream|github\.com)/i.test(response);
    const futureOnly = !actionEvidence && /\b(should|would|could|recommend|next step|need to|we need|we should|plan to|can then|could then|propose)\b/i.test(response);
    const completionEvidence = /\b(done|complete(?:d)?|finished|closed|resolved|active_verified|readiness pass|all tests pass(?:ed)?)\b/i.test(response);
    const noNextValueEvidence = /\b(no remaining (?:work|tasks|issues)|nothing (?:else|further) (?:to do|needed)|no further action|all objectives (?:are )?satisfied|no unresolved (?:work|items|issues))\b/i.test(response);
    const repetitionEvidence = state.lastMission && normalize(state.lastMission.objective) && lower.includes(normalize(state.lastMission.objective).toLowerCase().slice(0, 80));
    return {
      userCorrection,
      actionEvidence,
      verificationEvidence,
      artifactEvidence,
      blockerEvidence,
      uncertaintyEvidence,
      sourceEvidence,
      futureOnly,
      completionEvidence,
      noNextValueEvidence,
      repetitionEvidence
    };
  };

  const evaluatePreviousMissionOutcome = (responseText, latestUserText = '') => {
    if (!state.lastMission) return null;
    const signals = responseSignals(responseText, latestUserText);
    let score = 0;
    if (signals.actionEvidence) score += 32;
    if (signals.verificationEvidence) score += 26;
    if (signals.artifactEvidence) score += 18;
    if (signals.sourceEvidence && state.lastMission.requiresFreshSources) score += 14;
    if (signals.blockerEvidence && /(?:alternate|fallback|reroute|different route|next route|preserv)/i.test(responseText)) score += 16;
    if (signals.futureOnly) score -= 25;
    if (signals.repetitionEvidence) score -= 15;
    if (signals.userCorrection) score -= 35;
    score = Math.max(0, Math.min(100, score));

    let progressClass = score >= 80 ? 'VERIFIED_PROGRESS' : score >= config.minimumProgressScore ? 'PROGRESS' : 'INSUFFICIENT_PROGRESS';
    if (signals.userCorrection) progressClass = 'USER_REPORTED_FAILURE';

    if (score < config.minimumProgressScore || signals.userCorrection) state.sameProgressFailureCount += 1;
    else state.sameProgressFailureCount = 0;

    state.lastProgressScore = score;
    state.lastProgressClass = progressClass;
    const receipt = {
      at: new Date().toISOString(),
      missionId: state.lastMission.id,
      route: state.lastMission.route,
      score,
      progressClass,
      signals,
      responseHash: hashText(responseText)
    };
    state.progressReceipts.push(receipt);
    if (state.progressReceipts.length > 100) state.progressReceipts.splice(0, state.progressReceipts.length - 100);
    audit('progress.assessed', receipt);
    return receipt;
  };

  const candidateRoutes = ({ domain, signals, context, previousOutcome }) => {
    const topic = context.topic;
    const candidates = [];
    const add = (route, objective, rationale, acceptance, bonus = 0, requiresFreshSources = false) => {
      let score = ROUTE_PRIORITY[route] + bonus;
      if (state.lastRoute === route && previousOutcome && previousOutcome.score < config.minimumProgressScore) score -= 25;
      if (route === 'REPAIR_ARCHITECTURE' && state.sameProgressFailureCount >= config.sameFailureEscalation) score += 40;
      if (route === 'VERIFY_AND_REPAIR' && signals.actionEvidence && !signals.verificationEvidence) score += 30;
      if (route === 'EXECUTE' && (signals.futureOnly || (!signals.actionEvidence && !signals.completionEvidence))) score += 25;
      if (route === 'TECHNICAL_FRONTIER' && domain === 'coding') score += 28;
      if (route === 'TECHNICAL_FRONTIER' && signals.actionEvidence && !signals.verificationEvidence) score -= 45;
      if (route === 'TECHNICAL_FRONTIER' && signals.completionEvidence && signals.verificationEvidence) score -= 55;
      if (route === 'RESEARCH_AND_APPLY' && (domain === 'research' || signals.uncertaintyEvidence)) score += 20;
      if (route === 'INTEGRATE' && signals.completionEvidence && signals.verificationEvidence) score += 70;
      if (route === 'INTEGRATE' && signals.noNextValueEvidence) score -= 220;
      if (route === 'DELIVER' && domain === 'writing') score += 22;
      if (signals.userCorrection && route !== 'REPAIR_ARCHITECTURE') score -= 45;
      candidates.push({ route, objective, rationale, acceptance, score, requiresFreshSources });
    };

    if (signals.userCorrection || state.sameProgressFailureCount >= config.sameFailureEscalation) {
      add(
        'REPAIR_ARCHITECTURE',
        `Repair the mechanism that failed to produce observable progress on ${topic}; do not patch the wording of the failed approach.`,
        'A user-reported or repeated progress failure invalidates the current route and requires a materially different mechanism.',
        'Identify the failed assumption, choose a materially different route, execute it now, and prove the exact reported failure no longer occurs.',
        35,
        domain === 'coding'
      );
    }

    if (signals.actionEvidence && !signals.verificationEvidence) {
      add('VERIFY_AND_REPAIR', `Verify the claimed state change for ${topic}, falsify it, repair any failure, and preserve provider/repository readback.`, 'Execution claims without readback are not finished.', 'Produce an independent test/readback plus a durable receipt or exact artifact identifier.');
    }

    if (domain === 'coding') {
      add(
        'TECHNICAL_FRONTIER',
        `Use the current implementation of ${topic} as a springboard: discover the strongest current technical frontier, then implement and test the highest-leverage upgrade now.`,
        'Coding progress should import current primary-source information and convert it into a concrete capability gain, not merely discuss technology.',
        'Use current authoritative technical sources, identify the concrete new capability they unlock here, make the code/repository change, and run falsifiable tests.',
        15,
        true
      );
    }

    if (signals.futureOnly || (!signals.actionEvidence && !signals.completionEvidence)) {
      add('EXECUTE', `Turn the current analysis/design for ${topic} into real state change using available tools, files, repositories, or providers.`, 'The response contains plans or recommendations without sufficient observable execution.', 'Create or change a real artifact/state, then read it back or test it.');
    }

    if (domain === 'research' || signals.uncertaintyEvidence || (domain === 'coding' && !signals.sourceEvidence)) {
      add('RESEARCH_AND_APPLY', `Acquire the strongest current evidence relevant to ${topic}, determine what it changes, and immediately apply that finding to the active objective.`, 'Fresh evidence is useful only when it changes a decision or implementation.', 'Use primary/current sources, state the concrete consequence, then execute or revise the active work accordingly.', 0, true);
    }

    if (signals.completionEvidence && signals.verificationEvidence) {
      add('INTEGRATE', `Compound the verified result for ${topic} into the highest-leverage adjacent system instead of re-solving completed work.`, 'Verified completion should create downstream leverage.', 'Produce one new verified integration or durable downstream capability without regressing the completed state.');
    }

    if (domain === 'writing') {
      add('DELIVER', `Convert the current material on ${topic} into the strongest finished artifact required by the underlying objective.`, 'Writing work should end in a usable deliverable rather than recursive commentary.', 'Produce the finished artifact and perform a concrete quality/completeness check.');
    }

    add('FALSIFY', `Attack the weakest assumption controlling ${topic}; run the strongest available test and let the result change the route.`, 'Falsification prevents confident repetition of a wrong abstraction.', 'Name the controlling assumption, test it with observable evidence, and update the implementation based on the result.');

    if (signals.completionEvidence && signals.verificationEvidence && !signals.blockerEvidence) {
      add('STOP', `Stop recursive expansion of ${topic} unless a materially higher-leverage adjacent objective is demonstrated.`, 'Continuation is not intrinsically valuable.', 'Either identify a concrete positive-value next state change or explicitly stop rather than manufacture another discussion turn.', signals.noNextValueEvidence ? 220 : -20);
    }

    return candidates.sort((a, b) => b.score - a.score || a.route.localeCompare(b.route));
  };

  const compactRecoveredContext = (context) => {
    if (!context.matches.length) return '';
    return context.matches.slice(0, 4).map((match, index) => {
      const label = match.title ? `${match.title}: ` : '';
      return `${index + 1}. ${label}${match.text.slice(0, 520)}`;
    }).join('\n');
  };

  const compileMission = ({ selected, candidates, context, responseText, previousOutcome, domain }) => {
    const recovered = compactRecoveredContext(context);
    const candidateSummary = candidates.slice(0, 4).map((candidate) => `${candidate.route}:${candidate.score}`).join(', ');
    const previous = previousOutcome
      ? `Previous mission outcome: ${previousOutcome.progressClass} (${previousOutcome.score}/100). Repeated progress failures: ${state.sameProgressFailureCount}.`
      : 'Previous mission outcome: none — establish the next real state transition from the current response.';
    const sourceRule = selected.requiresFreshSources && config.requireFreshSources ? `\nCURRENT-SOURCE REQUIREMENT:\n${SOURCE_POLICY}` : '';
    const contextRule = recovered
      ? `\nRECOVERED PRIOR CONTEXT (apply it; do not restart):\n${recovered}`
      : `\nCONTEXT RECOVERY REQUIREMENT:\nSearch/recover relevant prior conversation, project, repository, file, memory, or connected-source state before acting. Do not ask the user to repeat information that is already recoverable.`;
    const responseDigest = normalize(responseText).slice(-1800);

    return `${MISSION_PREFIX}\n\n` +
      `MODE: ${selected.route}\nDOMAIN: ${domain}\nTOPIC: ${context.topic}\n` +
      `OBJECTIVE: ${selected.objective}\n` +
      `WHY THIS ROUTE: ${selected.rationale}\n` +
      `${previous}\n` +
      `Internal route scores (do not merely discuss these): ${candidateSummary}.\n` +
      `${contextRule}${sourceRule}\n\n` +
      `CURRENT RESPONSE STATE:\n${responseDigest}\n\n` +
      `EXECUTION LAW:\n` +
      `1. Recover relevant context/state first.\n` +
      `2. Treat the current response as a springboard, not a prompt to paraphrase.\n` +
      `3. Generate materially different routes internally, select the strongest by objective gain, compatibility, reversibility, proof strength, dependency preservation, and downstream leverage. Do not dump the route brainstorm on the user.\n` +
      `4. Execute the selected route NOW with available tools/connectors/repositories/files/browser capabilities. Planning-only is failure when execution is available.\n` +
      `5. If a route is blocked, preserve the blocker as evidence and change route; do not change the objective.\n` +
      `6. Verify/falsify the resulting real state with tests, provider readback, repository state, receipts, hashes, artifacts, or other observable evidence.\n` +
      `7. Preserve what changed so the next turn starts from the new state.\n` +
      `8. Do not ask a generic follow-up question. Do not say "go deeper" or restate the plan. Do not redo solved work.\n` +
      `9. If no next action has positive expected value, STOP instead of manufacturing continuation.\n\n` +
      `ACCEPTANCE CRITERIA:\n${selected.acceptance}\n` +
      `The response must make the resulting state, evidence, and remaining frontier inspectable. Meta-language about progress does not count as progress.`;
  };

  const generateMission = async (responseText, previousOutcome = null, freshHumanUserText = '') => {
    const context = await buildContextPacket(responseText);
    const signals = responseSignals(responseText, freshHumanUserText);
    const domain = classifyDomain([context.latestUserText, responseText, context.matches.map((match) => match.text).join('\n')].join('\n'));
    const candidates = candidateRoutes({ domain, signals, context, previousOutcome });
    const selected = candidates[0];
    const id = `${Date.now().toString(36)}-${hashText(`${selected.route}:${context.topic}:${responseText.slice(-400)}`)}`;
    const mission = compileMission({ selected, candidates, context, responseText, previousOutcome, domain }).slice(0, config.missionMaxChars);
    return {
      id,
      route: selected.route,
      category: selected.route.toLowerCase(),
      objective: selected.objective,
      score: selected.score,
      acceptance: selected.acceptance,
      requiresFreshSources: selected.requiresFreshSources,
      mission,
      context,
      domain,
      signals,
      candidates: candidates.slice(0, 5).map(({ route, score }) => ({ route, score }))
    };
  };

  const safeAutoAccept = () => {
    const approval = platform.approval;
    if (!config.enabled || !config.autoAccept || !approval) return;
    const allowedLabels = new Set(approval.labels || []);
    for (const button of queryAll(approval.buttons || [])) {
      if (!isVisible(button) || state.clickedApprovals.has(button)) continue;
      const textLabel = normalize(button.textContent || '').toLowerCase();
      const ariaLabel = normalize(button.getAttribute('aria-label') || '').toLowerCase();
      const label = allowedLabels.has(textLabel) ? textLabel : ariaLabel;
      if (!allowedLabels.has(label)) continue;
      const container = button.closest(approval.container);
      if (!container) continue;
      const context = normalize(container.textContent).toLowerCase();
      if (!approval.requestPattern.test(context) || approval.denyPattern.test(context)) continue;
      state.clickedApprovals.add(button);
      button.click();
      audit('approval.clicked', { label });
    }
  };

  const verifySubmissionStarted = async (input, previousHash, allowFallback = false) => {
    return waitUntil(() => {
      const inputCleared = normalize(elementValue(input)).length === 0;
      const responseText = getResponseText(allowFallback);
      const responseHash = responseText ? hashText(responseText) : '';
      return isBusy() || inputCleared || Boolean(responseHash && responseHash !== previousHash);
    }, 5500);
  };

  const assertOperationActive = (generation) => {
    if (!config.enabled || generation !== state.operationGeneration) {
      const error = new Error('Operation cancelled');
      error.name = 'AbortError';
      throw error;
    }
  };

  const submitDrill = async ({ manual = false } = {}) => {
    if (state.processing || !config.enabled) return false;
    if (!manual && platform.manualOnly) return false;
    if (!manual && !config.autoDrill) return false;
    if (!manual && Date.now() < state.backoffUntil) return false;
    if (state.drillCount >= config.maxDrillDepth) {
      setStatus('Depth limit — inspect progress receipts before continuing');
      return false;
    }
    if (!manual && Date.now() - state.lastDrillAt < config.drillIntervalMs) return false;
    if (!manual && Date.now() - state.lastTrustedActivityAt < config.userQuietMs) return false;
    if (isBusy()) return false;

    const responseText = getResponseText(manual);
    if (!responseText) {
      const diagnostics = getDiagnostics();
      setStatus(`No response found • input ${diagnostics.input} • response ${diagnostics.response}`);
      audit('mission.blocked', { reason: 'no-response' });
      return false;
    }

    const responseHash = hashText(responseText);
    if (!manual && responseHash === state.lastHandledHash) return false;

    state.processing = true;
    const operationGeneration = state.operationGeneration;
    setStatus('Recovering context + selecting route');

    try {
      const latestHumanUserText = getLatestUserText();
      const latestHumanUserHash = latestHumanUserText ? hashText(latestHumanUserText) : '';
      const humanMessageIsFresh = Boolean(latestHumanUserHash && latestHumanUserHash !== state.lastHumanUserHash);
      const freshHumanUserText = humanMessageIsFresh ? latestHumanUserText : '';
      const previousOutcome = evaluatePreviousMissionOutcome(responseText, freshHumanUserText);
      const generated = await generateMission(responseText, previousOutcome, freshHumanUserText);
      assertOperationActive(operationGeneration);

      audit('mission.selected', {
        missionId: generated.id,
        route: generated.route,
        domain: generated.domain,
        routeScore: generated.score,
        candidates: generated.candidates,
        responseHash,
        contextSource: generated.context?.source || 'unknown',
        corpusStatus: generated.context?.corpusStatus || 'unknown',
        keywords: generated.context?.keywords || [],
        previousOutcome
      });

      const input = await waitUntil(() => getInput(), 4000) ? getInput() : null;
      assertOperationActive(operationGeneration);
      if (!input) {
        const diagnostics = getDiagnostics();
        throw new Error(`Prompt input not found (input ${diagnostics.input}, response ${diagnostics.response})`);
      }
      if (normalize(elementValue(input))) throw new Error('Prompt input is not empty');

      assertOperationActive(operationGeneration);
      setInputValue(input, generated.mission);
      const inserted = await waitUntil(
        () => normalize(elementValue(input)).includes(MISSION_PREFIX),
        1800
      );
      assertOperationActive(operationGeneration);
      if (!inserted) throw new Error('Mission injection could not be verified');

      const submitButton = getSubmitButton(input);
      assertOperationActive(operationGeneration);
      if (submitButton) submitButton.click();
      else pressEnter(input);

      let started = await verifySubmissionStarted(input, responseHash, manual);
      if (!started && submitButton) {
        assertOperationActive(operationGeneration);
        pressEnter(input);
        started = await verifySubmissionStarted(input, responseHash, manual);
      }
      assertOperationActive(operationGeneration);
      if (!started) throw new Error('Mission submission could not be verified');

      state.drillCount += 1;
      state.lastDrillAt = Date.now();
      state.consecutiveFailures = 0;
      state.backoffUntil = 0;
      state.lastHandledHash = responseHash;
      if (latestHumanUserHash) state.lastHumanUserHash = latestHumanUserHash;
      state.lastRoute = generated.route;
      state.lastMission = {
        id: generated.id,
        route: generated.route,
        domain: generated.domain,
        objective: generated.objective,
        acceptance: generated.acceptance,
        requiresFreshSources: generated.requiresFreshSources,
        dispatchedAt: new Date().toISOString(),
        sourceHash: responseHash
      };
      state.history.push({
        at: new Date().toISOString(),
        platform: platform.id,
        missionId: generated.id,
        route: generated.route,
        domain: generated.domain,
        routeScore: generated.score,
        objective: generated.objective,
        acceptance: generated.acceptance,
        mission: generated.mission,
        sourceHash: responseHash,
        contextSource: generated.context?.source || 'unknown',
        corpusStatus: generated.context?.corpusStatus || 'unknown',
        keywords: generated.context?.keywords || [],
        candidates: generated.candidates,
        previousOutcome
      });
      persistContextMemory({
        at: new Date().toISOString(),
        platform: platform.id,
        userText: generated.context?.latestUserText || '',
        keywords: generated.context?.keywords || [],
        route: generated.route,
        mission: generated.mission,
        missionId: generated.id,
        sourceHash: responseHash,
        contextSource: generated.context?.source || 'unknown',
        previousProgressScore: previousOutcome?.score ?? null,
        previousProgressClass: previousOutcome?.progressClass ?? null
      });
      audit('mission.dispatched', {
        missionId: generated.id,
        route: generated.route,
        domain: generated.domain,
        sourceHash: responseHash,
        note: 'Dispatch is not counted as verified progress; the resulting response is assessed on the next cycle.'
      });
      setStatus(`${generated.route} • dispatched • prior progress ${state.lastProgressScore ?? 'n/a'}`);
      updateHud();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.name === 'AbortError') {
        audit('mission.cancelled', { reason: message });
        setStatus('Cancelled');
        return false;
      }
      state.consecutiveFailures += 1;
      const backoffMs = Math.min(30000, 2000 * (2 ** (state.consecutiveFailures - 1)));
      state.backoffUntil = Date.now() + backoffMs;
      audit('mission.failed', { error: message, backoffMs, consecutiveFailures: state.consecutiveFailures });
      setStatus(`Blocked ${Math.ceil(backoffMs / 1000)}s: ${message}`);
      return false;
    } finally {
      state.processing = false;
    }
  };

  const observeResponse = () => {
    const candidate = getResponseCandidate();
    if (!candidate.strong || !candidate.text) return;
    const text = candidate.text;
    const hash = hashText(text);
    if (hash !== state.candidateHash) {
      state.candidateHash = hash;
      state.candidateSince = Date.now();
      return;
    }
    if (
      hash !== state.lastHandledHash &&
      Date.now() - state.candidateSince >= config.responseStableMs &&
      !isBusy()
    ) {
      void submitDrill();
    }
  };

  const exportSession = () => {
    const payload = {
      schema: 'more-show-progress-session/v2',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      platform: platform.id,
      url: location.href,
      config: { ...config },
      state: { drillCount: state.drillCount, startedAt: new Date(state.startedAt).toISOString(), lastRoute: state.lastRoute, lastProgressScore: state.lastProgressScore, lastProgressClass: state.lastProgressClass, sameProgressFailureCount: state.sameProgressFailureCount },
      history: state.history,
      contextMemory: state.contextMemory,
      lastContextPacket: state.lastContextPacket,
      lastMission: state.lastMission,
      progressReceipts: state.progressReceipts,
      audit: state.audit
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `more-show-${platform.id}-${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit('session.exported');
  };

  const resetSession = () => {
    state.operationGeneration += 1;
    rootsCachedAt = 0;
    state.drillCount = 0;
    state.lastDrillAt = 0;
    state.consecutiveFailures = 0;
    state.sameProgressFailureCount = 0;
    state.lastProgressScore = null;
    state.lastProgressClass = 'UNASSESSED';
    state.lastRoute = 'NONE';
    state.lastMission = null;
    state.progressReceipts = [];
    state.backoffUntil = 0;
    state.history = [];
    state.audit = [];
    const current = getResponseText();
    state.lastHandledHash = current ? hashText(current) : '';
    state.candidateHash = state.lastHandledHash;
    state.candidateSince = Date.now();
    setStatus('Reset');
    updateHud();
  };

  const createHud = () => {
    if (document.getElementById(HUD_ID)) return;
    const host = document.createElement('div');
    host.id = HUD_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    state.hudHost = host;
    state.shadow = shadow;

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        #panel {
          width: min(310px, calc(100vw - 24px)); max-height: calc(100vh - 24px); color: #f8fafc; background: rgba(15,23,42,.96);
          border: 1px solid rgba(148,163,184,.28); border-radius: 12px;
          box-shadow: 0 18px 50px rgba(0,0,0,.38); overflow: hidden;
          font: 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        #header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 12px; background: ${platform.color}; cursor: move; user-select: none;
        }
        #title { font-weight: 750; letter-spacing: .1px; }
        #version { opacity: .78; font-size: 11px; margin-left: 6px; }
        #minimize { border: 0; border-radius: 6px; background: rgba(255,255,255,.18); color: white; width: 27px; height: 27px; cursor: pointer; }
        #body { padding: 11px; max-height: calc(100vh - 86px); overflow: auto; }
        #body.hidden { display: none; }
        .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 7px 0; }
        .row label { color: #cbd5e1; }
        input[type="checkbox"] { width: 17px; height: 17px; accent-color: ${platform.color}; }
        input[type="number"] {
          width: 72px; border: 1px solid #475569; border-radius: 6px;
          background: #0f172a; color: white; padding: 5px 7px;
        }
        #status { margin-top: 9px; padding: 8px; border-radius: 7px; background: #020617; color: #cbd5e1; min-height: 32px; }
        #stats { display: flex; justify-content: space-between; color: #94a3b8; margin-top: 8px; font-size: 11px; }
        #actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 10px; }
        button.action {
          border: 1px solid #475569; border-radius: 7px; padding: 7px 8px;
          background: #1e293b; color: white; cursor: pointer;
        }
        button.action.primary { background: ${platform.color}; border-color: transparent; grid-column: 1 / -1; font-weight: 700; }
        button.action:hover { filter: brightness(1.12); }
        .notice { color: #fbbf24; font-size: 11px; margin-top: 8px; }
      </style>
      <div id="panel">
        <div id="header">
          <div id="title">MoreShow Progress Engine — ${platform.name}<span id="version">v${VERSION}</span></div>
          <button id="minimize" title="Minimize">−</button>
        </div>
        <div id="body">
          <div class="row"><label>Enabled</label><input id="enabled" type="checkbox"></div>
          <div class="row"><label>Auto drill</label><input id="autoDrill" type="checkbox" ${platform.manualOnly ? 'disabled' : ''}></div>
          <div class="row"><label>Safe auto-accept</label><input id="autoAccept" type="checkbox" ${platform.approval ? '' : 'disabled'}></div>
          <div class="row"><label>Max missions</label><input id="maxDepth" type="number" min="1" max="50"></div>
          <div class="row"><label>Interval (seconds)</label><input id="interval" type="number" min="3" max="120" step="1"></div>
          <div class="row"><label>Fresh sources for tech</label><input id="freshSources" type="checkbox"></div>
          <div class="row"><label>Min progress score</label><input id="minProgress" type="number" min="20" max="95"></div>
          ${platform.manualOnly ? '<div class="notice">Notion runs in manual-only mode to avoid typing into ordinary pages.</div>' : ''}
          ${platform.approval ? '' : '<div class="notice">Auto-accept stays disabled until this provider has an explicit approval adapter.</div>'}
          <div id="status">Starting</div>
          <div id="stats"><span id="count">0 missions</span><span id="progress">progress n/a</span><span id="platform">${platform.id}</span></div>
          <div id="actions">
            <button id="drillNow" class="action primary">Advance current response</button>
            <button id="reset" class="action">Reset</button>
            <button id="export" class="action">Export audit</button>
          </div>
        </div>
      </div>
    `;

    const byId = (id) => shadow.getElementById(id);
    byId('enabled').checked = config.enabled;
    byId('autoDrill').checked = platform.manualOnly ? false : config.autoDrill;
    byId('autoAccept').checked = config.autoAccept;
    byId('maxDepth').value = String(config.maxDrillDepth);
    byId('interval').value = String(Math.round(config.drillIntervalMs / 1000));
    byId('freshSources').checked = config.requireFreshSources;
    byId('minProgress').value = String(config.minimumProgressScore);

    const bindBoolean = (id, key) => byId(id).addEventListener('change', (event) => {
      config[key] = Boolean(event.target.checked);
      if (key === 'autoDrill' && platform.manualOnly) config[key] = false;
      if (key === 'autoAccept' && !platform.approval) config[key] = false;
      if (key === 'enabled' && !config.enabled) state.operationGeneration += 1;
      persistConfig();
      audit('config.changed', { key, value: config[key] });
    });
    bindBoolean('enabled', 'enabled');
    bindBoolean('autoDrill', 'autoDrill');
    bindBoolean('autoAccept', 'autoAccept');
    bindBoolean('freshSources', 'requireFreshSources');

    byId('maxDepth').addEventListener('change', (event) => {
      config.maxDrillDepth = Math.max(1, Math.min(50, Number(event.target.value) || DEFAULTS.maxDrillDepth));
      event.target.value = String(config.maxDrillDepth);
      persistConfig();
      updateHud();
    });
    byId('interval').addEventListener('change', (event) => {
      const seconds = Math.max(3, Math.min(120, Number(event.target.value) || 9));
      config.drillIntervalMs = seconds * 1000;
      event.target.value = String(seconds);
      persistConfig();
    });
    byId('minProgress').addEventListener('change', (event) => {
      config.minimumProgressScore = Math.max(20, Math.min(95, Number(event.target.value) || DEFAULTS.minimumProgressScore));
      event.target.value = String(config.minimumProgressScore);
      persistConfig();
    });
    byId('drillNow').addEventListener('click', () => void submitDrill({ manual: true }));
    byId('reset').addEventListener('click', resetSession);
    byId('export').addEventListener('click', exportSession);
    byId('minimize').addEventListener('click', () => {
      config.minimized = !config.minimized;
      byId('body').classList.toggle('hidden', config.minimized);
      byId('minimize').textContent = config.minimized ? '+' : '−';
      persistConfig();
    });
    byId('body').classList.toggle('hidden', config.minimized);
    byId('minimize').textContent = config.minimized ? '+' : '−';

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    byId('header').addEventListener('pointerdown', (event) => {
      if (event.target.id === 'minimize') return;
      dragging = true;
      const rect = host.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      byId('header').setPointerCapture(event.pointerId);
    });
    byId('header').addEventListener('pointermove', (event) => {
      if (!dragging) return;
      host.style.left = `${Math.max(0, event.clientX - offsetX)}px`;
      host.style.top = `${Math.max(0, event.clientY - offsetY)}px`;
      host.style.right = 'auto';
    });
    byId('header').addEventListener('pointerup', () => { dragging = false; });
    updateHud();
  };

  const setStatus = (message) => {
    if (!state.shadow) return;
    const status = state.shadow.getElementById('status');
    if (status) status.textContent = message;
  };

  const updateHud = () => {
    if (!state.shadow) return;
    const count = state.shadow.getElementById('count');
    const progress = state.shadow.getElementById('progress');
    if (count) count.textContent = `${state.drillCount}/${config.maxDrillDepth} missions`;
    if (progress) progress.textContent = `progress ${state.lastProgressScore ?? 'n/a'} • ${state.lastProgressClass}`;
  };

  const registerTrustedActivity = (event) => {
    if (!event.isTrusted) return;
    if (state.hudHost && event.composedPath().includes(state.hudHost)) return;
    state.lastTrustedActivityAt = Date.now();
  };

  const handleRouteChange = () => {
    if (location.href === state.currentUrl) return;
    state.currentUrl = location.href;
    state.operationGeneration += 1;
    state.drillCount = 0;
    state.consecutiveFailures = 0;
    state.sameProgressFailureCount = 0;
    state.lastProgressScore = null;
    state.lastProgressClass = 'UNASSESSED';
    state.lastRoute = 'NONE';
    state.lastMission = null;
    state.backoffUntil = 0;
    state.lastHandledHash = '';
    state.lastHumanUserHash = '';
    state.candidateHash = '';
    state.candidateSince = Date.now();
    clearTimeout(state.baselineTimer);
    const scheduledUrl = state.currentUrl;
    state.baselineTimer = setTimeout(() => {
      if (location.href === scheduledUrl) seedResponseBaseline();
    }, 700);
    audit('route.changed');
  };

  const patchHistory = () => {
    for (const method of ['pushState', 'replaceState']) {
      try {
        const original = history[method];
        if (typeof original !== 'function') continue;
        history[method] = function patchedHistory(...args) {
          const result = original.apply(this, args);
          queueMicrotask(handleRouteChange);
          return result;
        };
      } catch (error) {
        debug('history patch unavailable', method, error);
      }
    }
    addEventListener('popstate', handleRouteChange);
    addEventListener('hashchange', handleRouteChange);
  };

  const seedResponseBaseline = () => {
    const current = getResponseText() || getResponseText(true);
    const hash = current ? hashText(current) : '';
    state.lastHandledHash = hash;
    state.candidateHash = hash;
    state.candidateSince = Date.now();
    const diagnostics = getDiagnostics();
    const ready = platform.manualOnly ? 'Ready — manual only' : 'Ready';
    setStatus(`${ready} • input ${diagnostics.input} • response ${diagnostics.response} • send ${diagnostics.submit}`);
    audit('runtime.ready', { initialResponseHash: hash || null });
  };

  const tick = () => {
    try {
      handleRouteChange();
      safeAutoAccept();
      observeResponse();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      audit('runtime.error', { error: message });
    }
  };

  const init = () => {
    createHud();
    patchHistory();
    for (const eventName of ['pointerdown', 'keydown', 'input', 'paste']) {
      document.addEventListener(eventName, registerTrustedActivity, true);
    }
    gmRegisterMenuCommand('MoreShow: Toggle panel', () => {
      if (!state.hudHost) return;
      state.hudHost.style.display = state.hudHost.style.display === 'none' ? 'block' : 'none';
    });
    gmRegisterMenuCommand('MoreShow: Advance now', () => void submitDrill({ manual: true }));
    gmRegisterMenuCommand('MoreShow: Toggle auto advance', () => {
      if (platform.manualOnly) return;
      config.autoDrill = !config.autoDrill;
      persistConfig();
      if (state.shadow) state.shadow.getElementById('autoDrill').checked = config.autoDrill;
      audit('config.changed', { key: 'autoDrill', value: config.autoDrill });
    });
    gmRegisterMenuCommand('MoreShow: Emergency stop', () => {
      state.operationGeneration += 1;
      config.enabled = false;
      config.autoDrill = false;
      config.autoAccept = false;
      persistConfig();
      setStatus('Emergency stop');
      if (state.shadow) {
        state.shadow.getElementById('enabled').checked = false;
        state.shadow.getElementById('autoDrill').checked = false;
        state.shadow.getElementById('autoAccept').checked = false;
      }
      audit('runtime.emergency-stop');
    });
    addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault();
        void submitDrill({ manual: true });
      }
    }, true);
    state.baselineTimer = setTimeout(seedResponseBaseline, 900);
    state.ticker = setInterval(tick, 700);
  };

  try {
    console.info(`[MoreShow:${platform.id}] booting v${VERSION}`, location.href);
    init();
  } catch (error) {
    console.error('[MoreShow] boot failure', error);
    const failure = document.createElement('div');
    failure.id = `${HUD_ID}-failure`;
    failure.textContent = `MoreShow v${VERSION} failed: ${error instanceof Error ? error.message : String(error)}`;
    failure.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:10px;border-radius:8px;background:#7f1d1d;color:white;font:12px system-ui;word-break:break-word';
    document.documentElement.appendChild(failure);
  }
})();
