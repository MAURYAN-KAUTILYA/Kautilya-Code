# Theme

The global visual system lives here.

## What Lives Here

- Theme tokens and accent palettes
- Light and dark mode support
- App-wide theme persistence and context
- Derived semantic colors for surfaces, text, borders, focus, and highlights
- Theme-aware UI surfaces that keep the builder and routed pages aligned

## Why It Matters

Theme is part of the product identity, not an afterthought. This folder keeps Kautilya's look deliberate across every surface and makes it easy for new components to inherit the same color logic.

## Related Pieces

- `AppThemeProvider` owns the current mode and accent family
- `Theme Builder` lets the user switch palettes without changing routes or backend behavior
- Builder and dashboard chrome read the same theme tokens so colors stay consistent across the app
