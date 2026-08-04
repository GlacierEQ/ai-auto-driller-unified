// ==UserScript==
// @name         AI Auto-Driller Master
// @namespace    https://github.com/GlacierEQ
// @version      5.0.0
// @description  One hardened, cross-platform Auto Driller with verified input, response-stability detection, retries, audit export, and isolated UI.
// @author       GlacierEQ
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
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
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/GlacierEQ/ai-auto-driller-unified/main/scripts/auto-driller-master.user.js
// @updateURL    https://raw.githubusercontent.com/GlacierEQ/ai-auto-driller-unified/main/scripts/auto-driller-master.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '5.0.0';
  const INSTANCE_KEY = 'autoDrillerMasterV5';
  const STORE_KEY = 'auto-driller-master:v5';
  const HUD_ID = 'auto-driller-master-host';

  if (window.top !== window || document.documentElement.dataset[INSTANCE_KEY] === '1') return;
  document.documentElement.dataset[INSTANCE_KEY] = '1';

  const DEFAULTS = Object.freeze({
    enabled: true,
    autoDrill: false,
    autoAccept: false,
    maxDrillDepth: 5,
    drillIntervalMs: 7000,
    userQuietMs: 10000,
    responseStableMs: 1400,
    debug: false,
    minimized: false
  });

  const PLATFORM_DEFINITIONS = [
    {
      id: 'chatgpt', name: 'ChatGPT', color: '#10a37f',
      hosts: [/^(chatgpt\.com|chat\.openai\.com)$/],
      input: ['#prompt-textarea', 'textarea[placeholder*="Message" i]', '[contenteditable="true"][role="textbox"]'],
      submit: ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
      response: ['[data-message-author-role="assistant"]', 'article [data-message-author-role="assistant"]'],
      busy: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', '[class*="result-streaming"]']
    },
    {
      id: 'claude', name: 'Claude', color: '#d97757',
      hosts: [/^claude\.ai$/],
      input: ['div[contenteditable="true"][role="textbox"]', '.ProseMirror[contenteditable="true"]', 'textarea'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="assistant" i]', '[data-is-streaming]', '.font-claude-response', '.prose'],
      busy: ['button[aria-label*="Stop" i]', '[data-is-streaming="true"]', '[class*="generating"]']
    },
    {
      id: 'gemini', name: 'Gemini', color: '#4285f4',
      hosts: [/^gemini\.google\.com$/],
      input: ['rich-textarea [contenteditable="true"]', '.ql-editor[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]', 'textarea'],
      submit: ['button[aria-label*="Send" i]', 'button[aria-label*="Submit" i]', '.send-button'],
      response: ['model-response', '[data-test-id*="model-response" i]', '.model-response-text', '.markdown'],
      busy: ['button[aria-label*="Stop" i]', '[class*="loading"]', '[class*="generating"]']
    },
    {
      id: 'perplexity', name: 'Perplexity', color: '#20808d',
      hosts: [/^(www\.)?perplexity\.ai$/],
      input: ['textarea[placeholder*="Ask" i]', 'textarea[role="textbox"]', 'textarea', '[contenteditable="true"][role="textbox"]'],
      submit: ['button[type="submit"]', 'button[aria-label*="Submit" i]', 'button[aria-label*="Send" i]'],
      response: ['[data-testid*="answer" i]', '[class*="answer"] .prose', 'article .prose', '.prose'],
      busy: ['[aria-busy="true"]', 'button[aria-label*="Stop" i]', '[class*="generating"]']
    },
    {
      id: 'grok', name: 'Grok', color: '#e11d8a',
      hosts: [/^grok\.com$/, /^x\.com$/],
      scope: (host, pathname) => host === 'grok.com' || /^\/i\/grok/.test(pathname),
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="message" i]', '[class*="response"]', '.markdown', '.prose'],
      busy: ['button[aria-label*="Stop" i]', '[class*="generating"]', '[aria-busy="true"]']
    },
    {
      id: 'deepseek', name: 'DeepSeek', color: '#2563eb',
      hosts: [/^chat\.deepseek\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]'],
      submit: ['button[class*="send" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['.ds-markdown', '[class*="markdown"]', '[class*="response"]', '.prose'],
      busy: ['ds-loading', 'button[aria-label*="Stop" i]', '[class*="loading"]', '[class*="generating"]']
    },
    {
      id: 'kimi', name: 'Kimi', color: '#6d5dfc',
      hosts: [/^(www\.)?kimi\.com$/, /^kimi\.moonshot\.cn$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="发送" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[class*="segment-content"]', '[class*="markdown"]', '[class*="response"]', '[class*="message"]'],
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="typing"]']
    },
    {
      id: 'qwen', name: 'Qwen', color: '#615ced',
      hosts: [/^chat\.qwen\.ai$/, /^tongyi\.aliyun\.com$/, /^qianwen\.aliyun\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="发送" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[class*="answer"] [class*="markdown"]', '.markdown-body', '[class*="response"]', '[class*="message"]'],
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="typing"]']
    },
    {
      id: 'cohere', name: 'Cohere', color: '#39594d',
      hosts: [/^chat\.cohere\.com$/],
      input: ['textarea', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      response: ['[data-testid*="assistant" i]', '[class*="response"]', '.markdown', '.prose'],
      busy: ['[aria-busy="true"]', '[class*="generating"]', '[class*="spinner"]']
    },
    {
      id: 'notion', name: 'Notion AI', color: '#111827', manualOnly: true,
      hosts: [/^(www\.)?notion\.so$/],
      input: ['[role="dialog"] textarea', '[role="dialog"] [contenteditable="true"]'],
      submit: ['[role="dialog"] button[type="submit"]', '[role="dialog"] button[aria-label*="Send" i]'],
      response: ['[role="dialog"] [class*="notion-ai"]', '[role="dialog"] .notion-page-content', '[role="dialog"] .prose'],
      busy: ['[role="dialog"] [aria-busy="true"]', '[role="dialog"] [class*="loading"]']
    },
    {
      id: 'local', name: 'Local LLM', color: '#a21caf',
      hosts: [/^localhost$/, /^127\.0\.0\.1$/],
      input: ['#chat-input', 'textarea[placeholder*="message" i]', 'textarea', 'div[contenteditable="true"][role="textbox"]'],
      submit: ['button[aria-label*="Send" i]', 'button[type="submit"]', '#send-button'],
      response: ['[data-message-role="assistant"]', '.message.assistant', '[class*="assistant"] .prose', '.prose'],
      busy: ['button[aria-label*="Stop" i]', '[aria-busy="true"]', '[class*="generating"]']
    }
  ];

  const platform = PLATFORM_DEFINITIONS.find((candidate) => {
    const hostMatch = candidate.hosts.some((rule) => rule.test(location.hostname));
    return hostMatch && (!candidate.scope || candidate.scope(location.hostname, location.pathname));
  });
  if (!platform) return;

  const storedConfig = GM_getValue(`${STORE_KEY}:config`, {});
  const config = { ...DEFAULTS, ...(storedConfig && typeof storedConfig === 'object' ? storedConfig : {}) };
  const clampNumber = (value, minimum, maximum, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
  };
  config.enabled = Boolean(config.enabled);
  config.autoDrill = Boolean(config.autoDrill);
  config.autoAccept = Boolean(config.autoAccept);
  config.debug = Boolean(config.debug);
  config.minimized = Boolean(config.minimized);
  config.maxDrillDepth = Math.round(clampNumber(config.maxDrillDepth, 1, 50, DEFAULTS.maxDrillDepth));
  config.drillIntervalMs = clampNumber(config.drillIntervalMs, 3000, 120000, DEFAULTS.drillIntervalMs);
  config.userQuietMs = clampNumber(config.userQuietMs, 0, 120000, DEFAULTS.userQuietMs);
  config.responseStableMs = clampNumber(config.responseStableMs, 500, 10000, DEFAULTS.responseStableMs);
  if (platform.manualOnly) config.autoDrill = false;

  const state = {
    startedAt: Date.now(),
    drillCount: 0,
    processing: false,
    lastDrillAt: 0,
    consecutiveFailures: 0,
    backoffUntil: 0,
    lastTrustedActivityAt: 0,
    lastHandledHash: '',
    candidateHash: '',
    candidateSince: 0,
    lastResponseText: '',
    currentUrl: location.href,
    history: [],
    audit: [],
    clickedApprovals: new WeakSet(),
    hudHost: null,
    shadow: null,
    ticker: null
  };

  const DRILL_PATTERNS = Object.freeze({
    clarification: [
      'Clarify the most important ambiguity in {topic}, then provide a concrete example.',
      'Break {topic} into its essential components and explain how they relate.'
    ],
    depth: [
      'What underlying mechanisms or assumptions control {topic}?',
      'Take {topic} one level deeper and identify what is usually overlooked.'
    ],
    practical: [
      'Turn {topic} into a step-by-step implementation with clear acceptance criteria.',
      'What is the strongest practical workflow for applying {topic} now?'
    ],
    comparative: [
      'Compare {topic} with the strongest realistic alternative and recommend one.',
      'What tradeoffs would change the decision about {topic}?'
    ],
    verification: [
      'Audit the claims about {topic}. Separate verified facts, inferences, assumptions, and unresolved gaps.',
      'What evidence or tests would falsify the current conclusions about {topic}?'
    ],
    technical: [
      'Design a production-grade architecture for {topic}, including failure modes and observability.',
      'Identify the main performance, security, and reliability risks in {topic}, then harden them.'
    ],
    problem_solving: [
      'Find the highest-leverage unresolved problem in {topic} and solve it concretely.',
      'What is currently blocking completion of {topic}, and what exact action removes that block?'
    ],
    integration: [
      'Map how {topic} should integrate with the surrounding systems, contracts, and data flows.',
      'Identify the dependencies and downstream effects of implementing {topic}.'
    ]
  });
  const PATTERN_WEIGHTS = Object.freeze({
    clarification: 1,
    depth: 2,
    practical: 4,
    comparative: 2,
    verification: 4,
    technical: 4,
    problem_solving: 4,
    integration: 3
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const debug = (...args) => {
    if (config.debug) console.debug(`[AutoDriller:${platform.id}]`, ...args);
  };
  const persistConfig = () => GM_setValue(`${STORE_KEY}:config`, { ...config, autoDrill: platform.manualOnly ? false : config.autoDrill });

  const audit = (type, details = {}) => {
    const event = { at: new Date().toISOString(), type, platform: platform.id, url: location.href, ...details };
    state.audit.push(event);
    if (state.audit.length > 250) state.audit.splice(0, state.audit.length - 250);
    debug(type, details);
    updateHud();
  };

  const isVisible = (element) => {
    if (!(element instanceof Element) || !element.isConnected) return false;
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
    if (Date.now() - rootsCachedAt < 5000) return cachedRoots;
    const roots = [document];
    const rootQueue = [document];
    const discoveredRoots = new Set(rootQueue);
    while (rootQueue.length) {
      const root = rootQueue.shift();
      const elements = root === document
        ? [document.documentElement, ...document.querySelectorAll('*')]
        : [...root.querySelectorAll('*')];
      for (const element of elements) {
        if (!(element instanceof Element) || !element.shadowRoot || discoveredRoots.has(element.shadowRoot)) continue;
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
    const signature = normalize([
      element.getAttribute('data-message-author-role') || '',
      element.getAttribute('data-testid') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('role') || '',
      element.className || ''
    ].join(' ')).toLowerCase();
    let score = 0;
    if (/(assistant|model|answer|response|claude|gemini)/.test(signature)) score += 8;
    if (/(markdown|prose)/.test(signature)) score += 2;
    if (/(user|human|prompt|composer|input)/.test(signature)) score -= 12;
    return score;
  };
  const compareDocumentOrder = (left, right) => {
    const relation = left.compareDocumentPosition(right);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  };
  const lastVisible = (selectors, minLength = 0) => {
    const matches = queryAll(selectors)
      .filter((element) => isVisible(element) && normalize(element.textContent).length >= minLength)
      .sort((left, right) => responseScore(left) - responseScore(right) || compareDocumentOrder(left, right));
    return matches.length ? matches[matches.length - 1] : null;
  };

  const elementValue = (element) => {
    if (!element) return '';
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
    return element.isContentEditable ? element.innerText || element.textContent || '' : element.textContent || '';
  };

  const setFormControlValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
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
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
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

  const getResponseText = () => {
    const response = lastVisible(platform.response, 30);
    return normalize(response?.textContent);
  };

  const hashText = (text) => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const isBusy = () => platform.busy.some((selector) => {
    try {
      return queryAll([selector]).some(isVisible);
    } catch {
      return false;
    }
  });

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

  const extractTopic = (text) => {
    const stopWords = new Set([
      'the','and','that','this','with','from','have','will','would','could','should','into','about','there',
      'their','what','when','where','which','while','your','youre','they','them','then','than','also','only',
      'using','used','does','doing','done','been','were','was','are','for','not','but','all','any','can'
    ]);
    const words = normalize(text)
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));
    return words.slice(0, 5).join(' ') || 'the current subject';
  };

  const weightedChoice = () => {
    const entries = Object.entries(PATTERN_WEIGHTS);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.random() * total;
    for (const [category, weight] of entries) {
      cursor -= weight;
      if (cursor <= 0) return category;
    }
    return entries[entries.length - 1][0];
  };

  const generateQuestion = (responseText) => {
    const category = weightedChoice();
    const patterns = DRILL_PATTERNS[category];
    const template = patterns[Math.floor(Math.random() * patterns.length)];
    return {
      category,
      question: template.replaceAll('{topic}', extractTopic(responseText))
    };
  };

  const safeAutoAccept = () => {
    if (!config.autoAccept) return;
    const allowedLabels = new Set([
      'allow', 'allow once', 'approve', 'accept', 'confirm', 'continue', 'run', 'run tool',
      '允许', '确认', '继续', '运行'
    ]);
    for (const button of queryAll(['button', '[role="button"]'])) {
      if (!isVisible(button) || state.clickedApprovals.has(button)) continue;
      const label = normalize(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`).toLowerCase();
      if (!allowedLabels.has(label)) continue;
      if (/(always|remember|delete|remove|purchase|pay|send email|publish|merge|overwrite|share|post)/i.test(label)) continue;
      const container = button.closest('[role="dialog"], [data-testid*="tool" i], [class*="tool" i], [class*="permission" i], [class*="confirm" i]');
      if (!container) continue;
      const context = normalize(container.textContent).toLowerCase();
      if (/(delete|remove|purchase|payment|send email|publish|merge|overwrite|share publicly|post publicly|submit order)/i.test(context)) continue;
      if (!/(tool|permission|allow|approve|confirm|continue|run|execute|action|access|允许|确认|运行)/i.test(context)) continue;
      state.clickedApprovals.add(button);
      button.click();
      audit('approval.clicked', { label });
    }
  };

  const verifySubmissionStarted = async (input, previousHash) => {
    return waitUntil(() => {
      const inputCleared = normalize(elementValue(input)).length === 0;
      const responseHash = hashText(getResponseText());
      return isBusy() || inputCleared || (responseHash && responseHash !== previousHash);
    }, 5500);
  };

  const submitDrill = async ({ manual = false } = {}) => {
    if (state.processing || !config.enabled) return false;
    if (!manual && platform.manualOnly) return false;
    if (!manual && !config.autoDrill) return false;
    if (!manual && Date.now() < state.backoffUntil) return false;
    if (state.drillCount >= config.maxDrillDepth) {
      setStatus('Depth limit');
      return false;
    }
    if (!manual && Date.now() - state.lastDrillAt < config.drillIntervalMs) return false;
    if (!manual && Date.now() - state.lastTrustedActivityAt < config.userQuietMs) return false;
    if (isBusy()) return false;

    const responseText = getResponseText();
    if (!responseText) {
      setStatus('No response found');
      audit('drill.blocked', { reason: 'no-response' });
      return false;
    }

    const responseHash = hashText(responseText);
    if (!manual && responseHash === state.lastHandledHash) return false;

    state.processing = true;
    setStatus('Preparing');
    const generated = generateQuestion(responseText);
    audit('drill.preparing', { category: generated.category, responseHash });

    try {
      const input = await waitUntil(() => getInput(), 4000) ? getInput() : null;
      if (!input) throw new Error('Prompt input not found');
      if (normalize(elementValue(input))) throw new Error('Prompt input is not empty');

      setInputValue(input, generated.question);
      const inserted = await waitUntil(
        () => normalize(elementValue(input)).includes(normalize(generated.question).slice(0, 24)),
        1800
      );
      if (!inserted) throw new Error('Prompt injection could not be verified');

      const submitButton = getSubmitButton(input);
      if (submitButton) submitButton.click();
      else pressEnter(input);

      let started = await verifySubmissionStarted(input, responseHash);
      if (!started && submitButton) {
        pressEnter(input);
        started = await verifySubmissionStarted(input, responseHash);
      }
      if (!started) throw new Error('Submission could not be verified');

      state.drillCount += 1;
      state.lastDrillAt = Date.now();
      state.consecutiveFailures = 0;
      state.backoffUntil = 0;
      state.lastHandledHash = responseHash;
      state.history.push({
        at: new Date().toISOString(),
        platform: platform.id,
        category: generated.category,
        question: generated.question,
        sourceHash: responseHash
      });
      audit('drill.submitted', { category: generated.category, sourceHash: responseHash });
      setStatus(`Drill ${state.drillCount}/${config.maxDrillDepth}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.consecutiveFailures += 1;
      const backoffMs = Math.min(30000, 2000 * (2 ** (state.consecutiveFailures - 1)));
      state.backoffUntil = Date.now() + backoffMs;
      audit('drill.failed', { error: message, backoffMs, consecutiveFailures: state.consecutiveFailures });
      setStatus(`Blocked ${Math.ceil(backoffMs / 1000)}s: ${message}`);
      return false;
    } finally {
      state.processing = false;
    }
  };

  const observeResponse = () => {
    const text = getResponseText();
    if (!text) return;
    const hash = hashText(text);
    if (hash !== state.candidateHash) {
      state.candidateHash = hash;
      state.candidateSince = Date.now();
      state.lastResponseText = text;
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
      schema: 'auto-driller-session/v1',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      platform: platform.id,
      url: location.href,
      config: { ...config },
      state: { drillCount: state.drillCount, startedAt: new Date(state.startedAt).toISOString() },
      history: state.history,
      audit: state.audit
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `auto-driller-${platform.id}-${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit('session.exported');
  };

  const resetSession = () => {
    state.drillCount = 0;
    state.lastDrillAt = 0;
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
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    host.style.all = 'initial';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    state.hudHost = host;
    state.shadow = shadow;

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        #panel {
          width: 310px; color: #f8fafc; background: rgba(15,23,42,.96);
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
        #body { padding: 11px; }
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
        #manual { color: #fbbf24; font-size: 11px; margin-top: 8px; }
      </style>
      <div id="panel">
        <div id="header">
          <div id="title">Auto Driller — ${platform.name}<span id="version">v${VERSION}</span></div>
          <button id="minimize" title="Minimize">−</button>
        </div>
        <div id="body">
          <div class="row"><label>Enabled</label><input id="enabled" type="checkbox"></div>
          <div class="row"><label>Auto drill</label><input id="autoDrill" type="checkbox" ${platform.manualOnly ? 'disabled' : ''}></div>
          <div class="row"><label>Safe auto-accept</label><input id="autoAccept" type="checkbox"></div>
          <div class="row"><label>Max depth</label><input id="maxDepth" type="number" min="1" max="50"></div>
          <div class="row"><label>Interval (seconds)</label><input id="interval" type="number" min="3" max="120" step="1"></div>
          ${platform.manualOnly ? '<div id="manual">Notion runs in manual-only mode to avoid typing into ordinary pages.</div>' : ''}
          <div id="status">Starting</div>
          <div id="stats"><span id="count">0 drills</span><span id="platform">${platform.id}</span></div>
          <div id="actions">
            <button id="drillNow" class="action primary">Drill current response</button>
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

    const bindBoolean = (id, key) => byId(id).addEventListener('change', (event) => {
      config[key] = Boolean(event.target.checked);
      if (key === 'autoDrill' && platform.manualOnly) config[key] = false;
      persistConfig();
      audit('config.changed', { key, value: config[key] });
    });
    bindBoolean('enabled', 'enabled');
    bindBoolean('autoDrill', 'autoDrill');
    bindBoolean('autoAccept', 'autoAccept');

    byId('maxDepth').addEventListener('change', (event) => {
      config.maxDrillDepth = Math.max(1, Math.min(50, Number(event.target.value) || DEFAULTS.maxDrillDepth));
      event.target.value = String(config.maxDrillDepth);
      persistConfig();
      updateHud();
    });
    byId('interval').addEventListener('change', (event) => {
      const seconds = Math.max(3, Math.min(120, Number(event.target.value) || 7));
      config.drillIntervalMs = seconds * 1000;
      event.target.value = String(seconds);
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
    if (count) count.textContent = `${state.drillCount}/${config.maxDrillDepth} drills`;
  };

  const registerTrustedActivity = (event) => {
    if (!event.isTrusted) return;
    if (state.hudHost && event.composedPath().includes(state.hudHost)) return;
    state.lastTrustedActivityAt = Date.now();
  };

  const handleRouteChange = () => {
    if (location.href === state.currentUrl) return;
    state.currentUrl = location.href;
    state.drillCount = 0;
    state.consecutiveFailures = 0;
    state.backoffUntil = 0;
    state.lastHandledHash = '';
    state.candidateHash = '';
    state.candidateSince = Date.now();
    setTimeout(seedResponseBaseline, 700);
    audit('route.changed');
  };

  const patchHistory = () => {
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function patchedHistory(...args) {
        const result = original.apply(this, args);
        queueMicrotask(handleRouteChange);
        return result;
      };
    }
    addEventListener('popstate', handleRouteChange);
    addEventListener('hashchange', handleRouteChange);
  };

  const seedResponseBaseline = () => {
    const current = getResponseText();
    const hash = current ? hashText(current) : '';
    state.lastHandledHash = hash;
    state.candidateHash = hash;
    state.candidateSince = Date.now();
    state.lastResponseText = current;
    setStatus(platform.manualOnly ? 'Ready — manual only' : 'Ready');
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
    GM_registerMenuCommand('Auto Driller: Toggle panel', () => {
      if (!state.hudHost) return;
      state.hudHost.style.display = state.hudHost.style.display === 'none' ? 'block' : 'none';
    });
    GM_registerMenuCommand('Auto Driller: Drill now', () => void submitDrill({ manual: true }));
    GM_registerMenuCommand('Auto Driller: Toggle auto drill', () => {
      if (platform.manualOnly) return;
      config.autoDrill = !config.autoDrill;
      persistConfig();
      if (state.shadow) state.shadow.getElementById('autoDrill').checked = config.autoDrill;
      audit('config.changed', { key: 'autoDrill', value: config.autoDrill });
    });
    GM_registerMenuCommand('Auto Driller: Emergency stop', () => {
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
    setTimeout(seedResponseBaseline, 900);
    state.ticker = setInterval(tick, 700);
  };

  init();
})();
