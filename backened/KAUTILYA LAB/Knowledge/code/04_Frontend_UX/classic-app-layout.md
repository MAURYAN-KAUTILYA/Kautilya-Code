# CLASSIC APP LAYOUT — Design System & SVG Standards

## Purpose
When building classic/traditional application UIs — dashboards, admin panels, tools,
productivity apps — follow this system exactly. This produces stable, accessible,
professional-grade interfaces that look like real software, not toy demos.

---

## When to Use This vs Frontend-Design
- Use FRONTEND-DESIGN for: expressive, creative, branded, portfolio, landing pages
- Use CLASSIC APP LAYOUT for: dashboards, admin panels, tools, data-heavy apps,
  multi-page applications, anything that needs to feel like "real software"
- When in doubt: if the user says "app", "dashboard", "tool", "system" → use this

---

## Design Tokens — Always Use These

```css
:root {
  /* Color scale */
  --bg: #f6f7f9;
  --surface: #ffffff;
  --muted: #6b7280;
  --text: #111827;
  --accent: #0b5fff;
  --danger: #dc2626;

  /* Layout */
  --container-max: 1200px;
  --columns: 12;
  --gutter: 24px;

  /* Typography */
  --font-sans: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --base-size: 16px;
  --scale-0: 12px;
  --scale-1: 14px;
  --scale-2: 16px;
  --scale-3: 20px;
  --scale-4: 24px;
  --scale-5: 32px;
  --radius: 8px;

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06);
}
```

Dark theme override:
```css
[data-theme="dark"] {
  --bg: #0f1117;
  --surface: #1a1b23;
  --muted: #6b7280;
  --text: #f9fafb;
  --accent: #6366f1;
}
```

---

## Layout Rules

**Structure:**
- Header: fixed top, 56-72px height
- Sidebar: fixed width 220-280px on desktop, hamburger on mobile
- Content: flexible scrollable region

```css
.container {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 calc(var(--gutter) / 2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--gutter);
}

@media (max-width: 900px) { .grid { grid-template-columns: repeat(6, 1fr); } }
@media (max-width: 600px) { .grid { grid-template-columns: repeat(4, 1fr); } }
```

**App shell pattern:**
```css
.app-shell {
  display: grid;
  grid-template-rows: 64px 1fr;
  grid-template-columns: 260px 1fr;
  height: 100vh;
}
.header { grid-column: 1 / -1; }
.sidebar { grid-row: 2; overflow-y: auto; }
.content { grid-row: 2; overflow-y: auto; padding: var(--gutter); }
```

---

## Typography

```css
body { font-family: var(--font-sans); font-size: var(--base-size); color: var(--text); background: var(--bg); }
h1 { font-size: var(--scale-5); margin: 0 0 8px; }
h2 { font-size: var(--scale-4); }
h3 { font-size: var(--scale-3); }
small { font-size: var(--scale-0); color: var(--muted); }
```

---

## Core Components

```css
/* Header */
.header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid rgba(17,24,39,0.08);
  box-shadow: var(--shadow-1);
}

/* Card */
.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow-1);
}

/* Buttons */
.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  font-size: var(--scale-1);
  font-family: var(--font-sans);
  transition: all 0.15s ease;
}
.button.primary { background: var(--accent); color: white; }
.button.primary:hover { filter: brightness(1.1); }
.button.ghost { background: transparent; border-color: rgba(17,24,39,0.1); color: var(--text); }
.button.ghost:hover { background: rgba(17,24,39,0.04); }
.button.danger { background: var(--danger); color: white; }

/* Sidebar nav */
.sidebar-nav { display: flex; flex-direction: column; padding: 12px; gap: 2px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--scale-1);
  color: var(--muted);
  transition: all 0.15s;
}
.nav-item:hover { background: rgba(17,24,39,0.05); color: var(--text); }
.nav-item.active { background: rgba(11,95,255,0.08); color: var(--accent); font-weight: 500; }

/* Table */
.table { width: 100%; border-collapse: collapse; font-size: var(--scale-1); }
.table th { text-align: left; padding: 10px 12px; color: var(--muted); font-weight: 500; border-bottom: 1px solid rgba(17,24,39,0.08); }
.table td { padding: 12px; border-bottom: 1px solid rgba(17,24,39,0.05); }
.table tr:hover td { background: rgba(17,24,39,0.02); }

/* Input */
.input {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(17,24,39,0.15);
  border-radius: 6px;
  font-size: var(--scale-1);
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--surface);
  transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(11,95,255,0.1); }

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: var(--scale-0);
  font-weight: 500;
}
.badge.success { background: rgba(22,163,74,0.1); color: #16a34a; }
.badge.warning { background: rgba(234,179,8,0.1); color: #ca8a04; }
.badge.danger { background: rgba(220,38,38,0.1); color: var(--danger); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--surface); border-radius: var(--radius); padding: 24px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }

/* Focus states for accessibility */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

---

## Monochrome SVG Icons — Rules

ALL SVGs must be single-colour. No hardcoded hex values inside SVG files. Ever.

**Stroke icon pattern (use for most icons):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="false" role="img">
  <title>search</title>
  <desc>Magnifying glass icon</desc>
  <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="6"></circle>
    <path d="M21 21l-4.35-4.35"></path>
  </g>
</svg>
```

**Solid icon pattern:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img">
  <title>check</title>
  <path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
</svg>
```

**SVG Rules:**
- Always `stroke="currentColor"` or `fill="currentColor"` — never hardcoded colors
- Always `viewBox="0 0 24 24"` on a 24px grid
- Always `stroke-width="1.5"` for stroke icons
- Always `stroke-linecap="round"` and `stroke-linejoin="round"`
- Always include `<title>` and `<desc>` for accessibility
- Never include `width`/`height` fixed attributes on inline SVGs (let CSS control size)
- Set color via CSS on the parent: `color: var(--accent)` → icon inherits it

**Usage in buttons:**
```html
<button class="button ghost">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="6"/><path d="M21 21l-4.35-4.35"/>
  </svg>
  Search
</button>
```

---

## Accessibility Rules
- WCAG AA contrast minimum for all text
- Visible focus states on all interactive elements (use `:focus-visible`)
- Logical focus/tab order
- Inline SVG icons: `role="img"` + `aria-hidden="false"` when meaningful
- Decorative icons: `aria-hidden="true"`
- Form inputs: always paired with `<label>`

---

## File Structure (when building multi-file)
```
/
├── tokens.css
├── index.html
├── css/
│   └── ui-components.css
└── icons/
    ├── search-outline.svg
    ├── user-solid.svg
    └── icons-sprite.svg
```

---

## Quick-Start HTML Template
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>App</title>
  <style>/* paste tokens + components CSS here */</style>
</head>
<body>
  <div class="app-shell">
    <header class="header">
      <div class="brand" style="font-weight:700;color:var(--text)">AppName</div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="button ghost">Settings</button>
        <button class="button primary">Action</button>
      </div>
    </header>
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <div class="nav-item active">Dashboard</div>
        <div class="nav-item">Users</div>
        <div class="nav-item">Settings</div>
      </nav>
    </aside>
    <main class="content">
      <div class="card">Content here</div>
    </main>
  </div>
</body>
</html>
```