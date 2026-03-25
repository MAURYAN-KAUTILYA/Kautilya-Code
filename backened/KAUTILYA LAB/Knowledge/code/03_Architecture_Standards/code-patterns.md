# CODE PROMPT PATTERNS — Routing Classification

## PURPOSE
Every coding request maps to a tier. The Decision Engine reads this file
and picks the minimum pipeline needed. Speed matters — don't over-route.

---

## TIER 1 — INSTANT (~3s) — Direct answer, no pipeline
Single-fact code questions. Syntax lookups. Quick definitions.

Signatures:
- "What is the syntax for X in Y"
- "How do you declare X in Y"
- "What does X operator do"
- "What is the difference between == and ==="
- "How do you import X"
- "What does this error message mean" (common known errors)
- "What is O(n) / Big O of X"
- Single-line code completions

Examples:
- "How do you destructure an array in JavaScript?" → TIER 1
- "What does the spread operator do?" → TIER 1
- "How do you write a ternary in Python?" → TIER 1

---

## TIER 2 — FAST (~10s) — Generate + explain
Write a single function, component, or small module. Known pattern, clear spec.

Signatures:
- "Write a function that X"
- "Create a component that X" (simple, single responsibility)
- "Write a regex for X"
- "Convert this code to X"
- "Write a SQL query that X"
- "Add error handling to this"
- "Write a utility that X"
- Clear spec, single file, no architecture decisions needed

Examples:
- "Write a function to debounce input" → TIER 2
- "Create a React button component" → TIER 2
- "Write a SQL query to get users with more than 3 orders" → TIER 2

---

## TIER 3 — STANDARD (~25s) — Reason + Generate + Review
Multi-part features, debugging, code that requires reasoning about approach.

Signatures:
- "Why is my code doing X" — debugging
- "How should I structure X" — architecture lite
- "What is wrong with this code"
- "Refactor this to be X"
- "Implement X feature" (multi-function, one file)
- "Optimize this for performance"
- "Write tests for this"
- Questions with "best way", "should I", "which approach"
- Code review requests

Examples:
- "Why is this useEffect running infinitely?" → TIER 3
- "Refactor this class component to hooks" → TIER 3
- "Write unit tests for this auth function" → TIER 3

---

## TIER 4 — DEEP (~40s) — Full reasoning pipeline
Complex systems, architecture decisions, multi-file features, security-sensitive code.

Signatures:
- Multi-file system or feature
- "Design the architecture for X"
- "Build a X system" (auth, caching, rate limiting, etc.)
- "How do I scale X"
- Security-sensitive: auth, payments, encryption
- "Implement X from scratch"
- Performance-critical code
- "Integrate X with Y"
- Complex algorithms (graphs, trees, dynamic programming)
- Database schema design
- API design

Examples:
- "Build a JWT authentication system" → TIER 4
- "Design a database schema for an e-commerce app" → TIER 4
- "Implement a rate limiter in Node.js" → TIER 4
- "How do I implement infinite scroll efficiently?" → TIER 4

---

## TIER 5 — FULL (~60s) — Everything + web search
Cutting-edge libraries, framework-specific patterns that may have changed,
best current practices, full system design, complex debugging with unknown cause.

Signatures:
- Questions about specific library versions or recent APIs
- "What is the current best practice for X"
- "How does X work in [framework] v[recent version]"
- Full application architecture
- "Build a complete X" — entire working system
- Complex debugging: "I've tried everything and..."
- Migration guides: "How do I migrate from X to Y"

Examples:
- "What is the best way to handle state in React 19?" → TIER 5
- "Build a complete REST API with auth, rate limiting, and caching" → TIER 5
- "How do I migrate from React Router v5 to v6?" → TIER 5

---

## LANGUAGE / FRAMEWORK DETECTION
Always detect and note:
- Primary language (JavaScript, TypeScript, Python, etc.)
- Framework if relevant (React, Express, FastAPI, etc.)
- Environment (browser, Node.js, mobile, etc.)
- Existing code style if provided (tabs vs spaces, naming conventions)

If language is ambiguous — default to TypeScript for frontend, Python for backend/data.

---

## DECISION OUTPUT FORMAT
Output ONLY raw JSON:
{"tier":2,"reason":"brief reason","web_search":false,"language":"typescript","framework":"react","focus":"what to nail","complexity":"function|feature|system"}