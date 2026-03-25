import { useState, useRef, useEffect, useCallback } from "react";
import { buildCommandReference } from "../../shared/kautilya-commands.js";

/* ─── Types ─── */
type FileStatus = "pending" | "in_progress" | "done" | "paused";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "queued" | "running" | "done" | "error";
  meta?: Record<string, any>;
}

interface AttachmentItem {
  id: string;
  name: string;
  kind: "file" | "image";
  size: number;
  mimeType: string;
}

type CommandTier = "standard" | "elite" | "sentinel";
type CommandChipType = "temporary" | "persistent" | "utility";

interface DraftCommandChip {
  name: string;
  token: string;
  recognized: boolean;
  label: string;
  tier: CommandTier;
  type: CommandChipType;
}

interface CreditStatus {
  limit: number;
  used: number;
  remaining: number;
  percentRemaining: number;
  warnAt?: number;
}

interface ApiKeyInfo {
  provider?: string;
  model?: string;
  tier?: string;
}

type ParallelAgentKey = "webResearch" | "designInspiration";
type ParallelAgentStatus =
  | "idle"
  | "requested"
  | "proposed"
  | "awaiting_approval"
  | "allowed"
  | "running"
  | "completed"
  | "skipped"
  | "denied"
  | "failed";

interface AIPanelProps {
  variant: string;
  section: string;
  medium: string;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  status: string;
  sending: boolean;
  messages: ChatMessage[];
  fileStatus: Record<string, FileStatus>;
  creditStatus: CreditStatus | null;
  applyMode: "preview" | "write";
  onApplyModeChange: (mode: "preview" | "write") => void;
  apiKeyInfo: ApiKeyInfo | null;
  onSetApiKey: (key: string, model?: string) => void;
  onVariantChange: (variant: string) => void;
  onSectionChange: (section: string) => void;
  onMediumChange: (medium: string) => void;
  parallelAgents: Record<ParallelAgentKey, boolean>;
  parallelStatuses: Record<ParallelAgentKey, ParallelAgentStatus>;
  onParallelAgentToggle: (agent: ParallelAgentKey, next: boolean) => void;
  attachments: AttachmentItem[];
  sketchNotesCount: number;
  onOpenSketchBoard: () => void;
  onAttachFiles: () => void;
  onAttachImages: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  draftCommands: DraftCommandChip[];
  commandErrors: string[];
  commandWarnings: string[];
  canSend: boolean;
  commandSheetOpen: boolean;
  onCommandSheetOpenChange: (open: boolean) => void;
  onAddDraftCommand: (name: string) => void;
  onRemoveDraftCommand: (name: string) => void;
  onClose: () => void;
}

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
} as const;

const COMMAND_REFERENCE = buildCommandReference() as Record<string, Array<Record<string, any>>>;

/* ─── Design Tokens ─── */
const T = {
  bg: "var(--builder-glass)",
  bgCard: "var(--builder-glass)",
  bgElevated: "var(--builder-glass-strong)",
  bgHover: "var(--bg-muted)",
  bgWarmSubtle: "var(--accent-soft)",
  bgWarmHover: "var(--highlight)",
  border: "var(--builder-border)",
  borderSubtle: "var(--builder-border-subtle)",
  borderMed: "var(--separator-strong)",
  borderWarm: "rgba(var(--accent-rgb), 0.22)",
  text: "var(--text-primary)",
  textSec: "var(--builder-muted-strong)",
  textTer: "var(--builder-muted)",
  accent: "var(--accent-strong)",
  accentRaig: "var(--accent)",
  accentRaigGlow: "var(--focus-ring)",
  commandHash: "var(--accent)",
  commandSlash: "var(--accent)",
  font: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  mono: "'SF Mono','JetBrains Mono','Fira Code',monospace",
  radius: 18,
  radiusSm: 10,
  radiusPill: 999,
  shadow: "var(--shadow-lg)",
  shadowSm: "var(--shadow-md)",
  transition: "all 0.3s cubic-bezier(.25,.1,.25,1)",
  transitionFast: "all 0.2s cubic-bezier(.25,.1,.25,1)",
  blur: "blur(24px)",
} as const;

/* ─── Inline SVG Icons (monochrome, thin, Apple-style) ─── */
const Ico = ({ d, size = 16, sw = 1.3 }: { d: string; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d={d} />
  </svg>
);

const ISettings = () => <Ico d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" sw={1.2} />;
const IEdit = () => <Ico d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" sw={1.2} />;
const IChevD = () => <Ico d="m6 9 6 6 6-6" size={12} sw={1.4} />;
const IClose = () => <Ico d="M18 6 6 18 M6 6l12 12" size={13} sw={1.35} />;
const ISend = () => <Ico d="m22 2-7 20-4-9-9-4 20-7z M22 2 11 13" sw={1.2} />;
const IMore = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IParallel = () => <Ico d="M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5" size={13} sw={1.2} />;
const IShield = () => <Ico d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" size={13} sw={1.2} />;
const IOpenFile = () => <Ico d="M14 3h7v7 M10 14 21 3 M21 10V3h-7 M5 5h5 M5 11h4 M5 17h6" size={14} sw={1.25} />;
const ISpotlight = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 7.7 13.35 11 16.7 12.35 13.35 13.7 12 17l-1.35-3.3L7.3 12.35 10.65 11 12 7.7Z" />
  </svg>
);
const IAdd = () => <Ico d="M12 5v14 M5 12h14" size={15} sw={1.35} />;
const IUpload = () => <Ico d="M12 16V5 M8 9l4-4 4 4 M5 19h14" size={14} sw={1.3} />;
const ISketch = () => <Ico d="M4 16.5 16.5 4a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z M13 6l5 5" size={14} sw={1.25} />;
const ISticky = () => <Ico d="M5 4h11a3 3 0 0 1 3 3v7l-5 5H8a3 3 0 0 1-3-3z M14 19v-4a1 1 0 0 1 1-1h4" size={14} sw={1.2} />;
const IFigma = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    <path d="M9 3h6a3 3 0 0 1 0 6H9V3Z" fill="currentColor" opacity="0.95"/>
    <path d="M9 9h6a3 3 0 1 1 0 6H9V9Z" fill="currentColor" opacity="0.78"/>
    <path d="M9 15h3a3 3 0 1 1-3 3v-3Z" fill="currentColor" opacity="0.62"/>
    <path d="M9 3v6H6a3 3 0 1 1 0-6h3Z" fill="currentColor" opacity="0.72"/>
    <path d="M9 9v6H6a3 3 0 1 1 0-6h3Z" fill="currentColor" opacity="0.48"/>
  </svg>
);
const INotion = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M9 17V8.4l6 8.6V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ILinear = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    <path d="M6 6h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M6 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M6 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IDocGem = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="m12 7 3 2v4l-3 2-3-2V9l3-2Z" fill="currentColor" opacity="0.85"/>
  </svg>
);

