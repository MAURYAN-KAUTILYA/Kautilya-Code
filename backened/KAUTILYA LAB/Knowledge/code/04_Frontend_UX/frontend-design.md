# FRONTEND DESIGN — Visual Excellence Standard

## Read This First — Before Writing a Single Line of Code
Before coding anything, commit to a BOLD aesthetic direction.
Ask: what is the one thing someone will remember about this interface?
Generic is the enemy. Every component must feel designed for its specific context.

## Design Thinking — Do This Every Time

PURPOSE: What problem does this interface solve? Who uses it?
TONE: Pick an extreme and commit to it fully:
  - Brutally minimal
  - Maximalist / rich / layered
  - Retro-futuristic
  - Organic / natural / soft
  - Luxury / refined / editorial
  - Playful / toy-like / expressive
  - Brutalist / raw / utilitarian
  - Art deco / geometric / structured
  - Cinematic / dark / atmospheric
  - Terminal / hacker / monospace

DIFFERENTIATION: What makes this UNFORGETTABLE?
Bold maximalism and refined minimalism both work — intentionality is everything.

## Typography Rules
- Choose fonts that are beautiful, unique, and characterful
- NEVER use: Inter, Roboto, Arial, or system-ui as primary display fonts
- Use Google Fonts CDN for distinctive choices
- Pair a striking display font with a refined body font
- Examples of good choices: Sora, Plus Jakarta Sans, DM Serif Display,
  Playfair Display, Space Mono, Bebas Neue, Fraunces, Cabinet Grotesk,
  Instrument Serif, Archivo Black
- Typography alone can make or break the design — invest in it

## Color and Theme Rules
- Commit to a cohesive aesthetic — use CSS variables for all colors
- Dominant colors with sharp accents outperform timid evenly-distributed palettes
- NEVER default to purple gradient on white — this is the most clichéd AI aesthetic
- Dark themes: go deep and atmospheric, not just #000
- Light themes: warm whites, cream, not just #fff
- One primary accent color, one highlight, one surface — and stop there
- Use color to direct attention, not to decorate

## Motion and Animation Rules
- Animations should feel inevitable, not decorative
- Page load: one well-orchestrated entrance with staggered reveals is better than
  scattered micro-interactions everywhere
- Use CSS animations/transitions for: hover states, reveals, entrances, feedback
- Micro-interactions: button press, input focus, state changes
- NEVER animate things that don't need to move
- Timing: 200ms for feedback, 300-500ms for transitions, 600-800ms for reveals

## Spatial Composition Rules
- Unexpected layouts beat predictable grid-everything
- Use asymmetry, overlap, diagonal flow where appropriate
- Grid-breaking elements create visual tension and interest
- Generous negative space OR controlled density — pick one and commit
- Padding ratios matter: 8px, 12px, 16px, 24px, 32px, 48px — use a scale

## Background and Visual Depth Rules
- Create atmosphere, not just backgrounds
- Tools for depth: gradient meshes, noise textures, geometric patterns,
  layered transparencies, dramatic shadows, decorative borders, grain overlays
- Subtle radial gradients behind content add dimension
- SVG patterns as background texture — instant visual interest
- Glassmorphism: use sparingly and purposefully, not as default

## Implementation Rules
- Maximalist vision needs elaborate code: multiple animations, layered effects
- Minimalist vision needs precision: perfect spacing, typography, subtle details
- Elegance = executing the vision perfectly, not complexity for its own sake
- Every visual decision must serve the user's task, not obstruct it

## What NEVER to Do
- Purple gradient on white background
- Generic card grid with shadow and border-radius on everything
- Inter/Roboto/system-ui as the only font
- Predictable hero → features → CTA layout
- Cookie-cutter component patterns with no visual personality
- Centering everything on a white background with gray text
- Same design twice — vary tone, typography, color, layout every time

## The Standard
When a user asks for "a todo app" — anyone can make a todo app.
The question is: can you make THE todo app — the one that stops people mid-scroll?
That is the standard. Every component, every time.