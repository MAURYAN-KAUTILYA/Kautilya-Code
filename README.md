# Kautilya Code

Kautilya Code is a premium AI builder workspace for people who want the request, the source, the preview, and the review step visible at the same time.

It feels less like a chatbot wrapper and more like a disciplined product studio.

## Why It Stands Out

| Area | What You Get |
| --- | --- |
| Frontend | Apple-inspired intro, login, dashboard, and builder surfaces |
| Builder Lab | Code editor, preview pane, terminal, diff review, sketch board, and console in one place |
| AI Flow | Slash commands, model variants, specialist agents, and approval-gated output |
| Backend | Variant-aware orchestration, memory, runtime control, checkpointing, and file-system tools |
| Experience | Protected routes, session persistence, and a calmer visual language across the app |

## Product Highlights

- One workspace for prompt, files, preview, runtime, and review
- Route-aware frontend with polished intro, login, dashboard, and builder experiences
- Command-driven workflow with persistent directives and session memory
- Variant-aware backend that routes requests through the right reasoning path
- Sketch notes and checkpoints that keep the work connected across sessions
- Review-first execution so changes stay visible before they land

## What Lives Where

- [src](./src/README.md) - frontend app, routed surfaces, theme system, and shared UI building blocks
- [backened](./backened/README.md) - backend entry point and orchestration hub
- [KAUTILYA LAB](./backened/KAUTILYA%20LAB/README.md) - server, pipeline, memory, knowledge, and execution layers

## Quick Start

- `npm install` - install dependencies
- `npm run dev` - start the frontend
- `npm run dev:server` - start the backend server
- `npm run dev:all` - run the full local stack together

## Scripts

- `npm run build` - compile the frontend for production
- `npm run lint` - run lint checks
- `npm run preview` - preview the built app locally

## Environment

The app expects Supabase and backend provider keys to be configured in `.env`.

- Frontend auth and client access use the Supabase variables defined by the app
- Backend execution, memory, and model routing depend on the server-side keys described in the backend docs

## Why The Repo Feels Different

Kautilya does not hide the work behind a generic assistant shell. It keeps the task, the source, the runtime, and the review loop visible together so the product feels intentional instead of noisy.
