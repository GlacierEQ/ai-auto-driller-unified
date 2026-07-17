# 📱 iOS Bookmarklets Guide

## Overview
For iOS/iPadOS users who can't install Tampermonkey, we provide bookmarklet versions that work in Safari and other mobile browsers.

## 🚀 Installation

### Step 1: Create Bookmark
1. **Open Safari** on your iPhone/iPad
2. Visit any website (e.g., apple.com)
3. Tap the **Share button** (↑)
4. Tap **Add Bookmark**
5. Name it: **ChatGPT Driller** or **Perplexity Driller**
6. Save to **Favorites**

### Step 2: Edit Bookmark
1. Tap **Bookmarks icon** (📖)
2. Tap **Edit**
3. Select your bookmark
4. **Delete the URL**
5. **Paste the bookmarklet code** (see below)
6. Tap **Done**

## 🤖 ChatGPT Bookmarklet

```javascript
javascript:(function(){const CONFIG={maxDepth:5,interval:5000,typingSpeed:50};const STATE={count:0,processing:false};const PATTERNS={clarification:["Can you elaborate on {topic}?","What are examples of {topic}?"],depth:["What are principles behind {topic}?","How does {topic} work deeper?"],practical:["How to implement {topic}?","What tools for {topic}?"]};function extractTopic(text){const words=text.toLowerCase().split(/\s+/).filter(w=>w.length>3&&!['this','that','what','how','when'].includes(w));return words.slice(0,2).join(' ')||'this';}function generateQ(){const categories=Object.keys(PATTERNS);const cat=categories[Math.floor(Math.random()*categories.length)];const pattern=PATTERNS[cat][Math.floor(Math.random()*PATTERNS[cat].length)];const msgs=document.querySelectorAll('[data-message-author-role="assistant"]');const lastMsg=msgs[msgs.length-1];const topic=lastMsg?extractTopic(lastMsg.textContent):'this topic';return pattern.replace('{topic}',topic);}function autoContinue(){const btns=document.querySelectorAll('button');btns.forEach(btn=>{if(btn.textContent.includes('Continue')&&btn.offsetParent){btn.click();console.log('Clicked continue');}});}function drill(){if(STATE.processing||STATE.count>=CONFIG.maxDepth)return;STATE.processing=true;const input=document.querySelector('textarea[placeholder*="Message"]')||document.querySelector('#prompt-textarea');if(!input){STATE.processing=false;return;}const q=generateQ();input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>{const submit=document.querySelector('button[data-testid="send-button"]');if(submit)submit.click();STATE.count++;alert(`Drill ${STATE.count}/${CONFIG.maxDepth}: ${q}`);STATE.processing=false;},500);}setInterval(autoContinue,500);setInterval(drill,CONFIG.interval);alert('ChatGPT Driller Active!\nAuto-continue: ON\nAuto-drill will start in 5s');})();
```

## 🔍 Perplexity Bookmarklet

```javascript
javascript:(function(){const CONFIG={maxDepth:5,interval:4000};const STATE={count:0};const PATTERNS={clarification:["Can you elaborate on {topic}?","What are examples of {topic}?"],depth:["What principles underlie {topic}?","How does {topic} work?"],practical:["How to apply {topic}?","What are uses of {topic}?"]};function extractTopic(text){const words=text.toLowerCase().split(/\s+/).filter(w=>w.length>3);return words.slice(0,2).join(' ')||'this';}function approve(){const btns=document.querySelectorAll('button');btns.forEach(btn=>{const text=btn.textContent.toLowerCase();if((text.includes('approve')||text.includes('allow')||text.includes('yes'))&&btn.offsetParent){btn.click();console.log('Auto-approved');}});}function drill(){if(STATE.count>=CONFIG.maxDepth)return;const msgs=document.querySelectorAll('[class*="prose"]');const lastMsg=msgs[msgs.length-1];if(!lastMsg)return;const topic=extractTopic(lastMsg.textContent);const cats=Object.keys(PATTERNS);const cat=cats[Math.floor(Math.random()*cats.length)];const pattern=PATTERNS[cat][Math.floor(Math.random()*PATTERNS[cat].length)];const q=pattern.replace('{topic}',topic);const input=document.querySelector('textarea[placeholder*="Ask"]');if(!input)return;input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>{const submit=document.querySelector('button[aria-label*="Submit"]');if(submit)submit.click();STATE.count++;alert(`Drill ${STATE.count}/${CONFIG.maxDepth}`);},300);}setInterval(approve,300);setInterval(drill,CONFIG.interval);alert('Perplexity Driller Active!\nAuto-approve: ON\nDrilling starts in 4s');})();
```

## 🎮 Usage

### ChatGPT:
1. Visit chatgpt.com in Safari
2. Ask your initial question
3. Tap **Bookmarks** → **ChatGPT Driller**
4. Alert shows: "ChatGPT Driller Active!"
5. Auto-continue will click "Continue" buttons
6. Auto-drill starts after 5 seconds
7. Alerts show each drill count

### Perplexity:
1. Visit perplexity.ai in Safari
2. Ask your initial question
3. Tap **Bookmarks** → **Perplexity Driller**
4. Alert shows: "Perplexity Driller Active!"
5. Auto-approve handles permissions
6. Drilling starts after 4 seconds

## ⚙️ Configuration

### Edit Bookmarklet Code:

**Max Depth:**
```javascript
maxDepth:5  // Change to 3, 10, etc.
```

**Interval (milliseconds):**
```javascript
interval:5000  // 5 seconds, change to 3000, 8000, etc.
```

**Typing Speed:**
```javascript
typingSpeed:50  // Milliseconds per character
```

## ⚠️ Limitations

**iOS Bookmarklets vs Desktop Scripts:**

| Feature | Bookmarklet | Tampermonkey |
|---------|-------------|-------------|
| Auto-run on page load | ❌ No (manual tap) | ✅ Yes |
| Persistent UI panel | ❌ No | ✅ Yes |
| Session persistence | ❌ No | ✅ Yes |
| Configuration UI | ❌ No | ✅ Yes |
| Live statistics | ❌ Limited (alerts) | ✅ Full dashboard |
| Update notifications | ❌ Manual | ✅ Automatic |
| Multiple themes | ❌ No | ✅ Yes |

## 🐛 Troubleshooting

### Bookmarklet Not Working
1. **Re-paste the code** (may have gotten corrupted)
2. **Check URL field** starts with `javascript:`
3. **Hard refresh** the AI platform page
4. **Try different browser** (Chrome iOS, Edge iOS)

### Alerts Not Showing
1. **Enable JavaScript** in Safari settings
2. **Allow pop-ups** for the site
3. **Check console** for errors (desktop Safari only)

### Drilling Not Starting
1. **Wait for response** to fully complete
2. **Manually tap bookmarklet** again
3. **Check max depth** hasn't been reached
4. **Verify selectors** (AI platforms may have updated UI)

## 🔄 Updates

To update bookmarklets:
1. Delete old bookmark
2. Create new one with updated code
3. Paste new version from this page

**Check for updates:** [GitHub Releases](https://github.com/GlacierEQ/chatgpt_infinity/releases)

## 📞 Support

For iOS-specific issues:
- [Report iOS bugs](https://github.com/GlacierEQ/chatgpt_infinity/issues)
- [Join discussions](https://github.com/GlacierEQ/chatgpt_infinity/discussions)

---

**Note:** Desktop Tampermonkey versions are much more powerful. iOS bookmarklets are a lightweight alternative for mobile users.