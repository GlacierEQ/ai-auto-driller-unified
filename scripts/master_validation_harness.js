/**
 * Auto Driller Master v5 validation harness.
 * Static and contract-level checks that run without a browser.
 */
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const target = path.join(__dirname, 'auto-driller-master.user.js');
const source = fs.readFileSync(target, 'utf8');

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

test('JavaScript syntax compiles', () => {
  new vm.Script(source, { filename: target });
});

test('userscript metadata is complete', () => {
  for (const field of ['@name', '@namespace', '@version', '@description', '@run-at', '@downloadURL', '@updateURL']) {
    includes(`// ${field}`, `Missing metadata field ${field}`);
  }
});

test('supported platform matches are present', () => {
  const expected = [
    'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai',
    'grok.com', 'chat.deepseek.com', 'kimi.com', 'chat.qwen.ai',
    'chat.cohere.com', 'notion.so', 'localhost', '127.0.0.1'
  ];
  for (const domain of expected) includes(domain, `Missing match for ${domain}`);
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

test('actions are verified before counting success', () => {
  includes('Prompt injection could not be verified');
  includes('Submission could not be verified');
  includes('verifySubmissionStarted');
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

test('UI is isolated in a shadow root', () => {
  includes("attachShadow({ mode: 'open' })");
  includes("style.all = 'initial'");
});

test('SPA route changes are handled', () => {
  includes("'pushState'");
  includes("'replaceState'");
  includes("'popstate'");
  includes('handleRouteChange');
});

test('audit export and emergency stop exist', () => {
  includes("schema: 'auto-driller-session/v1'");
  includes('runtime.emergency-stop');
  includes('Export audit');
});

test('Notion is manual only', () => {
  assert(/id:\s*'notion'[\s\S]*?manualOnly:\s*true/.test(source), 'Notion must remain manual-only');
});

test('script size remains bounded', () => {
  assert(Buffer.byteLength(source, 'utf8') < 100_000, 'Master userscript exceeds 100 KB');
  assert(source.split('\n').length < 1200, 'Master userscript exceeds 1200 lines');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
