/* eslint-env node */
/**
 * Auto Driller Master v5 validation harness.
 * Static and contract-level checks that run without a browser.
 */
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const target = path.join(__dirname, 'auto-driller-master.user.js');
let source = '';
let readError = null;
try {
  source = fs.readFileSync(target, 'utf8');
} catch (error) {
  readError = error;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(value, message) {
  assert(source.includes(value), message || `Missing ${value}`);
}

function occurrences(value) {
  return source.split(value).length - 1;
}

function metadata() {
  const match = source.match(/\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/);
  assert(match, 'Missing userscript metadata block');
  const entries = new Map();
  for (const line of match[1].split('\n')) {
    const item = line.match(/^\/\/\s+(@\S+)\s+(.+)$/);
    if (!item) continue;
    const [, key, value] = item;
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(value.trim());
  }
  return entries;
}

test('target userscript is readable', () => {
  assert(!readError, readError ? `Cannot read ${target}: ${readError.message}` : 'Unreadable target');
  assert(source.length > 0, 'Target userscript is empty');
});

test('JavaScript syntax compiles', () => {
  new vm.Script(source, { filename: target });
});

test('userscript metadata is complete', () => {
  const entries = metadata();
  for (const field of ['@name', '@namespace', '@version', '@description', '@run-at', '@downloadURL', '@updateURL']) {
    const values = entries.get(field) || [];
    assert(values.length > 0 && values.every(Boolean), `Missing or empty metadata field ${field}`);
  }
});

test('supported platform matches are present in metadata', () => {
  const matches = metadata().get('@match') || [];
  const expected = [
    'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai',
    'grok.com', 'chat.deepseek.com', 'kimi.com', 'chat.qwen.ai',
    'chat.cohere.com', 'notion.so', 'localhost', '127.0.0.1'
  ];
  for (const domain of expected) {
    assert(matches.some((value) => value.includes(domain)), `Missing @match for ${domain}`);
  }
});

test('dangerous automation defaults are disabled', () => {
  assert(/autoDrill:\s*false/.test(source), 'autoDrill must default to false');
  assert(/autoAccept:\s*false/.test(source), 'autoAccept must default to false');
});

test('invalid Playwright-only selectors are absent', () => {
  assert(!source.includes(':has-text('), 'Contains invalid :has-text selector');
  assert(!source.includes('button:has(svg)'), 'Contains overly broad SVG button selector');
});

test('input drivers cover framework and contenteditable controls', () => {
  includes('HTMLTextAreaElement.prototype');
  includes('HTMLInputElement.prototype');
  includes('setContentEditableValue');
  includes("new InputEvent('beforeinput'");
});

test('actions are verified exactly once before counting success', () => {
  includes('Prompt injection could not be verified');
  includes('Submission could not be verified');
  includes('verifySubmissionStarted');
  assert(occurrences('state.drillCount += 1') === 1, 'Drill count must have exactly one increment site');
  const countIndex = source.indexOf('state.drillCount += 1');
  const verifyIndex = source.indexOf("if (!started) throw new Error('Submission could not be verified')");
  assert(countIndex > verifyIndex, 'Drill count must increment only after verification');
});

test('response handling uses stability and deduplication', () => {
  includes('responseStableMs');
  includes('lastHandledHash');
  includes('candidateHash');
  includes('hashText');
});

test('automatic response selection requires strong assistant candidates', () => {
  includes('strongResponseCount');
  includes('getResponseCandidate');
  includes('if (!candidate.strong || !candidate.text) return');
  includes('lastVisible(strongSelectors, 4, 1)');
  includes('allowFallback');
});

test('short valid model replies are accepted', () => {
  includes('lastVisible(strongSelectors, 4, 1)');
  assert(!source.includes('lastVisible(platform.response, 30)'), 'Still rejects concise replies under 30 characters');
});

test('empty response cannot satisfy submission verification', () => {
  includes("const responseHash = responseText ? hashText(responseText) : ''");
  includes('Boolean(responseHash && responseHash !== previousHash)');
});

test('UI is isolated and fixed after reset styles', () => {
  includes("attachShadow({ mode: 'open' })");
  const resetIndex = source.indexOf("host.style.all = 'initial'");
  const fixedIndex = source.indexOf("host.style.position = 'fixed'");
  assert(resetIndex >= 0 && fixedIndex > resetIndex, 'HUD style reset must occur before fixed positioning');
});

test('SPA route changes are guarded against stale baselines', () => {
  includes("'pushState'");
  includes("'replaceState'");
  includes("'popstate'");
  includes('clearTimeout(state.baselineTimer)');
  includes('const scheduledUrl = state.currentUrl');
  includes('if (location.href === scheduledUrl) seedResponseBaseline()');
});

test('audit export, retention, and emergency stop exist', () => {
  includes("schema: 'auto-driller-session/v1'");
  includes('runtime.emergency-stop');
  includes('Export audit');
  includes('state.audit.length > 250');
  includes('state.audit.splice(0, state.audit.length - 250)');
});

test('Notion is manual only', () => {
  assert(/id:\s*'notion'[\s\S]*?manualOnly:\s*true/.test(source), 'Notion must remain manual-only');
});

test('Grok routing is host-aware', () => {
  includes("scope: (host, pathname) => host === 'grok.com' || /^\\/i\\/grok/.test(pathname)");
  includes('candidate.scope(location.hostname, location.pathname)');
  assert(!/path:\s*\/\^\\\/i\\\/grok\s*\|\s*\.\*\//.test(source), 'Grok routing still contains an all-path alternative');
});

test('failed submissions use bounded exponential backoff', () => {
  includes('consecutiveFailures');
  includes('backoffUntil');
  includes('Math.min(30000');
  includes('Date.now() < state.backoffUntil');
});

test('DOM root discovery is cached and busy selectors are batched', () => {
  includes('cachedRoots');
  includes('rootsCachedAt');
  includes('Date.now() - rootsCachedAt < 750');
  includes('const isBusy = () => queryAll(platform.busy).some(isVisible)');
});

test('auto-accept requires global enable and provider-specific adapter', () => {
  includes('if (!platform.approval) config.autoAccept = false');
  includes('if (!config.enabled || !config.autoAccept || !approval) return');
  includes('queryAll(approval.buttons || [])');
  includes('approval.requestPattern.test(context)');
  includes('approval.denyPattern.test(context)');
  includes("platform.approval ? '' : 'disabled'");
});

test('emergency stop cancels in-flight operations', () => {
  includes('operationGeneration');
  includes('assertOperationActive');
  includes("error.name = 'AbortError'");
  includes("error.name === 'AbortError'");
  assert(occurrences('assertOperationActive(operationGeneration)') >= 5, 'Cancellation must be checked across awaited boundaries');
  includes('state.operationGeneration += 1');
});

test('route changes preserve prior session history', () => {
  const routeStart = source.indexOf('const handleRouteChange');
  const routeEnd = source.indexOf('const patchHistory', routeStart);
  assert(routeStart !== -1 && routeEnd !== -1 && routeEnd > routeStart, 'Unable to locate route change block');
  const routeBlock = source.slice(routeStart, routeEnd);
  assert(!routeBlock.includes('state.history = []'), 'Route change must not erase session history');
});


test('reset clears cancellation and retry state', () => {
  const resetStart = source.indexOf('const resetSession');
  const resetEnd = source.indexOf('const createHud', resetStart);
  assert(resetStart !== -1 && resetEnd !== -1 && resetEnd > resetStart, 'Unable to locate reset block');
  const resetBlock = source.slice(resetStart, resetEnd);
  assert(resetBlock.includes('state.operationGeneration += 1'), 'Reset must cancel in-flight work');
  assert(resetBlock.includes('state.consecutiveFailures = 0'), 'Reset must clear failure count');
  assert(resetBlock.includes('state.backoffUntil = 0'), 'Reset must clear retry backoff');
});

test('dead response-text state is absent', () => {
  assert(!source.includes('lastResponseText'), 'Dead lastResponseText state remains');
});

test('script size remains bounded', () => {
  assert(Buffer.byteLength(source, 'utf8') < 100_000, 'Master userscript exceeds 100 KB');
  assert(source.split('\n').length < 1200, 'Master userscript exceeds 1200 lines');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
