# CHANAKYA REASONING ENGINE
## The Cognitive Architecture That Forces Claude-Level Thinking

> *"The wise man does not decide — he eliminates. When every wrong answer
> is destroyed, only the truth remains."*
> — Kautilya, Arthashastra

---

## WHY THIS FILE EXISTS

Every other AI in your pipeline answers questions.
This file teaches it to **think before it answers** — the way Claude thinks.

Claude does not produce better output because it has more knowledge.
It produces better output because it **constructs reasoning explicitly** before
committing to a conclusion. It generates hypotheses. It attacks them. It falsifies
the weak ones. It follows the survivor to its conclusion — even if uncomfortable.

This file is the instruction set for replicating that cognitive process.

---

## THE FUNDAMENTAL REASONING PROTOCOL

Every non-trivial answer must follow this sequence internally.
This is non-negotiable. An answer that skips any step is incomplete reasoning.

```
STEP 1: HYPOTHESIS GENERATION
  → Generate 3 distinct possible answers/approaches
  → Do not evaluate yet — just surface them

STEP 2: FALSIFICATION
  → For each hypothesis: what specific evidence or logic would DESTROY it?
  → Actively try to kill each one
  → The one that survives attack is the candidate

STEP 3: ASSUMPTION AUDIT
  → What am I assuming to be true that I haven't verified?
  → If assumption X is wrong, does the candidate answer collapse?

STEP 4: CHANDRASEKHAR PRINCIPLE
  → Follow the reasoning where it leads — even if the conclusion is uncomfortable
  → Do NOT reverse-engineer a safe answer — reason FORWARD to the true one
  → Named for Subrahmanyan Chandrasekhar: told by the greatest astrophysicist alive
    that his math was wrong. He kept the math. He was right.

STEP 5: CONFIDENCE CALIBRATION
  → How certain am I? State it explicitly.
  → What would change the answer? State it explicitly.
  → Where am I in the territory of "known" vs "inferred" vs "guessed"?

STEP 6: OUTPUT
  → The answer that survived steps 1-5
  → With its surviving reasoning, not its conclusion alone
```

---

## THE XML THINKING PATTERN

This is the single most important technique.
**Force the model to think inside `<reasoning>` tags before producing output.**

Every prompt that requires real reasoning must include this instruction:

```
Before answering, work through your reasoning inside <reasoning> tags.
Inside the tags:
  - Generate 3 possible approaches or answers
  - Attack each one: what breaks it?
  - Pick the survivor
  - State what you're uncertain about
  - State what assumption you're making
Then provide your answer AFTER the </reasoning> tag.
```

Why this works: models that articulate their reasoning process produce
dramatically more accurate outputs than models that produce answers directly.
The act of writing the reasoning trace forces reconsideration of wrong paths
before they reach the output — exactly like Claude's extended thinking.

### Template — Reasoning Trace Prompt Addition

Add this block to the END of any system prompt that requires deep reasoning:

```
MANDATORY REASONING PROTOCOL:
Before producing your output, write your reasoning trace inside <reasoning></reasoning> tags.

Inside <reasoning>:
HYPOTHESES: [3 distinct possible approaches — not evaluated yet]
FALSIFICATION: [attack each hypothesis — what breaks it?]
SURVIVOR: [which hypothesis survived and why]
ASSUMPTIONS: [what am I assuming? what breaks if wrong?]
UNCERTAINTY: [what am I not sure about? what would change the answer?]

Then produce your actual output AFTER </reasoning>.
The reasoning trace is internal scaffolding — the user sees only what comes after.
```

---

## THE FIVE REASONING MODES

Different questions require different cognitive postures.
The pipeline must select the correct mode before reasoning begins.

### MODE 1 — DEDUCTIVE (Known → Conclusion)
Use when: The premises are certain. Logic leads directly to answer.
Pattern: "All X are Y. This is X. Therefore this is Y."
Kautilya equivalent: Applying established law to a known situation.
Prompt signal: "What is", "How does", "Define"

### MODE 2 — INDUCTIVE (Pattern → General Rule)
Use when: Reasoning from specific cases to a general principle.
Risk: Overgeneralization — always state the sample size and its limits.
Kautilya equivalent: Learning from past kingdoms what makes states strong.
Prompt signal: "Why do", "What causes", "What pattern"

### MODE 3 — ABDUCTIVE (Evidence → Best Explanation)
Use when: Multiple explanations exist — find the most probable.
Pattern: "The most parsimonious explanation that accounts for all evidence is X"
Kautilya equivalent: Intelligence analysis — what does the enemy's movement mean?
Prompt signal: "Why is", "What explains", "What went wrong"
**This is the hardest mode — most AI defaults to first plausible answer, not best.**

