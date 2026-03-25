import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
const BOARD_W = 1200;
const BOARD_H = 760;
const DEFAULT_BRUSH = { kind: "pencil", color: "#1D4ED8", width: 3 };
const DEFAULT_SHAPE = "rounded";
const DEFAULT_LINE = "straight";
const DEFAULT_STICKY = "#FDE68A";
const COLORS = ["#1D4ED8", "#2563EB", "#A855F7", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#111827"];
const STICKY_COLORS = ["#FDE68A", "#FDBA74", "#FDA4AF", "#93C5FD", "#86EFAC", "#C4B5FD"];
const SHAPE_FILL = "rgba(255,255,255,0.72)";
const SHAPE_STROKE = "rgba(17,24,39,0.78)";
function createId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36)}`;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function normalizePoint(point, width, height) {
    return { x: width ? point.x / width : 0, y: height ? point.y / height : 0 };
}
function denormalizePoint(point, width, height) {
    return { x: point.x * width, y: point.y * height };
}
function denormalizeBox(box, width, height) {
    return { x: box.x * width, y: box.y * height, w: box.w * width, h: box.h * height };
}
function boxFromPoints(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}
function boxIntersects(a, b) {
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}
function angleDeg(from, to) {
    return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}
function snapAngle(start, current) {
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
function snapLinePoint(start, current, lines, width, height, excludeId, lockAngle) {
    let next = current;
    let snapped = false;
    let guideX = null;
    let guideY = null;
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
function strokePath(points, width, height) {
    if (!points.length)
        return "";
    const first = denormalizePoint(points[0], width, height);
    if (points.length === 1)
        return `M ${first.x} ${first.y}`;
    const segments = [`M ${first.x} ${first.y}`];
    for (let i = 1; i < points.length; i += 1) {
        const prev = denormalizePoint(points[i - 1], width, height);
        const curr = denormalizePoint(points[i], width, height);
        const mid = midpoint(prev, curr);
        segments.push(`Q ${prev.x} ${prev.y} ${mid.x} ${mid.y}`);
    }
    const last = denormalizePoint(points[points.length - 1], width, height);
    segments.push(`T ${last.x} ${last.y}`);
    return segments.join(" ");
}
function linePath(line, width, height) {
    const p1 = denormalizePoint({ x: line.x1, y: line.y1 }, width, height);
    const p2 = denormalizePoint({ x: line.x2, y: line.y2 }, width, height);
    if (line.kind === "straight")
        return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    if (line.kind === "elbow")
        return `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
    const ctrl = { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) - Math.abs(p2.x - p1.x) * 0.18 };
    return `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;
}
function shapePath(kind, box) {
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
function getTextMetrics(text, minW = 180, minH = 96) {
    const lines = text.split("\n");
    const longest = Math.max(...lines.map((line) => line.length), 1);
    return { w: Math.max(minW, Math.min(520, longest * 9.4 + 32)), h: Math.max(minH, Math.min(280, Math.max(lines.length, 1) * 24 + 32)) };
}
function getStrokeBounds(points, width, height, padding = 18) {
    if (!points.length)
        return { x: 0, y: 0, w: 0, h: 0 };
    const coordinates = points.map((point) => denormalizePoint(point, width, height));
    const xs = coordinates.map((point) => point.x);
    const ys = coordinates.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX - padding / 2, y: minY - padding / 2, w: Math.max(1, maxX - minX) + padding, h: Math.max(1, maxY - minY) + padding };
}
function getElementBounds(element, width, height) {
    if (element.type === "stroke")
        return getStrokeBounds(element.points, width, height, Math.max(element.width * 4, 18));
    if (element.type === "line") {
        const bounds = boxFromPoints(denormalizePoint({ x: element.x1, y: element.y1 }, width, height), denormalizePoint({ x: element.x2, y: element.y2 }, width, height));
        const padding = Math.max(element.width * 4, 18);
        return { x: bounds.x - padding / 2, y: bounds.y - padding / 2, w: Math.max(1, bounds.w) + padding, h: Math.max(1, bounds.h) + padding };
    }
    return denormalizeBox({ x: element.x, y: element.y, w: element.w, h: element.h }, width, height);
}
function clampStrokeDelta(points, delta) {
    if (!points.length)
        return delta;
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
function clampLineDelta(line, delta) {
    const minX = Math.min(line.x1, line.x2);
    const maxX = Math.max(line.x1, line.x2);
    const minY = Math.min(line.y1, line.y2);
    const maxY = Math.max(line.y1, line.y2);
    return {
        x: clamp(delta.x, -minX, 1 - maxX),
        y: clamp(delta.y, -minY, 1 - maxY),
    };
}
function clampBoxPosition(originBox, delta) {
    return {
        x: clamp(originBox.x + delta.x, 0, Math.max(0, 1 - originBox.w)),
        y: clamp(originBox.y + delta.y, 0, Math.max(0, 1 - originBox.h)),
    };
}
function resizeBoxWithinBounds(originBox, corner, delta, minW = 0.12, minH = 0.08) {
    const right = originBox.x + originBox.w;
    const bottom = originBox.y + originBox.h;
    let x = originBox.x;
    let y = originBox.y;
    let w = originBox.w;
    let h = originBox.h;
    if (corner.includes("w")) {
        x = clamp(originBox.x + delta.x, 0, right - minW);
        w = right - x;
    }
    else {
        w = clamp(originBox.w + delta.x, minW, 1 - originBox.x);
    }
    if (corner.includes("n")) {
        y = clamp(originBox.y + delta.y, 0, bottom - minH);
        h = bottom - y;
    }
    else {
        h = clamp(originBox.h + delta.y, minH, 1 - originBox.y);
    }
    return { x, y, w, h };
}
function getSelectionIdsFromBox(elements, selectionBox, width, height) {
    if (selectionBox.w < 4 && selectionBox.h < 4)
        return [];
    return elements.filter((entry) => boxIntersects(getElementBounds(entry, width, height), selectionBox)).map((entry) => entry.id);
}
function isEditableTarget(target) {
    return typeof HTMLElement !== "undefined"
        && target instanceof HTMLElement
        && Boolean(target.closest("textarea, input, [contenteditable='true']"));
}
function useSize() {
    const ref = useRef(null);
    const [size, setSize] = useState({ width: BOARD_W, height: BOARD_H });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
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
function useLatest(value) {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
}
function IconSelect() { return _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: _jsx("path", { d: "M5 4l11 8-5 1 4 6-2 1-4-6-3 4z", stroke: "currentColor", strokeWidth: "1.8", strokeLinejoin: "round" }) }); }
function IconPencil() { return _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: [_jsx("path", { d: "M5 16.5V19h2.5L18 8.5 15.5 6 5 16.5Z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }), _jsx("path", { d: "M13.6 4.8l2.6 2.6", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round" })] }); }
function IconShapes() { return _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: [_jsx("rect", { x: "4.5", y: "4.5", width: "6", height: "6", rx: "1.2", stroke: "currentColor", strokeWidth: "1.7" }), _jsx("circle", { cx: "16.5", cy: "8.5", r: "3.5", stroke: "currentColor", strokeWidth: "1.7" }), _jsx("path", { d: "M12 18.5l3.5-6h7l-3.5 6z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" })] }); }
function IconLine() { return _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: [_jsx("path", { d: "M5 18l14-12", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }), _jsx("circle", { cx: "5", cy: "18", r: "1.4", fill: "currentColor" }), _jsx("circle", { cx: "19", cy: "6", r: "1.4", fill: "currentColor" })] }); }
function IconSticky() { return _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: [_jsx("path", { d: "M4 5.5A1.5 1.5 0 0 1 5.5 4H16l4 4v10.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13Z", fill: "currentColor", opacity: ".16" }), _jsx("path", { d: "M16 4v4h4", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" })] }); }
function IconText() { return _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: [_jsx("path", { d: "M5 7h14M12 7v11", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }), _jsx("path", { d: "M9 18h6", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })] }); }
function IconClose() { return _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", children: _jsx("path", { d: "M6 6l12 12M18 6L6 18", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) }); }
function IconMove() { return _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", children: _jsx("path", { d: "M12 4v16M4 12h16", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round" }) }); }
function IconResize() { return _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", children: _jsx("path", { d: "M8 16l8-8M13 16h3v-3", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" }) }); }
export function HeaderButton({ active, children, title, onClick }) {
    return (_jsx("button", { type: "button", title: title, onClick: onClick, style: {
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
        }, onMouseEnter: (e) => { e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: (e) => { e.currentTarget.style.transform = "translateY(0px)"; }, children: children }));
}
function Flyout({ title, children, onClose, align = "center" }) {
    return (_jsxs("div", { style: {
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
        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid rgba(15,23,42,0.06)" }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "#52607A" }, children: title }), _jsx("button", { type: "button", onClick: onClose, style: { border: "none", background: "transparent", color: "#64748B", cursor: "pointer" }, children: _jsx(IconClose, {}) })] }), _jsx("div", { style: { padding: 12 }, children: children })] }));
}
function BoardHandle({ left, top, onPointerDown }) {
    return (_jsx("button", { type: "button", onPointerDown: onPointerDown, style: {
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
        } }));
}
function initialScene() {
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
export default function SketchBoard({ open, value, defaultValue, onChange, onContextChange, onNotesChange, onClose }) {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(() => ({ ...initialScene(), ...(defaultValue ?? {}), elements: defaultValue?.elements ?? [] }));
    const scene = isControlled ? value : internalValue;
    const elements = scene.elements ?? [];
    const selectedId = scene.selectedId ?? null;
    const activeTool = scene.tool ?? "select";
    const brush = scene.brush ?? DEFAULT_BRUSH;
    const shapeKind = scene.shapeKind ?? DEFAULT_SHAPE;
    const lineKind = scene.lineKind ?? DEFAULT_LINE;
    const stickyColor = scene.stickyColor ?? DEFAULT_STICKY;
    const { ref: boardRef, size } = useSize();
    const [popover, setPopover] = useState(null);
    const [dragState, setDragState] = useState({ kind: "none" });
    const [liveGuide, setLiveGuide] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(() => (selectedId ? [selectedId] : []));
    const latestSceneRef = useLatest(scene);
    const overlayRef = useRef(null);
    const emitChange = useCallback((next) => { if (!isControlled)
        setInternalValue(next); onChange?.(next); }, [isControlled, onChange]);
    const updateScene = useCallback((patch) => emitChange({ ...latestSceneRef.current, ...patch }), [emitChange, latestSceneRef]);
    const updateSelection = useCallback((selected) => {
        setSelectedIds(selected ? [selected] : []);
        emitChange({ ...latestSceneRef.current, selectedId: selected });
    }, [emitChange, latestSceneRef]);
    const updateSelectionGroup = useCallback((ids) => {
        const uniqueIds = Array.from(new Set(ids));
        const primary = uniqueIds[uniqueIds.length - 1] ?? null;
        setSelectedIds(uniqueIds);
        emitChange({ ...latestSceneRef.current, selectedId: primary });
    }, [emitChange, latestSceneRef]);
    const patchElements = useCallback((updater) => {
        const currentElements = latestSceneRef.current.elements ?? [];
        emitChange({ ...latestSceneRef.current, elements: updater(currentElements) });
    }, [emitChange, latestSceneRef]);
    const getBoardPoint = useCallback((e) => {
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect)
            return { x: 0, y: 0 };
        return { x: clamp(e.clientX - rect.left, 0, rect.width), y: clamp(e.clientY - rect.top, 0, rect.height) };
    }, [boardRef]);
    const notes = useMemo(() => elements.filter((entry) => entry.type === "sticky" && entry.text.trim().length > 0).map((entry) => entry.text.trim()), [elements]);
    const textBlocks = useMemo(() => elements.filter((entry) => entry.type === "text" && entry.text.trim().length > 0).map((entry) => entry.text.trim()), [elements]);
    const selectedElement = useMemo(() => elements.find((entry) => entry.id === selectedId) ?? null, [elements, selectedId]);
    const activeSelectionIds = useMemo(() => (selectedIds.length ? selectedIds : selectedId ? [selectedId] : []), [selectedId, selectedIds]);
    useEffect(() => { onNotesChange?.(notes); onContextChange?.({ elements, notes, textBlocks }); }, [elements, notes, onContextChange, onNotesChange, textBlocks]);
    useEffect(() => { if (!open)
        return; overlayRef.current?.focus(); }, [open]);
    useEffect(() => {
        setSelectedIds((current) => {
            const valid = current.filter((id) => elements.some((entry) => entry.id === id));
            if (valid.length)
                return valid;
            return selectedId ? [selectedId] : [];
        });
    }, [elements, selectedId]);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose?.();
            }
            if (event.key === "Delete" || event.key === "Backspace") {
                if (editingId != null || isEditableTarget(event.target) || isEditableTarget(document.activeElement))
                    return;
                const active = activeSelectionIds.length
                    ? activeSelectionIds
                    : latestSceneRef.current.selectedId
                        ? [latestSceneRef.current.selectedId]
                        : [];
                if (!active.length)
                    return;
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
    const updateText = (id, text) => {
        patchElements((list) => list.map((entry) => {
            if (entry.id !== id)
                return entry;
            if (entry.type === "sticky")
                return { ...entry, text };
            if (entry.type === "text") {
                const metrics = getTextMetrics(text, 220, 84);
                return { ...entry, text, w: Math.max(entry.w, metrics.w / size.width), h: Math.max(entry.h, metrics.h / size.height) };
            }
            return entry;
        }));
    };
    const createElementFromCenter = (factory) => {
        const rect = boardRef.current?.getBoundingClientRect();
        const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: BOARD_W / 2, y: BOARD_H / 2 };
        const next = factory(center);
        emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), next], selectedId: next.id });
    };
    const createElementAtPoint = (factory, point) => {
        const next = factory(point);
        emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), next], selectedId: next.id });
    };
    const createShape = (center) => {
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
    const createSticky = (center) => ({
        id: createId("sticky"),
        type: "sticky",
        x: clamp(center.x - 110, 20, Math.max(20, size.width - 240)) / size.width,
        y: clamp(center.y - 90, 20, Math.max(20, size.height - 190)) / size.height,
        w: 220 / size.width,
        h: 180 / size.height,
        color: stickyColor,
        text: "Note for AI to read",
    });
    const createText = (center) => ({
        id: createId("text"),
        type: "text",
        x: clamp(center.x - 140, 20, Math.max(20, size.width - 320)) / size.width,
        y: clamp(center.y - 42, 20, Math.max(20, size.height - 140)) / size.height,
        w: 280 / size.width,
        h: 84 / size.height,
        text: "Your paragraph text",
        color: "#111827",
    });
    const startStroke = (point) => {
        const id = createId("stroke");
        const stroke = { id, type: "stroke", x: 0, y: 0, points: [normalizePoint(point, size.width, size.height)], color: brush.color, width: brush.width, brush: brush.kind };
        emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), stroke], selectedId: id });
        setDragState({ kind: "draw-stroke", id, start: point, points: [normalizePoint(point, size.width, size.height)], brush: brush.kind, color: brush.color, width: brush.width });
    };
    const startLine = (point) => {
        const id = createId("line");
        const normalized = normalizePoint(point, size.width, size.height);
        const lineWidth = brush.width + 0.25;
        const line = { id, type: "line", x: normalized.x, y: normalized.y, x1: normalized.x, y1: normalized.y, x2: normalized.x, y2: normalized.y, kind: lineKind, color: brush.color, width: lineWidth };
        emitChange({ ...latestSceneRef.current, elements: [...(latestSceneRef.current.elements ?? []), line], selectedId: id });
        setDragState({ kind: "draw-line", id, start: point, current: point, kindName: lineKind, color: brush.color, width: lineWidth });
    };
    const startMove = (id, point) => {
        const element = elements.find((entry) => entry.id === id);
        if (!element)
            return;
        updateSelection(id);
        if (element.type === "line") {
            setDragState({ kind: "move", id, start: point, originalLine: element });
            return;
        }
        if (element.type === "stroke") {
            setDragState({ kind: "move", id, start: point, originalPoints: element.points });
            return;
        }
        const boxEntry = element;
        setDragState({ kind: "move", id, start: point, originBox: { x: boxEntry.x, y: boxEntry.y, w: boxEntry.w, h: boxEntry.h } });
    };
    const startResize = (id, corner, point) => {
        const element = elements.find((entry) => entry.id === id);
        if (!element || element.type === "line" || element.type === "stroke")
            return;
        const boxEntry = element;
        setDragState({ kind: "resize", id, corner, start: point, originBox: { x: boxEntry.x, y: boxEntry.y, w: boxEntry.w, h: boxEntry.h } });
    };
    const startEndpoint = (id, endpoint, point) => {
        const element = elements.find((entry) => entry.id === id);
        if (!element || element.type !== "line")
            return;
        setDragState({ kind: "endpoint", id, endpoint, start: point, original: element });
    };
    const handleElementPointerDown = (element, event) => {
        event.stopPropagation();
        updateSelection(element.id);
        if (activeTool === "select") {
            startMove(element.id, getBoardPoint(event));
        }
    };
    const handleBoardPointerDown = (e) => {
        if (e.button !== 0)
            return;
        const target = e.target;
        if (target.closest("[data-no-board-draw='true']"))
            return;
        const point = getBoardPoint(e);
        if (activeTool === "pencil")
            return startStroke(point);
        if (activeTool === "line")
            return startLine(point);
        if (activeTool === "sticky")
            return createElementAtPoint(createSticky, point);
        if (activeTool === "text")
            return createElementAtPoint(createText, point);
        if (activeTool === "shapes")
            return createElementAtPoint(createShape, point);
        if (activeTool === "select") {
            updateSelection(null);
            setDragState({ kind: "select-area", start: point, current: point });
        }
    };
    useEffect(() => {
        const onMove = (event) => {
            if (dragState.kind === "none")
                return;
            const point = getBoardPoint(event);
            if (dragState.kind === "draw-stroke") {
                const nextPoints = [...dragState.points, normalizePoint(point, size.width, size.height)];
                setDragState({ ...dragState, points: nextPoints });
                patchElements((list) => list.map((entry) => (entry.id === dragState.id && entry.type === "stroke" ? { ...entry, points: nextPoints } : entry)));
                return;
            }
            if (dragState.kind === "draw-line") {
                const snapped = snapLinePoint(dragState.start, point, elements.filter((entry) => entry.type === "line"), size.width, size.height, dragState.id, dragState.kindName === "straight");
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
                    if (entry.id !== dragState.id)
                        return entry;
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
                        return { ...entry, ...clampBoxPosition(dragState.originBox, delta) };
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
                    if (entry.id !== dragState.id || entry.type === "line" || entry.type === "stroke")
                        return entry;
                    return { ...entry, ...resizeBoxWithinBounds(dragState.originBox, dragState.corner, delta) };
                }));
                return;
            }
            if (dragState.kind === "endpoint") {
                const fixedPoint = dragState.endpoint === "start"
                    ? { x: dragState.original.x2 * size.width, y: dragState.original.y2 * size.height }
                    : { x: dragState.original.x1 * size.width, y: dragState.original.y1 * size.height };
                const snapped = snapLinePoint(fixedPoint, point, elements.filter((entry) => entry.type === "line"), size.width, size.height, dragState.id, dragState.original.kind === "straight");
                const normalized = normalizePoint(snapped.current, size.width, size.height);
                setLiveGuide({ x: snapped.current.x, y: snapped.current.y, angle: snapped.angle, length: dist(fixedPoint, snapped.current), snapped: snapped.snapped, guideX: snapped.guideX, guideY: snapped.guideY });
                patchElements((list) => list.map((entry) => {
                    if (entry.id !== dragState.id || entry.type !== "line")
                        return entry;
                    const next = { ...entry };
                    if (dragState.endpoint === "start") {
                        next.x1 = normalized.x;
                        next.y1 = normalized.y;
                    }
                    else {
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
                const nextDragState = { ...dragState, current: point };
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
    const toolButton = (tool, icon, title, flyout) => (_jsx("button", { type: "button", title: title, onClick: () => {
            updateScene({ tool });
            if (flyout) {
                setPopover((current) => (current === flyout && activeTool === tool ? null : flyout));
            }
            else {
                closePopover();
            }
        }, style: { width: 42, height: 42, borderRadius: 16, border: activeTool === tool ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: activeTool === tool ? "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(239,246,255,0.92))" : "rgba(255,255,255,0.74)", color: activeTool === tool ? "#4154D6" : "#1F2937", display: "grid", placeItems: "center", boxShadow: activeTool === tool ? "0 14px 28px rgba(91,115,255,0.12)" : "0 10px 22px rgba(15,23,42,0.08)", cursor: "pointer" }, children: icon }));
    const isEditing = editingId != null;
    const showPrimaryHandles = activeSelectionIds.length <= 1;
    const selectionOverlays = useMemo(() => activeSelectionIds.map((id) => {
        const entry = elements.find((candidate) => candidate.id === id);
        if (!entry)
            return null;
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
    }).filter((entry) => Boolean(entry)), [activeSelectionIds, elements, size.height, size.width]);
    const marqueeBox = dragState.kind === "select-area" ? boxFromPoints(dragState.start, dragState.current) : null;
    if (!open)
        return null;
    return (_jsx("div", { ref: overlayRef, tabIndex: -1, onKeyDown: (e) => {
            if (e.key === "Escape")
                onClose?.();
            if (e.key === "Tab" && overlayRef.current) {
                const focusable = Array.from(overlayRef.current.querySelectorAll("button, textarea, [tabindex]:not([tabindex='-1'])")).filter((node) => !node.hasAttribute("disabled"));
                if (focusable.length === 0)
                    return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement;
                if (e.shiftKey && active === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }, style: { position: "fixed", inset: 0, zIndex: 250, display: "grid", placeItems: "center", background: "rgba(8,15,34,0.34)", backdropFilter: "blur(24px) saturate(1.3)", WebkitBackdropFilter: "blur(24px) saturate(1.3)", padding: 20 }, onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose?.(); }, children: _jsxs("div", { style: { width: "min(70vw, 1280px)", height: "min(80vh, 860px)", minWidth: "min(900px, 96vw)", minHeight: "min(620px, 86vh)", maxWidth: "96vw", maxHeight: "92vh", borderRadius: 32, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98))", boxShadow: "0 40px 120px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.85)", border: "1px solid rgba(148,163,184,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", borderBottom: "1px solid rgba(148,163,184,0.15)", background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,250,252,0.95))" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748B", fontWeight: 700 }, children: "Sketch Your Design" }), _jsx("div", { style: { fontSize: 13, color: "#0F172A", marginTop: 5 }, children: "Apple-inspired whiteboard with selectable pages, lines, notes, and text." })] }), _jsx("button", { type: "button", onClick: () => onClose?.(), style: { width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.9)", color: "#1F2937", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 10px 20px rgba(15,23,42,0.10)" }, children: _jsx(IconClose, {}) })] }), _jsxs("div", { style: { flex: 1, minHeight: 0, display: "flex", padding: 16, gap: 16, background: "linear-gradient(180deg, rgba(246,248,252,1), rgba(241,245,249,0.92))" }, children: [_jsxs("div", { style: { width: 74, flexShrink: 0, position: "relative" }, children: [_jsxs("div", { style: { position: "absolute", inset: 0, borderRadius: 28, background: "rgba(255,255,255,0.78)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 14px 34px rgba(15,23,42,0.08)", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 10px", gap: 10 }, children: [toolButton("select", _jsx(IconSelect, {}), "Select"), toolButton("pencil", _jsx(IconPencil, {}), "Pencil", "pencil"), toolButton("shapes", _jsx(IconShapes, {}), "Shapes", "shapes"), toolButton("line", _jsx(IconLine, {}), "Line", "line"), toolButton("sticky", _jsx(IconSticky, {}), "Sticky note", "sticky"), toolButton("text", _jsx(IconText, {}), "Text"), _jsx("div", { style: { flex: 1 } })] }), popover === "pencil" ? (_jsx(Flyout, { title: "Drawing", onClose: closePopover, align: "left", children: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }, children: ["pencil", "marker", "highlighter"].map((kind) => (_jsx("button", { type: "button", onClick: () => updateScene({ brush: { ...brush, kind } }), style: { border: brush.kind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: brush.kind === kind ? "rgba(91,115,255,0.09)" : "rgba(255,255,255,0.85)", borderRadius: 14, padding: "10px 8px", fontSize: 12, color: "#0F172A", cursor: "pointer" }, children: kind }, kind))) }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: COLORS.map((color) => _jsx("button", { type: "button", onClick: () => updateScene({ brush: { ...brush, color } }), style: { width: 28, height: 28, borderRadius: 999, border: brush.color === color ? "2px solid rgba(15,23,42,0.75)" : "2px solid rgba(255,255,255,0.85)", background: color, boxShadow: "0 6px 14px rgba(15,23,42,0.10)", cursor: "pointer" } }, color)) }), _jsx("div", { style: { display: "flex", gap: 8 }, children: [2, 3, 5, 7].map((width) => _jsx("button", { type: "button", onClick: () => updateScene({ brush: { ...brush, width } }), style: { flex: 1, borderRadius: 999, border: brush.width === width ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.88)", padding: "8px 0", cursor: "pointer", display: "grid", placeItems: "center" }, children: _jsx("span", { style: { width, height: width, borderRadius: 999, background: brush.color, display: "block" } }) }, width)) })] }) })) : null, popover === "shapes" ? (_jsx(Flyout, { title: "Shapes", onClose: closePopover, align: "left", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }, children: [["square", "Square"], ["rounded", "Rounded"], ["circle", "Circle"], ["triangle", "Triangle"], ["triangleDown", "Down"], ["diamond", "Diamond"], ["pentagon", "Pentagon"]].map(([kind, label]) => (_jsxs("button", { type: "button", onClick: () => { updateScene({ shapeKind: kind, tool: "shapes" }); createElementFromCenter(createShape); closePopover(); }, style: { border: shapeKind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.88)", borderRadius: 16, padding: "12px 10px", color: "#0F172A", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }, children: [_jsx("svg", { viewBox: "0 0 48 36", width: "40", height: "28", fill: "none", children: _jsx("path", { d: shapePath(kind, { x: 6, y: 5, w: 36, h: 24 }), fill: SHAPE_FILL, stroke: SHAPE_STROKE, strokeWidth: "1.5" }) }), _jsx("span", { style: { fontSize: 11, color: "#334155" }, children: label })] }, kind))) }) })) : null, popover === "line" ? (_jsx(Flyout, { title: "Connectors", onClose: closePopover, align: "left", children: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [["straight", "elbow", "curve"].map((kind) => (_jsxs("button", { type: "button", onClick: () => updateScene({ lineKind: kind }), style: { border: lineKind === kind ? "1px solid rgba(91,115,255,0.4)" : "1px solid rgba(148,163,184,0.16)", background: lineKind === kind ? "rgba(91,115,255,0.09)" : "rgba(255,255,255,0.88)", borderRadius: 16, padding: "10px 12px", color: "#0F172A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsx("span", { style: { textTransform: "capitalize", fontSize: 12 }, children: kind }), _jsx("svg", { viewBox: "0 0 44 26", width: "44", height: "26", fill: "none", children: kind === "straight" ? _jsx("path", { d: "M6 20L38 6", stroke: "#4154D6", strokeWidth: "2.4", strokeLinecap: "round" }) : kind === "elbow" ? _jsx("path", { d: "M6 20H24V6H38", stroke: "#4154D6", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round" }) : _jsx("path", { d: "M6 20C16 20 18 6 30 6C34 6 36 9 38 11", stroke: "#4154D6", strokeWidth: "2.4", strokeLinecap: "round" }) })] }, kind))), _jsx("div", { style: { fontSize: 11, color: "#64748B", lineHeight: 1.5 }, children: "Straight lines snap to `0\u00B0 / 45\u00B0 / 90\u00B0` and show live guide chips." })] }) })) : null, popover === "sticky" ? (_jsxs(Flyout, { title: "Sticky notes", onClose: closePopover, align: "left", children: [_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }, children: STICKY_COLORS.map((color) => _jsx("button", { type: "button", onClick: () => updateScene({ stickyColor: color }), style: { width: 28, height: 28, borderRadius: 999, border: stickyColor === color ? "2px solid rgba(15,23,42,0.75)" : "2px solid rgba(255,255,255,0.85)", background: color, boxShadow: "0 6px 14px rgba(15,23,42,0.10)", cursor: "pointer" } }, color)) }), _jsx("div", { style: { marginTop: 10, fontSize: 11, color: "#64748B", lineHeight: 1.5 }, children: "Sticky notes are the only elements sent to AI in v1." })] })) : null] }), _jsxs("div", { ref: boardRef, onPointerDown: handleBoardPointerDown, style: { flex: 1, minWidth: 0, position: "relative", borderRadius: 30, background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,251,0.96))", border: "1px solid rgba(148,163,184,0.15)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 16px 42px rgba(15,23,42,0.10)", overflow: "hidden" }, children: [_jsx("div", { style: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.45, pointerEvents: "none" } }), _jsxs("svg", { width: "100%", height: "100%", viewBox: `0 0 ${size.width || BOARD_W} ${size.height || BOARD_H}`, style: { position: "absolute", inset: 0, overflow: "visible" }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "sketch-stroke", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: "#4154D6" }), _jsx("stop", { offset: "100%", stopColor: "#A855F7" })] }), _jsx("filter", { id: "shadow-soft", x: "-20%", y: "-20%", width: "140%", height: "140%", children: _jsx("feDropShadow", { dx: "0", dy: "10", stdDeviation: "12", floodColor: "#0F172A", floodOpacity: "0.12" }) })] }), elements.map((entry) => {
                                            if (entry.type === "stroke") {
                                                const d = strokePath(entry.points, size.width, size.height);
                                                return (_jsxs("g", { children: [_jsx("path", { d: d, fill: "none", stroke: "transparent", strokeWidth: Math.max(entry.width + 12, 14), strokeLinecap: "round", strokeLinejoin: "round", pointerEvents: "stroke", onPointerDown: (event) => handleElementPointerDown(entry, event), style: { cursor: activeTool === "select" ? "move" : "pointer" } }), _jsx("path", { d: d, fill: "none", stroke: entry.color, strokeWidth: entry.width, strokeLinecap: "round", strokeLinejoin: "round", opacity: entry.brush === "highlighter" ? 0.38 : entry.brush === "marker" ? 0.85 : 1, filter: "url(#shadow-soft)", pointerEvents: "none" })] }, entry.id));
                                            }
                                            if (entry.type === "shape") {
                                                const d = shapePath(entry.kind, denormalizeBox({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, size.width, size.height));
                                                return _jsx("path", { d: d, fill: entry.fill, stroke: entry.stroke, strokeWidth: entry.strokeWidth, filter: "url(#shadow-soft)", onPointerDown: (event) => handleElementPointerDown(entry, event), style: { cursor: activeTool === "select" ? "move" : "pointer" } }, entry.id);
                                            }
                                            if (entry.type === "line") {
                                                const d = linePath(entry, size.width, size.height);
                                                return (_jsxs("g", { children: [_jsx("path", { d: d, fill: "none", stroke: "transparent", strokeWidth: Math.max(entry.width + 12, 14), strokeLinecap: "round", strokeLinejoin: "round", pointerEvents: "stroke", onPointerDown: (event) => handleElementPointerDown(entry, event), style: { cursor: activeTool === "select" ? "move" : "pointer" } }), _jsx("path", { d: d, fill: "none", stroke: entry.color, strokeWidth: entry.width, strokeLinecap: "round", strokeLinejoin: "round", filter: "url(#shadow-soft)", pointerEvents: "none" })] }, entry.id));
                                            }
                                            return null;
                                        })] }), elements.map((entry) => {
                                    if (entry.type === "stroke" || entry.type === "shape" || entry.type === "line")
                                        return null;
                                    const selected = activeSelectionIds.includes(entry.id);
                                    const primarySelected = selectedId === entry.id;
                                    const box = denormalizeBox({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, size.width, size.height);
                                    const isSticky = entry.type === "sticky";
                                    return (_jsxs("div", { style: { position: "absolute", left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h), zIndex: selected ? 3 : 2 }, onPointerDown: (e) => {
                                            if (e.target.closest("textarea"))
                                                return;
                                            e.stopPropagation();
                                            startMove(entry.id, getBoardPoint(e));
                                            updateSelection(entry.id);
                                        }, onClick: (e) => { e.stopPropagation(); updateSelection(entry.id); }, children: [showPrimaryHandles && primarySelected ? _jsx(BoardHandle, { left: 0, top: 0, onPointerDown: (e) => { e.stopPropagation(); startResize(entry.id, "nw", getBoardPoint(e)); } }) : null, showPrimaryHandles && primarySelected ? _jsx(BoardHandle, { left: box.w, top: 0, onPointerDown: (e) => { e.stopPropagation(); startResize(entry.id, "ne", getBoardPoint(e)); } }) : null, showPrimaryHandles && primarySelected ? _jsx(BoardHandle, { left: 0, top: box.h, onPointerDown: (e) => { e.stopPropagation(); startResize(entry.id, "sw", getBoardPoint(e)); } }) : null, showPrimaryHandles && primarySelected ? _jsx(BoardHandle, { left: box.w, top: box.h, onPointerDown: (e) => { e.stopPropagation(); startResize(entry.id, "se", getBoardPoint(e)); } }) : null, _jsxs("div", { style: { width: "100%", height: "100%", borderRadius: isSticky ? 18 : 16, background: isSticky ? `linear-gradient(180deg, ${entry.color}, rgba(255,255,255,0.94))` : "rgba(255,255,255,0.72)", border: selected ? "1px solid rgba(91,115,255,0.38)" : "1px solid rgba(148,163,184,0.18)", boxShadow: "0 16px 34px rgba(15,23,42,0.12)", overflow: "hidden", display: "flex", flexDirection: "column" }, children: [_jsx("textarea", { value: entry.text, onChange: (e) => updateText(entry.id, e.target.value), onFocus: () => { updateSelection(entry.id); setEditingId(entry.id); }, onBlur: () => setEditingId((current) => (current === entry.id ? null : current)), spellCheck: false, placeholder: isSticky ? "Add note" : "Your paragraph text", style: { width: "100%", height: "100%", flex: 1, resize: "none", border: "none", background: "transparent", color: isSticky ? "#111827" : entry.color, outline: "none", padding: isSticky ? "16px 14px 18px" : "12px 12px", fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", fontSize: isSticky ? 14 : 24, lineHeight: isSticky ? 1.5 : 1.25, letterSpacing: isSticky ? "-0.01em" : "-0.02em" } }), _jsxs("div", { style: { padding: "0 14px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }, children: [_jsx("span", { style: { fontSize: 9, color: "rgba(17,24,39,0.54)", fontWeight: 700, letterSpacing: "0.08em" }, children: isSticky ? "AI NOTE" : "TEXT" }), _jsx("span", { style: { fontSize: 9, color: "rgba(17,24,39,0.42)", fontFamily: "ui-monospace, SFMono-Regular, monospace" }, children: "Drag to move" })] })] }), showPrimaryHandles && primarySelected ? _jsx("button", { type: "button", title: "Move", onPointerDown: (e) => { e.stopPropagation(); startMove(entry.id, getBoardPoint(e)); }, style: { position: "absolute", right: -20, top: 10, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(255,255,255,0.95)", boxShadow: "0 10px 24px rgba(15,23,42,0.14)", color: "#334155", display: "grid", placeItems: "center", cursor: "grab" }, children: _jsx(IconMove, {}) }) : null, showPrimaryHandles && primarySelected ? _jsx("button", { type: "button", title: "Resize", onPointerDown: (e) => { e.stopPropagation(); startResize(entry.id, "se", getBoardPoint(e)); }, style: { position: "absolute", right: -18, bottom: -18, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(255,255,255,0.95)", boxShadow: "0 10px 24px rgba(15,23,42,0.14)", color: "#334155", display: "grid", placeItems: "center", cursor: "nwse-resize" }, children: _jsx(IconResize, {}) }) : null] }, entry.id));
                                }), selectionOverlays.map((overlay) => {
                                    const dashed = overlay.type === "line" || overlay.type === "stroke";
                                    return _jsx("div", { style: { position: "absolute", left: overlay.bounds.x, top: overlay.bounds.y, width: overlay.bounds.w, height: overlay.bounds.h, border: dashed ? "1px dashed rgba(91,115,255,0.42)" : "1px solid rgba(91,115,255,0.42)", borderRadius: dashed ? 12 : 18, pointerEvents: "none", boxShadow: dashed ? "none" : "0 0 0 4px rgba(91,115,255,0.08)" } }, `selection-${overlay.id}`);
                                }), showPrimaryHandles && selectedElement && selectedElement.type === "line" ? (_jsxs(_Fragment, { children: [_jsx(BoardHandle, { left: selectedElement.x1 * size.width, top: selectedElement.y1 * size.height, onPointerDown: (e) => { e.stopPropagation(); startEndpoint(selectedElement.id, "start", getBoardPoint(e)); } }), _jsx(BoardHandle, { left: selectedElement.x2 * size.width, top: selectedElement.y2 * size.height, onPointerDown: (e) => { e.stopPropagation(); startEndpoint(selectedElement.id, "end", getBoardPoint(e)); } })] })) : null, liveGuide?.guideX != null ? _jsx("div", { style: { position: "absolute", left: liveGuide.guideX, top: 0, bottom: 0, width: 1, background: "linear-gradient(180deg, rgba(59,130,246,0), rgba(59,130,246,0.65), rgba(59,130,246,0))", pointerEvents: "none" } }) : null, liveGuide?.guideY != null ? _jsx("div", { style: { position: "absolute", top: liveGuide.guideY, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.65), rgba(59,130,246,0))", pointerEvents: "none" } }) : null, (dragState.kind === "draw-line" || dragState.kind === "endpoint") && liveGuide ? _jsxs("div", { style: { position: "absolute", left: clamp(liveGuide.x + 12, 16, (size.width || BOARD_W) - 160), top: clamp(liveGuide.y + 12, 16, (size.height || BOARD_H) - 64), zIndex: 10, background: "rgba(15,23,42,0.9)", color: "#fff", borderRadius: 999, padding: "8px 12px", boxShadow: "0 16px 30px rgba(15,23,42,0.18)", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: "0.02em", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }, children: [_jsxs("span", { children: [Math.round(liveGuide.angle), "deg"] }), _jsx("span", { style: { opacity: 0.65 }, children: "\u2022" }), _jsxs("span", { children: [Math.round(liveGuide.length), "px"] }), _jsx("span", { style: { opacity: 0.65 }, children: "\u2022" }), _jsx("span", { children: liveGuide.snapped ? "snapped" : "free" })] }) : null, marqueeBox ? _jsx("div", { style: { position: "absolute", left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h, border: "1px dashed rgba(65,84,214,0.65)", background: "rgba(91,115,255,0.08)", borderRadius: 16, pointerEvents: "none", boxShadow: "0 0 0 1px rgba(255,255,255,0.4) inset" } }) : null, _jsxs("div", { style: { position: "absolute", left: 18, top: 18, display: "flex", alignItems: "center", gap: 10, zIndex: 6, pointerEvents: "none" }, children: [_jsx("div", { style: { padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.84)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 8px 24px rgba(15,23,42,0.06)", fontSize: 11, color: "#334155", fontWeight: 600 }, children: isEditing ? "EDITING" : activeTool.toUpperCase() }), _jsx("div", { style: { padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,0.84)", border: "1px solid rgba(148,163,184,0.16)", boxShadow: "0 8px 24px rgba(15,23,42,0.06)", fontSize: 11, color: "#64748B" }, children: "Page 1" })] })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 16px", borderTop: "1px solid rgba(148,163,184,0.15)", background: "linear-gradient(180deg, rgba(248,250,252,0.92), rgba(255,255,255,0.98))" }, children: [_jsx("div", { style: { fontSize: 12, color: "#64748B" }, children: "Drag, draw, and add notes. Sticky notes are the only AI-readable content in this version." }), _jsx("div", { style: { padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(91,115,255,0.22)", background: "rgba(91,115,255,0.08)", color: "#4154D6", fontWeight: 700, fontSize: 12 }, children: "Page 1" })] })] }) }));
}
