import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

type Tool = "select" | "pencil" | "shapes" | "line" | "sticky" | "text";
type ShapeKind = "square" | "rounded" | "circle" | "triangle" | "triangleDown" | "diamond" | "pentagon";
type LineKind = "straight" | "elbow" | "curve";
type BrushKind = "pencil" | "marker" | "highlighter";

type SketchPoint = { x: number; y: number };
type SketchBox = { x: number; y: number; w: number; h: number };

type BaseElement = { id: string; x: number; y: number; rotation?: number };

export type SketchStroke = BaseElement & {
  type: "stroke";
  points: SketchPoint[];
  color: string;
  width: number;
  brush: BrushKind;
};

export type SketchShape = BaseElement & {
  type: "shape";
  kind: ShapeKind;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type SketchLine = BaseElement & {
  type: "line";
  kind: LineKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

export type SketchSticky = BaseElement & {
  type: "sticky";
  w: number;
  h: number;
  color: string;
  text: string;
};

export type SketchText = BaseElement & {
  type: "text";
  w: number;
  h: number;
  text: string;
  color: string;
};

export type SketchElement = SketchStroke | SketchShape | SketchLine | SketchSticky | SketchText;

export type SketchBoardValue = {
  elements: SketchElement[];
  selectedId?: string | null;
  tool?: Tool;
  brush?: { kind: BrushKind; color: string; width: number };
  shapeKind?: ShapeKind;
  lineKind?: LineKind;
  stickyColor?: string;
};

export type SketchBoardContext = { elements: SketchElement[]; notes: string[]; textBlocks: string[] };

export type SketchBoardProps = {
  open: boolean;
  value?: SketchBoardValue;
  defaultValue?: SketchBoardValue;
  onChange?: (value: SketchBoardValue) => void;
  onContextChange?: (context: SketchBoardContext) => void;
  onNotesChange?: (notes: string[]) => void;
  onClose?: () => void;
};

type DragState =
  | { kind: "none" }
  | { kind: "draw-stroke"; id: string; start: SketchPoint; points: SketchPoint[]; brush: BrushKind; color: string; width: number }
  | { kind: "draw-line"; id: string; start: SketchPoint; current: SketchPoint; kindName: LineKind; color: string; width: number }
  | { kind: "move"; id: string; start: SketchPoint; originBox?: SketchBox; originalPoints?: SketchPoint[]; originalLine?: SketchLine }
  | { kind: "resize"; id: string; corner: "nw" | "ne" | "sw" | "se"; start: SketchPoint; originBox: SketchBox }
  | { kind: "endpoint"; id: string; endpoint: "start" | "end"; start: SketchPoint; original: SketchLine }
  | { kind: "select-area"; start: SketchPoint; current: SketchPoint };

type PopoverName = "pencil" | "shapes" | "line" | "sticky" | null;

const BOARD_W = 1200;
const BOARD_H = 760;
const DEFAULT_BRUSH = { kind: "pencil" as BrushKind, color: "#1D4ED8", width: 3 };
const DEFAULT_SHAPE = "rounded" as ShapeKind;
const DEFAULT_LINE = "straight" as LineKind;
const DEFAULT_STICKY = "#FDE68A";
const COLORS = ["#1D4ED8", "#2563EB", "#A855F7", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#111827"];
const STICKY_COLORS = ["#FDE68A", "#FDBA74", "#FDA4AF", "#93C5FD", "#86EFAC", "#C4B5FD"];
const SHAPE_FILL = "rgba(255,255,255,0.72)";
const SHAPE_STROKE = "rgba(17,24,39,0.78)";

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dist(a: SketchPoint, b: SketchPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: SketchPoint, b: SketchPoint): SketchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalizePoint(point: SketchPoint, width: number, height: number): SketchPoint {
  return { x: width ? point.x / width : 0, y: height ? point.y / height : 0 };
}

function denormalizePoint(point: SketchPoint, width: number, height: number): SketchPoint {
  return { x: point.x * width, y: point.y * height };
}

function denormalizeBox(box: SketchBox, width: number, height: number): SketchBox {
  return { x: box.x * width, y: box.y * height, w: box.w * width, h: box.h * height };
}

function boxFromPoints(a: SketchPoint, b: SketchPoint): SketchBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function boxIntersects(a: SketchBox, b: SketchBox) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function angleDeg(from: SketchPoint, to: SketchPoint) {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function snapAngle(start: SketchPoint, current: SketchPoint) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const targets = [0, 45, 90, 135, 180, -45, -90, -135];
  let best = deg;
  let bestDelta = Infinity;
  for (const target of targets) {
    const delta = Math.abs(((deg - target + 540) % 360) - 180);
    if (delta < bestDelta) {
      best = target;
      bestDelta = delta;
    }
  }
  if (bestDelta <= 8) {
    const rad = (best * Math.PI) / 180;
    const len = Math.hypot(dx, dy);
    return { current: { x: start.x + Math.cos(rad) * len, y: start.y + Math.sin(rad) * len }, snapped: true, angle: best };
  }
  return { current, snapped: false, angle: deg };
}

function snapLinePoint(
  start: SketchPoint,
  current: SketchPoint,
  lines: SketchLine[],
  width: number,
  height: number,
  excludeId: string,
  lockAngle: boolean,
) {
  let next = current;
  let snapped = false;
  let guideX: number | null = null;
  let guideY: number | null = null;

  const endpoints = lines
    .filter((line) => line.id !== excludeId)
    .flatMap((line) => [
      denormalizePoint({ x: line.x1, y: line.y1 }, width, height),
      denormalizePoint({ x: line.x2, y: line.y2 }, width, height),
    ]);

  for (const endpoint of endpoints) {
    if (dist(current, endpoint) <= 12) {
      next = endpoint;
      snapped = true;
      guideX = endpoint.x;
      guideY = endpoint.y;
      break;
    }
  }

  if (!snapped) {
    for (const endpoint of endpoints) {
      if (Math.abs(current.x - endpoint.x) <= 8) {
        next = { ...next, x: endpoint.x };
        snapped = true;
        guideX = endpoint.x;
      }
      if (Math.abs(current.y - endpoint.y) <= 8) {
        next = { ...next, y: endpoint.y };
        snapped = true;
        guideY = endpoint.y;
      }
    }
  }

  const angleResult = lockAngle ? snapAngle(start, next) : { current: next, snapped, angle: angleDeg(start, next) };
  return {
    current: angleResult.current,
    snapped: snapped || angleResult.snapped,
    angle: angleResult.angle,
    guideX,
    guideY,
  };
}

function strokePath(points: SketchPoint[], width: number, height: number) {
  if (!points.length) return "";
  const first = denormalizePoint(points[0], width, height);
  if (points.length === 1) return `M ${first.x} ${first.y}`;
  if (points.length === 2) {
    const second = denormalizePoint(points[1], width, height);
    return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
  }
  const segments: string[] = [`M ${first.x} ${first.y}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = denormalizePoint(points[i], width, height);
    const next = denormalizePoint(points[i + 1], width, height);
    const mid = midpoint(curr, next);
    segments.push(`Q ${curr.x} ${curr.y} ${mid.x} ${mid.y}`);
  }
  const last = denormalizePoint(points[points.length - 1], width, height);
  segments.push(`L ${last.x} ${last.y}`);
  return segments.join(" ");
}

function linePath(line: SketchLine, width: number, height: number) {
  const p1 = denormalizePoint({ x: line.x1, y: line.y1 }, width, height);
  const p2 = denormalizePoint({ x: line.x2, y: line.y2 }, width, height);
  if (line.kind === "straight") return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  if (line.kind === "elbow") return `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
  const ctrl = { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) - Math.abs(p2.x - p1.x) * 0.18 };
  return `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;
}

function shapePath(kind: ShapeKind, box: SketchBox) {
  const x = box.x;
  const y = box.y;
  const w = box.w;
  const h = box.h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (kind) {
    case "square":
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    case "rounded":
      return `M ${x + 12} ${y} H ${x + w - 12} Q ${x + w} ${y} ${x + w} ${y + 12} V ${y + h - 12} Q ${x + w} ${y + h} ${x + w - 12} ${y + h} H ${x + 12} Q ${x} ${y + h} ${x} ${y + h - 12} V ${y + 12} Q ${x} ${y} ${x + 12} ${y} Z`;
    case "circle":
      return `M ${cx} ${y} A ${w / 2} ${h / 2} 0 1 1 ${cx - 0.01} ${y} Z`;
    case "triangle":
      return `M ${cx} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    case "triangleDown":
      return `M ${x} ${y} L ${x + w} ${y} L ${cx} ${y + h} Z`;
    case "diamond":
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`;
    case "pentagon":
    default:
      return `M ${cx} ${y} L ${x + w} ${y + h * 0.38} L ${x + w * 0.8} ${y + h} L ${x + w * 0.2} ${y + h} L ${x} ${y + h * 0.38} Z`;
  }
}

function getTextMetrics(text: string, minW = 180, minH = 96) {
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return { w: Math.max(minW, Math.min(520, longest * 9.4 + 32)), h: Math.max(minH, Math.min(280, Math.max(lines.length, 1) * 24 + 32)) };
}

function getStrokeBounds(points: SketchPoint[], width: number, height: number, padding = 18): SketchBox {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  const coordinates = points.map((point) => denormalizePoint(point, width, height));
  const xs = coordinates.map((point) => point.x);
  const ys = coordinates.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX - padding / 2, y: minY - padding / 2, w: Math.max(1, maxX - minX) + padding, h: Math.max(1, maxY - minY) + padding };
}

function getElementBounds(element: SketchElement, width: number, height: number): SketchBox {
  if (element.type === "stroke") return getStrokeBounds(element.points, width, height, Math.max(element.width * 4, 18));
  if (element.type === "line") {
    const bounds = boxFromPoints(
      denormalizePoint({ x: element.x1, y: element.y1 }, width, height),
      denormalizePoint({ x: element.x2, y: element.y2 }, width, height),
    );
    const padding = Math.max(element.width * 4, 18);
    return { x: bounds.x - padding / 2, y: bounds.y - padding / 2, w: Math.max(1, bounds.w) + padding, h: Math.max(1, bounds.h) + padding };
  }
  return denormalizeBox({ x: element.x, y: element.y, w: element.w, h: element.h }, width, height);
}

function clampStrokeDelta(points: SketchPoint[], delta: SketchPoint): SketchPoint {
  if (!points.length) return delta;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: clamp(delta.x, -minX, 1 - maxX),
    y: clamp(delta.y, -minY, 1 - maxY),
  };
}

function clampLineDelta(line: SketchLine, delta: SketchPoint): SketchPoint {
  const minX = Math.min(line.x1, line.x2);
  const maxX = Math.max(line.x1, line.x2);
  const minY = Math.min(line.y1, line.y2);
  const maxY = Math.max(line.y1, line.y2);
  return {
    x: clamp(delta.x, -minX, 1 - maxX),
    y: clamp(delta.y, -minY, 1 - maxY),
  };
}

function clampBoxPosition(originBox: SketchBox, delta: SketchPoint) {
  return {
    x: clamp(originBox.x + delta.x, 0, Math.max(0, 1 - originBox.w)),
    y: clamp(originBox.y + delta.y, 0, Math.max(0, 1 - originBox.h)),
  };
}

function resizeBoxWithinBounds(originBox: SketchBox, corner: "nw" | "ne" | "sw" | "se", delta: SketchPoint, minW = 0.12, minH = 0.08): SketchBox {
  const right = originBox.x + originBox.w;
  const bottom = originBox.y + originBox.h;
  let x = originBox.x;
  let y = originBox.y;
  let w = originBox.w;
  let h = originBox.h;

  if (corner.includes("w")) {
    x = clamp(originBox.x + delta.x, 0, right - minW);
    w = right - x;
  } else {
    w = clamp(originBox.w + delta.x, minW, 1 - originBox.x);
  }

  if (corner.includes("n")) {
    y = clamp(originBox.y + delta.y, 0, bottom - minH);
    h = bottom - y;
  } else {
    h = clamp(originBox.h + delta.y, minH, 1 - originBox.y);
  }

  return { x, y, w, h };
}

function getSelectionIdsFromBox(elements: SketchElement[], selectionBox: SketchBox, width: number, height: number) {
  if (selectionBox.w < 4 && selectionBox.h < 4) return [];
  return elements.filter((entry) => boxIntersects(getElementBounds(entry, width, height), selectionBox)).map((entry) => entry.id);
}

function isEditableTarget(target: EventTarget | null) {
  return typeof HTMLElement !== "undefined"
    && target instanceof HTMLElement
    && Boolean(target.closest("textarea, input, [contenteditable='true']"));
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: BOARD_W, height: BOARD_H });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width || BOARD_W, height: rect.height || BOARD_H });
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return { ref, size };
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

function IconSelect() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 4l11 8-5 1 4 6-2 1-4-6-3 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>; }
function IconPencil() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 16.5V19h2.5L18 8.5 15.5 6 5 16.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M13.6 4.8l2.6 2.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function IconShapes() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="4.5" y="4.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.7" /><circle cx="16.5" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" /><path d="M12 18.5l3.5-6h7l-3.5 6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>; }
function IconLine() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 18l14-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="5" cy="18" r="1.4" fill="currentColor" /><circle cx="19" cy="6" r="1.4" fill="currentColor" /></svg>; }
function IconSticky() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H16l4 4v10.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13Z" fill="currentColor" opacity=".16" /><path d="M16 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>; }
function IconText() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 7h14M12 7v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>; }
function IconClose() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>; }
function IconMove() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>; }
function IconResize() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M8 16l8-8M13 16h3v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconDelete() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 7h12M9 7V5h6v2M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 7l1 11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-11" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>; }
function IconDuplicate() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><rect x="8" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.6" /></svg>; }
export function HeaderButton({ active, children, title, onClick }: { active?: boolean; children: ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        border: active ? "1px solid rgba(91,115,255,0.42)" : "1px solid rgba(15,23,42,0.08)",
        background: active ? "linear-gradient(180deg, rgba(91,115,255,0.16), rgba(91,115,255,0.08))" : "rgba(255,255,255,0.72)",
        color: active ? "#4154D6" : "#1F2937",
        display: "grid",
        placeItems: "center",
        boxShadow: active ? "0 10px 22px rgba(91,115,255,0.18)" : "0 10px 24px rgba(15,23,42,0.08)",
        cursor: "pointer",
        transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0px)"; }}
    >
      {children}
    </button>
  );
}

function Flyout({ title, children, onClose, align = "center" }: { title: string; children: ReactNode; onClose: () => void; align?: "left" | "center" | "right" }) {
  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? 0 : align === "center" ? "50%" : "auto",
        right: align === "right" ? 0 : "auto",
        top: "calc(100% + 10px)",
        transform: align === "center" ? "translateX(-50%)" : "none",
        minWidth: 230,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(22px)",
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: 22,
        boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
        overflow: "hidden",
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "#52607A" }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748B", cursor: "pointer" }}><IconClose /></button>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function BoardHandle({ left, top, onPointerDown }: { left: number; top: number; onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left,
        top,
        width: 14,
        height: 14,
        marginLeft: -7,
        marginTop: -7,
        borderRadius: 999,
        border: "1px solid rgba(59,130,246,0.52)",
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 8px 18px rgba(15,23,42,0.16)",
        cursor: "grab",
        zIndex: 4,
      }}
    />
  );
}

function initialScene(): SketchBoardValue {
  return {
    elements: [],
    selectedId: null,
    tool: "select",
    brush: DEFAULT_BRUSH,
    shapeKind: DEFAULT_SHAPE,
    lineKind: DEFAULT_LINE,
    stickyColor: DEFAULT_STICKY,
  };
}

// Runtime note: Vite currently resolves `SketchBoard.js` in-app.
// Keep this TSX mirror behavior-identical until the duplicate sources are consolidated.
export default function SketchBoard({ open, value, defaultValue, onChange, onContextChange, onNotesChange, onClose }: SketchBoardProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<SketchBoardValue>(() => ({ ...initialScene(), ...(defaultValue ?? {}), elements: defaultValue?.elements ?? [] }));
  const scene = isControlled ? value! : internalValue;
  const elements = scene.elements ?? [];
  const selectedId = scene.selectedId ?? null;
  const activeTool = scene.tool ?? "select";
  const brush = scene.brush ?? DEFAULT_BRUSH;
  const shapeKind = scene.shapeKind ?? DEFAULT_SHAPE;
  const lineKind = scene.lineKind ?? DEFAULT_LINE;
  const stickyColor = scene.stickyColor ?? DEFAULT_STICKY;
  const { ref: boardRef, size } = useSize<HTMLDivElement>();
  const [popover, setPopover] = useState<PopoverName>(null);
  const [dragState, setDragState] = useState<DragState>({ kind: "none" });
  const [liveGuide, setLiveGuide] = useState<{ x: number; y: number; angle: number; length: number; snapped: boolean; guideX?: number | null; guideY?: number | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (selectedId ? [selectedId] : []));
  const latestSceneRef = useLatest(scene);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Accumulates stroke points in a ref so rapid pointermove events can't lose
  // intermediate points due to stale closures (state update hasn't flushed yet).
  const livePointsRef = useRef<SketchPoint[]>([]);

  const emitChange = useCallback((next: SketchBoardValue) => { if (!isControlled) setInternalValue(next); onChange?.(next); }, [isControlled, onChange]);
  const updateScene = useCallback((patch: Partial<SketchBoardValue>) => emitChange({ ...latestSceneRef.current, ...patch }), [emitChange, latestSceneRef]);
  const updateSelection = useCallback((selected: string | null) => {
    setSelectedIds(selected ? [selected] : []);
    emitChange({ ...latestSceneRef.current, selectedId: selected });
  }, [emitChange, latestSceneRef]);
  const updateSelectionGroup = useCallback((ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    const primary = uniqueIds[uniqueIds.length - 1] ?? null;
    setSelectedIds(uniqueIds);
    emitChange({ ...latestSceneRef.current, selectedId: primary });
  }, [emitChange, latestSceneRef]);
  // Use functional setInternalValue so rapid back-to-back calls (e.g. fast pointer moves)
  // chain correctly instead of each overwriting the other with the same stale base.
  const patchElements = useCallback((updater: (list: SketchElement[]) => SketchElement[]) => {
    if (!isControlled) {
      setInternalValue((prev) => ({ ...prev, elements: updater(prev.elements ?? []) }));
    }
    if (onChange) {
      onChange({ ...latestSceneRef.current, elements: updater(latestSceneRef.current.elements ?? []) });
    }
  }, [isControlled, onChange, latestSceneRef]);

  const getBoardPoint = useCallback((e: React.PointerEvent<Element> | PointerEvent) => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const bL = parseFloat(cs.borderLeftWidth) || 0;
    const bT = parseFloat(cs.borderTopWidth) || 0;
    
    const contentW = rect.width - bL - (parseFloat(cs.borderRightWidth) || 0);
    const contentH = rect.height - bT - (parseFloat(cs.borderBottomWidth) || 0);
    
    const px = e.clientX - rect.left - bL;
    const py = e.clientY - rect.top - bT;
    
    const vbW = size.width || contentW;
    const vbH = size.height || contentH;
    
    const svgX = (px / (contentW || 1)) * vbW;
    const svgY = (py / (contentH || 1)) * vbH;
    
    return { 
      x: clamp(svgX, 0, vbW), 
      y: clamp(svgY, 0, vbH) 
    };
  }, [boardRef, size.width, size.height]);

  const notes = useMemo(() => elements.filter((entry): entry is SketchSticky => entry.type === "sticky" && entry.text.trim().length > 0).map((entry) => entry.text.trim()), [elements]);
  const textBlocks = useMemo(() => elements.filter((entry): entry is SketchText => entry.type === "text" && entry.text.trim().length > 0).map((entry) => entry.text.trim()), [elements]);
  const selectedElement = useMemo(() => elements.find((entry) => entry.id === selectedId) ?? null, [elements, selectedId]);
  const activeSelectionIds = useMemo(() => (selectedIds.length ? selectedIds : selectedId ? [selectedId] : []), [selectedId, selectedIds]);

  useEffect(() => { onNotesChange?.(notes); onContextChange?.({ elements, notes, textBlocks }); }, [elements, notes, onContextChange, onNotesChange, textBlocks]);
  useEffect(() => { if (!open) return; overlayRef.current?.focus(); }, [open]);
  useEffect(() => {
    setSelectedIds((current) => {
      const valid = current.filter((id) => elements.some((entry) => entry.id === id));
      // If selectedId is defined but not already the primary selection, adopt it.
      if (selectedId && !valid.includes(selectedId)) return selectedId ? [selectedId] : [];
      if (valid.length) return valid;
      return selectedId ? [selectedId] : [];
    });
  }, [elements, selectedId]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose?.(); }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (editingId != null || isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;
        const active = activeSelectionIds.length
          ? activeSelectionIds
          : latestSceneRef.current.selectedId
            ? [latestSceneRef.current.selectedId]
            : [];
        if (!active.length) return;
        event.preventDefault();
        setSelectedIds([]);
        emitChange({
          ...latestSceneRef.current,
          elements: (latestSceneRef.current.elements ?? []).filter((entry) => !active.includes(entry.id)),
          selectedId: null,
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSelectionIds, editingId, emitChange, latestSceneRef, onClose, open]);

  const closePopover = () => setPopover(null);
  const updateText = (id: string, text: string) => {
    patchElements((list) => list.map((entry) => {
      if (entry.id !== id) return entry;
      if (entry.type === "sticky") return { ...entry, text };
      if (entry.type === "text") {
        const metrics = getTextMetrics(text, 220, 84);
        return { ...entry, text, w: Math.max(entry.w, metrics.w / size.width), h: Math.max(entry.h, metrics.h / size.height) };
      }
      return entry;
    }));
  };

  const createElementFromCenter = (factory: (center: SketchPoint) => SketchElement) => {
    const rect = boardRef.current?.getBoundingClientRect();
    const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: BOARD_W / 2, y: BOARD_H / 2 };
    const next = factory(center);
    emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), next], selectedId: next.id });
  };
  const createElementAtPoint = (factory: (point: SketchPoint) => SketchElement, point: SketchPoint) => {
    const next = factory(point);
    emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), next], selectedId: next.id });
  };

  const createShape = (center: SketchPoint): SketchShape => {
    const w = 170;
    const h = 120;
    return {
      id: createId("shape"),
      type: "shape",
      kind: shapeKind,
      x: clamp(center.x - w / 2, 20, Math.max(20, size.width - w - 20)) / size.width,
      y: clamp(center.y - h / 2, 20, Math.max(20, size.height - h - 20)) / size.height,
      w: w / size.width,
      h: h / size.height,
      fill: SHAPE_FILL,
      stroke: SHAPE_STROKE,
      strokeWidth: 2,
    };
  };
  const createSticky = (center: SketchPoint): SketchSticky => ({
    id: createId("sticky"),
    type: "sticky",
    x: clamp(center.x - 110, 20, Math.max(20, size.width - 240)) / size.width,
    y: clamp(center.y - 90, 20, Math.max(20, size.height - 190)) / size.height,
    w: 220 / size.width,
    h: 180 / size.height,
    color: stickyColor,
    text: "Note for AI to read",
  });
  const createText = (center: SketchPoint): SketchText => ({
    id: createId("text"),
    type: "text",
    x: clamp(center.x - 140, 20, Math.max(20, size.width - 320)) / size.width,
    y: clamp(center.y - 42, 20, Math.max(20, size.height - 140)) / size.height,
    w: 280 / size.width,
    h: 84 / size.height,
    text: "Your paragraph text",
    color: "#111827",
  });

  const startStroke = (point: SketchPoint) => {
    const id = createId("stroke");
    const initialPoints = [normalizePoint(point, size.width, size.height)];
    livePointsRef.current = initialPoints;
    const stroke: SketchStroke = { id, type: "stroke", x: 0, y: 0, points: initialPoints, color: brush.color, width: brush.width, brush: brush.kind };
    emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), stroke], selectedId: id });
    setDragState({ kind: "draw-stroke", id, start: point, points: initialPoints, brush: brush.kind, color: brush.color, width: brush.width });
  };

  const startLine = (point: SketchPoint) => {
    const id = createId("line");
    const normalized = normalizePoint(point, size.width, size.height);
    const lineWidth = brush.width + 0.25;
    const line: SketchLine = { id, type: "line", x: normalized.x, y: normalized.y, x1: normalized.x, y1: normalized.y, x2: normalized.x, y2: normalized.y, kind: lineKind, color: brush.color, width: lineWidth };
    emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), line], selectedId: id });
    setDragState({ kind: "draw-line", id, start: point, current: point, kindName: lineKind, color: brush.color, width: lineWidth });
  };

  const startMove = (id: string, point: SketchPoint) => {
    const element = elements.find((entry) => entry.id === id);
    if (!element) return;
    updateSelection(id);
    if (element.type === "line") { setDragState({ kind: "move", id, start: point, originalLine: element }); return; }
    if (element.type === "stroke") { setDragState({ kind: "move", id, start: point, originalPoints: element.points }); return; }
    const boxEntry = element as SketchShape | SketchSticky | SketchText;
    setDragState({ kind: "move", id, start: point, originBox: { x: boxEntry.x, y: boxEntry.y, w: boxEntry.w, h: boxEntry.h } });
  };
  const startResize = (id: string, corner: "nw" | "ne" | "sw" | "se", point: SketchPoint) => {
    const element = elements.find((entry) => entry.id === id);
    if (!element || element.type === "line" || element.type === "stroke") return;
    const boxEntry = element as SketchShape | SketchSticky | SketchText;
    setDragState({ kind: "resize", id, corner, start: point, originBox: { x: boxEntry.x, y: boxEntry.y, w: boxEntry.w, h: boxEntry.h } });
  };
  const startEndpoint = (id: string, endpoint: "start" | "end", point: SketchPoint) => {
    const element = elements.find((entry) => entry.id === id);
    if (!element || element.type !== "line") return;
    setDragState({ kind: "endpoint", id, endpoint, start: point, original: element });
  };

  const handleElementPointerDown = (element: SketchElement, event: ReactPointerEvent<SVGElement>) => {
    event.stopPropagation();
    updateSelection(element.id);
    if (activeTool === "select") {
      startMove(element.id, getBoardPoint(event));
    }
  };

  const handleBoardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-board-draw='true']")) return;
    closePopover();
    const point = getBoardPoint(e);
    if (activeTool === "pencil") return startStroke(point);
    if (activeTool === "line") return startLine(point);
    if (activeTool === "sticky") return createElementAtPoint(createSticky, point);
    if (activeTool === "text") return createElementAtPoint(createText, point);
    if (activeTool === "shapes") return createElementAtPoint(createShape, point);
    if (activeTool === "select") { updateSelection(null); setDragState({ kind: "select-area", start: point, current: point }); }
  };
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragState.kind === "none") return;
      const point = getBoardPoint(event);
      if (dragState.kind === "draw-stroke") {
        // Push directly to the ref so no points are dropped between renders.
        livePointsRef.current = [...livePointsRef.current, normalizePoint(point, size.width, size.height)];
        const nextPoints = livePointsRef.current;
        setDragState((prev) => (prev.kind === "draw-stroke" ? { ...prev, points: nextPoints } : prev));
        patchElements((list) => list.map((entry) => (entry.id === dragState.id && entry.type === "stroke" ? { ...entry, points: nextPoints } : entry)));
        return;
      }
      if (dragState.kind === "draw-line") {
        const snapped = snapLinePoint(
          dragState.start,
          point,
          elements.filter((entry): entry is SketchLine => entry.type === "line"),
          size.width,
          size.height,
          dragState.id,
          dragState.kindName === "straight",
        );
        const startN = normalizePoint(dragState.start, size.width, size.height);
        const endN = normalizePoint(snapped.current, size.width, size.height);
        setLiveGuide({ x: snapped.current.x, y: snapped.current.y, angle: snapped.angle, length: dist(dragState.start, snapped.current), snapped: snapped.snapped, guideX: snapped.guideX, guideY: snapped.guideY });
        patchElements((list) => list.map((entry) => (entry.id === dragState.id && entry.type === "line" ? { ...entry, kind: dragState.kindName, x: startN.x, y: startN.y, x1: startN.x, y1: startN.y, x2: endN.x, y2: endN.y, color: dragState.color, width: dragState.width } : entry)));
        return;
      }
      if (dragState.kind === "move") {
        const dx = point.x - dragState.start.x;
        const dy = point.y - dragState.start.y;
        patchElements((list) => list.map((entry) => {
          if (entry.id !== dragState.id) return entry;
          if (entry.type === "stroke" && dragState.originalPoints) {
            const delta = clampStrokeDelta(dragState.originalPoints, normalizePoint({ x: dx, y: dy }, size.width, size.height));
            return { ...entry, points: dragState.originalPoints.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) };
          }
          if (entry.type === "line" && dragState.originalLine) {
            const delta = clampLineDelta(dragState.originalLine, normalizePoint({ x: dx, y: dy }, size.width, size.height));
            return { ...entry, x1: dragState.originalLine.x1 + delta.x, y1: dragState.originalLine.y1 + delta.y, x2: dragState.originalLine.x2 + delta.x, y2: dragState.originalLine.y2 + delta.y, x: dragState.originalLine.x + delta.x, y: dragState.originalLine.y + delta.y };
          }
          if (entry.type !== "line" && dragState.originBox) {
            const delta = normalizePoint({ x: dx, y: dy }, size.width, size.height);
            return { ...entry, ...clampBoxPosition(dragState.originBox, delta) } as SketchElement;
          }
          return entry;
        }));
        return;
      }
      if (dragState.kind === "resize") {
        const dx = point.x - dragState.start.x;
        const dy = point.y - dragState.start.y;
        const delta = normalizePoint({ x: dx, y: dy }, size.width, size.height);
        patchElements((list) => list.map((entry) => {
          if (entry.id !== dragState.id || entry.type === "line" || entry.type === "stroke") return entry;
          return { ...entry, ...resizeBoxWithinBounds(dragState.originBox, dragState.corner, delta) };
        }));
        return;
      }
      if (dragState.kind === "endpoint") {
        const fixedPoint = dragState.endpoint === "start"
          ? { x: dragState.original.x2 * size.width, y: dragState.original.y2 * size.height }
          : { x: dragState.original.x1 * size.width, y: dragState.original.y1 * size.height };
        const snapped = snapLinePoint(
          fixedPoint,
          point,
          elements.filter((entry): entry is SketchLine => entry.type === "line"),
          size.width,
          size.height,
          dragState.id,
          dragState.original.kind === "straight",
        );
        const normalized = normalizePoint(snapped.current, size.width, size.height);
        setLiveGuide({ x: snapped.current.x, y: snapped.current.y, angle: snapped.angle, length: dist(fixedPoint, snapped.current), snapped: snapped.snapped, guideX: snapped.guideX, guideY: snapped.guideY });
        patchElements((list) => list.map((entry) => {
          if (entry.id !== dragState.id || entry.type !== "line") return entry;
          const next = { ...entry };
          if (dragState.endpoint === "start") {
            next.x1 = normalized.x;
            next.y1 = normalized.y;
          } else {
            next.x2 = normalized.x;
            next.y2 = normalized.y;
          }
          next.x = next.x1;
          next.y = next.y1;
          return next;
        }));
        return;
      }
      if (dragState.kind === "select-area") {
        const nextDragState: DragState = { ...dragState, current: point };
        setDragState(nextDragState);
        setSelectedIds(getSelectionIdsFromBox(elements, boxFromPoints(dragState.start, point), size.width, size.height));
      }
    };
    const onUp = () => {
      if (dragState.kind === "select-area") {
        updateSelectionGroup(getSelectionIdsFromBox(latestSceneRef.current.elements ?? [], boxFromPoints(dragState.start, dragState.current), size.width, size.height));
      }
      setDragState({ kind: "none" });
      setLiveGuide(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragState, elements, getBoardPoint, latestSceneRef, patchElements, size.height, size.width, updateSelectionGroup]);

  const toolButton = (tool: Tool, icon: ReactNode, title: string, flyout?: PopoverName) => (
    <button
      type="button"
      title={title}
      onClick={() => {
        updateScene({ tool });
        if (flyout) {
          setPopover((current) => (current === flyout && activeTool === tool ? null : flyout));
        } else {
          closePopover();
        }
      }}
      style={{ width: 42, height: 42, borderRadius: 16, border: activeTool === tool ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: activeTool === tool ? "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(239,246,255,0.92))" : "rgba(255,255,255,0.74)", color: activeTool === tool ? "#4154D6" : "#1F2937", display: "grid", placeItems: "center", boxShadow: activeTool === tool ? "0 14px 28px rgba(91,115,255,0.12)" : "0 10px 22px rgba(15,23,42,0.08)", cursor: "pointer" }}
    >{icon}</button>
  );

  const isEditing = editingId != null;
  const showPrimaryHandles = activeSelectionIds.length <= 1;
  const selectionOverlays = useMemo(() => activeSelectionIds.map((id) => {
    const entry = elements.find((candidate) => candidate.id === id);
    if (!entry) return null;
    const bounds = getElementBounds(entry, size.width, size.height);
    const padding = entry.type === "line" || entry.type === "stroke" ? 4 : 6;
    return {
      id: entry.id,
      type: entry.type,
      bounds: {
        x: bounds.x - padding,
        y: bounds.y - padding,
        w: bounds.w + padding * 2,
        h: bounds.h + padding * 2,
      },
    };
  }).filter((entry): entry is { id: string; type: SketchElement["type"]; bounds: SketchBox } => Boolean(entry)), [activeSelectionIds, elements, size.height, size.width]);
  const marqueeBox = dragState.kind === "select-area" ? boxFromPoints(dragState.start, dragState.current) : null;

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose?.();
        if (e.key === "Tab" && overlayRef.current) {
          const focusable = Array.from(overlayRef.current.querySelectorAll<HTMLElement>("button, textarea, [tabindex]:not([tabindex='-1'])")).filter((node) => !node.hasAttribute("disabled"));
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement as HTMLElement | null;
          if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      style={{ position: "fixed", inset: 0, zIndex: 250, display: "grid", placeItems: "center", background: "rgba(8,15,34,0.34)", backdropFilter: "blur(24px) saturate(1.3)", WebkitBackdropFilter: "blur(24px) saturate(1.3)", padding: 20 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{ width: "min(70vw, 1280px)", height: "min(80vh, 860px)", minWidth: "min(900px, 96vw)", minHeight: "min(620px, 86vh)", maxWidth: "96vw", maxHeight: "92vh", borderRadius: 32, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98))", boxShadow: "0 40px 120px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.85)", border: "1px solid rgba(148,163,184,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", borderBottom: "1px solid rgba(148,163,184,0.15)", background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,250,252,0.95))" }}>
          <div><div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748B", fontWeight: 700 }}>Sketch Your Design</div><div style={{ fontSize: 13, color: "#0F172A", marginTop: 5 }}>Apple-inspired whiteboard with selectable pages, lines, notes, and text.</div></div>
          <button type="button" onClick={() => onClose?.()} style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.9)", color: "#1F2937", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 10px 20px rgba(15,23,42,0.10)" }}><IconClose /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", padding: 16, gap: 16, background: "linear-gradient(180deg, rgba(246,248,252,1), rgba(241,245,249,0.92))", position: "relative" }}>
          <div style={{ width: 74, flexShrink: 0, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, background: "rgba(255,255,255,0.78)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 14px 34px rgba(15,23,42,0.08)", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 10px", gap: 10 }}>
              {toolButton("select", <IconSelect />, "Select")}
              {toolButton("pencil", <IconPencil />, "Pencil", "pencil")}
              {toolButton("shapes", <IconShapes />, "Shapes", "shapes")}
              {toolButton("line", <IconLine />, "Line", "line")}
              {toolButton("sticky", <IconSticky />, "Sticky note", "sticky")}
              {toolButton("text", <IconText />, "Text")}
              <div style={{ flex: 1 }} />
            </div>
            {popover === "pencil" ? (
              <Flyout title="Drawing" onClose={closePopover} align="left">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {(["pencil", "marker", "highlighter"] as BrushKind[]).map((kind) => (
                      <button key={kind} type="button" onClick={() => updateScene({ brush: { ...brush, kind } })} style={{ border: brush.kind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: brush.kind === kind ? "rgba(91,115,255,0.09)" : "rgba(255,255,255,0.85)", borderRadius: 14, padding: "10px 8px", fontSize: 12, color: "#0F172A", cursor: "pointer" }}>{kind}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {COLORS.map((color) => <button key={color} type="button" onClick={() => updateScene({ brush: { ...brush, color } })} style={{ width: 28, height: 28, borderRadius: 999, border: brush.color === color ? "2px solid rgba(15,23,42,0.75)" : "2px solid rgba(255,255,255,0.85)", background: color, boxShadow: "0 6px 14px rgba(15,23,42,0.10)", cursor: "pointer" }} />)}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[2, 3, 5, 7].map((width) => <button key={width} type="button" onClick={() => updateScene({ brush: { ...brush, width } })} style={{ flex: 1, borderRadius: 999, border: brush.width === width ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.88)", padding: "8px 0", cursor: "pointer", display: "grid", placeItems: "center" }}><span style={{ width, height: width, borderRadius: 999, background: brush.color, display: "block" }} /></button>)}
                  </div>
                </div>
              </Flyout>
            ) : null}
            {popover === "shapes" ? (
              <Flyout title="Shapes" onClose={closePopover} align="left">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {([["square", "Square"], ["rounded", "Rounded"], ["circle", "Circle"], ["triangle", "Triangle"], ["triangleDown", "Down"], ["diamond", "Diamond"], ["pentagon", "Pentagon"]] as Array<[ShapeKind, string]>).map(([kind, label]) => (
                    <button key={kind} type="button" onClick={() => { updateScene({ shapeKind: kind, tool: "shapes" }); createElementFromCenter((center) => ({ ...createShape(center), kind })); closePopover(); }} style={{ border: shapeKind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.88)", borderRadius: 16, padding: "12px 10px", color: "#0F172A", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <svg viewBox="0 0 48 36" width="40" height="28" fill="none"><path d={shapePath(kind, { x: 6, y: 5, w: 36, h: 24 })} fill={SHAPE_FILL} stroke={SHAPE_STROKE} strokeWidth="1.5" /></svg>
                      <span style={{ fontSize: 11, color: "#334155" }}>{label}</span>
                    </button>
                  ))}
                </div>
              </Flyout>
            ) : null}
            {popover === "line" ? (
              <Flyout title="Connectors" onClose={closePopover} align="left">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["straight", "elbow", "curve"] as LineKind[]).map((kind) => (
                    <button key={kind} type="button" onClick={() => updateScene({ lineKind: kind })} style={{ border: lineKind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: lineKind === kind ? "rgba(91,115,255,0.09)" : "rgba(255,255,255,0.88)", borderRadius: 16, padding: "10px 12px", color: "#0F172A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ textTransform: "capitalize", fontSize: 12 }}>{kind}</span>
                      <svg viewBox="0 0 44 26" width="44" height="26" fill="none">{kind === "straight" ? <path d="M6 20L38 6" stroke="#4154D6" strokeWidth="2.4" strokeLinecap="round" /> : kind === "elbow" ? <path d="M6 20H24V6H38" stroke="#4154D6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M6 20C16 20 18 6 30 6C34 6 36 9 38 11" stroke="#4154D6" strokeWidth="2.4" strokeLinecap="round" />}</svg>
                    </button>
                  ))}
                  <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>Straight lines snap to `0° / 45° / 90°` and show live guide chips.</div>
                </div>
              </Flyout>
            ) : null}
            {popover === "sticky" ? (
              <Flyout title="Sticky notes" onClose={closePopover} align="left">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {STICKY_COLORS.map((color) => <button key={color} type="button" onClick={() => updateScene({ stickyColor: color })} style={{ width: 28, height: 28, borderRadius: 999, border: stickyColor === color ? "2px solid rgba(15,23,42,0.75)" : "2px solid rgba(255,255,255,0.85)", background: color, boxShadow: "0 6px 14px rgba(15,23,42,0.10)", cursor: "pointer" }} />)}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>Sticky notes are the only elements sent to AI in v1.</div>
              </Flyout>
            ) : null}
          </div>

          {/* ── Selection Card ─────────────────────────────────── */}
          {selectedElement && activeTool === "select" && !isEditing ? (
            <div data-no-board-draw="true" style={{
              position: "absolute",
              left: 98,
              top: 18,
              width: 220,
              zIndex: 30,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(22px)",
              WebkitBackdropFilter: "blur(22px)",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: 22,
              boxShadow: "0 20px 52px rgba(15,23,42,0.16), 0 0 0 1px rgba(255,255,255,0.6) inset",
              overflow: "hidden",
            }}>
              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "#52607A" }}>
                  {selectedElement.type === "stroke" ? "Stroke" : selectedElement.type === "shape" ? "Shape" : selectedElement.type === "line" ? "Line" : selectedElement.type === "sticky" ? "Sticky Note" : "Text"}
                </div>
                <button type="button" onClick={() => updateSelection(null)} style={{ border: "none", background: "transparent", color: "#64748B", cursor: "pointer", display: "grid", placeItems: "center" }}><IconClose /></button>
              </div>

              {/* Card Body */}
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Color display */}
                {(selectedElement.type === "stroke" || selectedElement.type === "line") ? (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.06em" }}>COLOR</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {COLORS.map((color) => (
                        <button key={color} type="button" onClick={() => {
                          patchElements((list) => list.map((entry) => {
                            if (entry.id !== selectedElement.id) return entry;
                            if (entry.type === "stroke") return { ...entry, color };
                            if (entry.type === "line") return { ...entry, color };
                            return entry;
                          }));
                        }} style={{
                          width: 22, height: 22, borderRadius: 999,
                          border: (selectedElement.type === "stroke" || selectedElement.type === "line") && (selectedElement as SketchStroke | SketchLine).color === color ? "2px solid rgba(15,23,42,0.8)" : "2px solid rgba(255,255,255,0.8)",
                          background: color, boxShadow: "0 4px 10px rgba(15,23,42,0.10)", cursor: "pointer",
                        }} />
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedElement.type === "sticky" ? (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.06em" }}>COLOR</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {STICKY_COLORS.map((color) => (
                        <button key={color} type="button" onClick={() => {
                          patchElements((list) => list.map((entry) => entry.id === selectedElement.id && entry.type === "sticky" ? { ...entry, color } : entry));
                        }} style={{
                          width: 22, height: 22, borderRadius: 999,
                          border: (selectedElement as SketchSticky).color === color ? "2px solid rgba(15,23,42,0.8)" : "2px solid rgba(255,255,255,0.8)",
                          background: color, boxShadow: "0 4px 10px rgba(15,23,42,0.10)", cursor: "pointer",
                        }} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Dimensions */}
                {(selectedElement.type === "shape" || selectedElement.type === "sticky" || selectedElement.type === "text") ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(248,250,252,0.8)", padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>W</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{Math.round((selectedElement as SketchShape | SketchSticky | SketchText).w * size.width)}px</div>
                    </div>
                    <div style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(248,250,252,0.8)", padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>H</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{Math.round((selectedElement as SketchShape | SketchSticky | SketchText).h * size.height)}px</div>
                    </div>
                  </div>
                ) : null}
                {selectedElement.type === "line" ? (
                  <div style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(248,250,252,0.8)", padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>LENGTH</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                      {Math.round(dist(
                        denormalizePoint({ x: selectedElement.x1, y: selectedElement.y1 }, size.width, size.height),
                        denormalizePoint({ x: selectedElement.x2, y: selectedElement.y2 }, size.width, size.height),
                      ))}px
                    </div>
                  </div>
                ) : null}
                {selectedElement.type === "stroke" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(248,250,252,0.8)", padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>BRUSH</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B", textTransform: "capitalize" }}>{(selectedElement as SketchStroke).brush}</div>
                    </div>
                    <div style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(248,250,252,0.8)", padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>WIDTH</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{(selectedElement as SketchStroke).width}px</div>
                    </div>
                  </div>
                ) : null}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, paddingTop: 4 }}>
                  <button type="button" title="Duplicate" onClick={() => {
                    const clone = { ...selectedElement, id: createId(selectedElement.type) };
                    if ("x" in clone && "y" in clone && clone.type !== "line") {
                      (clone as any).x = Math.min((clone as any).x + 0.02, 0.9);
                      (clone as any).y = Math.min((clone as any).y + 0.02, 0.9);
                    }
                    emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), clone], selectedId: clone.id });
                  }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 14, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.88)", color: "#334155", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                    <IconDuplicate /> Duplicate
                  </button>
                  <button type="button" title="Delete" onClick={() => {
                    setSelectedIds([]);
                    emitChange({ ...latestSceneRef.current, elements: (latestSceneRef.current.elements ?? []).filter((entry) => entry.id !== selectedElement.id), selectedId: null });
                  }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#DC2626", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                    <IconDelete /> Delete
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={boardRef} onPointerDown={handleBoardPointerDown} style={{ flex: 1, minWidth: 0, position: "relative", borderRadius: 30, background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,251,0.96))", border: "1px solid rgba(148,163,184,0.15)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 16px 42px rgba(15,23,42,0.10)", overflow: "hidden", cursor: activeTool === "pencil" ? "crosshair" : activeTool === "line" ? "crosshair" : activeTool === "shapes" ? "crosshair" : activeTool === "sticky" ? "crosshair" : activeTool === "text" ? "text" : "default" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.45, pointerEvents: "none" }} />
            <svg width="100%" height="100%" viewBox={`0 0 ${size.width || BOARD_W} ${size.height || BOARD_H}`} shapeRendering="geometricPrecision" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <defs>
                <linearGradient id="sketch-stroke" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4154D6" /><stop offset="100%" stopColor="#A855F7" /></linearGradient>
                <filter id="shadow-soft" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.08" /></filter>
                <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 4 L0 8 Z" fill="currentColor" opacity="0.7" /></marker>
              </defs>
              {elements.map((entry) => {
                if (entry.type === "stroke") {
                  const d = strokePath(entry.points, size.width, size.height);
                  return (
                    <g key={entry.id}>
                      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(entry.width + 12, 14)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" onPointerDown={(event) => handleElementPointerDown(entry, event)} style={{ cursor: activeTool === "select" ? "move" : "pointer" }} />
                      <path d={d} fill="none" stroke={entry.color} strokeWidth={entry.width} strokeLinecap="round" strokeLinejoin="round" opacity={entry.brush === "highlighter" ? 0.38 : entry.brush === "marker" ? 0.85 : 1} filter="url(#shadow-soft)" pointerEvents="none" />
                    </g>
                  );
                }
                if (entry.type === "shape") {
                  const d = shapePath(entry.kind, denormalizeBox({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, size.width, size.height));
                  return <path key={entry.id} d={d} fill={entry.fill} stroke={entry.stroke} strokeWidth={entry.strokeWidth} filter="url(#shadow-soft)" onPointerDown={(event) => handleElementPointerDown(entry, event)} style={{ cursor: activeTool === "select" ? "move" : "pointer" }} />;
                }
                if (entry.type === "line") {
                  const d = linePath(entry, size.width, size.height);
                  return (
                    <g key={entry.id}>
                      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(entry.width + 12, 14)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" onPointerDown={(event) => handleElementPointerDown(entry, event)} style={{ cursor: activeTool === "select" ? "move" : "pointer" }} />
                      <path d={d} fill="none" stroke={entry.color} strokeWidth={entry.width} strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow-soft)" pointerEvents="none" markerEnd="url(#arrowhead)" style={{ color: entry.color }} />
                    </g>
                  );
                }
                return null;
              })}
            </svg>
            {elements.map((entry) => {
              if (entry.type === "stroke" || entry.type === "shape" || entry.type === "line") return null;
              const selected = activeSelectionIds.includes(entry.id);
              const primarySelected = selectedId === entry.id;
              const box = denormalizeBox({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, size.width, size.height);
              const isSticky = entry.type === "sticky";
              return (
                <div
                  key={entry.id}
                  style={{ position: "absolute", left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h), zIndex: selected ? 3 : 2 }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest("textarea")) return;
                    e.stopPropagation();
                    startMove(entry.id, getBoardPoint(e));
                    updateSelection(entry.id);
                  }}
                  onClick={(e) => { e.stopPropagation(); updateSelection(entry.id); }}
                >
                  {showPrimaryHandles && primarySelected ? <BoardHandle left={0} top={0} onPointerDown={(e) => { e.stopPropagation(); startResize(entry.id, "nw", getBoardPoint(e)); }} /> : null}
                  {showPrimaryHandles && primarySelected ? <BoardHandle left={box.w} top={0} onPointerDown={(e) => { e.stopPropagation(); startResize(entry.id, "ne", getBoardPoint(e)); }} /> : null}
                  {showPrimaryHandles && primarySelected ? <BoardHandle left={0} top={box.h} onPointerDown={(e) => { e.stopPropagation(); startResize(entry.id, "sw", getBoardPoint(e)); }} /> : null}
                  {showPrimaryHandles && primarySelected ? <BoardHandle left={box.w} top={box.h} onPointerDown={(e) => { e.stopPropagation(); startResize(entry.id, "se", getBoardPoint(e)); }} /> : null}
                  <div style={{ width: "100%", height: "100%", borderRadius: isSticky ? 18 : 16, background: isSticky ? `linear-gradient(180deg, ${entry.color}, rgba(255,255,255,0.94))` : "rgba(255,255,255,0.72)", border: selected ? "1px solid rgba(91,115,255,0.38)" : "1px solid rgba(148,163,184,0.18)", boxShadow: "0 16px 34px rgba(15,23,42,0.12)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <textarea value={entry.text} onChange={(e) => updateText(entry.id, e.target.value)} onFocus={() => { updateSelection(entry.id); setEditingId(entry.id); }} onBlur={() => setEditingId((current) => (current === entry.id ? null : current))} spellCheck={false} placeholder={isSticky ? "Add note" : "Your paragraph text"} style={{ width: "100%", height: "100%", flex: 1, resize: "none", border: "none", background: "transparent", color: isSticky ? "#111827" : entry.color, outline: "none", padding: isSticky ? "16px 14px 18px" : "12px 12px", fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", fontSize: isSticky ? 14 : 24, lineHeight: isSticky ? 1.5 : 1.25, letterSpacing: isSticky ? "-0.01em" : "-0.02em" }} />
                    <div style={{ padding: "0 14px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 9, color: "rgba(17,24,39,0.54)", fontWeight: 700, letterSpacing: "0.08em" }}>{isSticky ? "AI NOTE" : "TEXT"}</span>
                      <span style={{ fontSize: 9, color: "rgba(17,24,39,0.42)", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>Drag to move</span>
                    </div>
                  </div>
                  {showPrimaryHandles && primarySelected ? <button type="button" title="Move" onPointerDown={(e) => { e.stopPropagation(); startMove(entry.id, getBoardPoint(e)); }} style={{ position: "absolute", right: -20, top: 10, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(255,255,255,0.95)", boxShadow: "0 10px 24px rgba(15,23,42,0.14)", color: "#334155", display: "grid", placeItems: "center", cursor: "grab" }}><IconMove /></button> : null}
                  {showPrimaryHandles && primarySelected ? <button type="button" title="Resize" onPointerDown={(e) => { e.stopPropagation(); startResize(entry.id, "se", getBoardPoint(e)); }} style={{ position: "absolute", right: -18, bottom: -18, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(255,255,255,0.95)", boxShadow: "0 10px 24px rgba(15,23,42,0.14)", color: "#334155", display: "grid", placeItems: "center", cursor: "nwse-resize" }}><IconResize /></button> : null}
                </div>
              );
            })}
            {selectionOverlays.map((overlay) => {
              const dashed = overlay.type === "line" || overlay.type === "stroke";
              return <div key={`selection-${overlay.id}`} style={{ position: "absolute", left: overlay.bounds.x, top: overlay.bounds.y, width: overlay.bounds.w, height: overlay.bounds.h, border: dashed ? "1px dashed rgba(91,115,255,0.42)" : "1px solid rgba(91,115,255,0.42)", borderRadius: dashed ? 12 : 18, pointerEvents: "none", boxShadow: dashed ? "none" : "0 0 0 4px rgba(91,115,255,0.08)" }} />;
            })}
            {showPrimaryHandles && selectedElement && selectedElement.type === "line" ? (
              <>
                <BoardHandle left={selectedElement.x1 * size.width} top={selectedElement.y1 * size.height} onPointerDown={(e) => { e.stopPropagation(); startEndpoint(selectedElement.id, "start", getBoardPoint(e)); }} />
                <BoardHandle left={selectedElement.x2 * size.width} top={selectedElement.y2 * size.height} onPointerDown={(e) => { e.stopPropagation(); startEndpoint(selectedElement.id, "end", getBoardPoint(e)); }} />
              </>
            ) : null}
            {liveGuide?.guideX != null ? <div style={{ position: "absolute", left: liveGuide.guideX, top: 0, bottom: 0, width: 1, background: "linear-gradient(180deg, rgba(59,130,246,0), rgba(59,130,246,0.65), rgba(59,130,246,0))", pointerEvents: "none" }} /> : null}
            {liveGuide?.guideY != null ? <div style={{ position: "absolute", top: liveGuide.guideY, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.65), rgba(59,130,246,0))", pointerEvents: "none" }} /> : null}
            {(dragState.kind === "draw-line" || dragState.kind === "endpoint") && liveGuide ? <div style={{ position: "absolute", left: clamp(liveGuide.x + 12, 16, (size.width || BOARD_W) - 160), top: clamp(liveGuide.y + 12, 16, (size.height || BOARD_H) - 64), zIndex: 10, background: "rgba(15,23,42,0.9)", color: "#fff", borderRadius: 999, padding: "8px 12px", boxShadow: "0 16px 30px rgba(15,23,42,0.18)", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}><span>{Math.round(liveGuide.angle)}deg</span><span style={{ opacity: 0.65 }}>•</span><span>{Math.round(liveGuide.length)}px</span><span style={{ opacity: 0.65 }}>•</span><span>{liveGuide.snapped ? "snapped" : "free"}</span></div> : null}
            {marqueeBox ? <div style={{ position: "absolute", left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h, border: "1px dashed rgba(65,84,214,0.65)", background: "rgba(91,115,255,0.08)", borderRadius: 16, pointerEvents: "none", boxShadow: "0 0 0 1px rgba(255,255,255,0.4) inset" }} /> : null}
            <div style={{ position: "absolute", left: 18, top: 18, display: "flex", alignItems: "center", gap: 10, zIndex: 6, pointerEvents: "none" }}>
              <div style={{ padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.84)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 8px 24px rgba(15,23,42,0.06)", fontSize: 11, color: "#334155", fontWeight: 600 }}>{isEditing ? "EDITING" : activeTool.toUpperCase()}</div>
              <div style={{ padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.84)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 8px 24px rgba(15,23,42,0.06)", fontSize: 11, color: "#64748B" }}>Page 1</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 16px", borderTop: "1px solid rgba(148,163,184,0.15)", background: "linear-gradient(180deg, rgba(248,250,252,0.92), rgba(255,255,255,0.98))" }}>
          <div style={{ fontSize: 12, color: "#64748B" }}>Drag, draw, and add notes. Sticky notes are the only AI-readable content in this version.</div>
          <div style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(91,115,255,0.22)", background: "rgba(91,115,255,0.08)", color: "#4154D6", fontWeight: 700, fontSize: 12 }}>Page 1</div>
        </div>
      </div>
    </div>
  );
}