/* ─── Kautilya Logo ─── */
const KautilyaLogo = ({ size = 80, opacity = 0.03 }: { size?: number; opacity?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 250 250" style={{ opacity }}>
    <path d="m124.7 5.63c-0.45-0.62-1.24-0.62-1.69 0l-82.06 118.2c-0.32 0.46-0.32 1.13 0 1.59l82.3 118.9c0.44 0.64 1.25 0.64 1.7 0l83.51-119c0.33-0.46 0.33-1.11 0-1.57l-83.76-118.2zm0.05 3.17 24.04 35-24.04-20.02v-14.98zm-1.7 0.01v14.97l-22.74 19.69 22.74-34.66zm1.7 18.6 28.68 21.72 12.52 17.23-41.2-18.64v-20.31zm-1.7 0v20.31l-38.89 18.03 12.34-17.06 26.55-21.28zm1.7 22.66 43.48 19.64 11.55 17.04-55.03-18.28v-18.4zm-1.7 0v18.4l-53.63 17.25 13-16.81 40.63-18.84zm1.7 20.23 57.72 19.04 11.79 18.63-69.51-19.31v-18.36zm-1.7 0v18.36l-67.86 18.47 12.36-18.25 55.5-18.58zm1.7 20.18 71.2 20.13 9.24 12.4-80.44-13.09v-19.44zm-1.7 0v19.44l-78.77 13.09 8.43-12.45 70.34-20.08zm1.7 21.24 79.01 13.01-26.83 14.21-52.18-15.02v-12.2zm-1.7 0v12.2l-52.18 15.02-25.82-14.11 78-13.11zm1.7 14.07 48.66 14.59-18.53 10.03-30.13-10.85v-13.77zm-1.7 0v13.77l-28.63 12.12-20.51-10.99 49.14-14.9zm80.68 1.99-30.23 42.54-49.07 23.6v-24.21l79.3-41.93zm-158.1 0.33 77.46 42.01v23.69l-49.4-23.74-28.06-41.96zm79.16 13.27 27.32 10.42-27.32 16.33v-26.75zm-1.7 0v26.69l-26.06-15.24 26.06-11.45zm48.85 31.53-16.89 23.68-0.36-1.48-30.22 20.83v-19.24l47.47-23.79zm-94.74 0.38 45.89 23.41v18.08l-28.72-19.69-0.49 1.3-16.68-23.1zm75.06 25.82-27.47 40.6v-21.57l27.47-19.03zm-56.46 0.72 27.29 18.92v21.57l-27.29-40.49z" fill="#fff"/>
  </svg>
);

/* ─── Toggle Switch Component ─── */
const Toggle = ({ on, onToggle, label, note }: { on: boolean; onToggle: () => void; label: string; note?: string }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: T.font, fontSize: 12, color: T.textSec, letterSpacing: "-0.01em" }}>{label}</span>
      {note ? (
        <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textTer, letterSpacing: "0.05em", textTransform: "uppercase" }}>{note}</span>
      ) : null}
    </div>
    <button
      onClick={onToggle}
      style={{
        width: 36,
        height: 20,
        borderRadius: T.radiusPill,
        border: "none",
        background: on ? "var(--accent-soft)" : "rgba(255,255,255,0.08)",
        padding: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        transition: T.transition,
      }}
    >
      <span style={{
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: on ? "#fff" : "rgba(255,255,255,0.3)",
        display: "block",
        transition: T.transition,
        boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
      }} />
    </button>
  </div>
);

/* ─── Command Launcher ─── */
const CommandLauncher = ({
  onOpen,
  activeCount,
}: {
  onOpen: () => void;
  activeCount: number;
}) => (
  <button
    onClick={onOpen}
    style={{
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
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = T.bgWarmHover;
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "rgba(0,0,0,0.2)";
      e.currentTarget.style.transform = "none";
    }}
  >
    <span style={{ color: T.commandSlash, fontSize: 11, fontFamily: T.font, marginTop: -1 }}>/</span>
    <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.02em", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {activeCount > 0 ? `${activeCount} command${activeCount > 1 ? "s" : ""} staged` : "Commands"}
    </span>
    <span style={{ marginLeft: "auto", color: T.textTer, display: "flex" }}>
      <IChevD />
    </span>
  </button>
);

/* ─── Apple-style icon button ─── */
const IconBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
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
    }}
    onMouseEnter={e => {
      const el = e.currentTarget;
      el.style.background = T.bgWarmHover;
      el.style.color = T.textSec;
      el.style.transform = "scale(1.08)";
    }}
    onMouseLeave={e => {
      const el = e.currentTarget;
      el.style.background = "transparent";
      el.style.color = T.textTer;
      el.style.transform = "scale(1)";
    }}
  >
    {children}
  </button>
);