### MODE 4 — ADVERSARIAL (Assumption → Attack)
Use when: Evaluating code, plans, strategies, arguments.
Pattern: Steelman the opposite position first. Then attack it.
Kautilya equivalent: The Destroyer — find every flaw before the enemy does.
Prompt signal: "Review", "Evaluate", "Is this correct", "What's wrong with"

### MODE 5 — SYNTHETIC (Multiple Sources → New Insight)
Use when: Connecting ideas across domains to produce something neither contained.
Pattern: Domain A solved X. Domain B has problem X. Apply A's solution to B.
Kautilya equivalent: Applying military strategy to statecraft to economics.
Prompt signal: "How might", "What can we learn from", "What is the relationship between"

---

## SELF-CONSISTENCY PROTOCOL

Claude's self-consistency: generate multiple reasoning paths independently,
then check if they converge on the same answer.
If they diverge — that divergence IS the answer (it means the question is ambiguous
or requires more information).

### Implementation in Pipeline:

For Tier 4-5 code questions, the two-version generation already does this.
But the **judge prompt** must be upgraded to detect REASONING divergence, not just
code style divergence.

Judge instruction addition:
```
REASONING DIVERGENCE CHECK:
Do these two implementations make different ASSUMPTIONS about the problem?
If yes — state the assumption difference explicitly before picking the winner.
The assumption difference reveals an ambiguity that should be flagged to the user.
```

### Self-Consistency Prompt Pattern:

When a single stage needs self-consistency:
```
Generate your answer. Then generate it again from scratch, as if you had not
seen your first answer. Then compare the two.
If they agree: the answer is reliable.
If they diverge: state what caused the divergence — that divergence is
the most important thing in your response.
```

---

## UNCERTAINTY QUANTIFICATION — THE CALIBRATION SCALE

Claude never presents uncertain knowledge as fact.
Your pipeline must do the same. Every output stage must apply this scale:

```
KNOWN (K): Direct derivation from code/math/logic. Verifiable. State without hedge.
  Example: "This has O(n²) time complexity" — calculable, not opinion.

INFERRED (I): Strong evidence points here but not certain. Flag it.
  Example: "This likely has a race condition" — flag as inference.
  Language: "The evidence suggests...", "This indicates...", "Most likely..."

MODELED (M): Best guess from pattern matching. State model and its limits.
  Example: "Based on typical Node.js behavior..." — model may not apply here.
  Language: "Assuming standard behavior...", "Under typical conditions..."

GUESSED (G): Insufficient information. Say so. Do not dress a guess as inference.
  Language: "I don't have enough context to be certain, but...", "This is speculation..."

UNKNOWN (U): Outside knowledge. Say so explicitly. Do not hallucinate.
  Language: "I don't know", "This requires verification", "Check the documentation."
```

**Non-negotiable rule:** If output contains a (G) or (U) level claim presented
as (K) level certainty — that is a hallucination. The pipeline has failed.

---

## THE CONTRARIAN CHECK

After every major claim, ask:
*"What would a smart person who disagrees say?"*

Three possible outcomes:
1. The disagreement is valid → include it and adjust the claim
2. The disagreement is weak → explain exactly why it is weak (do not just dismiss)
3. The disagreement reveals a genuine controversy → surface the controversy, do not hide it

This is not devil's advocate for its own sake.
This is the intellectual honesty that separates analysis from propaganda.

Prompt pattern to inject:
```
CONTRARIAN CHECK:
Before finalizing your answer, state the strongest objection to it.
Then: either refute it with specific reasoning, or incorporate it into your answer.
An objection that cannot be refuted must modify the answer.
```

---

## THE SOCRATIC DECOMPOSITION

Complex questions must be decomposed before answered.
Chanakya never advised on a question he had not first broken into its parts.

Pattern:
```
DECOMPOSE: What are the 3 sub-questions this question contains?
SEQUENCE: Which must be answered first to answer the others?
ANSWER EACH: In sequence — do not skip ahead.
SYNTHESIZE: What does answering all three tell us about the original question?
```

This prevents the #1 failure mode of LLMs on complex questions:
**answering the easy sub-question while the hard sub-question determines the answer.**

Example:
"Should I use microservices for my startup?"
Easy sub-question: "What are microservices?"
Hard sub-question: "What does my specific team/product/scale actually need?"
Most AI answers the easy one. The Socratic decomposition forces both.

---

## THE LADDER OF ABSTRACTION

Move deliberately between abstract and concrete.
The mistake: staying at one level.

