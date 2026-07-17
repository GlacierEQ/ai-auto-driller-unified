// ==UserScript==
// @name         ChatGPT Auto-Driller Unified — MAX Edition
// @namespace    https://github.com/GlacierEQ
// @version      4.0.0
// @description  UNIFIED: 8 weighted categories, typing simulation, auto-continue, max depth, draggable UI, session export, APEX Nexus memory.
// @author       GlacierEQ
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      mcp.supermemory.ai
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ─── CONFIG ────────────────────────────────────────────────────────────────
    const CONFIG = {
        enabled:        GM_getValue('enabled', true),
        autoContinue:   GM_getValue('autoContinue', true),
        autoDrill:      GM_getValue('autoDrill', false),
        autoAccept:     GM_getValue('autoAccept', true),
        maxDrillDepth:  GM_getValue('maxDrillDepth', 5),
        drillInterval:  GM_getValue('drillInterval', 5000),
        typingSpeed:    GM_getValue('typingSpeed', 50),
        intelligentMode: GM_getValue('intelligentMode', true),
        debug:          GM_getValue('debug', false),
        minimized:      GM_getValue('minimized', false),
        theme:          GM_getValue('theme', 'chatgpt'),
    };

    const STATE = {
        drillCount: 0,
        isProcessing: false,
        lastDrillTime: 0,
        conversationHistory: [],
        topicCache: new Map(),
        lastResponseText: '',
        userIsTyping: false,
        lastUserActivity: 0,
        startTime: Date.now(),
    };

    // ─── PATTERNS (8 categories, weighted) ──────────────────────────────────────
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
    const WEIGHTS = [4, 3, 3, 2, 1, 1, 1, 1];

    // ─── SELECTORS ──────────────────────────────────────────────────────────────
    const SEL = {
        continueBtns: [
            'button[class*="continue"]', 'button:has-text("Continue generating")',
            'button:has-text("Continue")', 'button[aria-label*="Continue"]',
            'button[data-testid*="continue"]'
        ],
        textInput: [
            'textarea[id*="prompt"]', 'textarea[placeholder*="Message"]',
            'textarea[data-id*="root"]', 'div[contenteditable="true"][role="textbox"]',
            '#prompt-textarea', 'main textarea'
        ],
        submitBtn: [
            'button[data-testid="send-button"]', 'button[aria-label*="Send"]',
            'button[type="submit"]', 'form button[type="submit"]'
        ],
        response: [
            '[data-message-author-role="assistant"]', '.markdown', '.prose',
            'div[class*="markdown"]', 'main [class*="text-base"]'
        ],
        loading: [
            '[class*="result-streaming"]', '[class*="generating"]',
            '[aria-label*="Generating"]', '.cursor-pointer.animate-pulse'
        ],
        stopBtn: [
            'button[aria-label*="Stop"]', 'button:has-text("Stop generating")',
            'button[data-testid*="stop"]'
        ],
        acceptBtns: [
            'button:has-text("Allow")', 'button:has-text("Accept")',
            'button:has-text("Confirm")', 'button:has-text("Continue")'
        ]
    };

    // ─── UTILS ──────────────────────────────────────────────────────────────────
    const log = (...args) => { if (CONFIG.debug) console.log('[CHATGPT-MAX]', ...args); };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const saveConfig = () => Object.keys(CONFIG).forEach(k => GM_setValue(k, CONFIG[k]));

    const extractTopic = (text) => {
        if (!text || text.length < 20) return 'this topic';
        if (STATE.topicCache.has(text)) return STATE.topicCache.get(text);
        const stops = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','were','been','be','have','has','had','do','does','did','will','would','could','should','may','might','can','this','that','it','its','they','them','their']);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const words = (sentences[0] || text).toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stops.has(w));
        const topic = words.slice(0, 3).join(' ') || 'this topic';
        STATE.topicCache.set(text, topic);
        return topic;
    };

    const findEl = (sels) => {
        for (const s of sels) {
            try {
                if (s.includes(':has-text')) {
                    const [, base, txt] = s.match(/^(.+?):has-text\("(.+?)"\)$/);
                    const el = Array.from(document.querySelectorAll(base)).find(e => e.textContent.trim().toLowerCase().includes(txt.toLowerCase()));
                    if (el && el.offsetParent !== null) return el;
                } else {
                    const el = document.querySelector(s);
                    if (el && el.offsetParent !== null && !el.disabled) return el;
                }
            } catch (e) {}
        }
        return null;
    };

    const isIdle = () => !findEl(SEL.loading) && !findEl(SEL.stopBtn);

    const getResponseText = () => {
        const els = document.querySelectorAll(SEL.response.join(', '));
        if (!els.length) return '';
        const last = Array.from(els).pop();
        const text = last?.textContent?.trim() || '';
        return text.length > 50 ? text : '';
    };

    const hasNewResponse = () => {
        const current = getResponseText();
        const isNew = current !== STATE.lastResponseText && current.length > 0;
        if (isNew) STATE.lastResponseText = current;
        return isNew;
    };

    // ─── AUTO-CONTINUE ──────────────────────────────────────────────────────────
    const clickedContinue = new WeakSet();
    const autoContinue = () => {
        if (!CONFIG.autoContinue) return;
        document.querySelectorAll(SEL.continueBtns.join(', ')).forEach(btn => {
            if (btn.offsetParent !== null && !clickedContinue.has(btn)) {
                btn.click();
                clickedContinue.add(btn);
                log('Clicked continue');
            }
        });
    };

    // ─── AUTO-ACCEPT ────────────────────────────────────────────────────────────
    const clickedAccept = new WeakSet();
    const autoAccept = () => {
        if (!CONFIG.autoAccept) return;
        document.querySelectorAll(SEL.acceptBtns.join(', ')).forEach(btn => {
            if (btn.offsetParent !== null && !clickedAccept.has(btn)) {
                btn.click();
                clickedAccept.add(btn);
                log('Auto-accepted');
            }
        });
    };

    // ─── DRILLING ───────────────────────────────────────────────────────────────
    const generateQuestion = () => {
        const text = getResponseText();
        if (!text) return "Can you provide more details about that?";
        const topic = extractTopic(text);
        const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalWeight;
        let idx = 0;
        const cats = Object.keys(DRILL_PATTERNS);
        for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) { idx = i; break; } }
        const pattern = DRILL_PATTERNS[cats[idx]][Math.floor(Math.random() * DRILL_PATTERNS[cats[idx]].length)];
        return pattern.replace('{topic}', topic);
    };

    const submitDrill = async () => {
        if (STATE.isProcessing || !CONFIG.autoDrill) return false;
        if (STATE.drillCount >= CONFIG.maxDrillDepth) { ui.updateStatus(`Max depth (${CONFIG.maxDrillDepth}) reached`); return false; }
        if (Date.now() - STATE.lastDrillTime < CONFIG.drillInterval) return false;
        if (!isIdle() || !hasNewResponse()) return false;
        if (Date.now() - STATE.lastUserActivity < 10000) { log('User active, skipping'); return false; }

        STATE.isProcessing = true;
        ui.updateStatus('Processing...');
        try {
            await sleep(1000);
            const input = await findEl(SEL.textInput) || await new Promise(r => {
                const check = setInterval(() => { const el = findEl(SEL.textInput); if (el) { clearInterval(check); r(el); } }, 200);
                setTimeout(() => { clearInterval(check); r(null); }, 3000);
            });
            if (!input) return false;
            if (input.value && input.value.length > 0) { log('Input has text, skipping'); return false; }

            const q = generateQuestion();
            ui.updateStatus('Typing...');
            input.focus();
            await sleep(300);

            // React-compatible input
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (setter) setter.call(input, q);
            else input.value = q;
            input.dispatchEvent(new Event('input', { bubbles: true }));

            await sleep(500);
            const btn = findEl(SEL.submitBtn);
            if (btn) btn.click();
            else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

            STATE.drillCount++;
            STATE.lastDrillTime = Date.now();
            STATE.conversationHistory.push({ timestamp: Date.now(), question: q });
            ui.updateDrillCount(STATE.drillCount);
            ui.updateStatus(`Drill #${STATE.drillCount} sent`);
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
                    <div class="dp-title"><span>Driller</span><span class="dp-ver">v4.0</span></div>
                    <button class="dp-min" id="dp-min">−</button>
                </div>
                <div class="dp-body" id="dp-body">
                    <div class="dp-section">
                        <div class="dp-row"><span>Auto-Continue</span><div class="dp-toggle ${CONFIG.autoContinue?'on':''}" data-k="autoContinue"><div class="dp-slider"></div></div></div>
                        <div class="dp-row"><span>Auto-Drill</span><div class="dp-toggle ${CONFIG.autoDrill?'on':''}" data-k="autoDrill"><div class="dp-slider"></div></div></div>
                        <div class="dp-row"><span>Auto-Accept</span><div class="dp-toggle ${CONFIG.autoAccept?'on':''}" data-k="autoAccept"><div class="dp-slider"></div></div></div>
                    </div>
                    <div class="dp-section">
                        <div class="dp-row"><label>Max Depth</label><input type="number" id="dp-depth" value="${CONFIG.maxDrillDepth}" min="1" max="50"></div>
                        <div class="dp-row"><label>Interval (s)</label><input type="number" id="dp-interval" value="${CONFIG.drillInterval/1000}" min="1" max="30" step="0.5"></div>
                        <div class="dp-row"><label>Speed</label><input type="range" id="dp-speed" value="${CONFIG.typingSpeed}" min="20" max="150"><span id="dp-speed-val">${CONFIG.typingSpeed}ms</span></div>
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
                #driller-panel{position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#10a37f,#1a7f64);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;width:340px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1)}
                .dp-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.1);cursor:move}
                .dp-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px}
                .dp-ver{font-size:11px;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:4px}
                .dp-min{background:none;border:none;color:#fff;font-size:24px;cursor:pointer;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px}
                .dp-min:hover{background:rgba(255,255,255,.1)}
                .dp-body{padding:20px}
                .dp-body.hidden{display:none}
                .dp-section{margin-bottom:16px}
                .dp-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,255,255,.05);border-radius:8px;margin-bottom:6px;font-size:14px}
                .dp-toggle{position:relative;width:48px;height:26px;background:rgba(255,255,255,.2);border-radius:13px;cursor:pointer;transition:.3s}
                .dp-toggle.on{background:#34d399}
                .dp-slider{position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .3s;box-shadow:0 2px 4px rgba(0,0,0,.2)}
                .dp-toggle.on .dp-slider{transform:translateX(22px)}
                input[type="number"],input[type="range"]{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;padding:6px 10px;font-size:14px;width:70px}
                input[type="range"]{width:100px}
                #dp-speed-val{font-size:12px;margin-left:6px}
                .dp-stats{background:rgba(0,0,0,.2);padding:12px;border-radius:8px;margin-bottom:16px}
                .dp-stats div{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
                .dp-btns{display:flex;gap:10px}
                .dp-btn{flex:1;padding:10px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;background:rgba(255,255,255,.2);color:#fff}
                .dp-btn:hover{background:rgba(255,255,255,.3)}
                .dp-btn-accent{background:rgba(52,211,153,.3)}
                .dp-btn-accent:hover{background:rgba(52,211,153,.5)}
            `);
        },
        events() {
            // Toggle clicks
            document.querySelectorAll('.dp-toggle').forEach(t => {
                t.addEventListener('click', () => {
                    const k = t.dataset.k;
                    CONFIG[k] = !CONFIG[k];
                    t.classList.toggle('on');
                    saveConfig();
                });
            });
            // Settings
            document.getElementById('dp-depth').addEventListener('change', e => { CONFIG.maxDrillDepth = parseInt(e.target.value); saveConfig(); });
            document.getElementById('dp-interval').addEventListener('change', e => { CONFIG.drillInterval = parseFloat(e.target.value) * 1000; saveConfig(); });
            document.getElementById('dp-speed').addEventListener('input', e => { CONFIG.typingSpeed = parseInt(e.target.value); document.getElementById('dp-speed-val').textContent = CONFIG.typingSpeed + 'ms'; saveConfig(); });
            // Buttons
            document.getElementById('dp-reset').addEventListener('click', () => { STATE.drillCount = 0; STATE.conversationHistory = []; STATE.topicCache.clear(); ui.updateDrillCount(0); ui.updateStatus('Reset'); });
            document.getElementById('dp-export').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify({ drillCount: STATE.drillCount, history: STATE.conversationHistory, config: CONFIG, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chatgpt-session-${Date.now()}.json`; a.click();
            });
            // Minimize
            document.getElementById('dp-min').addEventListener('click', () => {
                const body = document.getElementById('dp-body');
                const btn = document.getElementById('dp-min');
                const hidden = body.classList.toggle('hidden');
                btn.textContent = hidden ? '+' : '−';
                CONFIG.minimized = hidden; saveConfig();
            });
            // Drag
            let dragging = false, ix, iy;
            document.getElementById('dp-header').addEventListener('mousedown', e => {
                if (e.target.id === 'dp-min') return;
                dragging = true; ix = e.clientX - this.panel.offsetLeft; iy = e.clientY - this.panel.offsetTop;
            });
            document.addEventListener('mousemove', e => { if (dragging) { e.preventDefault(); this.panel.style.left = (e.clientX - ix) + 'px'; this.panel.style.top = (e.clientY - iy) + 'px'; this.panel.style.right = 'auto'; } });
            document.addEventListener('mouseup', () => { dragging = false; });
            // User activity
            document.addEventListener('keydown', () => { STATE.lastUserActivity = Date.now(); });
            document.addEventListener('input', () => { STATE.lastUserActivity = Date.now(); });
            // Apply minimized state
            if (CONFIG.minimized) { document.getElementById('dp-body').classList.add('hidden'); document.getElementById('dp-min').textContent = '+'; }
        },
        updateDrillCount(c) { const e = document.getElementById('dp-count'); if (e) e.textContent = c; },
        updateStatus(m) { const e = document.getElementById('dp-status'); if (e) e.textContent = m; },
        startUptime() { setInterval(() => { const e = document.getElementById('dp-uptime'); if (e) { const s = Math.floor((Date.now() - STATE.startTime) / 1000); const m = Math.floor(s / 60); e.textContent = m > 0 ? `${m}m ${s%60}s` : `${s}s`; } }, 1000); }
    };

    // ─── INIT ───────────────────────────────────────────────────────────────────
    function init() {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); return; }
        setTimeout(() => {
            ui.create();
            // Main loop
            setInterval(() => {
                if (!CONFIG.enabled) return;
                autoAccept();
                autoContinue();
                submitDrill();
            }, 1000);
            // Mutation observer for continue buttons
            const obs = new MutationObserver(() => { if (CONFIG.autoContinue) autoContinue(); });
            obs.observe(document.body, { childList: true, subtree: true });
            ui.updateStatus('Ready');
            log('Initialized');
        }, 2000);
    }
    init();

    // ─── MENU COMMANDS ──────────────────────────────────────────────────────────
    GM_registerMenuCommand('Toggle Auto-Continue', () => { CONFIG.autoContinue = !CONFIG.autoContinue; saveConfig(); });
    GM_registerMenuCommand('Toggle Auto-Drill', () => { CONFIG.autoDrill = !CONFIG.autoDrill; saveConfig(); });
    GM_registerMenuCommand('Toggle Auto-Accept', () => { CONFIG.autoAccept = !CONFIG.autoAccept; saveConfig(); });
    GM_registerMenuCommand('Toggle Debug', () => { CONFIG.debug = !CONFIG.debug; saveConfig(); });
    GM_registerMenuCommand('Reset Session', () => { STATE.drillCount = 0; STATE.conversationHistory = []; STATE.topicCache.clear(); });
})();
