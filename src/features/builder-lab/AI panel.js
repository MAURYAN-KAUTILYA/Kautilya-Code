import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from "react";
import { buildCommandReference } from "../../../shared/kautilya-commands.js";
/* ─── Constants ─── */
const VARIANTS = [
    { id: "812", label: "812", badge: "Free", color: "#6B7280" },
    { id: "812hybrid", label: "812 hybrid", badge: "Hybrid", color: "#3B82F6" },
    { id: "812+", label: "812+", badge: "Pro", color: "#9B2226" },
    { id: "812+hybrid", label: "812+ hybrid", badge: "Max", color: "#AE7C1A" },
];
const SECTIONS = ["Simple", "Think", "Chanakya Intelligence"];
const AI_MODES = ["Plan", "Build", "Ask"];
const SECURITY_OPTIONS = [
    { id: "strict", label: "Strict" },
    { id: "ask", label: "Ask Question and Permission (Recommended)" },
    { id: "risk", label: "Work as per agent (Risk)" },
];
const MODEL_SPOTLIGHTS = {
    "812+hybrid": {
        image: "https://i.postimg.cc/JhMmwRpQ/Gemini-Generated-Image-q8d950q8d950q8d9.png",
        eyebrow: "Frontier intelligence, full pipeline",
        title: "Introducing 812+ hybrid",
        summary: "The cinematic flagship lane for deep builds, live context, and high-stakes orchestration.",
        body: "812+ hybrid is the most expressive Kautilya experience. It blends premium reasoning with the full pipeline rhythm, so complex work feels deliberate, calm, and astonishingly fast.",
        footer: "Best for multi-file implementation, product strategy, and sessions where you want the whole system awake.",
        accent: "#AE7C1A",
    },
    "812+": {
        image: "https://i.postimg.cc/cCpCwV0P/Gemini-Generated-Image-b7qtblb7qtblb7qt.png",
        eyebrow: "Pure premium reasoning",
        title: "Introducing 812+",
        summary: "A focused direct model for premium answers when you want sharp thought without the heavier orchestration layer.",
        body: "812+ feels refined, crisp, and intentional. It is ideal for concentrated asks, premium drafting, and clean one-model sessions where speed and polish both matter.",
        footer: "Pipeline is not available on this model.",
        accent: "#9B2226",
    },
    "812hybrid": {
        image: "https://i.postimg.cc/FRfTDnMk/812-hy.png",
        eyebrow: "Balanced hybrid flow",
        title: "Introducing 812 hybrid",
        summary: "The agile everyday builder that mixes live context with a lighter orchestration footprint.",
        body: "812 hybrid is the sweet spot for most sessions. It feels collaborative, responsive, and modern, with enough hybrid power to stay smart while still moving lightly.",
        footer: "Best for steady implementation, web-aware guidance, and long editing sessions that need balance over brute force.",
        accent: "#3B82F6",
    },
    "812": {
        image: "https://i.postimg.cc/BQ1GXmbV/812.png",
        eyebrow: "Essential core model",
        title: "Introducing 812",
        summary: "A fast, minimal lane for quick asks, light drafting, and budget-friendly momentum.",
        body: "812 is intentionally lean. It is the model you reach for when you want simple execution, quick iteration, and an elegant baseline that still feels unmistakably Kautilya.",
        footer: "Best for lightweight prompts, rapid notes, and clean low-overhead work.",
        accent: "#9CA3AF",
    },
};
const COMMAND_REFERENCE = buildCommandReference();
/* ─── Design Tokens ─── */
const T = {
    bg: "#0a0a0f",
    bgCard: "rgba(18,18,26,0.65)",
    bgElevated: "#111118",
    bgHover: "rgba(255,255,255,0.05)",
    bgWarmSubtle: "rgba(255,100,50,0.03)",
    bgWarmHover: "rgba(255,140,60,0.07)",
    border: "rgba(255,255,255,0.06)",
    borderSubtle: "rgba(255,255,255,0.03)",
    borderMed: "rgba(255,255,255,0.10)",
    borderWarm: "rgba(200,100,50,0.08)",
    text: "#f5f5f7",
    textSec: "#a1a1aa",
    textTer: "#52525b",
    accent: "#bf9b30",
    accentRaig: "#8b5cf6",
    accentRaigGlow: "rgba(139,92,246,0.25)",
    commandHash: "#22d3ee",
    commandSlash: "#a78bfa",
    font: "'SF Pro Display','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    mono: "'SF Mono','JetBrains Mono','Fira Code',monospace",
    radius: 14,
    radiusSm: 8,
    radiusPill: 999,
    shadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 1px rgba(255,255,255,0.05)",
    shadowSm: "0 2px 8px rgba(0,0,0,0.3)",
    transition: "all 0.3s cubic-bezier(.25,.1,.25,1)",
    transitionFast: "all 0.2s cubic-bezier(.25,.1,.25,1)",
    blur: "blur(24px)",
};
/* ─── Inline SVG Icons (monochrome, thin, Apple-style) ─── */
const Ico = ({ d, size = 16, sw = 1.3 }) => (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" }, children: _jsx("path", { d: d }) }));
const ISettings = () => _jsx(Ico, { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", sw: 1.2 });
const IEdit = () => _jsx(Ico, { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z", sw: 1.2 });
const IChevD = () => _jsx(Ico, { d: "m6 9 6 6 6-6", size: 12, sw: 1.4 });
const IClose = () => _jsx(Ico, { d: "M18 6 6 18 M6 6l12 12", size: 13, sw: 1.35 });
const ISend = () => _jsx(Ico, { d: "m22 2-7 20-4-9-9-4 20-7z M22 2 11 13", sw: 1.2 });
const IMore = () => (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "currentColor", stroke: "none", style: { display: "block" }, children: [_jsx("circle", { cx: "12", cy: "5", r: "1.5" }), _jsx("circle", { cx: "12", cy: "12", r: "1.5" }), _jsx("circle", { cx: "12", cy: "19", r: "1.5" })] }));
const IParallel = () => _jsx(Ico, { d: "M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5", size: 13, sw: 1.2 });
const IShield = () => _jsx(Ico, { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", size: 13, sw: 1.2 });
const IOpenFile = () => _jsx(Ico, { d: "M14 3h7v7 M10 14 21 3 M21 10V3h-7 M5 5h5 M5 11h4 M5 17h6", size: 14, sw: 1.25 });
const ISpotlight = () => (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.35", strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" }, children: [_jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "4" }), _jsx("path", { d: "M12 7.7 13.35 11 16.7 12.35 13.35 13.7 12 17l-1.35-3.3L7.3 12.35 10.65 11 12 7.7Z" })] }));
const IAdd = () => _jsx(Ico, { d: "M12 5v14 M5 12h14", size: 15, sw: 1.35 });
const IUpload = () => _jsx(Ico, { d: "M12 16V5 M8 9l4-4 4 4 M5 19h14", size: 14, sw: 1.3 });
const ISketch = () => _jsx(Ico, { d: "M4 16.5 16.5 4a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z M13 6l5 5", size: 14, sw: 1.25 });
const ISticky = () => _jsx(Ico, { d: "M5 4h11a3 3 0 0 1 3 3v7l-5 5H8a3 3 0 0 1-3-3z M14 19v-4a1 1 0 0 1 1-1h4", size: 14, sw: 1.2 });
const IFigma = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", style: { display: "block" }, children: [_jsx("path", { d: "M9 3h6a3 3 0 0 1 0 6H9V3Z", fill: "currentColor", opacity: "0.95" }), _jsx("path", { d: "M9 9h6a3 3 0 1 1 0 6H9V9Z", fill: "currentColor", opacity: "0.78" }), _jsx("path", { d: "M9 15h3a3 3 0 1 1-3 3v-3Z", fill: "currentColor", opacity: "0.62" }), _jsx("path", { d: "M9 3v6H6a3 3 0 1 1 0-6h3Z", fill: "currentColor", opacity: "0.72" }), _jsx("path", { d: "M9 9v6H6a3 3 0 1 1 0-6h3Z", fill: "currentColor", opacity: "0.48" })] }));
const INotion = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", style: { display: "block" }, children: [_jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2.5", stroke: "currentColor", strokeWidth: "1.7" }), _jsx("path", { d: "M9 17V8.4l6 8.6V7", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" })] }));
const ILinear = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", style: { display: "block" }, children: [_jsx("path", { d: "M6 6h11", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }), _jsx("path", { d: "M6 12h8", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }), _jsx("path", { d: "M6 18h11", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })] }));
const IDocGem = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", style: { display: "block" }, children: [_jsx("path", { d: "m12 3 7 4v10l-7 4-7-4V7l7-4Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("path", { d: "m12 7 3 2v4l-3 2-3-2V9l3-2Z", fill: "currentColor", opacity: "0.85" })] }));
/* ─── Kautilya Logo ─── */
const KautilyaLogo = ({ size = 80, opacity = 0.03 }) => (_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, fill: "none", viewBox: "0 0 250 250", style: { opacity }, children: _jsx("path", { d: "m124.7 5.63c-0.45-0.62-1.24-0.62-1.69 0l-82.06 118.2c-0.32 0.46-0.32 1.13 0 1.59l82.3 118.9c0.44 0.64 1.25 0.64 1.7 0l83.51-119c0.33-0.46 0.33-1.11 0-1.57l-83.76-118.2zm0.05 3.17 24.04 35-24.04-20.02v-14.98zm-1.7 0.01v14.97l-22.74 19.69 22.74-34.66zm1.7 18.6 28.68 21.72 12.52 17.23-41.2-18.64v-20.31zm-1.7 0v20.31l-38.89 18.03 12.34-17.06 26.55-21.28zm1.7 22.66 43.48 19.64 11.55 17.04-55.03-18.28v-18.4zm-1.7 0v18.4l-53.63 17.25 13-16.81 40.63-18.84zm1.7 20.23 57.72 19.04 11.79 18.63-69.51-19.31v-18.36zm-1.7 0v18.36l-67.86 18.47 12.36-18.25 55.5-18.58zm1.7 20.18 71.2 20.13 9.24 12.4-80.44-13.09v-19.44zm-1.7 0v19.44l-78.77 13.09 8.43-12.45 70.34-20.08zm1.7 21.24 79.01 13.01-26.83 14.21-52.18-15.02v-12.2zm-1.7 0v12.2l-52.18 15.02-25.82-14.11 78-13.11zm1.7 14.07 48.66 14.59-18.53 10.03-30.13-10.85v-13.77zm-1.7 0v13.77l-28.63 12.12-20.51-10.99 49.14-14.9zm80.68 1.99-30.23 42.54-49.07 23.6v-24.21l79.3-41.93zm-158.1 0.33 77.46 42.01v23.69l-49.4-23.74-28.06-41.96zm79.16 13.27 27.32 10.42-27.32 16.33v-26.75zm-1.7 0v26.69l-26.06-15.24 26.06-11.45zm48.85 31.53-16.89 23.68-0.36-1.48-30.22 20.83v-19.24l47.47-23.79zm-94.74 0.38 45.89 23.41v18.08l-28.72-19.69-0.49 1.3-16.68-23.1zm75.06 25.82-27.47 40.6v-21.57l27.47-19.03zm-56.46 0.72 27.29 18.92v21.57l-27.29-40.49z", fill: "#fff" }) }));
/* ─── Toggle Switch Component ─── */
const Toggle = ({ on, onToggle, label, note }) => (_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [_jsx("span", { style: { fontFamily: T.font, fontSize: 12, color: T.textSec, letterSpacing: "-0.01em" }, children: label }), note ? (_jsx("span", { style: { fontFamily: T.mono, fontSize: 8.5, color: T.textTer, letterSpacing: "0.05em", textTransform: "uppercase" }, children: note })) : null] }), _jsx("button", { onClick: onToggle, style: {
                width: 36,
                height: 20,
                borderRadius: T.radiusPill,
                border: "none",
                background: on ? "rgba(191,155,48,0.35)" : "rgba(255,255,255,0.08)",
                padding: 2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: on ? "flex-end" : "flex-start",
                transition: T.transition,
            }, children: _jsx("span", { style: {
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    background: on ? "#fff" : "rgba(255,255,255,0.3)",
                    display: "block",
                    transition: T.transition,
                    boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                } }) })] }));
