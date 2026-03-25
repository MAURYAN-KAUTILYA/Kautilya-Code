# PROMPT PATTERNS — Complete Classification System

## PURPOSE
This file defines every possible prompt structure so the Decision Engine can instantly classify any question and determine the minimum pipeline needed. Read this completely before making any routing decision.

---

## TIER 1 — INSTANT (1 stage: Direct Answer only)
**Time target: 3-5 seconds**

These questions have definitive, short answers. No research, no reasoning chain needed.

### Pattern signatures:
- "What is X" where X is a simple definition
- "Who is X" where X is a well-known person/entity
- "When did X happen" — specific historical date
- "How many X" — simple countable fact
- "What does X stand for" — acronym/abbreviation
- "Is X true/false" — simple verifiable fact
- "What year was X" — date question
- "Define X" — single concept definition
- "What is the capital of X"
- "How do you spell X"
- "What is the formula for X" — known formula
- "Convert X to Y" — unit conversion
- "What language is X written in"
- "Who invented X" — known inventor

### Examples:
- "What is DNA?" → TIER 1
- "Who is Chanakya?" → TIER 1
- "What is 15% of 200?" → TIER 1
- "What does API stand for?" → TIER 1
- "What is the capital of France?" → TIER 1
- "What year did WW2 end?" → TIER 1

---

## TIER 2 — FAST (2 stages: Research + Answer)
**Time target: 8-12 seconds**

Questions needing factual depth but not complex reasoning. Lookup + explain.

### Pattern signatures:
- "How does X work" — mechanism explanation
- "Explain X" — concept explanation
- "What are the benefits/drawbacks of X"
- "Tell me about X" — overview request
- "What causes X" — causation, single domain
- "What is the difference between X and Y"
- "List the steps to X" — procedural
- "How do I X" — how-to with known answer
- "What are the types of X"
- "Why is X important"
- "Give me an example of X"
- "What happens when X"
- "Describe X"
- "Summarize X"

### Examples:
- "How does photosynthesis work?" → TIER 2
- "Explain machine learning" → TIER 2
- "What is the difference between TCP and UDP?" → TIER 2
- "How does the immune system work?" → TIER 2
- "What are the benefits of meditation?" → TIER 2

---

## TIER 3 — STANDARD (4 stages: Analyze + Research + Reason + Answer)
**Time target: 20-30 seconds**

Questions requiring genuine reasoning, multi-domain knowledge, or nuanced understanding.

### Pattern signatures:
- "Why does X happen" — requires causal reasoning
- "Should I X or Y" — decision/comparison
- "What is the best way to X" — optimization
- "How can I improve X" — improvement advice
- "What would happen if X" — hypothetical reasoning
- "Is X better than Y" — evaluative comparison
- "Why do people X" — behavioral/psychological
- "How should I approach X" — strategic advice
- "What is wrong with X" — diagnosis/critique
- "Can you analyze X" — analysis request
- "What are the implications of X"
- "How does X affect Y" — relationship analysis
- "What is the relationship between X and Y"
- "Evaluate X" — judgment required
- Questions with "actually", "really", "truly" — implies depth wanted
- Questions with "in depth", "deeply", "thoroughly"

### Examples:
- "Why do people procrastinate?" → TIER 3
- "Should I learn React or Vue?" → TIER 3
- "How can I improve my focus?" → TIER 3
- "Is capitalism better than socialism?" → TIER 3
- "Why does exercise improve mental health?" → TIER 3

---

## TIER 4 — DEEP (5 stages: Full pipeline minus one QC pass)
**Time target: 35-45 seconds**

Complex multi-domain questions, strategic problems, technical deep dives.

### Pattern signatures:
- Multi-part questions with "and also" / "furthermore" / "additionally"
- Questions about systems, architectures, strategies
- "How do I build X" — complex creation
- "Design a X" — design challenge
- "Create a plan for X" — planning
- Technical questions spanning multiple domains
- "What is the complete X" — completeness requested
- Business/startup/career strategic questions
- Questions containing domain-specific jargon suggesting expert level
- "From first principles" / "fundamentally" / "at a deep level"
- Medical/legal/financial questions requiring careful reasoning
- Historical analysis questions
- "Compare and contrast X and Y in detail"
- "What separates X from Y" — when X and Y are about human qualities/greatness
- "What is the one thing that..." — single insight questions deserve deep reasoning
- Questions about excellence, mastery, greatness → always Tier 4 minimum
- "What is the one thing..." → always Tier 4
- "What do X know that Y don't" → always Tier 4  
- "What school never teaches" → always Tier 4
- "Why do most people never..." → always Tier 4
- Any question where the honest answer is uncomfortable → Tier 4

### Examples:
- "How do I build a startup with no money?" → TIER 4
- "Design a recommendation algorithm" → TIER 4
- "Explain quantum entanglement from first principles" → TIER 4
- "What is the complete process of how the internet works?" → TIER 4
- "How does CRISPR gene editing actually work?" → TIER 4

---

## TIER 5 — FULL (6 stages: Complete Chanakya pipeline)
**Time target: 50-70 seconds**

Questions requiring live web data, maximum depth, or genuinely novel synthesis.

### Pattern signatures:
- Questions about recent events, current news, latest developments
- "What is happening with X right now"
- "Latest X" / "recent X" / "current X" / "today's X"
- Questions requiring up-to-date statistics or data
- "What do experts currently think about X"
- Highly contested or rapidly evolving topics
- Questions where the answer may have changed recently
- Research-level questions
- Questions with "comprehensive", "complete guide", "everything about"
- Multi-perspective analysis of complex social/political topics
- Creative synthesis across many domains
- "Best X in 2024/2025" — requires current data

### Examples:
- "What are the latest developments in AI?" → TIER 5
- "What is the current state of quantum computing?" → TIER 5
- "Give me a comprehensive guide to learning programming" → TIER 5
- "What do experts currently think about intermittent fasting?" → TIER 5
- "What are the best AI startups right now?" → TIER 5

---

## SPECIAL CASES

### Conversational / Chitchat → TIER 1
- "Hi", "Hello", "How are you", "Thanks", "What's your name"
- Any greeting or pleasantry
- One word messages

### Code questions → TIER 2 or TIER 3
- "Write code for X" → TIER 2 (just generate)
- "Why is my code X" / "Debug X" → TIER 3 (requires reasoning)
- "Design the architecture for X" → TIER 4

### Math questions → TIER 1 or TIER 3
- Computation → TIER 1
- Proof or conceptual → TIER 3

### Opinion questions → TIER 3
- "What do you think about X" → TIER 3 (requires nuanced response)

### Ambiguous questions → Default to TIER 3
- When unclear, choose the middle path

---

## DECISION OUTPUT FORMAT
The Decision Engine must output EXACTLY this JSON:

```json
{
  "tier": 2,
  "reason": "Single domain explanation, no reasoning chain needed",
  "stages": ["research", "answer"],
  "web_search": false,
  "user_level": "student",
  "focus": "What is the core thing to nail in this answer"
}
```

Tier must be 1, 2, 3, 4, or 5.
web_search true only for Tier 4+ OR if question explicitly needs current data.
user_level: "child", "beginner", "student", "advanced", "expert"