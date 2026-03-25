# The Kautilyan Pipeline: Strict Rules of Execution

## 1. Core Operating Philosophy
This system bypasses standard linear Chain of Thought (CoT) by utilizing a **Multi-Divisional Adversarial Pipeline**. The "State Apparatus" debates, tests, and attacks code before it is passed to the user.

## 2. Step-by-Step Execution Lifecycle (The Block Protocol)

### Phase 1: Strategic Planning (The Council)
1. **The Prompt Arrives**: The User ("The People") submits a prompt.
2. **The Assessment (Rajarishi)**: The King evaluates the "Artha" (Business Value). 
   - *If the prompt is trivial*: Bypass the Block, assign to a low-level agent, stream result.
   - *If the prompt is vague/flawed*: Halt execution. Ask the User for clarification.
   - *If valid*: Proceed to Architecture.
3. **The Architecture (Amatya)**: The Chief Architect maps the logic to the Saptanga Theory. Separates data (Janapada), security (Durga), and APIs (Mitra). **Creates the initial interfaces.**

### Phase 2: The Adversarial Review (The Judiciary)
4. **Civil Linting (Dharmashta)**: The Civil Judge aggressively checks the Amatya's interfaces. 
   - Does it violate SOLID principles? 
   - Are types strict? 
   *If NO, reject and send back to Amatya.*
5. **Criminal Stress-Test (Kantaka Shodhana)**: The Destroyer assumes the code is hostile.
   - It attempts to find race conditions, memory leaks, SQL injections, or unhandled nulls.
   *If a flaw is found, send a batched critique back to Amatya.*

### Phase 3: External Diplomatic Negotiation
6. **API Management (Diplomat)**: If the Amatya's architecture requires external APIs or third-party libraries, the Diplomat enforces the Shadgunya (Six-fold Policy):
   - **Sandhi (Peace)**: Add retries and standard connections.
   - **Dvaidhibhava (Double Policy)**: Add fallback / Circuit Breaker patterns.
   - **Asana (Neutrality)**: Enforce asynchronous webhook waiting if necessary.

### Phase 4: Intelligence Injection
7. **Telemetry (Samstha)**: Stationary spies inject metrics and logging into the approved logic structure.
8. **Chaos Testing (Sanchara)**: Roaming spies write the unit tests under the **Three Spy Validation Rule** (Happy Path, Edge Case, Failure State).

### Phase 5: Royal Output
9. **Final Synthesis**: The King receives the surviving, hardened, tested code.
10. **Delivery**: The King outputs the code to the User.

---

## 3. The Grand Topology (Chain of Command)

This section strictly enforces the architecture graph, defining exactly who can talk to whom.

*   **1. The Block ➔ The King (Strict Subordination)**: 
    *   The Block (all internal pipeline agents) is directly sub-ordinate to the King (Rajarishi).
    *   Block agents **CANNOT act autonomously** and **CANNOT invent their own tasks**. They must strictly follow the King's mandate.
    *   If a Block agent wants to do something outside their initial mandate, or encounters ambiguity, they DO NOT guess—they **MUST stop and ask the King**.
*   **2. The King ➔ The User (The People)**: 
    *   The King acts as the sole bridge between the Block and the User.
    *   If the King has any doubts about the foundational prompt, the architecture, or the "Artha," the King halts execution and **MUST ask the User** for clarification before proceeding.
*   **3. The King ➔ The External Agent (Appointed Spies)**:
    *   The Design/Research Agent physically sits **OUTSIDE the Block**.
    *   It is connected **ONLY to the King** and can **ONLY be appointed by the King**.
    *   Block agents cannot talk to the Research Agent directly.

---

## 4. External Intelligence: Design & Research Agents
*   **Separation of Concerns**: As established above, they exist entirely outside the Block and report solely to the King.
*   **Mandate (The Rule of One)**: To prevent massive API token burns on infinite web browsing, these external agents run **exactly ONE TIME** per feature. They fetch design inspiration primarily from Apple (minimalism) and ChatGPT (functional clarity), extract key design tokens, pass them securely to the King, and immediately terminate.
*   **Low-Level Protocol (Bypass)**: For tiny requests (e.g., simple typo fixes or CSS color tweaks), the King bypasses both the Block and External Agents entirely, executing directly via a fast, cheap model to save API costs.

---

## 5. Protecting the Kosha (API Cost Reduction)
To surpass standard Opus and Gemini performance while preserving the treasury (API limits), these rules are absolute:
1.  **Model Tiering**: Low-level workers, Samstha (Loggers), and Sanchara (Unit Testers) use fast, cheap models. Only the Rajarishi (King) and Kantaka Shodhana (Destroyer) utilize expensive, high-reasoning models.
2.  **Batched Adversarial Reviews**: Do not allow the Amatya and Kantaka Shodhana to argue back and forth turn-by-turn. All structural, security, and type critiques must be compiled into a single batch assessment *before* Amatya attempts a rewrite.
3.  **Diff-Only Outputs**: Agents inside the block must pass minimal diffs or patches to each other instead of full file contents to drastically reduce token context usage.
4.  **Aggressive Caching**: Design tokens (from external agents) and previously validated module layouts must be cached. If a core module is untouched by the user prompt, the Judiciary skips reviewing it.

---

## 6. Known Weaknesses & Kautilyan Mitigations

### Weakness 1: The Bureaucracy Problem (Over-engineering)
*   **The Flaw**: Utilizing a full 7-role block for a simple request is a massive waste of API tokens and execution time.
*   **The Fix**: The **Complexity Triage Protocol**. The Rajarishi aggressively evaluates the prompt on a scale of 1-5. Scores 1-2 go straight to a solo low-level agent. Scores 3-5 engage the adversarial Block.

### Weakness 2: Deadlock / Infinite Debate
*   **The Flaw**: The adversarial design means the Amatya writes code, Kantaka Shodhana finds a minor flaw, Amatya rewrites, Dharmashta rejects a type—leading to an infinite token-draining loop.
*   **The Fix**: The **Two-Strike Rule**. If the code does not pass the Judiciary within exactly two iterations, the Rajarishi steps in, forcefully accepts the most stable version, wraps it in a defensive `try/catch` fallback (Dvaidhibhava), and outputs it to prevent cost spiraling.

### Weakness 3: Context Window Exhaustion
*   **The Flaw**: Passing the entire conversational context and codebase to 7 different agents will instantly max out API context windows.
*   **The Fix**: **Compartmentalization (Need-to-Know Basis)**. The Dharmashta only receives type definitions and interfaces. The Diplomat only receives network requests. The Kantaka Shodhana only receives the authentication/input execution paths. Only the King sees the full picture.

### Weakness 4: High Latency (Slow UX)
*   **The Flaw**: Processing a prompt through 7 isolated agents before showing the UI will make the application feel incredibly unresponsive to the user.
*   **The Fix**: **Streaming Consensus**. The King immediately streams the non-controversial scaffolding and UI structures directly to the user while the Judiciary concurrently runs its attacks on the deeper logic layers in the background.
