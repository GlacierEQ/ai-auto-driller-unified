// ==UserScript==
// @name         Ollama Auto-Driller Unified — MAX Edition
// @namespace    https://github.com/GlacierEQ
// @version      4.0.0
// @description  UNIFIED: 8 weighted categories, typing sim, auto-accept, draggable UI, session export.
// @author       GlacierEQ
// @match        https://chat.deepseek.com/*
// @match        http://localhost:3000/*
// @match        http://localhost:1234/*
// @match        http://127.0.0.1:*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    const CONFIG = {
        enabled: GM_getValue('enabled', true), autoDrill: GM_getValue('autoDrill', false),
        autoAccept: GM_getValue('autoAccept', true), maxDrillDepth: GM_getValue('maxDrillDepth', 5),
        drillInterval: GM_getValue('drillInterval', 5000), typingSpeed: GM_getValue('typingSpeed', 50),
        debug: GM_getValue('debug', false), minimized: GM_getValue('minimized', false),
    };
    const STATE = { drillCount: 0, isProcessing: false, lastDrillTime: 0, conversationHistory: [],
        topicCache: new Map(), lastResponseText: '', lastUserActivity: 0, startTime: Date.now() };
    const DRILL_PATTERNS = {
        clarification: ["Can you elaborate on {topic} with examples?","What are the nuances of {topic}?","Could you break down {topic}?","What are examples of {topic}?","Can you explain {topic} more?"],
        depth: ["What are the underlying principles of {topic}?","How has {topic} evolved?","What are cutting-edge developments in {topic}?","What are theoretical foundations of {topic}?","How does {topic} work deeply?"],
        practical: ["What are real-world applications of {topic}?","How can I implement {topic}?","What tools are best for {topic}?","Can you provide a step-by-step guide for {topic}?","What are common use cases for {topic}?"],
        comparative: ["How does {topic} compare to alternatives?","What are pros and cons of {topic}?","When should I choose {topic}?","What makes {topic} different?","How does {topic} stack up?"],
        future: ["What's the future of {topic}?","What trends shape {topic}?","How will {topic} change by 2030?","What innovations are in {topic}?","What's next for {topic}?"],
        technical: ["What are best practices for {topic}?","What are common pitfalls with {topic}?","What are technical specs of {topic}?","How do experts optimize {topic}?","What are performance implications of {topic}?"],
        problem_solving: ["What problems does {topic} solve?","What are limitations of {topic}?","How can I troubleshoot {topic}?","What are potential solutions using {topic}?","How can {topic} address challenges?"],
        integration: ["How does {topic} integrate with systems?","What dependencies does {topic} require?","How can I combine {topic} with other tech?","What's the learning curve for {topic}?","What prerequisites for {topic}?"]
    };
    const WEIGHTS = [1,3,4,2,2,3,3,2];
    const SEL = {
        approve: ['button:has-text("Allow")','button:has-text("Approve")'],
        input: ['textarea','div[contenteditable="true"]'],
        submit: ['button[type="submit"]','button:has(svg)'],
        response: ['[class*="message"]','[class*="response"]','.markdown','.prose'],
        loading: ['[class*="loading"]','[class*="generating"]']
    };
    const log = (...a) => { if (CONFIG.debug) console.log('[Ollama-MAX]', ...a); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const randomDelay = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
    const saveConfig = () => Object.keys(CONFIG).forEach(k => GM_setValue(k, CONFIG[k]));
    const extractTopic = (text) => {
        if (!text || text.length < 20) return 'this topic';
        if (STATE.topicCache.has(text)) return STATE.topicCache.get(text);
        const stops = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','this','that']);
        const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length>4 && !stops.has(w)).slice(0,3);
        const topic = words.join(' ') || 'this topic'; STATE.topicCache.set(text, topic); return topic;
    };
    const findEl = (sels) => {
        for (const s of sels) { try { const el = document.querySelector(s); if (el && el.offsetParent !== null && !el.disabled) return el; } catch(e){} } return null;
    };
    const isIdle = () => { for (const s of SEL.loading) { try { if (document.querySelector(s)) return false; } catch(e){} } return true; };
    const getResponseText = () => { const el = findEl(SEL.response); const t = el?.textContent?.trim()||''; return t.length>50?t:''; };
    const hasNewResponse = () => { const c = getResponseText(); const n = c !== STATE.lastResponseText && c.length>0; if(n) STATE.lastResponseText=c; return n; };
    const clickedAccept = new WeakSet();
    const autoAccept = () => { if(!CONFIG.autoAccept) return; document.querySelectorAll(SEL.approve.join(',')).forEach(b=>{ if(b.offsetParent!==null && !clickedAccept.has(b)){b.click();clickedAccept.add(b);} }); };
    const generateQuestion = () => {
        const text = getResponseText(); if(!text) return "Tell me more about that";
        const topic = extractTopic(text); const cats = Object.keys(DRILL_PATTERNS);
        const totalW = WEIGHTS.reduce((a,b)=>a+b,0); let r=Math.random()*totalW; let idx=0;
        for(let i=0;i<WEIGHTS.length;i++){r-=WEIGHTS[i];if(r<=0){idx=i;break;}}
        return DRILL_PATTERNS[cats[idx]][Math.floor(Math.random()*DRILL_PATTERNS[cats[idx]].length)].replace('{topic}',topic);
    };
    const submitDrill = async () => {
        if(STATE.isProcessing||!CONFIG.autoDrill) return false;
        if(STATE.drillCount>=CONFIG.maxDrillDepth) return false;
        if(Date.now()-STATE.lastDrillTime<CONFIG.drillInterval) return false;
        if(!isIdle()||!hasNewResponse()) return false;
        if(Date.now()-STATE.lastUserActivity<10000) return false;
        STATE.isProcessing=true; try {
            await sleep(1000); const input = findEl(SEL.input); if(!input) return false;
            if(input.value&&input.value.length>0) return false;
            const q = generateQuestion(); input.focus(); await sleep(300);
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set;
            if(setter) setter.call(input,q); else input.value=q;
            input.dispatchEvent(new Event('input',{bubbles:true})); await sleep(500);
            const btn = findEl(SEL.submit); if(btn) btn.click(); else input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
            STATE.drillCount++; STATE.lastDrillTime=Date.now(); STATE.conversationHistory.push({timestamp:Date.now(),question:q});
            ui.updateCount(STATE.drillCount); ui.updateStatus(`Drill #${STATE.drillCount}`); return true;
        } catch(e){return false;} finally{STATE.isProcessing=false;}
    };
    const ui = {
        panel:null, create(){
            const p=document.createElement('div'); p.id='driller-panel';
            p.innerHTML=`<div class="dp-header" id="dp-header"><div class="dp-title"><span>Ollama Driller</span><span class="dp-ver">v4.0</span></div><button class="dp-min" id="dp-min">−</button></div><div class="dp-body" id="dp-body"><div class="dp-section"><div class="dp-row"><span>Auto-Accept</span><div class="dp-toggle ${CONFIG.autoAccept?'on':''}" data-k="autoAccept"><div class="dp-slider"></div></div></div><div class="dp-row"><span>Auto-Drill</span><div class="dp-toggle ${CONFIG.autoDrill?'on':''}" data-k="autoDrill"><div class="dp-slider"></div></div></div></div><div class="dp-section"><div class="dp-row"><label>Max Depth</label><input type="number" id="dp-depth" value="${CONFIG.maxDrillDepth}" min="1" max="50"></div><div class="dp-row"><label>Interval (s)</label><input type="number" id="dp-interval" value="${CONFIG.drillInterval/1000}" min="1" max="30" step="0.5"></div></div><div class="dp-stats"><div><span>Drills:</span><span id="dp-count">0</span></div><div><span>Status:</span><span id="dp-status">Idle</span></div><div><span>Uptime:</span><span id="dp-uptime">0s</span></div></div><div class="dp-btns"><button class="dp-btn" id="dp-reset">Reset</button><button class="dp-btn dp-btn-accent" id="dp-export">Export</button></div></div>`;
            document.body.appendChild(p); this.panel=p; this.styles(); this.events(); this.startUptime();
        },
        styles(){ GM_addStyle(`#driller-panel{position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#1a1a2e,#e91e8c);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.3);z-index:999999;font-family:-apple-system,sans-serif;color:#fff;width:320px}.dp-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid rgba(255,255,255,.2);cursor:move}.dp-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px}.dp-ver{font-size:10px;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:4px}.dp-min{background:rgba(255,255,255,.2);border:none;color:#fff;font-size:20px;cursor:pointer;width:28px;height:28px;border-radius:6px}.dp-body{padding:16px}.dp-body.hidden{display:none}.dp-section{margin-bottom:16px}.dp-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(0,0,0,.15);border-radius:8px;margin-bottom:6px;font-size:14px}.dp-toggle{position:relative;width:48px;height:26px;background:rgba(0,0,0,.3);border-radius:13px;cursor:pointer}.dp-toggle.on{background:#10b981}.dp-slider{position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s}.dp-toggle.on .dp-slider{transform:translateX(22px)}input[type="number"]{background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;padding:6px 10px;font-size:14px;width:60px}.dp-stats{background:rgba(0,0,0,.2);padding:12px;border-radius:8px;margin-bottom:12px}.dp-stats div{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}.dp-btns{display:flex;gap:10px}.dp-btn{flex:1;padding:10px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;background:rgba(255,255,255,.2);color:#fff}.dp-btn-accent{background:rgba(16,185,129,.3)}`); },
        events(){
            document.querySelectorAll('.dp-toggle').forEach(t=>{t.addEventListener('click',()=>{const k=t.dataset.k;CONFIG[k]=!CONFIG[k];t.classList.toggle('on');saveConfig();});});
            document.getElementById('dp-depth').addEventListener('change',e=>{CONFIG.maxDrillDepth=parseInt(e.target.value);saveConfig();});
            document.getElementById('dp-interval').addEventListener('change',e=>{CONFIG.drillInterval=parseFloat(e.target.value)*1000;saveConfig();});
            document.getElementById('dp-reset').addEventListener('click',()=>{STATE.drillCount=0;STATE.conversationHistory=[];STATE.topicCache.clear();ui.updateCount(0);ui.updateStatus('Reset');});
            document.getElementById('dp-export').addEventListener('click',()=>{const b=new Blob([JSON.stringify({drillCount:STATE.drillCount,history:STATE.conversationHistory,config:CONFIG,timestamp:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`ollama-session-${Date.now()}.json`;a.click();});
            document.getElementById('dp-min').addEventListener('click',()=>{const body=document.getElementById('dp-body');const btn=document.getElementById('dp-min');const h=body.classList.toggle('hidden');btn.textContent=h?'+':'−';CONFIG.minimized=h;saveConfig();});
            let dragging=false,ix,iy;document.getElementById('dp-header').addEventListener('mousedown',e=>{if(e.target.id==='dp-min')return;dragging=true;ix=e.clientX-ui.panel.offsetLeft;iy=e.clientY-ui.panel.offsetTop;});document.addEventListener('mousemove',e=>{if(dragging){e.preventDefault();ui.panel.style.left=(e.clientX-ix)+'px';ui.panel.style.top=(e.clientY-iy)+'px';ui.panel.style.right='auto';}});document.addEventListener('mouseup',()=>{dragging=false;});
            document.addEventListener('keydown',()=>{STATE.lastUserActivity=Date.now();});
            document.addEventListener('input',()=>{STATE.lastUserActivity=Date.now();});
            if(CONFIG.minimized){document.getElementById('dp-body').classList.add('hidden');document.getElementById('dp-min').textContent='+';}
        },
        updateCount(c){const e=document.getElementById('dp-count');if(e)e.textContent=c;},
        updateStatus(m){const e=document.getElementById('dp-status');if(e)e.textContent=m;},
        startUptime(){setInterval(()=>{const e=document.getElementById('dp-uptime');if(e){const s=Math.floor((Date.now()-STATE.startTime)/1000);const m=Math.floor(s/60);e.textContent=m>0?`${m}m ${s%60}s`:`${s}s`;}},1000);}
    };
    function init(){if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);return;}setTimeout(()=>{ui.create();setInterval(()=>{if(!CONFIG.enabled)return;autoAccept();submitDrill();},1000);ui.updateStatus('Ready');},1000);}
    init();
    GM_registerMenuCommand('Toggle Auto-Drill',()=>{CONFIG.autoDrill=!CONFIG.autoDrill;saveConfig();});
    GM_registerMenuCommand('Toggle Auto-Accept',()=>{CONFIG.autoAccept=!CONFIG.autoAccept;saveConfig();});
    GM_registerMenuCommand('Toggle Debug',()=>{CONFIG.debug=!CONFIG.debug;saveConfig();});
})();
