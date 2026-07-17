# ⚙️ Configuration Profiles Guide

## Quick Reference

| Profile | Max Depth | Interval | Speed | Best For |
|---------|-----------|----------|-------|----------|
| 🔬 **Research** | 15-20 | 5-6s | 50ms | Academic, deep exploration |
| ⚡ **Quick** | 2-3 | 3s | 40ms | Fast overviews, summaries |
| 🛡️ **Safe** | 2 | 6s | 60ms | Rate-limit friendly, testing |
| 🚀 **Aggressive** | 20-30 | 2s | 30ms | Maximum depth, power users |
| 🎓 **Learning** | 8-10 | 4s | 50ms | Tutorials, structured learning |
| 💼 **Professional** | 5-7 | 4-5s | 45ms | Business intel, reports |
| 🧪 **Experimental** | 30 | 1.5s | 20ms | Testing, edge cases |
| 🎯 **Focused** | 4 | 5s | 50ms | Targeted questions |

---

## Detailed Profiles

### 🔬 Research Mode

**Configuration:**
```javascript
maxDrillDepth: 15-20
drillInterval: 5000-6000
typingSpeed: 50
intelligentMode: true
```

**Use Cases:**
- Academic research papers
- Technical documentation
- Comprehensive topic exploration
- Multi-faceted problem analysis

**Question Distribution:**
- Clarification: 30%
- Depth: 25%
- Practical: 20%
- Technical: 15%
- Others: 10%

**Example Session:**
```
1. Initial: "Explain quantum computing"
2. Drill 1: "What are the underlying principles behind quantum computing?"
3. Drill 2: "Can you elaborate on quantum superposition with specific examples?"
4. Drill 3: "What are real-world applications of quantum computing?"
... continues to depth 15-20
```

---

### ⚡ Quick Mode

**Configuration:**
```javascript
maxDrillDepth: 2-3
drillInterval: 3000
typingSpeed: 40
intelligentMode: false
```

**Use Cases:**
- Fast fact-checking
- Brief clarifications
- Simple definitions
- Quick overviews

**Optimizations:**
- Weighted toward clarification questions
- Faster typing simulation
- Shorter intervals
- Minimal depth

**Example Session:**
```
1. Initial: "What is Python?"
2. Drill 1: "Can you elaborate on Python with specific examples?"
3. Drill 2: "What are common use cases for Python?"
→ Stops at 2-3 drills
```

---

### 🛡️ Safe Mode

**Configuration:**
```javascript
maxDrillDepth: 2
drillInterval: 6000
typingSpeed: 60
intelligentMode: true
```

**Use Cases:**
- New to automation
- Rate-limit concerns
- Testing setup
- Conservative approach

**Safety Features:**
- Longer intervals (6s)
- Minimal depth (2 drills)
- Human-like typing (60ms)
- Gradual progression

**Why Use Safe Mode:**
1. **Avoid Rate Limits** - Longer intervals
2. **Test Functionality** - Low depth for testing
3. **Learn Patterns** - Observe 2 auto-questions
4. **Gradual Adoption** - Get comfortable first

---

### 🚀 Aggressive Mode

**Configuration:**
```javascript
maxDrillDepth: 20-30
drillInterval: 2000
typingSpeed: 30
intelligentMode: true
```

**Use Cases:**
- Power users with premium accounts
- Comprehensive research sessions
- Maximum information extraction
- Time-sensitive projects

**⚠️ Warnings:**
- **May trigger rate limits**
- **Requires premium account**
- **High token usage**
- **Monitor for errors**

**Recommended:**
- Use with Pro/Premium accounts
- Monitor console for errors
- Have manual stop ready
- Use during off-peak hours

---

### 🎓 Learning Mode

**Configuration:**
```javascript
maxDrillDepth: 8-10
drillInterval: 4000
typingSpeed: 50
intelligentMode: true
```

**Use Cases:**
- Online courses
- Tutorial follow-alongs
- Skill development
- Structured learning paths

**Pattern Focus:**
- Practical questions: 35%
- Clarification: 30%
- Examples-based: 20%
- Technical details: 15%

**Learning Flow:**
```
1. Initial: "How to build a REST API"
2. Auto-drills focus on:
   - Step-by-step breakdowns
   - Practical implementations
   - Common pitfalls
   - Best practices
   - Real-world examples
```

---

### 💼 Professional Mode

**Configuration:**
```javascript
maxDrillDepth: 5-7
drillInterval: 4000-5000
typingSpeed: 45
intelligentMode: true
```

**Use Cases:**
- Business intelligence
- Market research
- Competitive analysis
- Client presentations
- Report generation

