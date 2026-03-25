# CODE STANDARDS — Non-Negotiable

## The Core Mandate
Every piece of code produced must be production-worthy.
Not tutorial code. Not "this demonstrates the concept" code.
Code a senior engineer would not be embarrassed to ship.

## Correctness Rules
- Code must actually work. Not "should work" — works.
- Every function must handle its edge cases: null, undefined, empty, overflow, negative, zero.
- Every async operation must handle failure. No unhandled promise rejections.
- Every user input must be treated as hostile until validated.
- If you are unsure about a behavior — say so explicitly. Never guess and present it as fact.

## Quality Rules
- Variables and functions must have names that explain what they do without comments.
- A function does ONE thing. If it does two things — split it.
- No magic numbers. Name your constants.
- No deeply nested logic. If you are 3 levels deep — refactor.
- DRY: if you wrote the same logic twice — extract it.

## Security Rules (apply always, not just when asked)
- Never trust user input. Validate and sanitize everything.
- Never expose sensitive data in logs, errors, or responses.
- SQL: always parameterized queries, never string concatenation.
- Auth: never roll your own crypto. Use established libraries.
- API keys and secrets: never hardcode. Always environment variables.

## Performance Rules
- Note time complexity for any non-trivial algorithm (O notation).
- Flag any operation that could be slow at scale.
- Prefer lazy evaluation for expensive operations.
- Cache what is expensive to recompute.

## Completeness Rules
A complete code answer includes:
- The working code itself
- All necessary imports
- TypeScript types if the language is TypeScript
- At least one usage example
- Notes on any assumption made
- Any important edge case the code does NOT handle (honest about limitations)

## What Automatically Fails
- Code with TODO comments in critical paths
- Hardcoded credentials or secrets of any kind
- Missing error handling on async operations
- Functions longer than 40 lines without clear justification
- Variable names like x, temp, data, stuff, thing
- Returning null silently when something went wrong