/* ══════════════════════════════════════════════
   ██  AI PANEL COMPONENT  ██
   ══════════════════════════════════════════════ */
export default function AIPanel({
  variant,
  section,
  medium,
  input,
  onInputChange,
  onSend,
  status,
  sending,
  messages,
  fileStatus,
  creditStatus,
  applyMode,
  onApplyModeChange,
  apiKeyInfo,
  onSetApiKey: _onSetApiKey,
  onVariantChange,
  onSectionChange,
  onMediumChange,
  parallelAgents,
  parallelStatuses,
  onParallelAgentToggle,
  attachments,
  sketchNotesCount,
  onOpenSketchBoard,
  onAttachFiles,
  onAttachImages,
  onRemoveAttachment,
  draftCommands,
  commandErrors,
  commandWarnings,
  canSend,
  commandSheetOpen,
  onCommandSheetOpenChange,
  onAddDraftCommand,
  onRemoveDraftCommand,
  onClose: _onClose,
}: AIPanelProps) {
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
  const [modelSpotlight, setModelSpotlight] = useState<keyof typeof MODEL_SPOTLIGHTS | null>(null);


  const panelRef = useRef<HTMLDivElement>(null);

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
    const handler = (e: MouseEvent) => {
      // If clicking inside the panel but not on a menu-trigger, close all menus
      // The menus themselves stop propagation, triggers toggle, so this catches "elsewhere"
      const target = e.target as HTMLElement;
      if (!target.closest("[data-menu]")) {
        closeAll();
      }
    };
    const el = panelRef.current;
    if (el) el.addEventListener("mousedown", handler);
    return () => { if (el) el.removeEventListener("mousedown", handler); };
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
  const activeSpotlightId = (modelSpotlight ?? variant) as keyof typeof MODEL_SPOTLIGHTS;
  const spotlightData = MODEL_SPOTLIGHTS[activeSpotlightId] ?? MODEL_SPOTLIGHTS["812"];
  const spotlightVariant = VARIANTS.find(v => v.id === activeSpotlightId) ?? selectedVariant;
  const parallelStatusLabel = (statusValue: ParallelAgentStatus) => ({
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
    if (!canSend || sending) return;
    onSend();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = (mode: string) => {
    setSelectedMode(prev => prev === mode ? "" : mode);
    onMediumChange(mode);
  };

  const openModelSpotlight = (modelId: string) => {
    closeAll();
    setModelSpotlight(modelId as keyof typeof MODEL_SPOTLIGHTS);
  };

  /* ─── Render ─── */
  return (
    <div ref={panelRef} style={{
      width: 340,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(180deg, var(--builder-glass-strong) 0%, var(--builder-glass) 100%)",
      borderLeft: `1px solid ${T.borderSubtle}`,
      fontFamily: T.font,
      height: "100%",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        height: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px 0 16px",
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
        background: `linear-gradient(180deg, rgba(var(--accent-rgb), 0.08) 0%, ${T.bg} 100%)`,
      }}>
        <span style={{
          fontFamily: T.mono,
          fontSize: 11,
          color: T.accent,
          letterSpacing: "0.12em",
          fontWeight: 600,
          textTransform: "uppercase",
        }}>
          Kautilya
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconBtn onClick={() => {}} title="Settings">
            <ISettings />
          </IconBtn>
          <IconBtn onClick={() => { closeAll(); onCommandSheetOpenChange(true); }} title="Slash Commands">
            <IEdit />
          </IconBtn>
        </div>
      </div>

      {/* ═══ MESSAGES / CONTENT ═══ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        {messages.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 14,
            userSelect: "none",
          }}>
            <KautilyaLogo size={90} opacity={0.035} />
            <span style={{
              fontFamily: T.font,
              fontSize: 12,
              color: T.textTer,
              letterSpacing: "-0.01em",
              fontWeight: 400,
            }}>
              Start a conversation…
            </span>
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.04em" }}>{status}</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: creditColor, letterSpacing: "0.04em", marginTop: 4 }}>
                Credits: {creditStatus ? `${creditStatus.percentRemaining}%` : "—"}
              </div>
            </div>
            {apiKeyInfo && (
              <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(134,239,172,0.5)", letterSpacing: "0.04em" }}>
                {apiKeyInfo.provider} · {apiKeyInfo.model} · {apiKeyInfo.tier}
              </div>
            )}
          </div>
        ) : (
          <div>
            {messages.map(msg => {
              const roleColor = msg.role === "system" ? "#F59E0B" : msg.role === "user" ? T.accent : "#93C5FD";
              return (
                <div key={msg.id} style={{ marginBottom: 14, animation: "kFadeIn 0.3s ease" }}>
                  <div style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    color: roleColor,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}>
                    {msg.role} {msg.status ? `· ${msg.status}` : ""}
                  </div>
                  {msg.meta && (
                    <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textTer, letterSpacing: "0.04em", marginBottom: 4 }}>
                      {msg.meta.variant ?? "model"} · {msg.meta.section ?? "section"} · {msg.meta.medium ?? "medium"}
                    </div>
                  )}
                  {Array.isArray(msg.meta?.commands) && msg.meta.commands.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                      {msg.meta.commands.map((token: string) => (
                        <span
                          key={token}
                          style={{
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
                          }}
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(msg.meta?.attachments) && msg.meta.attachments.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {msg.meta.attachments.map((attachment: AttachmentItem) => (
                        <div key={attachment.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, border: attachment.kind === "image" ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(255,255,255,0.09)", background: attachment.kind === "image" ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.03)", color: attachment.kind === "image" ? "#BFDBFE" : T.textSec, fontFamily: T.mono, fontSize: 8.5, letterSpacing: "0.03em" }}>
                          <span style={{ display: "flex", color: attachment.kind === "image" ? "#60A5FA" : T.textTer }}>
                            {attachment.kind === "image" ? <IUpload /> : <IOpenFile />}
                          </span>
                          <span>{attachment.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {Number(msg.meta?.sketchNotesCount) > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(14,165,233,0.26)", background: "rgba(14,165,233,0.10)", color: "#BAE6FD", fontFamily: T.mono, fontSize: 8.5, letterSpacing: "0.03em" }}>
                        <span style={{ display: "flex", color: "#7DD3FC" }}><ISticky /></span>
                        <span>{Number(msg.meta?.sketchNotesCount)} sketch note{Number(msg.meta?.sketchNotesCount) === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  ) : null}
                  <div style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 12.5,
                    color: T.text,
                    lineHeight: 1.65,
                    fontFamily: T.font,
                    letterSpacing: "-0.01em",
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {Object.keys(fileStatus).length > 0 && (
              <div style={{ marginTop: 8 }}>
                {Object.entries(fileStatus).map(([file, s]) => (
                  <div key={file} style={{
                    fontFamily: T.mono, fontSize: 9,
                    color: s === "done" ? "#86EFAC" : s === "in_progress" ? "#FBBF24" : T.textTer,
                    letterSpacing: "0.04em",
                  }}>
                    {file} · {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MAIN INPUT CONTAINER ═══ */}
      <div style={{ padding: "8px 10px 6px", borderTop: `1px solid ${T.border}`, position: "relative" }}>
        <div style={{
          position: "relative",
          border: `1px solid ${T.borderMed}`,
          borderRadius: T.radius,
          background: "linear-gradient(180deg, var(--builder-glass-strong) 0%, var(--builder-glass) 100%)",
          backdropFilter: T.blur,
          WebkitBackdropFilter: T.blur,
          padding: "10px 12px 10px",
          boxShadow: "var(--shadow-md)",
        }}>

          {/* Row 1: Model Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }} data-menu="model">
            <button
              onClick={() => { setModelMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }}
              data-menu="model"
              style={{
                height: 26,
                padding: "0 10px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.borderMed}`,
                background: modelMenuOpen ? "var(--accent-soft)" : "transparent",
                color: T.textSec,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: T.mono,
                fontSize: 10,
                cursor: "pointer",
                transition: T.transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = modelMenuOpen ? "var(--accent-soft)" : "transparent"; e.currentTarget.style.transform = "none"; }}
            >
              <span style={{ color: T.text, fontWeight: 500 }}>{selectedVariant.label}</span>
              <span style={{
                fontSize: 8, padding: "1px 5px", borderRadius: 4,
                background: "var(--accent-soft)", color: "var(--accent-strong)",
                border: "1px solid rgba(var(--accent-rgb), 0.22)", fontWeight: 600,
              }}>
                {selectedVariant.badge}
              </span>
              <IChevD />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openModelSpotlight(selectedVariant.id);
              }}
              title={`Open ${selectedVariant.label} model card`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border: "1px solid rgba(var(--accent-rgb), 0.28)",
                background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.18) 0%, rgba(var(--accent-alt-rgb), 0.08) 100%)",
                color: "var(--accent-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: T.transition,
                boxShadow: "inset 0 1px 0 rgba(var(--accent-rgb), 0.14)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-1px) scale(1.04)";
                e.currentTarget.style.boxShadow = "0 10px 24px rgba(var(--accent-rgb), 0.2), inset 0 1px 0 rgba(var(--accent-rgb), 0.24)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(var(--accent-rgb), 0.14)";
              }}
            >
              <ISpotlight />
            </button>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer }}>/ {section}</span>
          </div>

          {/* Model Dropdown */}
          {modelMenuOpen && (
            <div data-menu="model" style={{
              position: "absolute", left: 0, right: 0, bottom: "calc(100% + 6px)",
              background: "var(--builder-glass-strong)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
              border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 60,
              overflow: "hidden", boxShadow: T.shadow,
              animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom center",
            }}>
              <div style={{
                padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Model Architecture
                </span>
                <Toggle on={showAdvancedModels} onToggle={() => setShowAdvancedModels(v => !v)} label="" />
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {visibleModels.map(model => {
                  const expanded = expandedModel === model.id;
                  return (
                    <div key={model.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 0" }}>
                        <button
                          onClick={() => setExpandedModel(prev => prev === model.id ? "" : model.id)}
                          style={{
                            width: "100%", border: "none",
                            background: variant === model.id ? "rgba(255,255,255,0.04)" : "transparent",
                            color: variant === model.id ? T.text : T.textSec,
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 10px", fontFamily: T.mono, fontSize: 11,
                            cursor: "pointer", textAlign: "left", transition: T.transition,
                            borderRadius: T.radiusSm,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background = variant === model.id ? "rgba(255,255,255,0.04)" : "transparent"; }}
                        >
                          <span style={{ transform: expanded ? "rotate(0)" : "rotate(-90deg)", transition: T.transition, display: "flex" }}>
                            <IChevD />
                          </span>
                          <span>{model.label}</span>
                          <span style={{
                            fontSize: 8, padding: "1px 5px", borderRadius: 4,
                            background: "var(--accent-soft)", color: "var(--accent-strong)",
                            border: "1px solid rgba(var(--accent-rgb), 0.22)", marginLeft: "auto",
                          }}>
                            {model.badge}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openModelSpotlight(model.id);
                          }}
                          title={`Open ${model.label} model card`}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: "1px solid rgba(var(--accent-rgb), 0.24)",
                            background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.14) 0%, rgba(var(--accent-alt-rgb), 0.07) 100%)",
                            color: "var(--accent-strong)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: T.transition,
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = "translateY(-1px) scale(1.04)";
                            e.currentTarget.style.boxShadow = "0 10px 24px rgba(var(--accent-rgb), 0.16)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <ISpotlight />
                        </button>
                      </div>
                      {expanded && (
                        <div style={{ padding: "2px 12px 8px 36px", display: "flex", flexDirection: "column", gap: 1 }}>
                          {SECTIONS.map(entry => (
                            <button
                              key={`${model.id}-${entry}`}
                              onClick={() => { onVariantChange(model.id); onSectionChange(entry); setModelMenuOpen(false); }}
                              style={{
                                border: "none",
                                background: variant === model.id && section === entry ? "var(--accent-soft)" : "transparent",
                                color: variant === model.id && section === entry ? T.text : T.textTer,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "5px 8px", borderRadius: 6,
                                fontFamily: T.font, fontSize: 11, cursor: "pointer", textAlign: "left", transition: T.transition,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; }}
                              onMouseLeave={e => { e.currentTarget.style.background = variant === model.id && section === entry ? "var(--accent-soft)" : "transparent"; }}
                            >
                              <span>{entry}</span>
                              {variant === model.id && section === entry && <span style={{ color: T.accent, fontSize: 12 }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 2: AI Mode Selector (toggle buttons) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 3, marginBottom: 10,
            background: "var(--bg-muted)", borderRadius: T.radiusSm, padding: 3,
            boxShadow: "inset 0 1px 4px rgba(var(--accent-rgb), 0.08)", border: `1px solid ${T.borderSubtle}`
          }}>
            {AI_MODES.map(mode => {
              const active = selectedMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? T.text : T.textTer,
                    fontFamily: T.font, fontSize: 11, fontWeight: active ? 500 : 400,
                    cursor: "pointer", transition: T.transition,
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.bgHover; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {mode}
                </button>
              );
            })}
            {/* Raigbait special toggle */}
            {(() => {
              const active = selectedMode === "Raigbait";
              return (
                <button
                  onClick={() => handleModeChange("Raigbait")}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 6,
                    border: active ? `1px solid rgba(139,92,246,0.5)` : "1px solid rgba(139,92,246,0.15)",
                    background: active
                      ? `linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))`
                      : "transparent",
                    color: active ? "#c4b5fd" : "rgba(139,92,246,0.6)",
                    fontFamily: T.font, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: T.transition,
                    boxShadow: active ? `0 0 14px ${T.accentRaigGlow}` : "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                      e.currentTarget.style.color = "#c4b5fd";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(139,92,246,0.5)";
                    }
                  }}
                >
                  ✦ Raigbait
                </button>
              );
            })()}
          </div>

          {/* Row 3: Main text area with blur */}
          <textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Kautilya anything, @ to add files(from editor), "
            rows={2}
            style={{
              width: "100%",
              padding: "10px 10px",
              background: "var(--bg-secondary)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${T.borderSubtle}`,
              boxShadow: "inset 0 2px 8px rgba(var(--accent-rgb), 0.06)",
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
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-strong)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = T.borderSubtle; e.currentTarget.style.background = "var(--bg-secondary)"; }}
          />
          {attachments.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
              {attachments.map((attachment) => (
                <div key={attachment.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, border: attachment.kind === "image" ? "1px solid rgba(59,130,246,0.24)" : "1px solid rgba(255,255,255,0.08)", background: attachment.kind === "image" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.035)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
                  <span style={{ display: "flex", color: attachment.kind === "image" ? "#60A5FA" : T.textTer }}>
                    {attachment.kind === "image" ? <IUpload /> : <IOpenFile />}
                  </span>
                  <span style={{ fontFamily: T.font, fontSize: 11, color: T.textSec, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</span>
                  <button onClick={() => onRemoveAttachment(attachment.id)} style={{ border: "none", background: "transparent", color: T.textTer, cursor: "pointer", display: "flex", padding: 0 }}>
                    <IClose />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {sketchNotesCount > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: attachments.length > 0 ? 8 : 10 }}>
              <button
                onClick={onOpenSketchBoard}
                style={{
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
                }}
              >
                <span style={{ display: "flex", color: "#7DD3FC" }}><ISticky /></span>
                <span style={{ fontFamily: T.font, fontSize: 11, color: "#E0F2FE" }}>
                  {sketchNotesCount} sketch note{sketchNotesCount === 1 ? "" : "s"} attached
                </span>
              </button>
            </div>
          ) : null}

          {draftCommands.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
              {draftCommands.map((command) => (
                <div
                  key={command.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 10px",
                    borderRadius: 999,
                    border: command.recognized
                      ? command.tier === "elite"
                        ? "1px solid rgba(var(--accent-rgb), 0.24)"
                        : command.tier === "sentinel"
                          ? "1px solid rgba(244,63,94,0.24)"
                          : "1px solid rgba(var(--accent-rgb), 0.24)"
                      : "1px solid rgba(248,113,113,0.28)",
                    background: command.recognized
                      ? command.tier === "elite"
                        ? "rgba(var(--accent-rgb), 0.08)"
                        : command.tier === "sentinel"
                          ? "rgba(244,63,94,0.08)"
                          : "rgba(var(--accent-rgb), 0.08)"
                      : "rgba(239,68,68,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: command.recognized ? (command.tier === "sentinel" ? "#FDA4AF" : "var(--accent-strong)") : "#FCA5A5" }}>
                    {command.token}
                  </span>
                  <span style={{ fontFamily: T.font, fontSize: 11, color: command.recognized ? T.textSec : "#FCA5A5" }}>
                    {command.label}
                  </span>
                  <button onClick={() => onRemoveDraftCommand(command.name)} style={{ border: "none", background: "transparent", color: T.textTer, cursor: "pointer", display: "flex", padding: 0 }}>
                    <IClose />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {commandErrors.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {commandErrors.map((message) => (
                <div key={message} style={{ fontFamily: T.font, fontSize: 10.5, color: "#FCA5A5", lineHeight: 1.45 }}>
                  {message}
                </div>
              ))}
            </div>
          ) : null}
          {commandWarnings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {commandWarnings.map((message) => (
                <div key={message} style={{ fontFamily: T.font, fontSize: 10.5, color: "#FCD34D", lineHeight: 1.45 }}>
                  {message}
                </div>
              ))}
            </div>
          ) : null}


          {/* Row 4: Bottom toolbar — Preview/Write + Command box + More + Send */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {/* Apply mode toggle */}
            <div style={{
              display: "flex", borderRadius: 6, border: `1px solid ${T.border}`, overflow: "hidden", flexShrink: 0,
            }}>
              {(["preview", "write"] as const).map(mode => (
                <button
                  key={mode}
                onClick={() => onApplyModeChange(mode)}
                style={{
                  border: "none",
                  background: applyMode === mode ? "var(--accent-soft)" : "transparent",
                  color: applyMode === mode ? T.text : T.textTer,
                    padding: "3px 8px", fontFamily: T.mono, fontSize: 9,
                    cursor: "pointer", transition: T.transition, textTransform: "capitalize",
                  }}
                  onMouseEnter={e => { if (applyMode !== mode) e.currentTarget.style.background = T.bgHover; }}
                  onMouseLeave={e => { if (applyMode !== mode) e.currentTarget.style.background = "transparent"; }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Command launcher */}
            <CommandLauncher onOpen={() => onCommandSheetOpenChange(true)} activeCount={draftCommands.length} />

            <div style={{ position: "relative", flexShrink: 0 }} data-menu="attach">
              <button
                onClick={() => { setAttachmentMenuOpen(v => !v); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }}
                data-menu="attach"
                style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: attachmentMenuOpen ? "var(--accent-soft)" : "transparent", color: attachmentMenuOpen ? T.textSec : T.textTer, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: T.transition }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = attachmentMenuOpen ? "var(--accent-soft)" : "transparent"; e.currentTarget.style.color = attachmentMenuOpen ? T.textSec : T.textTer; e.currentTarget.style.transform = "scale(1)"; }}
              >
                <IAdd />
              </button>

              {attachmentMenuOpen && (
                <div data-menu="attach" style={{ position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 254, background: "var(--builder-glass-strong)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur, border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 80, overflow: "hidden", boxShadow: T.shadow, animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Attach & Import
                    </div>
                  </div>
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <button onClick={() => { onOpenSketchBoard(); setAttachmentMenuOpen(false); }} style={{ width: "100%", border: "1px solid rgba(var(--accent-rgb), 0.28)", borderRadius: 12, background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.18) 0%, rgba(var(--accent-alt-rgb), 0.12) 100%)", color: "#F8FAFC", padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: "0 10px 28px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.2)", overflow: "hidden", position: "relative" }}>
                      <span style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 48%), radial-gradient(circle at bottom right, rgba(var(--accent-rgb), 0.16), transparent 42%)", pointerEvents: "none" }} />
                      <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12.5, fontWeight: 500, position: "relative", zIndex: 1 }}>
                        <span style={{ display: "flex", color: "#ffffff" }}><ISketch /></span>
                        Sketch your design
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.76)", position: "relative", zIndex: 1 }}>BOARD</span>
                    </button>
                    <button onClick={() => { onAttachFiles(); setAttachmentMenuOpen(false); }} style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, background: "rgba(255,255,255,0.03)", color: T.text, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.font, fontSize: 12 }}>
                        <span style={{ display: "flex", color: T.accent }}><IOpenFile /></span>
                        Upload files
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer }}>FILES ONLY</span>
                    </button>
                    <button onClick={() => { onAttachImages(); setAttachmentMenuOpen(false); }} style={{ width: "100%", border: "1px solid rgba(59,130,246,0.18)", borderRadius: 10, background: "rgba(59,130,246,0.08)", color: "#DBEAFE", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.font, fontSize: 12 }}>
                        <span style={{ display: "flex", color: "#60A5FA" }}><IUpload /></span>
                        Upload image
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(191,219,254,0.72)" }}>IMAGE</span>
                    </button>
                    <button onClick={() => setImportMenuOpen(v => !v)} style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, background: importMenuOpen ? "var(--accent-soft)" : "rgba(255,255,255,0.025)", color: T.textSec, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: T.transition }}>
                      <span style={{ fontFamily: T.font, fontSize: 12 }}>More imports</span>
                      <IChevD />
                    </button>
                    {importMenuOpen ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                        {[
                          { id: "figma", label: "Import from Figma", tone: "rgba(245,158,11,0.10)", icon: <IFigma /> },
                          { id: "notion", label: "Import from Notion", tone: "rgba(255,255,255,0.03)", icon: <INotion /> },
                          { id: "linear", label: "Import from Linear", tone: "rgba(99,102,241,0.10)", icon: <ILinear /> },
                        ].map((item) => (
                          <button key={item.id} disabled style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 11, background: item.tone, color: T.textSec, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "not-allowed", opacity: 0.9 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12 }}>
                              <span style={{ display: "flex" }}>{item.icon}</span>
                              {item.label}
                            </span>
                            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer }}>SOON</span>
                          </button>
                        ))}
                        <button disabled style={{ width: "100%", border: "1px solid rgba(var(--accent-rgb), 0.28)", borderRadius: 12, background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.16) 0%, rgba(17,17,24,0.92) 100%)", color: "var(--accent-alt)", padding: "12px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "not-allowed", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 12.5, fontWeight: 500 }}>
                            <span style={{ display: "flex", color: "var(--accent-alt)" }}><IDocGem /></span>
                            Import from Kautilya Docs
                          </span>
                          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(var(--accent-alt-rgb), 0.76)" }}>PREMIUM SOON</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* More Actions (⋯) */}
            <div style={{ position: "relative", flexShrink: 0 }} data-menu="more">
              <button
                onClick={() => { setMoreMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setParallelMenuOpen(false); setSecurityMenuOpen(false); }}
                data-menu="more"
                style={{
                  width: 28, height: 28, borderRadius: 7, border: "none",
                  background: "transparent", color: T.textTer,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: T.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textTer; e.currentTarget.style.transform = "scale(1)"; }}
              >
                <IMore />
              </button>

              {/* More Actions Menu */}
              {moreMenuOpen && (
                <div data-menu="more" style={{
                  position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 210,
                  background: "rgba(255,255,255,0.92)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                  border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
                  overflow: "hidden", boxShadow: T.shadow,
                  animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right",
                }}>
                  <div style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Actions
                    </span>
                  </div>
                  <div style={{ padding: "6px 12px" }}>
                    <button
                      onClick={() => { onAddDraftCommand("contextrevise"); setMoreMenuOpen(false); }}
                      style={{
                        width: "100%", padding: "7px 12px", borderRadius: T.radiusSm,
                        border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.025)",
                        color: T.text, fontFamily: T.font, fontSize: 11.5,
                        cursor: "pointer", transition: T.transition, textAlign: "center",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.transform = "none"; }}
                    >
                      Context Revise
                    </button>
                  </div>
                  <div style={{ padding: "0 12px" }}>
                    <Toggle on={claudeSkills} onToggle={() => setClaudeSkills(v => !v)} label="Claude Skills" />
                  </div>
                  <div style={{ padding: "0 12px 6px" }}>
                    <Toggle
                      on={draftCommands.some((command) => command.name === "kautilyarules")}
                      onToggle={() => {
                        const active = draftCommands.some((command) => command.name === "kautilyarules");
                        if (active) onRemoveDraftCommand("kautilyarules");
                        else onAddDraftCommand("kautilyarules");
                      }}
                      label="Kautilya Rules"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{
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
              }}
              onMouseEnter={e => { if (canSend && !sending) e.currentTarget.style.transform = "scale(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <ISend />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM FOOTER / ACTION BAR ═══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 10px 10px", position: "relative",
      }}>
        {/* Parallel Agent */}
        <div style={{ position: "relative" }} data-menu="parallel">
          <button
            onClick={() => { setParallelMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setSecurityMenuOpen(false); }}
            data-menu="parallel"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textTer, fontFamily: T.mono, fontSize: 9,
              cursor: "pointer", transition: T.transition,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMed; e.currentTarget.style.color = T.textSec; e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textTer; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}
          >
            <IParallel />
            <span>Parallel</span>
            <IChevD />
          </button>
          {parallelMenuOpen && (
            <div data-menu="parallel" style={{
              position: "absolute", left: 0, bottom: "calc(100% + 6px)", width: 200,
              background: "rgba(255,255,255,0.92)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
              border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
              overflow: "hidden", boxShadow: T.shadow,
              animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom left",
            }}>
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Parallel Agent
                </span>
              </div>
              <div style={{ padding: "2px 14px 6px" }}>
                <Toggle
                  on={parallelAgents.designInspiration}
                  onToggle={() => onParallelAgentToggle("designInspiration", !parallelAgents.designInspiration)}
                  label="Design Inspiration"
                  note={parallelStatusLabel(parallelStatuses.designInspiration)}
                />
                <Toggle
                  on={parallelAgents.webResearch}
                  onToggle={() => onParallelAgentToggle("webResearch", !parallelAgents.webResearch)}
                  label="Web Search"
                  note={parallelStatusLabel(parallelStatuses.webResearch)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Security Settings */}
        <div style={{ position: "relative" }} data-menu="security">
          <button
            onClick={() => { setSecurityMenuOpen(v => !v); setAttachmentMenuOpen(false); setImportMenuOpen(false); setModelMenuOpen(false); setMoreMenuOpen(false); setParallelMenuOpen(false); }}
            data-menu="security"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textTer, fontFamily: T.mono, fontSize: 9,
              cursor: "pointer", transition: T.transition,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMed; e.currentTarget.style.color = T.textSec; e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textTer; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}
          >
            <IShield />
            <span>Security</span>
            <IChevD />
          </button>
          {securityMenuOpen && (
            <div data-menu="security" style={{
              position: "absolute", right: 0, bottom: "calc(100% + 6px)", width: 260,
              background: "rgba(255,255,255,0.92)", backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
              border: `1px solid ${T.borderMed}`, borderRadius: T.radius, zIndex: 70,
              overflow: "hidden", boxShadow: T.shadow,
              animation: "kMenuPopUp 0.3s cubic-bezier(.25,.1,.25,1) forwards", transformOrigin: "bottom right",
            }}>
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Security Level
                </span>
              </div>
              <div style={{ padding: "4px 0" }}>
                {SECURITY_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSelectedSecurity(opt.id); setSecurityMenuOpen(false); }}
                    style={{
                      width: "100%", border: "none",
                      background: selectedSecurity === opt.id ? "var(--accent-soft)" : "transparent",
                      color: selectedSecurity === opt.id ? T.text : T.textSec,
                      padding: "8px 14px", fontFamily: T.font, fontSize: 11,
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8, transition: T.transition,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = selectedSecurity === opt.id ? "var(--accent-soft)" : "transparent"; }}
                  >
                    {selectedSecurity === opt.id && <span style={{ color: T.accent, fontSize: 8 }}>●</span>}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ AGENT SKILLS MODAL ═══ */}
      {/* Model Spotlight Card */}
      {modelSpotlight && (
        <div
          onClick={() => setModelSpotlight(null)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 105,
            background: "var(--builder-overlay)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 282,
              borderRadius: 22,
              overflow: "hidden",
              background: "linear-gradient(180deg, var(--builder-inverse-panel) 0%, rgba(10, 12, 18, 0.98) 100%)",
              border: "1px solid rgba(var(--accent-rgb), 0.28)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.03), 0 10px 30px rgba(var(--accent-rgb), 0.18)",
              animation: "kSpotlightEnter 0.36s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div style={{ position: "relative", height: 182, overflow: "hidden" }}>
              <img
                src={spotlightData.image}
                alt={spotlightData.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: "saturate(1.06) contrast(1.03)",
                }}
              />
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(var(--accent-rgb), 0.08) 0%, rgba(10,10,14,0.04) 38%, rgba(10,10,14,0.38) 72%, rgba(10,10,14,0.82) 100%)",
              }} />
              <div style={{
                position: "absolute",
                inset: "14px 14px auto 14px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(var(--accent-rgb), 0.16)",
                  border: "1px solid rgba(var(--accent-rgb), 0.22)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                  maxWidth: 194,
                }}>
                  <span style={{ color: "var(--builder-inverse-text)", display: "flex", flexShrink: 0 }}>
                    <ISpotlight />
                  </span>
                  <span style={{
                    color: "var(--builder-inverse-text)",
                    fontSize: 11,
                    lineHeight: 1.25,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}>
                    {spotlightData.eyebrow}
                  </span>
                </div>
                <button
                  onClick={() => setModelSpotlight(null)}
                  title="Close model card"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    border: "1px solid rgba(var(--accent-rgb), 0.65)",
                    background: "rgba(12,12,16,0.5)",
                    color: "var(--accent-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 8px 22px rgba(var(--accent-rgb), 0.22)",
                    transition: T.transition,
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  x
                </button>
              </div>
            </div>

            <div style={{
              padding: "18px 18px 16px",
              background: "linear-gradient(180deg, rgba(var(--accent-rgb), 0.04) 0%, rgba(10,10,14,1) 18%, rgba(10,10,14,1) 100%)",
              textAlign: "center",
            }}>
              <div style={{
                fontFamily: T.mono,
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-strong)",
                marginBottom: 6,
              }}>
                {spotlightVariant.label} | {spotlightVariant.badge}
              </div>
              <div style={{
                color: "var(--builder-inverse-text)",
                fontSize: 24,
                lineHeight: 1.06,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                marginBottom: 10,
              }}>
                {spotlightData.title}
              </div>
              <div style={{
                color: "rgba(245, 247, 250, 0.92)",
                fontSize: 12.5,
                lineHeight: 1.55,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}>
                {spotlightData.summary}
              </div>
              <div style={{
                color: "var(--builder-inverse-muted)",
                fontSize: 11.5,
                lineHeight: 1.62,
                letterSpacing: "-0.01em",
                marginBottom: 10,
              }}>
                {spotlightData.body}
              </div>
              <div style={{
                color: "var(--accent-strong)",
                fontSize: 11,
                lineHeight: 1.55,
                letterSpacing: "-0.01em",
                marginBottom: 14,
              }}>
                {spotlightData.footer}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => {
                    onVariantChange(activeSpotlightId);
                    setModelSpotlight(null);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 999,
                    padding: "10px 16px",
                    background: "var(--accent-gradient)",
                    color: "#ffffff",
                    fontFamily: T.font,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: T.transition,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 14px 28px rgba(255,255,255,0.12)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Use {spotlightVariant.label}
                </button>
                <button
                  onClick={() => setModelSpotlight(null)}
                  style={{
                    width: "100%",
                    border: "1px solid var(--builder-inverse-border)",
                    borderRadius: 999,
                    padding: "10px 16px",
                    background: "rgba(255,255,255,0.03)",
                    color: "var(--builder-inverse-muted)",
                    fontFamily: T.font,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: T.transition,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  Keep current model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slash Command Reference */}
      {commandSheetOpen && (
        <div
          onClick={() => onCommandSheetOpenChange(false)}
          style={{
            position: "absolute", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360,
              background: T.bgElevated, border: `1px solid ${T.borderMed}`,
              borderRadius: T.radius, boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
              overflow: "hidden", animation: "kFadeInDown 0.3s cubic-bezier(.25,.1,.25,1)",
            }}
          >
            <div style={{
              padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
                Slash Commands
              </span>
              <button
                onClick={() => onCommandSheetOpenChange(false)}
                style={{
                  background: "none", border: "none", color: T.textTer,
                  cursor: "pointer", fontSize: 14, lineHeight: 1,
                  transition: T.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = T.textSec; e.currentTarget.style.transform = "scale(1.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textTer; e.currentTarget.style.transform = "scale(1)"; }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.textSec, lineHeight: 1.55 }}>
                Stage commands here or type them directly in the main chat box. Commands let you switch posture without losing context.
              </div>
              {Object.entries(COMMAND_REFERENCE).map(([tier, items]) => (
                <div key={tier} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: tier === "Elite" ? "#FDE68A" : tier === "Sentinel" ? "#FDA4AF" : "#C4B5FD", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {tier}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => {
                          onAddDraftCommand(item.name);
                          onCommandSheetOpenChange(false);
                        }}
                        style={{
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
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = T.bgWarmHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.transform = "none"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.accent }}>{item.slash}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textTer, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            {item.type}
                          </span>
                        </div>
                        <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.textSec, lineHeight: 1.45 }}>
                          {item.help}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inject keyframes */}
      <style>{`
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
      `}</style>
    </div>
  );
}
