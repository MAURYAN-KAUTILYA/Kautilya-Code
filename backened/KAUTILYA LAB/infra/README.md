# Infra

Supporting systems for the backend live here.

## What Lives Here

- `audit.js` - keeps a record of important events and decisions
- `checkpoint.js` - stores and restores resumable work states
- `durga-worker.js` - handles safety and enforcement work
- `providers.js` - wraps model provider selection and calls
- `relevance.js` - ranks files and dependencies for the current task
- `runtime.js` - runs commands locally or through sandboxed execution
- `session.js` - stores session history, commands, keys, and sketches

## Why It Matters

This folder gives the product its memory, execution, and accountability. It is the difference between a flashy demo and a workspace that can keep up with real work.
