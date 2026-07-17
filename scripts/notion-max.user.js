// ==UserScript==
// @name         Notion Auto-Driller Unified — MAX Edition
// @namespace    https://github.com/GlacierEQ
// @version      4.0.0
// @description  UNIFIED: 8 weighted categories, auto-expand, Notion AI invocation, typing sim, draggable UI, session export.
// @author       GlacierEQ
// @match        https://www.notion.so/*
// @match        https://notion.so/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        enabled: GM_getValue('enabled', true),
        autoExpand: GM_getValue('autoExpand', true),
        autoDrill: GM_getValue('autoDrill', false),
        maxDrillDepth: GM_getValue('maxDrillDepth', 5),
        drillInterval: GM_getValue('drillInterval', 6000),
        expandInterval: GM_getValue('expandInterval', 500),
        typingSpeed: GM_getValue('typingSpeed', 60),
        debug: GM_getValue('debug', false),
        minimized: GM_getValue('minimized', false),
    };

    const STATE = {
        drillCount: 0, isProcessing: false, lastDrillTime: 0,
        conversationHistory: [], topicCache: new Map(), lastUserActivity: 0,
        startTime: Date.now(), lastResponseText: '',
    };

    // Notion-specific patterns — structured weighted higher for outlines/organization
    const DRILL_PATTERNS = {
        clarification: [
            "Can you elaborate on {topic} with specific examples?",
            "What are the key nuances of {topic}?",
            "Could you break down {topic} into simpler components?",
            "What details about {topic} should I know?",
            "Can you explain {topic} more thoroughly?"
        ],
        depth: [
            "What are the underlying principles of {topic}?",
            "How does {topic} work in practice?",
            "What's the theory behind {topic}?",
            "What are the core concepts of {topic}?",
            "How can I understand {topic} deeply?"
        ],
        practical: [
            "What are practical applications of {topic}?",
            "How can I implement {topic}?",
            "What are actionable steps for {topic}?",
            "How do I use {topic} effectively?",
            "What's a practical guide to {topic}?"
        ],
        comparative: [
            "How does {topic} compare to alternatives?",
            "What are pros and cons of {topic}?",
            "When should I use {topic}?",
            "What makes {topic} different?",
            "How does {topic} stack up?"
        ],
        future: [
            "What's the future of {topic}?",
            "What trends affect {topic}?",
            "How will {topic} evolve?",
            "What innovations are happening in {topic}?",
            "What's next for {topic}?"
        ],
        technical: [
            "What are technical aspects of {topic}?",
            "What are common challenges with {topic}?",
            "What are best practices for {topic}?",
            "How do experts approach {topic}?",
            "What technical details of {topic} matter?"
        ],
        structured: [
            "Can you create a structured outline for {topic}?",
            "What's a step-by-step breakdown of {topic}?",
            "Can you organize information about {topic}?",
            "What's a hierarchical view of {topic}?",
            "Can you structure {topic} into sections?"
        ],
        creative: [
            "What creative approaches exist for {topic}?",
            "How can I innovate with {topic}?",
            "What unique perspectives on {topic} exist?",
            "What creative solutions involve {topic}?",
            "How can {topic} be used creatively?"
        ]
    };
    // Notion weights: structured=4 (highest), clarification=3, practical=3, depth=2, others=1
    const WEIGHTS = [3, 2, 3, 1, 1, 1, 4, 1];

    // ─── NOTION SELECTORS ───────────────────────────────────────────────────────
    const SEL = {
        expandBtns: [
            'button:has-text("Continue")', 'button:has-text("Keep writing")',
            'button:has-text("Continue writing")', 'button[class*="continue"]'
        ],
        notionAIInput: [
            'div[contenteditable="true"][data-content-editable-leaf="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[data-content-editable-void="true"]',
            'div[placeholder*="Tell AI"]', 'div[placeholder*="Ask AI"]'
        ],
        notionAITrigger: [
            'div[data-ai-button="true"]', 'button[aria-label*="AI"]',
            'div[class*="aiButton"]'
        ],
        aiResponse: [
            'div[data-block-id]', 'div[class*="notion-ai"]',
            'div[data-ai-block="true"]', 'div[class*="aiContent"]'
        ],
        loading: [
            'div[class*="loading"]', 'div[class*="spinner"]',
            'div[aria-label*="Loading"]'
        ]
    };

    // ─── UTILS ──────────────────────────────────────────────────────────────────
    const log = (...a) => { if (CONFIG.debug) console.log('[NOTION-MAX]', ...a); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const randomDelay = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const saveConfig = () => Object.keys(CONFIG).forEach(k => GM_setValue(k, CONFIG[k]));

    const extractTopic = (text) => {
        if (!text || text.length < 20) return 'this topic';
        if (STATE.topicCache.has(text)) return STATE.topicCache.get(text);
        const stops = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','this','that']);
        const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
            .filter(w => w.length > 3 && !stops.has(w)).slice(0, 3);
        const topic = words.join(' ') || 'this topic';
        STATE.topicCache.set(text, topic);
        return topic;
    };

    const findEl = (sels) => {
        for (const s of sels) {
            try {
                if (s.includes(':has-text')) {
                    const [, base, txt] = s.match(/^(.+?):has-text\("(.+?)"\)$/);
                    const el = Array.from(document.querySelectorAll(base))
                        .find(e => e.textContent.trim().toLowerCase().includes(txt.toLowerCase()));
                    if (el && el.offsetParent !== null) return el;
                } else {
                    const el = document.querySelector(s);
                    if (el && el.offsetParent !== null && !el.disabled) return el;
                }
            } catch (e) {}
        }
        return null;
    };

    const isIdle = () => {
        for (const s of SEL.loading) { try { if (document.querySelector(s)) return false; } catch(e){} }
        return true;
    };

    const getResponseText = () => {
        const aiBlocks = document.querySelectorAll(SEL.aiResponse.join(', '));
        if (aiBlocks.length > 0) {
            const last = Array.from(aiBlocks).pop();
            return last?.textContent?.trim() || '';
        }
        const content = document.querySelector('div[data-block-id]');
        return content?.textContent?.trim() || '';
    };

    const hasNewResponse = () => {
        const current = getResponseText();
        const isNew = current !== STATE.lastResponseText && current.length > 0;
        if (isNew) STATE.lastResponseText = current;
        return isNew;
    };

    // ─── AUTO-EXPAND ────────────────────────────────────────────────────────────
    const clickedExpand = new WeakSet();
    const autoExpand = () => {
        if (!CONFIG.autoExpand) return;
        document.querySelectorAll(SEL.expandBtns.join(', ')).forEach(btn => {
            if (btn.offsetParent !== null && !clickedExpand.has(btn)) {
                btn.click();
                clickedExpand.add(btn);
                log('Clicked expand');
            }
        });
    };

    // ─── NOTION AI INVOCATION ───────────────────────────────────────────────────
    const invokeNotionAI = async () => {
        // Method 1: Cmd/Ctrl + J
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'j', code: 'KeyJ', keyCode: 74, which: 74,
            ctrlKey: !navigator.platform.includes('Mac'),
            metaKey: navigator.platform.includes('Mac'),
            bubbles: true
        }));
        await sleep(500);

        // Method 2: Click AI button
        const btn = findEl(SEL.notionAITrigger);
        if (btn) { btn.click(); await sleep(500); }
    };

    const typeIntoNotionAI = async (text) => {
        const input = await new Promise(resolve => {
            const check = setInterval(() => {
                const el = findEl(SEL.notionAIInput);
                if (el) { clearInterval(check); resolve(el); }
            }, 200);
            setTimeout(() => { clearInterval(check); resolve(null); }, 3000);
        });
        if (!input) return false;

        input.focus();
        input.textContent = '';

        for (let i = 0; i < text.length; i++) {
            input.textContent += text[i];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, data: text[i] }));
            await sleep(randomDelay(CONFIG.typingSpeed - 20, CONFIG.typingSpeed + 30));
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    };

    const submitToNotionAI = async () => {
        const input = findEl(SEL.notionAIInput);
        if (!input) return false;
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
        return true;
    };

    // ─── DRILLING ───────────────────────────────────────────────────────────────
    const generateQuestion = () => {
        const text = getResponseText();
        if (!text || text.length < 50) return "Can you provide more details about that?";
        const topic = extractTopic(text);
        const totalW = WEIGHTS.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalW; let idx = 0;
        const cats = Object.keys(DRILL_PATTERNS);
        for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) { idx = i; break; } }
        return DRILL_PATTERNS[cats[idx]][Math.floor(Math.random() * DRILL_PATTERNS[cats[idx]].length)].replace('{topic}', topic);
    };

    const submitDrill = async () => {
        if (STATE.isProcessing || !CONFIG.autoDrill) return false;
        if (STATE.drillCount >= CONFIG.maxDrillDepth) { ui.updateStatus(`Max depth (${CONFIG.maxDrillDepth})`); return false; }
        if (Date.now() - STATE.lastDrillTime < CONFIG.drillInterval) return false;
        if (!isIdle()) return false;

        STATE.isProcessing = true;
        ui.updateStatus('Processing...');
        try {
            const q = generateQuestion();
            ui.updateStatus('Invoking AI...');
            await invokeNotionAI();
            await sleep(1000);
            ui.updateStatus('Typing...');
            const typed = await typeIntoNotionAI(q);
            if (!typed) return false;
            await sleep(randomDelay(500, 1000));
            await submitToNotionAI();
            STATE.drillCount++;
            STATE.lastDrillTime = Date.now();
            STATE.conversationHistory.push({ timestamp: Date.now(), question: q });
            ui.updateCount(STATE.drillCount);
            ui.updateStatus(`Drill #${STATE.drillCount}`);
            return true;
        } catch (e) { log('Error:', e); return false; }
        finally { STATE.isProcessing = false; }
    };

    // ─── UI ─────────────────────────────────────────────────────────────────────
    const ui = {
        panel: null,
        create() {
            const p = document.createElement('div');
            p.id = 'driller-panel';
            p.innerHTML = `
                <div class="dp-header" id="dp-header">
                    <div class="dp-title"><span>Notion Driller</span><span class="dp-ver">v4.0</span></div>
                    <button class="dp-min" id="dp-min">−</button>
                </div>
                <div class="dp-body" id="dp-body">
                    <div class="dp-section">
                        <div class="dp-row"><span>Auto-Expand</span><div class="dp-toggle ${CONFIG.autoExpand ? 'on' : ''}" data-k="autoExpand"><div class="dp-slider"></div></div></div>
                        <div class="dp-row"><span>Auto-Drill</span><div class="dp-toggle ${CONFIG.autoDrill ? 'on' : ''}" data-k="autoDrill"><div class="dp-slider"></div></div></div>
                    </div>
                    <div class="dp-section">
                        <div class="dp-row"><label>Max Depth</label><input type="number" id="dp-depth" value="${CONFIG.maxDrillDepth}" min="1" max="50"></div>
                        <div class="dp-row"><label>Interval (s)</label><input type="number" id="dp-interval" value="${CONFIG.drillInterval / 1000}" min="1" max="30" step="0.5"></div>
                    </div>
                    <div class="dp-stats">
                        <div><span>Drills:</span><span id="dp-count">0</span></div>
                        <div><span>Status:</span><span id="dp-status">Idle</span></div>
                        <div><span>Uptime:</span><span id="dp-uptime">0s</span></div>
                    </div>
                    <div class="dp-btns">
                        <button class="dp-btn" id="dp-reset">Reset</button>
                        <button class="dp-btn dp-btn-accent" id="dp-export">Export</button>
                    </div>
                </div>`;
            document.body.appendChild(p);
            this.panel = p;
            this.styles();
            this.events();
            this.startUptime();
        },
        styles() {
            GM_addStyle(`
                #driller-panel{position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#000,#2d2d2d);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.5);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;width:340px}
                .dp-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.1);cursor:move}
                .dp-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px}
                .dp-ver{font-size:11px;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:4px}
                .dp-min{background:none;border:none;color:#fff;font-size:24px;cursor:pointer;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px}
                .dp-min:hover{background:rgba(255,255,255,.1)}
                .dp-body{padding:20px}
                .dp-body.hidden{display:none}
                .dp-section{margin-bottom:16px}
                .dp-row{display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(255,255,255,.05);border-radius:8px;margin-bottom:8px}
                .dp-toggle{position:relative;width:52px;height:28px;background:rgba(255,255,255,.2);border-radius:14px;cursor:pointer;transition:.3s}
                .dp-toggle.on{background:#eb5757}
                .dp-slider{position:absolute;top:4px;left:4px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .3s;box-shadow:0 2px 4px rgba(0,0,0,.2)}
                .dp-toggle.on .dp-slider{transform:translateX(24px)}
                input[type="number"]{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;padding:6px 10px;font-size:14px;width:80px}
                .dp-stats{background:rgba(0,0,0,.3);padding:12px;border-radius:8px;margin-bottom:16px}
                .dp-stats div{display:flex;justify-content:space-between;margin:6px 0;font-size:13px}
                .dp-btns{display:flex;gap:10px}
                .dp-btn{flex:1;padding:10px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;background:rgba(255,255,255,.2);color:#fff}
                .dp-btn-accent{background:rgba(235,87,87,.3)}
                .dp-btn-accent:hover{background:rgba(235,87,87,.5)}
            `);
        },
        events() {
            document.querySelectorAll('.dp-toggle').forEach(t => {
                t.addEventListener('click', () => {
                    const k = t.dataset.k; CONFIG[k] = !CONFIG[k];
                    t.classList.toggle('on'); saveConfig();
                });
            });
            document.getElementById('dp-depth').addEventListener('change', e => { CONFIG.maxDrillDepth = parseInt(e.target.value); saveConfig(); });
            document.getElementById('dp-interval').addEventListener('change', e => { CONFIG.drillInterval = parseFloat(e.target.value) * 1000; saveConfig(); });
            document.getElementById('dp-reset').addEventListener('click', () => {
                STATE.drillCount = 0; STATE.conversationHistory = []; STATE.topicCache.clear();
                ui.updateCount(0); ui.updateStatus('Reset');
            });
            document.getElementById('dp-export').addEventListener('click', () => {
                const b = new Blob([JSON.stringify({ drillCount: STATE.drillCount, history: STATE.conversationHistory, config: CONFIG, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `notion-session-${Date.now()}.json`; a.click();
            });
            document.getElementById('dp-min').addEventListener('click', () => {
                const body = document.getElementById('dp-body');
                const btn = document.getElementById('dp-min');
                const h = body.classList.toggle('hidden');
                btn.textContent = h ? '+' : '−'; CONFIG.minimized = h; saveConfig();
            });
            // Drag
            let dragging = false, ix, iy;
            document.getElementById('dp-header').addEventListener('mousedown', e => {
                if (e.target.id === 'dp-min') return;
                dragging = true; ix = e.clientX - ui.panel.offsetLeft; iy = e.clientY - ui.panel.offsetTop;
            });
            document.addEventListener('mousemove', e => { if (dragging) { e.preventDefault(); ui.panel.style.left = (e.clientX - ix) + 'px'; ui.panel.style.top = (e.clientY - iy) + 'px'; ui.panel.style.right = 'auto'; } });
            document.addEventListener('mouseup', () => { dragging = false; });
            // User activity
            document.addEventListener('keydown', () => { STATE.lastUserActivity = Date.now(); });
            document.addEventListener('input', () => { STATE.lastUserActivity = Date.now(); });
            if (CONFIG.minimized) { document.getElementById('dp-body').classList.add('hidden'); document.getElementById('dp-min').textContent = '+'; }
        },
        updateCount(c) { const e = document.getElementById('dp-count'); if (e) e.textContent = c; },
        updateStatus(m) { const e = document.getElementById('dp-status'); if (e) e.textContent = m; },
        startUptime() { setInterval(() => { const e = document.getElementById('dp-uptime'); if (e) { const s = Math.floor((Date.now() - STATE.startTime) / 1000); const m = Math.floor(s / 60); e.textContent = m > 0 ? `${m}m ${s % 60}s` : `${s}s`; } }, 1000); }
    };

    // ─── INIT ───────────────────────────────────────────────────────────────────
    function init() {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); return; }
        setTimeout(() => {
            ui.create();
            setInterval(() => {
                if (!CONFIG.enabled) return;
                autoExpand();
                submitDrill();
            }, 1000);
            // Mutation observer for expand buttons
            const obs = new MutationObserver(() => { if (CONFIG.autoExpand) autoExpand(); });
            obs.observe(document.body, { childList: true, subtree: true });
            ui.updateStatus('Ready');
        }, 2000);
    }
    init();

    GM_registerMenuCommand('Toggle Auto-Expand', () => { CONFIG.autoExpand = !CONFIG.autoExpand; saveConfig(); });
    GM_registerMenuCommand('Toggle Auto-Drill', () => { CONFIG.autoDrill = !CONFIG.autoDrill; saveConfig(); });
    GM_registerMenuCommand('Toggle Debug', () => { CONFIG.debug = !CONFIG.debug; saveConfig(); });
})();