/* ─── Command Launcher ─── */
const CommandLauncher = ({ onOpen, activeCount, }) => (_jsxs("button", { onClick: onOpen, style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flex: 1,
        minWidth: 0,
        padding: "0 10px",
        height: 28,
        borderRadius: 7,
        border: `1px solid ${T.border}`,
        background: "rgba(0,0,0,0.2)",
        boxShadow: "inset 0 1px 4px rgba(0,0,0,0.15)",
        backdropFilter: T.blur,
        color: T.textSec,
        transition: T.transition,
        cursor: "pointer",
    }, onMouseEnter: e => {
        e.currentTarget.style.background = T.bgWarmHover;
        e.currentTarget.style.transform = "translateY(-1px)";
    }, onMouseLeave: e => {
        e.currentTarget.style.background = "rgba(0,0,0,0.2)";
        e.currentTarget.style.transform = "none";
    }, children: [_jsx("span", { style: { color: T.commandSlash, fontSize: 11, fontFamily: T.font, marginTop: -1 }, children: "/" }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.02em", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: activeCount > 0 ? `${activeCount} command${activeCount > 1 ? "s" : ""} staged` : "Commands" }), _jsx("span", { style: { marginLeft: "auto", color: T.textTer, display: "flex" }, children: _jsx(IChevD, {}) })] }));
/* ─── Apple-style icon button ─── */
const IconBtn = ({ onClick, title, children }) => (_jsx("button", { onClick: onClick, title: title, style: {
        width: 32,
        height: 32,
        borderRadius: T.radiusSm,
        border: "none",
        background: "transparent",
        color: T.textTer,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: T.transition,
    }, onMouseEnter: e => {
        const el = e.currentTarget;
        el.style.background = T.bgWarmHover;
        el.style.color = T.textSec;
        el.style.transform = "scale(1.08)";
    }, onMouseLeave: e => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.color = T.textTer;
        el.style.transform = "scale(1)";
    }, children: children }));
/* ══════════════════════════════════════════════
   ██  AI PANEL COMPONENT  ██
   ══════════════════════════════════════════════ */
export default function AIPanel({ variant, section, medium, input, onInputChange, onSend, status, sending, messages, fileStatus, creditStatus, applyMode, onApplyModeChange, apiKeyInfo, onSetApiKey: _onSetApiKey, onVariantChange, onSectionChange, onMediumChange, parallelAgents, parallelStatuses, onParallelAgentToggle, attachments, sketchNotesCount, onOpenSketchBoard, onAttachFiles, onAttachImages, onRemoveAttachment, draftCommands, commandErrors, commandWarnings, canSend, commandSheetOpen, onCommandSheetOpenChange, onAddDraftCommand, onRemoveDraftCommand, onClose: _onClose, }) {
    /* ─── State ─── */
    const [modelMenuOpen, setModelMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
    const [importMenuOpen, setImportMenuOpen] = useState(false);
    const [showAdvancedModels, setShowAdvancedModels] = useState(true);
    const [expandedModel, setExpandedModel] = useState("812");
    const [selectedMode, setSelectedMode] = useState(medium);
    const [parallelMenuOpen, setParallelMenuOpen] = useState(false);
    const [securityMenuOpen, setSecurityMenuOpen] = useState(false);
    const [selectedSecurity, setSelectedSecurity] = useState("ask");
    const [claudeSkills, setClaudeSkills] = useState(false);
    const [modelSpotlight, setModelSpotlight] = useState(null);
    const panelRef = useRef(null);
    /* ─── Click-outside-to-close all menus ─── */
    const closeAll = useCallback(() => {
        setModelMenuOpen(false);
        setMoreMenuOpen(false);
        setAttachmentMenuOpen(false);
        setImportMenuOpen(false);
        setParallelMenuOpen(false);
        setSecurityMenuOpen(false);
    }, []);
    useEffect(() => {
        const handler = (e) => {
            // If clicking inside the panel but not on a menu-trigger, close all menus
            // The menus themselves stop propagation, triggers toggle, so this catches "elsewhere"
            const target = e.target;
            if (!target.closest("[data-menu]")) {
                closeAll();
            }
        };
        const el = panelRef.current;
        if (el)
            el.addEventListener("mousedown", handler);
        return () => { if (el)
            el.removeEventListener("mousedown", handler); };
    }, [closeAll]);
    useEffect(() => {
        setSelectedMode(medium);
    }, [medium]);
    /* ─── Derived ─── */
    const modelGroups = [
        { id: "812", label: "812", badge: "Free", color: "#6B7280" },
        { id: "812hybrid", label: "812 hybrid", badge: "Hybrid", color: "#3B82F6" },
        { id: "812+", label: "812+", badge: "Pro", color: "#9B2226", advanced: true },
        { id: "812+hybrid", label: "812+ hybrid", badge: "Max", color: "#AE7C1A", advanced: true },
    ];
    const visibleModels = modelGroups.filter(m => showAdvancedModels || !m.advanced);
    const selectedVariant = VARIANTS.find(v => v.id === variant) ?? VARIANTS[0];
    const creditColor = !creditStatus ? T.textTer : creditStatus.percentRemaining <= 10 ? "#FCA5A5" : "#86EFAC";
    const activeSpotlightId = (modelSpotlight ?? variant);
    const spotlightData = MODEL_SPOTLIGHTS[activeSpotlightId] ?? MODEL_SPOTLIGHTS["812"];
    const spotlightVariant = VARIANTS.find(v => v.id === activeSpotlightId) ?? selectedVariant;
    const parallelStatusLabel = (statusValue) => ({
        idle: "",
        requested: "requested",
        proposed: "proposed",
        awaiting_approval: "approval needed",
        allowed: "allowed",
        running: "running",
        completed: "completed",
        skipped: "skipped",
        denied: "denied",
        failed: "failed",
    }[statusValue] ?? statusValue);
    /* ─── Helpers ─── */
    const handleSend = () => {
        if (!canSend || sending)
            return;
        onSend();
    };
    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const handleModeChange = (mode) => {
        setSelectedMode(prev => prev === mode ? "" : mode);
        onMediumChange(mode);
    };
    const openModelSpotlight = (modelId) => {
        closeAll();
        setModelSpotlight(modelId);
    };
    /* ─── Render ─── */
    return (_jsxs("div", { ref: panelRef, style: {
            width: 340,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(160deg, #0f0f13 0%, #050508 100%)",
            borderLeft: `1px solid ${T.borderSubtle}`,
            fontFamily: T.font,
            height: "100%",
            overflow: "hidden",
            position: "relative",
        }, children: [_jsxs("div", { style: {
                    height: 46,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px 0 16px",
                    borderBottom: `1px solid ${T.border}`,
                    flexShrink: 0,
                    background: `linear-gradient(180deg, rgba(255,120,50,0.015) 0%, ${T.bg} 100%)`,
                }, children: [_jsx("span", { style: {
                            fontFamily: T.mono,
                            fontSize: 11,
                            color: T.accent,
                            letterSpacing: "0.12em",
                            fontWeight: 600,
                            textTransform: "uppercase",
                        }, children: "Kautilya" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 2 }, children: [_jsx(IconBtn, { onClick: () => { }, title: "Settings", children: _jsx(ISettings, {}) }), _jsx(IconBtn, { onClick: () => { closeAll(); onCommandSheetOpenChange(true); }, title: "Slash Commands", children: _jsx(IEdit, {}) })] })] }), _jsx("div", { style: { flex: 1, overflowY: "auto", padding: "16px 14px" }, children: messages.length === 0 ? (_jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        gap: 14,
                        userSelect: "none",
                    }, children: [_jsx(KautilyaLogo, { size: 90, opacity: 0.035 }), _jsx("span", { style: {
                                fontFamily: T.font,
                                fontSize: 12,
                                color: T.textTer,
                                letterSpacing: "-0.01em",
                                fontWeight: 400,
                            }, children: "Start a conversation\u2026" }), _jsxs("div", { style: { marginTop: 8, textAlign: "center" }, children: [_jsx("div", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.04em" }, children: status }), _jsxs("div", { style: { fontFamily: T.mono, fontSize: 9, color: creditColor, letterSpacing: "0.04em", marginTop: 4 }, children: ["Credits: ", creditStatus ? `${creditStatus.percentRemaining}%` : "—"] })] }), apiKeyInfo && (_jsxs("div", { style: { fontFamily: T.mono, fontSize: 9, color: "rgba(134,239,172,0.5)", letterSpacing: "0.04em" }, children: [apiKeyInfo.provider, " \u00B7 ", apiKeyInfo.model, " \u00B7 ", apiKeyInfo.tier] }))] })) : (_jsxs("div", { children: [messages.map(msg => {
                            const roleColor = msg.role === "system" ? "#F59E0B" : msg.role === "user" ? T.accent : "#93C5FD";
                            return (_jsxs("div", { style: { marginBottom: 14, animation: "kFadeIn 0.3s ease" }, children: [_jsxs("div", { style: {
                                            fontFamily: T.mono,
                                            fontSize: 9,
                                            color: roleColor,
                                            letterSpacing: "0.06em",
                                            textTransform: "uppercase",
                                            marginBottom: 3,
                                        }, children: [msg.role, " ", msg.status ? `· ${msg.status}` : ""] }), msg.meta && (_jsxs("div", { style: { fontFamily: T.mono, fontSize: 8, color: T.textTer, letterSpacing: "0.04em", marginBottom: 4 }, children: [msg.meta.variant ?? "model", " \u00B7 ", msg.meta.section ?? "section", " \u00B7 ", msg.meta.medium ?? "medium"] })), Array.isArray(msg.meta?.commands) && msg.meta.commands.length > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }, children: msg.meta.commands.map((token) => (_jsx("span", { style: {
                                                display: "inline-flex",
                                                alignItems: "center",
                                                padding: "4px 7px",
                                                borderRadius: 999,
                                                border: "1px solid rgba(167,139,250,0.24)",
                                                background: "rgba(167,139,250,0.08)",
                                                color: "#C4B5FD",
                                                fontFamily: T.mono,
                                                fontSize: 8.5,
                                                letterSpacing: "0.04em",
                                            }, children: token }, token))) })) : null, Array.isArray(msg.meta?.attachments) && msg.meta.attachments.length > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }, children: msg.meta.attachments.map((attachment) => (_jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, border: attachment.kind === "image" ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(255,255,255,0.09)", background: attachment.kind === "image" ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.03)", color: attachment.kind === "image" ? "#BFDBFE" : T.textSec, fontFamily: T.mono, fontSize: 8.5, letterSpacing: "0.03em" }, children: [_jsx("span", { style: { display: "flex", color: attachment.kind === "image" ? "#60A5FA" : T.textTer }, children: attachment.kind === "image" ? _jsx(IUpload, {}) : _jsx(IOpenFile, {}) }), _jsx("span", { children: attachment.name })] }, attachment.id))) })) : null, Number(msg.meta?.sketchNotesCount) > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }, children: _jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(14,165,233,0.26)", background: "rgba(14,165,233,0.10)", color: "#BAE6FD", fontFamily: T.mono, fontSize: 8.5, letterSpacing: "0.03em" }, children: [_jsx("span", { style: { display: "flex", color: "#7DD3FC" }, children: _jsx(ISticky, {}) }), _jsxs("span", { children: [Number(msg.meta?.sketchNotesCount), " sketch note", Number(msg.meta?.sketchNotesCount) === 1 ? "" : "s"] })] }) })) : null, _jsx("div", { style: {
                                            whiteSpace: "pre-wrap",
                                            fontSize: 12.5,
                                            color: T.text,
                                            lineHeight: 1.65,
                                            fontFamily: T.font,
                                            letterSpacing: "-0.01em",
                                        }, children: msg.content })] }, msg.id));
                        }), Object.keys(fileStatus).length > 0 && (_jsx("div", { style: { marginTop: 8 }, children: Object.entries(fileStatus).map(([file, s]) => (_jsxs("div", { style: {
                                    fontFamily: T.mono, fontSize: 9,
                                    color: s === "done" ? "#86EFAC" : s === "in_progress" ? "#FBBF24" : T.textTer,
                                    letterSpacing: "0.04em",
                                }, children: [file, " \u00B7 ", s] }, file))) }))] })) }), _jsx("div", { style: { padding: "8px 10px 6px", borderTop: `1px solid ${T.border}`, position: "relative" }, children: _jsxs("div", { style: {
                        position: "relative",
                        border: `1px solid ${T.borderMed}`,
                        borderRadius: T.radius,
                        background: "linear-gradient(135deg, rgba(24,24,32,0.65) 0%, rgba(14,14,20,0.8) 100%)",
                        backdropFilter: T.blur,
                        WebkitBackdropFilter: T.blur,
                        padding: "10px 12px 10px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                    }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }, "data-menu": "model", children: [_jsxs("button", { onClick: () => { setModelMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }, "data-menu": "model", style: {
                                        height: 26,
                                        padding: "0 10px",
                                        borderRadius: T.radiusSm,
                                        border: `1px solid ${T.borderMed}`,
                                        background: modelMenuOpen ? "rgba(255,255,255,0.05)" : "transparent",
                                        color: T.textSec,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontFamily: T.mono,
                                        fontSize: 10,
                                        cursor: "pointer",
                                        transition: T.transition,
                                    }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: e => { e.currentTarget.style.background = modelMenuOpen ? "rgba(255,255,255,0.05)" : "transparent"; e.currentTarget.style.transform = "none"; }, children: [_jsx("span", { style: { color: T.text, fontWeight: 500 }, children: selectedVariant.label }), _jsx("span", { style: {
                                                fontSize: 8, padding: "1px 5px", borderRadius: 4,
                                                background: `${selectedVariant.color}18`, color: selectedVariant.color,
                                                border: `1px solid ${selectedVariant.color}25`, fontWeight: 600,
                                            }, children: selectedVariant.badge }), _jsx(IChevD, {})] }), _jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        openModelSpotlight(selectedVariant.id);
                                    }, title: `Open ${selectedVariant.label} model card`, style: {
                                        width: 26,
                                        height: 26,
                                        borderRadius: 8,
                                        border: `1px solid ${selectedVariant.color}35`,
                                        background: `linear-gradient(135deg, ${selectedVariant.color}18 0%, rgba(255,255,255,0.03) 100%)`,
                                        color: selectedVariant.color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        transition: T.transition,
                                        boxShadow: `inset 0 1px 0 ${selectedVariant.color}15`,
                                    }, onMouseEnter: e => {
                                        e.currentTarget.style.transform = "translateY(-1px) scale(1.04)";
                                        e.currentTarget.style.boxShadow = `0 10px 24px ${selectedVariant.color}20, inset 0 1px 0 ${selectedVariant.color}25`;
                                    }, onMouseLeave: e => {
                                        e.currentTarget.style.transform = "none";
                                        e.currentTarget.style.boxShadow = `inset 0 1px 0 ${selectedVariant.color}15`;
                                    }, children: _jsx(ISpotlight, {}) }), _jsxs("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer }, children: ["/ ", section] })] }), modelMenuOpen && (_jsxs("div", { "data-menu": "model", style: {
                                position: "absolute", left: 0, right: 0, bottom: "calc(100% + 6px)",
                                background: "rgba(17,17,24,0.75)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                                border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 60,
                                overflow: "hidden", boxShadow: T.shadow,
                                animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom center",
                            }, children: [_jsxs("div", { style: {
                                        padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                    }, children: [_jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }, children: "Model Architecture" }), _jsx(Toggle, { on: showAdvancedModels, onToggle: () => setShowAdvancedModels(v => !v), label: "" })] }), _jsx("div", { style: { maxHeight: 220, overflowY: "auto" }, children: visibleModels.map(model => {
                                        const expanded = expandedModel === model.id;
                                        return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 0" }, children: [_jsxs("button", { onClick: () => setExpandedModel(prev => prev === model.id ? "" : model.id), style: {
                                                                width: "100%", border: "none",
                                                                background: variant === model.id ? "rgba(255,255,255,0.04)" : "transparent",
                                                                color: variant === model.id ? T.text : T.textSec,
                                                                display: "flex", alignItems: "center", gap: 8,
                                                                padding: "8px 10px", fontFamily: T.mono, fontSize: 11,
                                                                cursor: "pointer", textAlign: "left", transition: T.transition,
                                                                borderRadius: T.radiusSm,
                                                            }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; }, onMouseLeave: e => { e.currentTarget.style.background = variant === model.id ? "rgba(255,255,255,0.04)" : "transparent"; }, children: [_jsx("span", { style: { transform: expanded ? "rotate(0)" : "rotate(-90deg)", transition: T.transition, display: "flex" }, children: _jsx(IChevD, {}) }), _jsx("span", { children: model.label }), _jsx("span", { style: {
                                                                        fontSize: 8, padding: "1px 5px", borderRadius: 4,
                                                                        background: `${model.color}18`, color: model.color,
                                                                        border: `1px solid ${model.color}25`, marginLeft: "auto",
                                                                    }, children: model.badge })] }), _jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                openModelSpotlight(model.id);
                                                            }, title: `Open ${model.label} model card`, style: {
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: 8,
                                                                border: `1px solid ${model.color}30`,
                                                                background: `linear-gradient(135deg, ${model.color}14 0%, rgba(255,255,255,0.02) 100%)`,
                                                                color: model.color,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                cursor: "pointer",
                                                                transition: T.transition,
                                                                flexShrink: 0,
                                                            }, onMouseEnter: e => {
                                                                e.currentTarget.style.transform = "translateY(-1px) scale(1.04)";
                                                                e.currentTarget.style.boxShadow = `0 10px 24px ${model.color}16`;
                                                            }, onMouseLeave: e => {
                                                                e.currentTarget.style.transform = "none";
                                                                e.currentTarget.style.boxShadow = "none";
                                                            }, children: _jsx(ISpotlight, {}) })] }), expanded && (_jsx("div", { style: { padding: "2px 12px 8px 36px", display: "flex", flexDirection: "column", gap: 1 }, children: SECTIONS.map(entry => (_jsxs("button", { onClick: () => { onVariantChange(model.id); onSectionChange(entry); setModelMenuOpen(false); }, style: {
                                                            border: "none",
                                                            background: variant === model.id && section === entry ? "rgba(191,155,48,0.08)" : "transparent",
                                                            color: variant === model.id && section === entry ? T.text : T.textTer,
                                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                                            padding: "5px 8px", borderRadius: 6,
                                                            fontFamily: T.font, fontSize: 11, cursor: "pointer", textAlign: "left", transition: T.transition,
                                                        }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; }, onMouseLeave: e => { e.currentTarget.style.background = variant === model.id && section === entry ? "rgba(191,155,48,0.08)" : "transparent"; }, children: [_jsx("span", { children: entry }), variant === model.id && section === entry && _jsx("span", { style: { color: T.accent, fontSize: 12 }, children: "\u2713" })] }, `${model.id}-${entry}`))) }))] }, model.id));
                                    }) })] })), _jsxs("div", { style: {
                                display: "flex", alignItems: "center", gap: 3, marginBottom: 10,
                                background: "rgba(0,0,0,0.2)", borderRadius: T.radiusSm, padding: 3,
                                boxShadow: "inset 0 1px 4px rgba(0,0,0,0.2)", border: `1px solid ${T.borderSubtle}`
                            }, children: [AI_MODES.map(mode => {
                                    const active = selectedMode === mode;
                                    return (_jsx("button", { onClick: () => handleModeChange(mode), style: {
                                            flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
                                            background: active ? "rgba(255,255,255,0.08)" : "transparent",
                                            color: active ? T.text : T.textTer,
                                            fontFamily: T.font, fontSize: 11, fontWeight: active ? 500 : 400,
                                            cursor: "pointer", transition: T.transition,
                                            boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                                        }, onMouseEnter: e => { if (!active)
                                            e.currentTarget.style.background = T.bgHover; }, onMouseLeave: e => { if (!active)
                                            e.currentTarget.style.background = "transparent"; }, children: mode }, mode));
                                }), (() => {
                                    const active = selectedMode === "Raigbait";
                                    return (_jsx("button", { onClick: () => handleModeChange("Raigbait"), style: {
                                            flex: 1, padding: "6px 0", borderRadius: 6,
                                            border: active ? `1px solid rgba(139,92,246,0.5)` : "1px solid rgba(139,92,246,0.15)",
                                            background: active
                                                ? `linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))`
                                                : "transparent",
                                            color: active ? "#c4b5fd" : "rgba(139,92,246,0.6)",
                                            fontFamily: T.font, fontSize: 11, fontWeight: 600,
                                            cursor: "pointer", transition: T.transition,
                                            boxShadow: active ? `0 0 14px ${T.accentRaigGlow}` : "none",
                                        }, onMouseEnter: e => {
                                            if (!active) {
                                                e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                                                e.currentTarget.style.color = "#c4b5fd";
                                            }
                                        }, onMouseLeave: e => {
                                            if (!active) {
                                                e.currentTarget.style.background = "transparent";
                                                e.currentTarget.style.color = "rgba(139,92,246,0.5)";
                                            }
                                        }, children: "\u2726 Raigbait" }));
                                })()] }), _jsx("textarea", { value: input, onChange: e => onInputChange(e.target.value), onKeyDown: handleKey, placeholder: "Ask Kautilya anything, @ to add files(from editor), ", rows: 2, style: {
                                width: "100%",
                                padding: "10px 10px",
                                background: "rgba(0,0,0,0.25)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                border: `1px solid ${T.borderSubtle}`,
                                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)",
                                borderRadius: T.radiusSm,
                                resize: "none",
                                outline: "none",
                                color: T.text,
                                fontSize: 13,
                                lineHeight: 1.55,
                                fontFamily: T.font,
                                letterSpacing: "-0.01em",
                                boxSizing: "border-box",
                                caretColor: T.accent,
                                transition: T.transition,
                            }, onFocus: e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }, onBlur: e => { e.currentTarget.style.borderColor = T.borderSubtle; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; } }), attachments.length > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }, children: attachments.map((attachment) => (_jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, border: attachment.kind === "image" ? "1px solid rgba(59,130,246,0.24)" : "1px solid rgba(255,255,255,0.08)", background: attachment.kind === "image" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.035)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }, children: [_jsx("span", { style: { display: "flex", color: attachment.kind === "image" ? "#60A5FA" : T.textTer }, children: attachment.kind === "image" ? _jsx(IUpload, {}) : _jsx(IOpenFile, {}) }), _jsx("span", { style: { fontFamily: T.font, fontSize: 11, color: T.textSec, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: attachment.name }), _jsx("button", { onClick: () => onRemoveAttachment(attachment.id), style: { border: "none", background: "transparent", color: T.textTer, cursor: "pointer", display: "flex", padding: 0 }, children: _jsx(IClose, {}) })] }, attachment.id))) })) : null, sketchNotesCount > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: attachments.length > 0 ? 8 : 10 }, children: _jsxs("button", { onClick: onOpenSketchBoard, style: {
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 7,
                                    padding: "7px 11px",
                                    borderRadius: 999,
                                    border: "1px solid rgba(14,165,233,0.22)",
                                    background: "rgba(14,165,233,0.08)",
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                                    color: "#E0F2FE",
                                    cursor: "pointer",
                                }, children: [_jsx("span", { style: { display: "flex", color: "#7DD3FC" }, children: _jsx(ISticky, {}) }), _jsxs("span", { style: { fontFamily: T.font, fontSize: 11, color: "#E0F2FE" }, children: [sketchNotesCount, " sketch note", sketchNotesCount === 1 ? "" : "s", " attached"] })] }) })) : null, draftCommands.length > 0 ? (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }, children: draftCommands.map((command) => (_jsxs("div", { style: {
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 7,
                                    padding: "7px 10px",
                                    borderRadius: 999,
                                    border: command.recognized
                                        ? command.tier === "elite"
                                            ? "1px solid rgba(191,155,48,0.24)"
                                            : command.tier === "sentinel"
                                                ? "1px solid rgba(244,63,94,0.24)"
                                                : "1px solid rgba(167,139,250,0.24)"
                                        : "1px solid rgba(248,113,113,0.28)",
                                    background: command.recognized
                                        ? command.tier === "elite"
                                            ? "rgba(191,155,48,0.08)"
                                            : command.tier === "sentinel"
                                                ? "rgba(244,63,94,0.08)"
                                                : "rgba(167,139,250,0.08)"
                                        : "rgba(239,68,68,0.08)",
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                                }, children: [_jsx("span", { style: { fontFamily: T.mono, fontSize: 10, color: command.recognized ? (command.tier === "elite" ? "#FDE68A" : command.tier === "sentinel" ? "#FDA4AF" : "#C4B5FD") : "#FCA5A5" }, children: command.token }), _jsx("span", { style: { fontFamily: T.font, fontSize: 11, color: command.recognized ? T.textSec : "#FCA5A5" }, children: command.label }), _jsx("button", { onClick: () => onRemoveDraftCommand(command.name), style: { border: "none", background: "transparent", color: T.textTer, cursor: "pointer", display: "flex", padding: 0 }, children: _jsx(IClose, {}) })] }, command.name))) })) : null, commandErrors.length > 0 ? (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }, children: commandErrors.map((message) => (_jsx("div", { style: { fontFamily: T.font, fontSize: 10.5, color: "#FCA5A5", lineHeight: 1.45 }, children: message }, message))) })) : null, commandWarnings.length > 0 ? (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }, children: commandWarnings.map((message) => (_jsx("div", { style: { fontFamily: T.font, fontSize: 10.5, color: "#FCD34D", lineHeight: 1.45 }, children: message }, message))) })) : null, _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 8 }, children: [_jsx("div", { style: {
                                        display: "flex", borderRadius: 6, border: `1px solid ${T.border}`, overflow: "hidden", flexShrink: 0,
                                    }, children: ["preview", "write"].map(mode => (_jsx("button", { onClick: () => onApplyModeChange(mode), style: {
                                            border: "none",
                                            background: applyMode === mode ? "rgba(255,255,255,0.08)" : "transparent",
                                            color: applyMode === mode ? T.text : T.textTer,
                                            padding: "3px 8px", fontFamily: T.mono, fontSize: 9,
                                            cursor: "pointer", transition: T.transition, textTransform: "capitalize",
                                        }, onMouseEnter: e => { if (applyMode !== mode)
                                            e.currentTarget.style.background = T.bgHover; }, onMouseLeave: e => { if (applyMode !== mode)
                                            e.currentTarget.style.background = "transparent"; }, children: mode }, mode))) }), _jsx(CommandLauncher, { onOpen: () => onCommandSheetOpenChange(true), activeCount: draftCommands.length }), _jsxs("div", { style: { position: "relative", flexShrink: 0 }, "data-menu": "attach", children: [_jsx("button", { onClick: () => { setAttachmentMenuOpen(v => !v); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }, "data-menu": "attach", style: { width: 28, height: 28, borderRadius: 7, border: "none", background: attachmentMenuOpen ? "rgba(255,255,255,0.06)" : "transparent", color: attachmentMenuOpen ? T.textSec : T.textTer, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: T.transition }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.08)"; }, onMouseLeave: e => { e.currentTarget.style.background = attachmentMenuOpen ? "rgba(255,255,255,0.06)" : "transparent"; e.currentTarget.style.color = attachmentMenuOpen ? T.textSec : T.textTer; e.currentTarget.style.transform = "scale(1)"; }, children: _jsx(IAdd, {}) }), attachmentMenuOpen && (_jsxs("div", { "data-menu": "attach", style: { position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 254, background: "rgba(17,17,24,0.82)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur, border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 80, overflow: "hidden", boxShadow: T.shadow, animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right" }, children: [_jsx("div", { style: { padding: "10px 14px", borderBottom: `1px solid ${T.border}` }, children: _jsx("div", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.08em", textTransform: "uppercase" }, children: "Attach & Import" }) }), _jsxs("div", { style: { padding: 10, display: "flex", flexDirection: "column", gap: 6 }, children: [_jsxs("button", { onClick: () => { onOpenSketchBoard(); setAttachmentMenuOpen(false); }, style: { width: "100%", border: "1px solid rgba(191,155,48,0.28)", borderRadius: 12, background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(160,196,255,0.12) 28%, rgba(191,155,48,0.12) 100%)", color: "#F8FAFC", padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: "0 10px 28px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.28)", overflow: "hidden", position: "relative" }, children: [_jsx("span", { style: { position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 48%), radial-gradient(circle at bottom right, rgba(14,165,233,0.16), transparent 42%)", pointerEvents: "none" } }), _jsxs("span", { style: { display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12.5, fontWeight: 500, position: "relative", zIndex: 1 }, children: [_jsx("span", { style: { display: "flex", color: "#FDE68A" }, children: _jsx(ISketch, {}) }), "Sketch your design"] }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.76)", position: "relative", zIndex: 1 }, children: "BOARD" })] }), _jsxs("button", { onClick: () => { onAttachFiles(); setAttachmentMenuOpen(false); }, style: { width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, background: "rgba(255,255,255,0.03)", color: T.text, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }, children: [_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 8, fontFamily: T.font, fontSize: 12 }, children: [_jsx("span", { style: { display: "flex", color: T.accent }, children: _jsx(IOpenFile, {}) }), "Upload files"] }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer }, children: "FILES ONLY" })] }), _jsxs("button", { onClick: () => { onAttachImages(); setAttachmentMenuOpen(false); }, style: { width: "100%", border: "1px solid rgba(59,130,246,0.18)", borderRadius: 10, background: "rgba(59,130,246,0.08)", color: "#DBEAFE", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }, children: [_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 8, fontFamily: T.font, fontSize: 12 }, children: [_jsx("span", { style: { display: "flex", color: "#60A5FA" }, children: _jsx(IUpload, {}) }), "Upload image"] }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: "rgba(191,219,254,0.72)" }, children: "IMAGE" })] }), _jsxs("button", { onClick: () => setImportMenuOpen(v => !v), style: { width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, background: importMenuOpen ? "rgba(191,155,48,0.07)" : "rgba(255,255,255,0.025)", color: T.textSec, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }, children: [_jsx("span", { style: { fontFamily: T.font, fontSize: 12 }, children: "More imports" }), _jsx(IChevD, {})] }), importMenuOpen ? (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }, children: [[
                                                                    { id: "figma", label: "Import from Figma", tone: "rgba(245,158,11,0.10)", icon: _jsx(IFigma, {}) },
                                                                    { id: "notion", label: "Import from Notion", tone: "rgba(255,255,255,0.03)", icon: _jsx(INotion, {}) },
                                                                    { id: "linear", label: "Import from Linear", tone: "rgba(99,102,241,0.10)", icon: _jsx(ILinear, {}) },
                                                                ].map((item) => (_jsxs("button", { disabled: true, style: { width: "100%", border: `1px solid ${T.border}`, borderRadius: 11, background: item.tone, color: T.textSec, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "not-allowed", opacity: 0.9 }, children: [_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12 }, children: [_jsx("span", { style: { display: "flex" }, children: item.icon }), item.label] }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer }, children: "SOON" })] }, item.id))), _jsxs("button", { disabled: true, style: { width: "100%", border: "1px solid rgba(191,155,48,0.28)", borderRadius: 12, background: "linear-gradient(135deg, rgba(191,155,48,0.16) 0%, rgba(17,17,24,0.92) 100%)", color: "#F7E7B1", padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "not-allowed", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }, children: [_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12.5, fontWeight: 500 }, children: [_jsx("span", { style: { display: "flex", color: "#F5D375" }, children: _jsx(IDocGem, {}) }), "Import from Kautilya Docs"] }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: "rgba(247,231,177,0.72)" }, children: "PREMIUM SOON" })] })] })) : null] })] }))] }), _jsxs("div", { style: { position: "relative", flexShrink: 0 }, "data-menu": "more", children: [_jsx("button", { onClick: () => { setMoreMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }, "data-menu": "more", style: {
                                                width: 28, height: 28, borderRadius: 7, border: "none",
                                                background: "transparent", color: T.textTer,
                                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                                transition: T.transition,
                                            }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.1)"; }, onMouseLeave: e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textTer; e.currentTarget.style.transform = "scale(1)"; }, children: _jsx(IMore, {}) }), moreMenuOpen && (_jsxs("div", { "data-menu": "more", style: {
                                                position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 210,
                                                background: "rgba(17,17,24,0.75)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                                                border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
                                                overflow: "hidden", boxShadow: T.shadow,
                                                animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right",
                                            }, children: [_jsx("div", { style: { padding: "9px 14px", borderBottom: `1px solid ${T.border}` }, children: _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }, children: "Actions" }) }), _jsx("div", { style: { padding: "6px 12px" }, children: _jsx("button", { onClick: () => { onAddDraftCommand("contextrevise"); setMoreMenuOpen(false); }, style: {
                                                            width: "100%", padding: "7px 12px", borderRadius: T.radiusSm,
                                                            border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.025)",
                                                            color: T.text, fontFamily: T.font, fontSize: 11.5,
                                                            cursor: "pointer", transition: T.transition, textAlign: "center",
                                                        }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.transform = "none"; }, children: "Context Revise" }) }), _jsx("div", { style: { padding: "0 12px" }, children: _jsx(Toggle, { on: claudeSkills, onToggle: () => setClaudeSkills(v => !v), label: "Claude Skills" }) }), _jsx("div", { style: { padding: "0 12px 6px" }, children: _jsx(Toggle, { on: draftCommands.some((command) => command.name === "kautilyarules"), onToggle: () => {
                                                            const active = draftCommands.some((command) => command.name === "kautilyarules");
                                                            if (active)
                                                                onRemoveDraftCommand("kautilyarules");
                                                            else
                                                                onAddDraftCommand("kautilyarules");
                                                        }, label: "Kautilya Rules" }) })] }))] }), _jsx("button", { onClick: handleSend, disabled: !canSend || sending, style: {
                                        width: 32, height: 32, borderRadius: T.radiusSm,
                                        border: "none", flexShrink: 0,
                                        cursor: canSend && !sending ? "pointer" : "default",
                                        background: canSend && !sending
                                            ? "linear-gradient(135deg, #f5f5f7, #e5e5ea)"
                                            : "rgba(255,255,255,0.05)",
                                        color: canSend && !sending ? "#111" : T.textTer,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: T.transition,
                                        boxShadow: canSend && !sending ? "0 2px 8px rgba(255,255,255,0.08)" : "none",
                                    }, onMouseEnter: e => { if (canSend && !sending)
                                        e.currentTarget.style.transform = "scale(1.08)"; }, onMouseLeave: e => { e.currentTarget.style.transform = "scale(1)"; }, children: _jsx(ISend, {}) })] })] }) }), _jsxs("div", { style: {
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "5px 10px 10px", position: "relative",
                }, children: [_jsxs("div", { style: { position: "relative" }, "data-menu": "parallel", children: [_jsxs("button", { onClick: () => { setParallelMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setSecurityMenuOpen(false); }, "data-menu": "parallel", style: {
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "5px 10px", borderRadius: T.radiusSm,
                                    border: `1px solid ${T.border}`, background: "transparent",
                                    color: T.textTer, fontFamily: T.mono, fontSize: 9,
                                    cursor: "pointer", transition: T.transition,
                                }, onMouseEnter: e => { e.currentTarget.style.borderColor = T.borderMed; e.currentTarget.style.color = T.textSec; e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textTer; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }, children: [_jsx(IParallel, {}), _jsx("span", { children: "Parallel" }), _jsx(IChevD, {})] }), parallelMenuOpen && (_jsxs("div", { "data-menu": "parallel", style: {
                                    position: "absolute", left: 0, bottom: "calc(100% + 6px)", width: 200,
                                    background: "rgba(17,17,24,0.75)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                                    border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
                                    overflow: "hidden", boxShadow: T.shadow,
                                    animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom left",
                                }, children: [_jsx("div", { style: { padding: "8px 14px", borderBottom: `1px solid ${T.border}` }, children: _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }, children: "Parallel Agent" }) }), _jsxs("div", { style: { padding: "2px 14px 6px" }, children: [_jsx(Toggle, { on: parallelAgents.designInspiration, onToggle: () => onParallelAgentToggle("designInspiration", !parallelAgents.designInspiration), label: "Design Inspiration", note: parallelStatusLabel(parallelStatuses.designInspiration) }), _jsx(Toggle, { on: parallelAgents.webResearch, onToggle: () => onParallelAgentToggle("webResearch", !parallelAgents.webResearch), label: "Web Search", note: parallelStatusLabel(parallelStatuses.webResearch) })] })] }))] }), _jsxs("div", { style: { position: "relative" }, "data-menu": "security", children: [_jsxs("button", { onClick: () => { setSecurityMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); }, "data-menu": "security", style: {
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "5px 10px", borderRadius: T.radiusSm,
                                    border: `1px solid ${T.border}`, background: "transparent",
                                    color: T.textTer, fontFamily: T.mono, fontSize: 9,
                                    cursor: "pointer", transition: T.transition,
                                }, onMouseEnter: e => { e.currentTarget.style.borderColor = T.borderMed; e.currentTarget.style.color = T.textSec; e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textTer; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }, children: [_jsx(IShield, {}), _jsx("span", { children: "Security" }), _jsx(IChevD, {})] }), securityMenuOpen && (_jsxs("div", { "data-menu": "security", style: {
                                    position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 260,
                                    background: "rgba(17,17,24,0.75)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                                    border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
                                    overflow: "hidden", boxShadow: T.shadow,
                                    animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right",
                                }, children: [_jsx("div", { style: { padding: "8px 14px", borderBottom: `1px solid ${T.border}` }, children: _jsx("span", { style: { fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }, children: "Security Level" }) }), _jsx("div", { style: { padding: "4px 0" }, children: SECURITY_OPTIONS.map(opt => (_jsxs("button", { onClick: () => { setSelectedSecurity(opt.id); setSecurityMenuOpen(false); }, style: {
                                                width: "100%", border: "none",
                                                background: selectedSecurity === opt.id ? "rgba(191,155,48,0.06)" : "transparent",
                                                color: selectedSecurity === opt.id ? T.text : T.textSec,
                                                padding: "8px 14px", fontFamily: T.font, fontSize: 11,
                                                cursor: "pointer", textAlign: "left",
                                                display: "flex", alignItems: "center", gap: 8, transition: T.transition,
                                            }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; }, onMouseLeave: e => { e.currentTarget.style.background = selectedSecurity === opt.id ? "rgba(191,155,48,0.06)" : "transparent"; }, children: [selectedSecurity === opt.id && _jsx("span", { style: { color: T.accent, fontSize: 8 }, children: "\u25CF" }), _jsx("span", { children: opt.label })] }, opt.id))) })] }))] })] }), modelSpotlight && (_jsx("div", { onClick: () => setModelSpotlight(null), style: {
                    position: "absolute",
                    inset: 0,
                    zIndex: 105,
                    background: "linear-gradient(180deg, rgba(4,4,8,0.44) 0%, rgba(4,4,8,0.76) 100%)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 14,
                }, children: _jsxs("div", { onClick: e => e.stopPropagation(), style: {
                        width: "100%",
                        maxWidth: 282,
                        borderRadius: 22,
                        overflow: "hidden",
                        background: "linear-gradient(180deg, rgba(18,18,24,0.94) 0%, rgba(10,10,14,0.98) 100%)",
                        border: `1px solid ${spotlightData.accent}30`,
                        boxShadow: `0 30px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.03), 0 10px 30px ${spotlightData.accent}18`,
                        animation: "kSpotlightEnter 0.36s cubic-bezier(.22,1,.36,1)",
                    }, children: [_jsxs("div", { style: { position: "relative", height: 182, overflow: "hidden" }, children: [_jsx("img", { src: spotlightData.image, alt: spotlightData.title, style: {
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                        filter: "saturate(1.06) contrast(1.03)",
                                    } }), _jsx("div", { style: {
                                        position: "absolute",
                                        inset: 0,
                                        background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(10,10,14,0.04) 38%, rgba(10,10,14,0.38) 72%, rgba(10,10,14,0.78) 100%)",
                                    } }), _jsxs("div", { style: {
                                        position: "absolute",
                                        inset: "14px 14px auto 14px",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: 12,
                                    }, children: [_jsxs("div", { style: {
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 8,
                                                padding: "8px 12px",
                                                borderRadius: 999,
                                                background: "rgba(245,245,247,0.12)",
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                backdropFilter: "blur(12px)",
                                                WebkitBackdropFilter: "blur(12px)",
                                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
                                                maxWidth: 194,
                                            }, children: [_jsx("span", { style: { color: "#fff", display: "flex", flexShrink: 0 }, children: _jsx(ISpotlight, {}) }), _jsx("span", { style: {
                                                        color: "#f5f5f7",
                                                        fontSize: 11,
                                                        lineHeight: 1.25,
                                                        fontWeight: 600,
                                                        letterSpacing: "-0.02em",
                                                    }, children: spotlightData.eyebrow })] }), _jsx("button", { onClick: () => setModelSpotlight(null), title: "Close model card", style: {
                                                width: 28,
                                                height: 28,
                                                borderRadius: 9,
                                                border: `1px solid ${spotlightData.accent}`,
                                                background: "rgba(12,12,16,0.5)",
                                                color: spotlightData.accent,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                cursor: "pointer",
                                                boxShadow: `0 8px 22px ${spotlightData.accent}22`,
                                                transition: T.transition,
                                                flexShrink: 0,
                                            }, onMouseEnter: e => { e.currentTarget.style.transform = "scale(1.06)"; }, onMouseLeave: e => { e.currentTarget.style.transform = "scale(1)"; }, children: "x" })] })] }), _jsxs("div", { style: {
                                padding: "18px 18px 16px",
                                background: "linear-gradient(180deg, rgba(20,20,24,0.98) 0%, rgba(10,10,14,1) 100%)",
                                textAlign: "center",
                            }, children: [_jsxs("div", { style: {
                                        fontFamily: T.mono,
                                        fontSize: 9,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: spotlightData.accent,
                                        marginBottom: 6,
                                    }, children: [spotlightVariant.label, " | ", spotlightVariant.badge] }), _jsx("div", { style: {
                                        color: T.text,
                                        fontSize: 24,
                                        lineHeight: 1.06,
                                        fontWeight: 700,
                                        letterSpacing: "-0.04em",
                                        marginBottom: 10,
                                    }, children: spotlightData.title }), _jsx("div", { style: {
                                        color: "#d4d4d8",
                                        fontSize: 12.5,
                                        lineHeight: 1.55,
                                        letterSpacing: "-0.02em",
                                        marginBottom: 8,
                                    }, children: spotlightData.summary }), _jsx("div", { style: {
                                        color: T.textSec,
                                        fontSize: 11.5,
                                        lineHeight: 1.62,
                                        letterSpacing: "-0.01em",
                                        marginBottom: 10,
                                    }, children: spotlightData.body }), _jsx("div", { style: {
                                        color: spotlightData.accent,
                                        fontSize: 11,
                                        lineHeight: 1.55,
                                        letterSpacing: "-0.01em",
                                        marginBottom: 14,
                                    }, children: spotlightData.footer }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [_jsxs("button", { onClick: () => {
                                                onVariantChange(activeSpotlightId);
                                                setModelSpotlight(null);
                                            }, style: {
                                                width: "100%",
                                                border: "none",
                                                borderRadius: 999,
                                                padding: "10px 16px",
                                                background: "linear-gradient(180deg, #f7f7f8 0%, #dedee2 100%)",
                                                color: "#111114",
                                                fontFamily: T.font,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                transition: T.transition,
                                            }, onMouseEnter: e => {
                                                e.currentTarget.style.transform = "translateY(-1px)";
                                                e.currentTarget.style.boxShadow = "0 14px 28px rgba(255,255,255,0.12)";
                                            }, onMouseLeave: e => {
                                                e.currentTarget.style.transform = "none";
                                                e.currentTarget.style.boxShadow = "none";
                                            }, children: ["Use ", spotlightVariant.label] }), _jsx("button", { onClick: () => setModelSpotlight(null), style: {
                                                width: "100%",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                borderRadius: 999,
                                                padding: "10px 16px",
                                                background: "rgba(255,255,255,0.03)",
                                                color: T.textSec,
                                                fontFamily: T.font,
                                                fontSize: 13,
                                                cursor: "pointer",
                                                transition: T.transition,
                                            }, onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }, onMouseLeave: e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }, children: "Keep current model" })] })] })] }) })), commandSheetOpen && (_jsx("div", { onClick: () => onCommandSheetOpenChange(false), style: {
                    position: "absolute", inset: 0, zIndex: 100,
                    background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
                }, children: _jsxs("div", { onClick: e => e.stopPropagation(), style: {
                        width: "100%", maxWidth: 360,
                        background: T.bgElevated, border: `1px solid ${T.borderMed}`,
                        borderRadius: T.radius, boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
                        overflow: "hidden", animation: "kFadeInDown 0.3s cubic-bezier(.25,.1,.25,1)",
                    }, children: [_jsxs("div", { style: {
                                padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                            }, children: [_jsx("span", { style: { fontFamily: T.mono, fontSize: 10, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }, children: "Slash Commands" }), _jsx("button", { onClick: () => onCommandSheetOpenChange(false), style: {
                                        background: "none", border: "none", color: T.textTer,
                                        cursor: "pointer", fontSize: 14, lineHeight: 1,
                                        transition: T.transition,
                                    }, onMouseEnter: e => { e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.15)"; }, onMouseLeave: e => { e.currentTarget.style.color = T.textTer; e.currentTarget.style.transform = "scale(1)"; }, children: "\u2715" })] }), _jsxs("div", { style: { padding: 16, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }, children: [_jsx("div", { style: { fontFamily: T.font, fontSize: 12, color: T.textSec, lineHeight: 1.55 }, children: "Stage commands here or type them directly in the main chat box. Commands let you switch posture without losing context." }), Object.entries(COMMAND_REFERENCE).map(([tier, items]) => (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [_jsx("div", { style: { fontFamily: T.mono, fontSize: 9, color: tier === "Elite" ? "#FDE68A" : tier === "Sentinel" ? "#FDA4AF" : "#C4B5FD", letterSpacing: "0.08em", textTransform: "uppercase" }, children: tier }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: items.map((item) => (_jsxs("button", { onClick: () => {
                                                    onAddDraftCommand(item.name);
                                                    onCommandSheetOpenChange(false);
                                                }, style: {
                                                    width: "100%",
                                                    border: `1px solid ${T.border}`,
                                                    background: "rgba(255,255,255,0.025)",
                                                    color: T.text,
                                                    borderRadius: 10,
                                                    padding: "10px 12px",
                                                    textAlign: "left",
                                                    cursor: "pointer",
                                                    transition: T.transition,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 4,
                                                }, onMouseEnter: e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }, onMouseLeave: e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.transform = "none"; }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsx("span", { style: { fontFamily: T.mono, fontSize: 10, color: T.accent }, children: item.slash }), _jsx("span", { style: { fontFamily: T.mono, fontSize: 8.5, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }, children: item.type })] }), _jsx("div", { style: { fontFamily: T.font, fontSize: 11.5, color: T.textSec, lineHeight: 1.45 }, children: item.help })] }, item.name))) })] }, tier)))] })] }) })), _jsx("style", { children: `
        @keyframes kFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes kMenuPopUp {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes kFadeInDown {
          from { opacity: 0; transform: translateY(-12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes kSpotlightEnter {
          from { opacity: 0; transform: translateY(22px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      ` })] }));
}
