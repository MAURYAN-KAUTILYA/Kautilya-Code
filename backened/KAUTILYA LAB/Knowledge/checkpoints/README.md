# Checkpoints

Resumable work state lives here.

## What Lives Here

- Saved checkpoint files that let the backend continue a paused workflow without rebuilding context from scratch

## Why It Matters

Checkpoints make the system feel durable. They help Kautilya pick up where it left off instead of acting like every request is the first one.
