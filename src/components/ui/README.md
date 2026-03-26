# UI Primitives

This folder holds the reusable, low-level UI pieces that can be shared across the app.

## What Lives Here

- Dock-style controls and other small interactive surfaces
- Shared visual primitives that stay close to the design system
- UI-only components that can be reused without pulling in feature logic

## Current Components

- `animated-dock.tsx`
- `mac-os-dock.tsx`

## Why It Exists

Keeping a dedicated `src/components/ui` folder makes the UI easier to extend without scattering small controls across feature folders. It also matches the structure expected by shadcn-style component libraries, which keeps future additions predictable and easy to find.
