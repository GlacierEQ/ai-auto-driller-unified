// ==UserScript==
// @name         AI-Auto-Driller Unified — Meta Manifest
// @namespace    https://github.com/GlacierEQ
// @version      4.0.0
// @description  UNIFIED SUITE: Elite strategic automation for 8 AI platforms. Merged from chatgpt_infinity + auto-driller-pro-max. Typing sim, 8 weighted categories, auto-continue, draggable UI, APEX Nexus memory.
// @author       GlacierEQ
// @homepage     https://github.com/GlacierEQ/ai-auto-driller-unified
// @supportURL   https://github.com/GlacierEQ/ai-auto-driller-unified/issues
// @license      MIT
//
// --- PLATFORM TARGETS ---
// @match        https://chatgpt.com/*
// @match        https://www.perplexity.ai/*
// @match        https://grok.com/*
// @match        https://x.com/i/grok*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://chat.deepseek.com/*
// @match        http://localhost:11434/*
// @match        http://localhost:3000/*
// @match        http://localhost:1234/*
// @match        http://127.0.0.1:*/*
//
// --- GRANTS ---
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @connect      mcp.supermemory.ai
//
// @run-at       document-end
// @noframes
// ==/UserScript==

/**
 * APEX NEXUS — MEMORY_CONFIG
 * Canonical reference. Update here; propagate to each script.
 */
const MEMORY_CONFIG = {
  qdrant: {
    enabled: false,
    endpoint: 'http://localhost:6333',
    collection: 'apex_nexus',
    apiKey: '',
  },
  supermemory: {
    enabled: false,
    endpoint: 'https://mcp.supermemory.ai',
    apiKey: '',
  },
  tiers: {
    tier0_identity: true,
    tier1_truth: true,
    tier2_tactical: true,
    tier3_local: true,
  },
};

/**
 * DRILL_PATTERNS — 8 weighted categories
 * Weights determine selection probability:
 *   clarification=4, depth=3, practical=3, comparative=2, others=1
 */
const DRILL_PATTERNS = {
  clarification: [
    "Can you elaborate on {topic} with specific examples?",
    "What are the nuances of {topic} that beginners often miss?",
    "Could you break down {topic} into simpler components?",
    "What are some real-world examples of {topic}?",
    "Can you explain {topic} in more detail?"
  ],
  depth: [
    "What are the underlying principles behind {topic}?",
    "How has {topic} evolved over the past decade?",
    "What are the cutting-edge developments in {topic}?",
    "What are the theoretical foundations of {topic}?",
    "How does {topic} work at a deeper level?"
  ],
  practical: [
    "What are real-world applications of {topic}?",
    "How can I implement {topic} in a production environment?",
    "What tools or frameworks are best for {topic}?",
    "Can you provide a step-by-step guide for {topic}?",
    "What are common use cases for {topic}?"
  ],
  comparative: [
    "How does {topic} compare to similar alternatives?",
    "What are the advantages and disadvantages of {topic}?",
    "When should I choose {topic} over other options?",
    "What makes {topic} different from related concepts?",
    "How does {topic} stack up against competitors?"
  ],
  future: [
    "What's the future outlook for {topic}?",
    "What emerging trends are shaping {topic}?",
    "How will {topic} change by 2030?",
    "What innovations are happening in {topic}?",
    "What's next for {topic}?"
  ],
  technical: [
    "What are the technical specifications of {topic}?",
    "What are common pitfalls when working with {topic}?",
    "What are best practices for {topic}?",
    "What are the performance implications of {topic}?",
    "How do experts optimize {topic}?"
  ],
  problem_solving: [
    "What problems does {topic} solve?",
    "How can {topic} address common challenges?",
    "What are the limitations of {topic}?",
    "How can I troubleshoot issues with {topic}?",
    "What are potential solutions using {topic}?"
  ],
  integration: [
    "How does {topic} integrate with existing systems?",
    "What dependencies does {topic} require?",
    "How can I combine {topic} with other technologies?",
    "What's the learning curve for {topic}?",
    "What prerequisites are needed for {topic}?"
  ]
};

const DRILL_WEIGHTS = [4, 3, 3, 2, 1, 1, 1, 1];

/**
 * CONFIG PROFILES
 */
const CONFIG_PROFILES = {
  research:     { maxDepth: 15, interval: 5500, speed: 50, label: 'Research' },
  quick:        { maxDepth: 3,  interval: 3000, speed: 40, label: 'Quick' },
  safe:         { maxDepth: 2,  interval: 6000, speed: 60, label: 'Safe' },
  aggressive:   { maxDepth: 30, interval: 2000, speed: 30, label: 'Aggressive' },
  learning:     { maxDepth: 10, interval: 4000, speed: 50, label: 'Learning' },
  professional: { maxDepth: 7,  interval: 4500, speed: 45, label: 'Professional' },
  focused:      { maxDepth: 4,  interval: 5000, speed: 50, label: 'Focused' },
};

/**
 * THEMES
 */
const THEMES = {
  chatgpt:     { gradient: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)', color: '#10a37f', label: 'ChatGPT Emerald' },
  perplexity:  { gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#3b82f6', label: 'Perplexity Sapphire' },
  claude:      { gradient: 'linear-gradient(135deg, #cc785c 0%, #e07b39 100%)', color: '#e07b39', label: 'Claude Amber' },
  grok:        { gradient: 'linear-gradient(135deg, #1d1d1f 0%, #e91e8c 100%)', color: '#e91e8c', label: 'Grok Magenta' },
  gemini:      { gradient: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)', color: '#4285f4', label: 'Gemini Blue' },
  deepseek:    { gradient: 'linear-gradient(135deg, #1a1a2e 0%, #6172f3 100%)', color: '#6172f3', label: 'DeepSeek Blue' },
  ollama:      { gradient: 'linear-gradient(135deg, #1a1a2e 0%, #e91e8c 100%)', color: '#e91e8c', label: 'Ollama Magenta' },
  purple:      { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#764ba2', label: 'Purple Haze' },
};
