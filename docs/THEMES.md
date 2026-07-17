# 🎨 Theme Customization Guide

## Available Themes

### Default Themes

#### 🤖 ChatGPT (Emerald)
```css
background: linear-gradient(135deg, #10a37f 0%, #1a7f64 100%);
```
**Brand:** OpenAI ChatGPT  
**Vibe:** Professional, trustworthy, tech-forward

#### 🔍 Perplexity (Sapphire)
```css
background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
```
**Brand:** Perplexity AI  
**Vibe:** Intelligence, clarity, precision

#### 🧠 Claude (Amber)
```css
background: linear-gradient(135deg, #cc785c 0%, #e07b39 100%);
```
**Brand:** Anthropic Claude  
**Vibe:** Warm, thoughtful, sophisticated

---

## Custom Themes

### 🝣 Purple Haze (Amethyst)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```
**Use Case:** Creative work, design projects  
**Mood:** Artistic, innovative, imaginative

### 🌅 Sunset Orange (Coral)
```css
background: linear-gradient(135deg, #f12711 0%, #f5af19 100%);
```
**Use Case:** High-energy tasks, motivation  
**Mood:** Bold, energetic, passionate

### 🌊 Ocean Teal (Aquamarine)
```css
background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
```
**Use Case:** Calm research, long sessions  
**Mood:** Peaceful, refreshing, balanced

### 🌹 Rose Pink (Blush)
```css
background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
```
**Use Case:** Creative content, social media  
**Mood:** Vibrant, playful, modern

### 🌙 Night Mode (Obsidian)
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
```
**Use Case:** Late-night work, eye strain reduction  
**Mood:** Dark, sleek, focused

### 🌿 Lime Fresh (Jade)
```css
background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%);
```
**Use Case:** Productivity, task completion  
**Mood:** Fresh, natural, energizing

---

## How to Apply Themes

### Method 1: Edit Script File

1. **Open Tampermonkey Dashboard**
2. **Click on your script** (ChatGPT/Perplexity/Claude)
3. **Find the `attachStyles()` function** (around line 700)
4. **Locate this line:**
```javascript
background: linear-gradient(135deg, #XXXXXX 0%, #YYYYYY 100%);
```
5. **Replace colors** with your chosen theme
6. **Save** (Ctrl+S / Cmd+S)
7. **Refresh** AI platform page

### Method 2: Browser Console (Temporary)

1. **Open page** with script active
2. **Press F12** (open DevTools)
3. **Go to Console tab**
4. **Paste and execute:**

```javascript
// Example: Apply Purple Haze theme
document.querySelector('[id*="auto-driller-pro"]').style.background = 
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
```

**Note:** This only lasts until page reload

---

## Create Your Own Theme

### Step 1: Choose Colors

Use color picker tools:
- [Coolors.co](https://coolors.co/) - Generate palettes
- [Adobe Color](https://color.adobe.com/) - Color wheel
- [UI Gradients](https://uigradients.com/) - Pre-made gradients

### Step 2: Test Gradient

Test your gradient online:
- [CSS Gradient Generator](https://cssgradient.io/)
- [Gradient Hunt](https://gradienthunt.com/)

### Step 3: Apply to Script

```javascript
// In attachStyles() function, replace:
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
```

### Step 4: Adjust Active States

Match toggle colors to theme:
```css
.toggle.active {
    background: #YOUR_ACCENT_COLOR; /* Use lighter shade of primary */
}
```

---

## Theme Gallery

### Productivity Themes

**Forest Green:**
```css
background: linear-gradient(135deg, #134e5e 0%, #71b280 100%);
```

**Sky Blue:**
```css
background: linear-gradient(135deg, #2980b9 0%, #6dd5fa 100%);
```

**Sunset Red:**
```css
background: linear-gradient(135deg, #c31432 0%, #240b36 100%);
```

### Dark Themes

**Midnight Blue:**
```css
background: linear-gradient(135deg, #0f2027 0%, #203a43 100%);
```

**Charcoal:**
```css
background: linear-gradient(135deg, #232526 0%, #414345 100%);
```

**Deep Purple:**
```css
background: linear-gradient(135deg, #360033 0%, #0b8793 100%);
```

---

## Advanced Customization

### Multi-Color Gradients

```css
background: linear-gradient(
    135deg, 
    #color1 0%, 
    #color2 33%, 
    #color3 66%, 
    #color4 100%
);
```

### Radial Gradients

```css
background: radial-gradient(
    circle at top right, 
    #color1, 
    #color2
);
```

### Animated Gradients

```css
@keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

#your-panel {
    background: linear-gradient(135deg, #color1, #color2, #color3);
    background-size: 200% 200%;
    animation: gradient 10s ease infinite;
}
```

---

## Theme Presets JSON

Export/Import themes:

```json
{
    "themes": [
        {
            "name": "ChatGPT Emerald",
            "primary": "#10a37f",
            "secondary": "#1a7f64",
            "accent": "#34d399"
        },
        {
            "name": "Custom Purple",
            "primary": "#667eea",
            "secondary": "#764ba2",
            "accent": "#a78bfa"
        }
    ]
}
```

---

## Troubleshooting

### Theme Not Applying
1. **Clear browser cache** (Ctrl+Shift+Del)
2. **Hard refresh** (Ctrl+F5)
3. **Check CSS syntax** (missing semicolons, brackets)
4. **Verify color codes** (must be hex: #RRGGBB)

### Colors Look Wrong
1. **Check monitor calibration**
2. **Try different browser**
3. **Disable dark mode** extensions
4. **Test with default theme first**

### Panel Not Visible
1. **Check z-index** (should be 999999)
2. **Verify position** (fixed, top, right values)
3. **Check for conflicting styles**

---

## Community Themes

Share your themes:
- [Post in Discussions](https://github.com/GlacierEQ/chatgpt_infinity/discussions)
- Tag with `#theme`
- Include screenshot

Popular community themes will be featured here!

---

## 📸 Screenshots

*Coming soon: Gallery of all themes with screenshots*

---

**Made with ❤️ by [GlacierEQ](https://github.com/GlacierEQ)**