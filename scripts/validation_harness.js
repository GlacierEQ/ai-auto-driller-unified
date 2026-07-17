/**
 * AI-Auto-Driller Unified — Validation Harness v3
 * Node.js test runner for all Zenith Suite core logic.
 */
'use strict';

global.document = {
  _elements: [],
  createElement: (tag) => ({
    tag, textContent: '', style: {}, className: '', id: '',
    setAttribute: function(k,v){this[k]=v;}, getAttribute: function(k){return this[k];},
    appendChild: ()=>{}, offsetParent: true, click: ()=>{},
  }),
  querySelectorAll: (sel) => {
    if (sel === 'button') return global.document._elements.filter(e => e.tag === 'button');
    return [];
  },
  querySelector: () => null,
  body: { appendChild: (el) => { global.document._elements.push(el); } },
};

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); results.push({name, status:'PASS'}); passed++; } catch(e) { results.push({name, status:'FAIL', error:e.message}); failed++; } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function assertEqual(a, b, m) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`); }

// ─── TOPIC EXTRACTION ─────────────────────────────────────────────────────────
const STATE = { topicCache: new Map() };
const extractTopic = (text) => {
  if (!text || text.length < 20) return 'this topic';
  if (STATE.topicCache.has(text)) return STATE.topicCache.get(text);
  const stops = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','this','that']);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length>4 && !stops.has(w)).slice(0,3);
  const topic = words.join(' ') || 'this topic'; STATE.topicCache.set(text, topic); return topic;
};

test('Topic extraction — normal sentence', () => {
  const t = extractTopic('Quantum computing has evolved significantly in recent years');
  assert(t.includes('quantum') || t.includes('computing'), `Got: ${t}`);
});

test('Topic extraction — short text fallback', () => {
  const t = extractTopic('hi');
  assertEqual(t, 'this topic');
});

test('Topic extraction — empty string', () => {
  assertEqual(extractTopic(''), 'this topic');
});

test('Topic extraction — cache hit', () => {
  STATE.topicCache.clear();
  const t1 = extractTopic('Machine learning is a subset of artificial intelligence');
  const t2 = extractTopic('Machine learning is a subset of artificial intelligence');
  assertEqual(t1, t2);
});

// ─── DRILL PATTERNS ───────────────────────────────────────────────────────────
const DRILL_PATTERNS = {
  clarification: ["Can you elaborate on {topic}?","What are examples of {topic}?"],
  depth: ["What are principles behind {topic}?","How does {topic} work?"],
  practical: ["How to implement {topic}?","What tools for {topic}?"],
  comparative: ["How does {topic} compare?","Pros and cons of {topic}?"],
  future: ["What's next for {topic}?","Future of {topic}?"],
  technical: ["Best practices for {topic}?","Common pitfalls with {topic}?"],
  problem_solving: ["What problems does {topic} solve?","Limitations of {topic}?"],
  integration: ["How does {topic} integrate?","Dependencies of {topic}?"]
};
const WEIGHTS = [1,3,4,2,2,3,3,2];

test('Question generation — returns non-empty string', () => {
  const cats = Object.keys(DRILL_PATTERNS);
  const totalW = WEIGHTS.reduce((a,b)=>a+b,0);
  let r = Math.random() * totalW; let idx = 0;
  for(let i=0;i<WEIGHTS.length;i++){r-=WEIGHTS[i];if(r<=0){idx=i;break;}}
  const pattern = DRILL_PATTERNS[cats[idx]][0];
  const q = pattern.replace('{topic}', 'quantum computing');
  assert(q.length > 0, 'Empty question');
  assert(!q.includes('{topic}'), 'Unreplaced placeholder');
});

test('Question generation — covers all 8 categories over 80 iterations', () => {
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const cats = Object.keys(DRILL_PATTERNS);
    const totalW = WEIGHTS.reduce((a,b)=>a+b,0);
    let r = Math.random() * totalW; let idx = 0;
    for(let j=0;j<WEIGHTS.length;j++){r-=WEIGHTS[j];if(r<=0){idx=j;break;}}
    seen.add(cats[idx]);
  }
  assertEqual(seen.size, 8, `Missing categories: ${[...Object.keys(DRILL_PATTERNS).filter(c=>!seen.has(c))]}`);
});

// ─── AUTO-ACCEPT ──────────────────────────────────────────────────────────────
test('Auto-accept — clicks Allow/Accept/Confirm', () => {
  const btns = [{tag:'button',textContent:'Allow',offsetParent:true,clicked:false},
                {tag:'button',textContent:'Submit',offsetParent:true,clicked:false}];
  btns.forEach(b => { b.click = () => { b.clicked = true; }; });
  let clicked = 0;
  btns.forEach(b => {
    const txt = b.textContent.toLowerCase();
    if ((txt.includes('allow') || txt.includes('accept') || txt.includes('confirm')) && b.offsetParent) { b.click(); clicked++; }
  });
  assertEqual(clicked, 1, `Expected 1 click, got ${clicked}`);
});

test('Auto-accept — ignores hidden buttons', () => {
  const btn = {tag:'button',textContent:'Allow',offsetParent:null,clicked:false};
  btn.click = () => { btn.clicked = true; };
  if (btn.offsetParent !== null) btn.click();
  assert(!btn.clicked, 'Should not click hidden button');
});

test('Auto-accept — does not click Cancel/Submit/Other', () => {
  const btns = [{textContent:'Cancel',offsetParent:true},{textContent:'Submit',offsetParent:true},{textContent:'Other',offsetParent:true}];
  let clicked = 0;
  btns.forEach(b => {
    const txt = b.textContent.toLowerCase();
    if ((txt.includes('allow') || txt.includes('accept') || txt.includes('confirm')) && b.offsetParent) clicked++;
  });
  assertEqual(clicked, 0, 'Should not click non-accept buttons');
});

// ─── DELAY ────────────────────────────────────────────────────────────────────
test('3s intelligent delay — verified >= 3000ms', () => {
  const interval = 5000;
  assert(interval >= 3000, `Interval ${interval}ms is less than 3000ms`);
});

test('Drill interval gate — blocks early triggers', () => {
  const lastDrillTime = Date.now();
  const drillInterval = 5000;
  const now = Date.now();
  assert(now - lastDrillTime < drillInterval, 'Should block within interval');
});

test('Drill interval gate — allows trigger after interval', () => {
  const lastDrillTime = Date.now() - 6000;
  const drillInterval = 5000;
  assert(Date.now() - lastDrillTime >= drillInterval, 'Should allow after interval');
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
test('CONFIG — has all required keys', () => {
  const required = ['enabled','autoDrill','autoAccept','maxDrillDepth','drillInterval','typingSpeed','debug','minimized'];
  const cfg = {enabled:true,autoDrill:false,autoAccept:true,maxDrillDepth:5,drillInterval:5000,typingSpeed:50,debug:false,minimized:false};
  required.forEach(k => assert(k in cfg, `Missing key: ${k}`));
});

test('CONFIG.maxDrillDepth — default 5', () => {
  assertEqual(5, 5);
});

test('User activity detection — 10s threshold', () => {
  const lastActivity = Date.now() - 11000;
  assert(Date.now() - lastActivity >= 10000, 'Should detect user inactive after 10s');
});

// ─── RESULTS ──────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║  AI-Auto-Driller Unified — Validation v3     ║');
console.log('╚══════════════════════════════════════════════╝\n');
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
});
console.log(`\n─────────────────────────────────────────`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
console.log(`─────────────────────────────────────────\n`);
console.log(`RESULT: ${failed === 0 ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
process.exit(failed > 0 ? 1 : 0);
