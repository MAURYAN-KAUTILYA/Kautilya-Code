export function buildCommandReference(): Record<string, Array<Record<string, any>>> {
  return {
    Standard: [
      { name: "plan", slash: "/plan", type: "temporary", help: "Plan your task before touching code. AI maps the full approach first." },
      { name: "ask", slash: "/ask", type: "temporary", help: "Q&A only - AI will not write code. Use when exploring ideas." },
      { name: "build", slash: "/build", type: "temporary", help: "Build something simple or a small scoped task." },
      { name: "debug", slash: "/debug", type: "persistent", help: "Fix only mode. No new features. No rewrites. No scope expansion." },
      { name: "freeze", slash: "/freeze", type: "persistent", help: "Lock scope. AI won't touch anything outside the exact prompt." },
      { name: "diff", slash: "/diff", type: "temporary", help: "Explain what changed vs what was built before outputting code." },
      { name: "explain", slash: "/explain", type: "temporary", help: "Over-explain every decision. Great for learning unfamiliar areas." },
      { name: "minimal", slash: "/minimal", type: "temporary", help: "Code only. No comments, no explanations, no markdown." },
      { name: "refactor", slash: "/refactor", type: "temporary", help: "Refactor without changing behaviour. No new features added." },
      { name: "types", slash: "/types", type: "temporary", help: "Add or fix TypeScript types only. Nothing else touched." },
      { name: "docs", slash: "/docs", type: "temporary", help: "Generate JSDoc comments and inline documentation only." },
      { name: "test", slash: "/test", type: "temporary", help: "Generate runnable tests only. Vitest/Jest, not pseudocode." },
      { name: "git", slash: "/git", type: "temporary", help: "Generate a conventional commit message for current changes." },
      { name: "rollback", slash: "/rollback", type: "temporary", help: "Discard last suggestion and try a completely different approach." },
      { name: "contextrevise", slash: "/contextrevise", type: "temporary", help: "Full project standup: what is done, pending, broken, and next." },
    ],
    Elite: [
      { name: "think", slash: "/think", type: "temporary", help: "Deep reasoning before responding. Boosts performance on hard problems." },
      { name: "research", slash: "/research", type: "temporary", help: "Spawn a parallel research agent before generating output." },
      { name: "inspiredesign", slash: "/inspiredesign", type: "temporary", help: "Spawn a parallel design research agent for visual inspiration." },
      { name: "future", slash: "/future", type: "temporary", help: "Map next steps for your project you may not have thought of." },
      { name: "perf", slash: "/perf", type: "temporary", help: "Performance audit - bottlenecks, N+1 queries, memory leaks." },
      { name: "heavylift", slash: "/heavylift", type: "temporary", help: "Max tier models for complex multi-file work. Burns cords fast." },
      { name: "solo", slash: "/solo", type: "temporary", help: "Hand over the full project. AI executes autonomously." },
      { name: "kautilyarules", slash: "/kautilyarules", type: "temporary", help: "Reframe project through Chanakya philosophy. Asks permission first." },
    ],
    Sentinel: [
      { name: "audit", slash: "/audit", type: "temporary", help: "Review code critically before acting. Flags all risks, then asks." },
      { name: "secure", slash: "/secure", type: "temporary", help: "Security scan - vulns, exposed keys, unsafe inputs, auth flaws." },
      { name: "destroy", slash: "/destroy", type: "temporary", help: "Deep scan: bugs, security, perf failures, architectural weaknesses." },
      { name: "nofake", slash: "/nofake", type: "persistent", help: "No mocks, no placeholders. Every import real. Production only." },
      { name: "analyse", slash: "/analyse", type: "temporary", help: "Read existing project fully before guessing. For imported codebases." },
    ],
  };
}