**Question Types:**
- Comparative analysis
- Market trends
- Best practices
- ROI considerations
- Industry standards

**Example:**
```
Initial: "CRM software comparison"
Drills:
- Feature comparisons
- Pricing analysis
- Integration capabilities
- Vendor reliability
- Implementation timeline
```

---

### 🧪 Experimental Mode

**Configuration:**
```javascript
maxDrillDepth: 30
drillInterval: 1500
typingSpeed: 20
intelligentMode: true
```

**Use Cases:**
- Testing new patterns
- Pushing boundaries
- Edge case discovery
- Script development
- Beta testing features

**⚠️ Extreme Settings:**
- **Very fast** (1.5s intervals)
- **Maximum depth** (30 drills)
- **Ultra-fast typing** (20ms)
- **High risk of errors**

**Only Use When:**
- Testing local changes
- Debugging selectors
- Developing new features
- You understand the risks

---

### 🎯 Focused Mode

**Configuration:**
```javascript
maxDrillDepth: 4
drillInterval: 5000
typingSpeed: 50
intelligentMode: true
```

**Use Cases:**
- Specific goal-oriented queries
- Targeted information gathering
- Problem-solving sessions
- Precise question sequences

**Approach:**
- Start with specific question
- 4 focused follow-ups
- Stay on topic
- Avoid tangents

---

## Custom Profile Creation

### Template

```javascript
const MY_CUSTOM_PROFILE = {
    name: "My Profile",
    maxDrillDepth: 10,        // 1-50
    drillInterval: 4000,      // Milliseconds
    typingSpeed: 50,          // MS per character
    intelligentMode: true,     // Weighted patterns
    
    // Optional advanced settings
    patterns: {
        clarification: 0.3,    // 30%
        depth: 0.25,           // 25%
        practical: 0.25,       // 25%
        comparative: 0.1,      // 10%
        future: 0.05,          // 5%
        technical: 0.05        // 5%
    }
};
```

### How to Apply

1. **Open script** in Tampermonkey
2. **Find CONFIG object** (top of script)
3. **Replace values** with your profile
4. **Save** (Ctrl+S)
5. **Refresh** AI platform

---

## Profile Comparison

### Speed vs Depth

```
Depth ↑
  30 │         🧪 Experimental
     │         🚀 Aggressive
  20 │
     │    🔬 Research
  10 │    🎓 Learning
     │    💼 Professional
   5 │    🎯 Focused
     │    ⚡ Quick
   2 │    🛡️ Safe
   0 └────────────────────→ Speed
      6s  5s  4s  3s  2s  1.5s
```

### Token Usage Estimates

| Profile | Tokens/Session | Cost (GPT-4) |
|---------|----------------|-------------|
| Safe | ~2K | $0.04 |
| Quick | ~3K | $0.06 |
| Focused | ~5K | $0.10 |
| Professional | ~8K | $0.16 |
| Learning | ~12K | $0.24 |
| Research | ~25K | $0.50 |
| Aggressive | ~40K+ | $0.80+ |
| Experimental | ~50K+ | $1.00+ |

*Based on GPT-4 Turbo pricing*

---

## Best Practices

### Choosing a Profile

1. **Start with Safe Mode** - Get comfortable
2. **Upgrade to Quick/Focused** - Regular use
3. **Use Learning** - Educational purposes
4. **Try Research** - Deep dives (premium account)
5. **Avoid Aggressive** - Unless necessary

### Profile Switching

**During a session:**
1. Open panel
2. Adjust max depth slider
3. Change interval
4. Settings save automatically

**Permanent change:**
1. Edit script file
2. Update CONFIG defaults
3. Save and refresh

---

## Troubleshooting Profiles

### Too Fast (Errors)
**Symptoms:** Rate limit errors, failed drills  
**Solution:** Increase interval by 1-2 seconds

### Too Slow
**Symptoms:** Impatient, long waits  
**Solution:** Decrease interval, but stay above 2s

### Wrong Depth
**Symptoms:** Too many/few questions  
**Solution:** Adjust maxDrillDepth +/- 3

### Repetitive Questions
**Symptoms:** Similar questions repeatedly  
**Solution:** Enable intelligentMode, check topic extraction

---

## Community Profiles

Share your custom profiles:
- [Submit Profile](https://github.com/GlacierEQ/chatgpt_infinity/discussions/new?category=profiles)
- Include: name, settings, use case
- Popular profiles will be featured!

---

**Made with ❤️ by [GlacierEQ](https://github.com/GlacierEQ)**