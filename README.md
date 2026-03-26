# Kautilya Code

A calm, premium AI builder workspace where prompt, files, preview, runtime, review, and memory stay in one frame.

## What Stands Out

- Apple-style frontend surfaces for intro, login, dashboard, and the builder lab
- Variant-aware backend orchestration with model selection, memory, and tribunal-style review
- Slash commands, session checkpoints, sketch notes, and approval-gated diffs
- Live editor, preview, terminal, and console feedback in a single working loop

## Project Map

- [src](./src/README.md) - frontend app, routed surfaces, theme system, and shared UI building blocks
- [backened](./backened/README.md) - backend entry point and orchestration hub
- [KAUTILYA LAB](./backened/KAUTILYA%20LAB/README.md) - server, pipeline, memory, knowledge, and execution layers

## Local Run

- `npm run dev` - start the frontend
- `npm run dev:server` - start the backend server
- `npm run dev:all` - run the full local stack together

## Why The Repo Feels Different

Kautilya does not hide the work behind a generic assistant shell. It keeps the request, the source, the runtime, and the review step visible together so the product feels deliberate instead of noisy.