```
ABSTRACT (why) → PRINCIPLE (what) → CONCRETE (how) → SPECIFIC (example)
```

Every complete answer touches at least 3 of the 4 rungs.
An answer that only touches CONCRETE produces instructions without understanding.
An answer that only touches ABSTRACT produces philosophy without utility.

Chanakya's advice was always: principle first, then tactic. Never tactic alone.
Because a tactic without a principle cannot be adapted when conditions change.

---

## THE THREE QUESTIONS — PRE-ANSWER PROTOCOL

Before any answer is produced for Tier 3+, the reasoning engine asks:

**1. WHAT IS ACTUALLY BEING ASKED?**
Not the surface question — the real question underneath.
"How do I center a div in CSS?" → Real question: "Why does CSS positioning feel broken?"
The real question determines the depth of answer needed.

**2. WHAT WOULD MAKE THIS ANSWER WRONG?**
Generate this before producing the answer — not after.
Knowing what would falsify the answer sharpens it before it leaves.

**3. WHAT DOES THE PERSON DO WITH THIS?**
What action does this answer enable?
If no action follows from the answer — the answer is incomplete.
Chanakya's counsel always ended with what the king should DO — not just what he should know.

---

## ANTI-PATTERNS — WHAT KILLS REASONING

These are the reasoning failures the pipeline must detect and refuse to produce:

### GALAXY-BRAINED REASONING
Definition: A chain of individually plausible steps that leads to an absurd conclusion.
Detection: If the conclusion surprises common sense — backtrack and audit every step.
The surprise is a signal that one step is wrong, not that the conclusion is secretly right.

### FALSE CONSENSUS
Definition: "Most experts believe X" when X is contested.
Detection: If a claim invokes authority without naming who disagrees — flag it.
Consensus that cannot name its dissenters is not consensus.

### MOTTE AND BAILEY
Definition: Defend a strong claim (bailey) with a weak claim (motte) when attacked.
Example: Claiming "AI will replace all programmers" then retreating to "AI will change programming"
Detection: If the interesting claim and the defensible claim are different — say both explicitly.

### AFFIRMING THE CONSEQUENT
Definition: "If X then Y. Y is true. Therefore X." (Invalid — Y could have other causes.)
Detection: Multiple causes for the same effect. Do not pick the first explanation.

### SURFACE-LEVEL PATTERN MATCHING
Definition: Recognizing a surface feature and applying a cached answer.
Example: "This looks like a sorting problem" → applying quicksort without checking if sorted data already.
Detection: Ask "Have I actually thought about this specific case, or am I pattern-matching?"

---

## INTEGRATION INSTRUCTIONS

### How to inject reasoning protocols into stage prompts:

**For stageIntent:** Add the Socratic Decomposition + Three Questions protocol
**For stageResearch:** Add Uncertainty Quantification (K/I/M/G/U) + Contrarian Check  
**For stageArchitecture:** Add Tree of Approaches (Mode 3: Abductive) + Ladder of Abstraction
**For stageGenerate:** Add Self-Consistency check + Craftsmanship tests
**For constitutional:** Add Adversarial Mode (Mode 4) + Anti-pattern detection
**For stageDestroy:** Add full Falsification protocol — attack every assumption

### XML Reasoning Trace — inject into Tier 3+ prompts:

```javascript
const REASONING_INJECTION = `
MANDATORY: Before producing output, write your reasoning trace inside <reasoning></reasoning>.

<reasoning>
HYPOTHESES: [3 approaches without evaluation]
FALSIFICATION: [what breaks each hypothesis]
SURVIVOR: [which survived and why — be specific]
ASSUMPTIONS: [what I'm assuming, what breaks if wrong]  
UNCERTAINTY: [what I'm not certain about, calibrated K/I/M/G/U]
CONTRARIAN: [strongest objection + why I'm overriding or incorporating it]
</reasoning>

[Your actual output follows here]`;
```

---

## THE CHANAKYA REASONING STANDARD

Chanakya's advice to Chandragupta was not just correct — it was **correct in advance**.
He modeled failure modes before they happened. He planned for betrayal. He stress-tested
strategies against the worst possible adversary, not the average one.

That is the reasoning standard for this pipeline.

Not "what is the right answer if everything goes as planned?"
But "what is the right answer when the adversary is intelligent, the network drops at the
worst moment, the input is malicious, the requirement changes after implementation?"

An answer that only survives the happy path has not been reasoned — it has been guessed.

**The standard:** Every output this pipeline produces must have survived
the adversary's best attack — in reasoning, in architecture, in code.

If it survived: ship it.
If it did not: the reasoning engine found the flaw first. Fix it.
That is the entire point.