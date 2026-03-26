# Frontend

This folder contains the public-facing Kautilya Code app.

## Main Surfaces

- `components/` - shared UI pieces like the logo
- `features/` - routed product experiences such as intro, auth, dashboard, and builder lab
- `lib/` - helpers and service clients
- `navigation/` - router and protected-route logic
- `shared/` - frontend-facing command types and helpers
- `theme/` - theme tokens, accent palettes, and app-wide styling state

## Reading Order

1. Start with [features](./features/README.md)
2. Then open [navigation](./navigation/README.md)
3. Finish with [theme](./theme/README.md) and [lib](./lib/README.md)

## Note

Many folders include both `.ts` / `.tsx` and `.js` mirrors. The TypeScript files are the canonical source of truth.
