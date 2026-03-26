# Pipeline

The main orchestration logic lives here.

## What Lives Here

- `orchestrator.js` - the core request flow and division routing
- `king.js` - the Rajarishi planning and review layer
- `arbitrator.js` - conflict resolution and synthesis
- `memory.js` - retrieval, persistence, and scoring
- `command-directives.js` - slash command effects and prompt modifiers
- `agent-tools.js` - shared utilities for specialist agents
- `web-research-agent.js` - research support
- `design-inspiration-agent.js` - design inspiration support
- `messenger.js` - agent communication utilities

## Why It Matters

This is the brain of the backend. It turns a request into a plan, routes it through the right experts, and returns a result that feels deliberate instead of random.
