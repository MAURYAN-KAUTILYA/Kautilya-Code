import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DiffEditor } from "@monaco-editor/react";
import { useAppTheme } from "@/theme/AppThemeProvider";
import AIPanel from "./Aipanel";
import EditorSection from "./editor";
import SketchBoard, { type SketchBoardValue, type SketchSticky } from "./SketchBoard";
import {
  COMMAND_REGISTRY,
  DEFAULT_PERSISTENT_COMMANDS,
  describePersistentCommands,
  parseLeadingSlashCommands,
  resolveCommandSet,
} from "../../shared/kautilya-commands.js";

const Logo = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 250 250">
    <path
      d="m124.7 5.63c-0.45-0.62-1.24-0.62-1.69 0l-82.06 118.2c-0.32 0.46-0.32 1.13 0 1.59l82.3 118.9c0.44 0.64 1.25 0.64 1.7 0l83.51-119c0.33-0.46 0.33-1.11 0-1.57l-83.76-118.2zm0.05 3.17 24.04 35-24.04-20.02v-14.98zm-1.7 0.01v14.97l-22.74 19.69 22.74-34.66zm1.7 18.6 28.68 21.72 12.52 17.23-41.2-18.64v-20.31zm-1.7 0v20.31l-38.89 18.03 12.34-17.06 26.55-21.28zm1.7 22.66 43.48 19.64 11.55 17.04-55.03-18.28v-18.4zm-1.7 0v18.4l-53.63 17.25 13-16.81 40.63-18.84zm1.7 20.23 57.72 19.04 11.79 18.63-69.51-19.31v-18.36zm-1.7 0v18.36l-67.86 18.47 12.36-18.25 55.5-18.58zm1.7 20.18 71.2 20.13 9.24 12.4-80.44-13.09v-19.44zm-1.7 0v19.44l-78.77 13.09 8.43-12.45 70.34-20.08zm1.7 21.24 79.01 13.01-26.83 14.21-52.18-15.02v-12.2zm-1.7 0v12.2l-52.18 15.02-25.82-14.11 78-13.11zm1.7 14.07 48.66 14.59-18.53 10.03-30.13-10.85v-13.77zm-1.7 0v13.77l-28.63 12.12-20.51-10.99 49.14-14.9zm80.68 1.99-30.23 42.54-49.07 23.6v-24.21l79.3-41.93zm-158.1 0.33 77.46 42.01v23.69l-49.4-23.74-28.06-41.96zm79.16 13.27 27.32 10.42-27.32 16.33v-26.75zm-1.7 0v26.69l-26.06-15.24 26.06-11.45zm48.85 31.53-16.89 23.68-0.36-1.48-30.22 20.83v-19.24l47.47-23.79zm-94.74 0.38 45.89 23.41v18.08l-28.72-19.69-0.49 1.3-16.68-23.1zm75.06 25.82-27.47 40.6v-21.57l27.47-19.03zm-56.46 0.72 27.29 18.92v21.57l-27.29-40.49z"
      fill="currentColor"
    />
  </svg>
);

const I = (d: string, s = 16) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const IMenu = () => I("M3 6h18 M3 12h18 M3 18h18");
const IChevR = () => I("m9 18 6-6-6-6", 14);
const IChevD = () => I("m6 9 6 6 6-6", 14);
const IClose = () => I("M18 6 6 18 M6 6l12 12", 14);
const ITerminal = () => I("m4 17 6-6-6-6 M12 19h8");
const IPlus = () => I("M12 5v14 M5 12h14", 14);
const IFolderPlus = () => I("M12 10V6 M10 8h4 M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3z", 14);
const IRefresh = () => I("M21 2v6h-6 M3 12a9 9 0 0 1 15.55-6.36L21 8 M3 22v-6h6 M21 12a9 9 0 0 1-15.55 6.36L3 16", 14);
const ICollapse = () => I("m8 7 4 4 4-4 M8 17l4-4 4 4", 14);
const ITrash = () => I("M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 11v6 M14 11v6", 14);
const IPencil = () => I("M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z", 14);
const IFolder = () => I("M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3z", 14);
const IOpenFile = () => I("M14 3h7v7 M10 14 21 3 M21 10V3h-7 M5 5h5 M5 11h4 M5 17h6", 14);
const IBot = () => I("M12 8V4H8 M12 8v4 M12 12H8 M12 12h4 M8 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-4");
const IPlay = () => I("m5 3 14 9-14 9V3z");
const IDownload = () => I("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3");
const IPlug = () => I("M12 22v-4 M9 2v6 M15 2v6 M5 8h14 M7 12h10");
const IBrain = () => I("M8 6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3 M16 6a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 M8 6h8 M8 14h8 M9 10h6");
const IDatabase = () =>
  I(
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  );
const IFlask = () => I("M10 2v4l-5 9a4 4 0 0 0 3.5 6h7a4 4 0 0 0 3.5-6l-5-9V2 M8 11h8");
const IFiles = () => I("M4 4h6l2 2h8v14H4z");

const STARTER_CODE = `// Kautilya Builder ï¿½ Active Session
// Model: 812+ ï¿½ Section: Chanakya Intelligence ï¿½ Medium: Build

import { useState, useEffect } from 'react';

interface AuthConfig {
  jwtSecret: string;
  refreshTokenExpiry: number;
  accessTokenExpiry: number;
}

export async function generateTokenPair(
  userId: string,
  config: AuthConfig
): Promise<{ accessToken: string; refreshToken: string }> {
  throw new Error('Wire to real JWT library');
}
`;

const VARIANTS = [
  { id: "812", label: "812", badge: "Free", color: "#6B7280" },
  { id: "812hybrid", label: "812 hybrid", badge: "Hybrid", color: "#3B82F6" },
  { id: "812+", label: "812+", badge: "Pro", color: "#9B2226" },
  { id: "812+hybrid", label: "812+ hybrid", badge: "Max", color: "#AE7C1A" },
];

interface TermLine {
  id: number;
  type: "command" | "output" | "error" | "info" | "status";
  text: string;
}

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
type PersistentCommandKey = "debug" | "freeze" | "nofake";

interface DraftCommandChip {
  name: string;
  token: string;
  recognized: boolean;
  label: string;
  tier: CommandTier;
  type: CommandChipType;
}

interface PendingDiff {
  file: string;
  before: string;
  after: string;
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

interface ActiveFileState {
  kind: "text" | "image" | "binary";
  url?: string;
  message?: string;
}

interface ConsoleLine {
  id: number;
  source: "runtime" | "preview" | "system";
  level: "log" | "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

interface SketchNoteAttachment {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

type AgentType = "webResearch" | "designInspiration";
type AgentWorkflowStatus =
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

interface AgentSource {
  title?: string;
  url: string;
}

interface AgentWorkflowStep {
  id: string;
  stage?: string;
  message: string;
  timestamp: number;
}

interface AgentWorkflow {
  agentId: string;
  agentType: AgentType;
  jobId?: string;
  status: AgentWorkflowStatus;
  reason?: string;
  query?: string;
  whyNow?: string;
  steps: AgentWorkflowStep[];
  sources: AgentSource[];
  imageUrls: string[];
  confidence?: number;
  summary?: string;
}

type ParallelAgentPreferences = Record<AgentType, boolean>;
type ParallelAgentStateMap = Record<AgentType, AgentWorkflowStatus>;

type RuntimeMode = "auto" | "sandbox" | "local";
type WorkspaceTab = "code" | "terminal";
type PreviewTab = "preview" | "console";
type PanelMode = "editor" | "preview";
type WorkspaceSource = "project" | "local";

interface LocalWorkspaceFile {
  path: string;
  handle?: FileSystemFileHandle;
  file?: File;
  readOnly: boolean;
}

interface ExplorerDraft {
  mode: "create" | "rename";
  type: "file" | "folder";
  parentPath: string;
  targetPath?: string;
  value: string;
}

interface ExplorerDragState {
  sourceId: string;
  sourceType: "file" | "folder";
  targetId: string | null;
  valid: boolean;
}

const TERMINAL_RUNTIME_KEY = "kautilya_terminal_runtime_mode";
const TERMINAL_CWD_KEY = "kautilya_terminal_cwd";
const DEFAULT_WORKSPACE_FILE = "src/features/builder-lab/BuilderShell.tsx";
const AGENT_LABELS: Record<AgentType, string> = {
  webResearch: "Web Research",
  designInspiration: "Design Inspiration",
};
const PARALLEL_STATUS_LABELS: Record<AgentWorkflowStatus, string> = {
  idle: "",
  requested: "Requested",
  proposed: "Proposed",
  awaiting_approval: "Approval Needed",
  allowed: "Allowed",
  running: "Running",
  completed: "Completed",
  skipped: "Skipped",
  denied: "Denied",
  failed: "Failed",
};

const createEmptySketchDocument = (): SketchBoardValue => ({
  elements: [],
  selectedId: null,
  tool: "select",
  brush: {
    kind: "pencil",
    color: "#1D4ED8",
    width: 3,
  },
  shapeKind: "rounded",
  lineKind: "straight",
  stickyColor: "#FDE68A",
});

const extractSketchNotes = (document: SketchBoardValue | null | undefined): SketchNoteAttachment[] => {
  if (!document || !Array.isArray(document.elements)) return [];
  return document.elements
    .filter((element): element is SketchSticky => element?.type === "sticky")
    .map((element) => ({
      id: String(element.id || ""),
      text: String(element.text || "").trim(),
      color: String(element.color || "#FCD34D"),
      x: Number(element.x || 0),
      y: Number(element.y || 0),
    }))
    .filter((note) => note.id && note.text);
};

function mergeDraftCommands(previous: DraftCommandChip[], incoming: DraftCommandChip[]) {
  const next = [...previous];
  incoming.forEach((chip) => {
    if (next.some((entry) => entry.name === chip.name)) return;
    next.push(chip);
  });
  return next;
}

function buildCommandChip(name: string, recognized = true): DraftCommandChip {
  const registryEntry = (COMMAND_REGISTRY as Record<string, any>)[name];
  return {
    name,
    token: `/${name}`,
    recognized,
    label: registryEntry?.chipLabel || registryEntry?.label || name,
    tier: (registryEntry?.tier || "standard") as CommandTier,
    type: (registryEntry?.type || "temporary") as CommandChipType,
  };
}

function deriveWorkingDirectory(filePath: string) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
}

function readStoredRuntimeMode() {
  if (typeof window === "undefined") return "auto" as RuntimeMode;
  const stored = window.localStorage.getItem(TERMINAL_RUNTIME_KEY);
  return stored === "sandbox" || stored === "local" ? stored : "auto";
}

function Terminal({
  activeFile,
  sessionId,
  onConsoleEntry,
}: {
  activeFile: string;
  sessionId: string;
  onConsoleEntry: (entry: Omit<ConsoleLine, "id" | "timestamp">) => void;
}) {
  const [lines, setLines] = useState<TermLine[]>([
    { id: 0, type: "info", text: "Kautilya Terminal ï¿½ hybrid runtime console ready" },
    { id: 1, type: "info", text: "Run commands in the project folder, stream logs, and stop active jobs." },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(() => (typeof window === "undefined" ? "" : window.localStorage.getItem(TERMINAL_CWD_KEY) ?? ""));
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(() => readStoredRuntimeMode());
  const [lastCommand, setLastCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(2);

  const suggestedCwd = deriveWorkingDirectory(activeFile);
  const resolvedCwd = cwd.trim() || suggestedCwd;

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TERMINAL_RUNTIME_KEY, runtimeMode);
  }, [runtimeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TERMINAL_CWD_KEY, cwd);
  }, [cwd]);

  const nextId = () => {
    const value = nextIdRef.current;
    nextIdRef.current += 1;
    return value;
  };

  const pushLine = (type: TermLine["type"], text: string) => {
    const normalized = text.replace(/\r\n/g, "\n").split("\n").filter((line, index, arr) => line.length > 0 || index < arr.length - 1);
    if (normalized.length === 0) return;
    setLines((prev) => [
      ...prev,
      ...normalized.map((line) => ({
        id: nextId(),
        type,
        text: line,
      })),
    ]);
  };

  const pushConsole = (level: ConsoleLine["level"], text: string, source: ConsoleLine["source"] = "runtime") => {
    const normalized = text.replace(/\r\n/g, "\n").split("\n").filter((line, index, arr) => line.length > 0 || index < arr.length - 1);
    normalized.forEach((line) => {
      onConsoleEntry({ source, level, text: line });
    });
  };

  const handleRuntimeEvent = (data: any) => {
    if (!data || typeof data !== "object") return;

    if (data.type === "start") {
      setActiveCommandId(data.commandId ?? null);
      setStatus("running");
      pushLine("status", `Started ${data.runtime ?? "runtime"} in ${resolvedCwd || "."}`);
      pushConsole("info", `Started ${data.runtime ?? "runtime"} command in ${resolvedCwd || "."}`, "system");
      return;
    }

    if (data.type === "stdout") {
      pushLine("output", data.text ?? "");
      pushConsole("info", data.text ?? "");
      return;
    }

    if (data.type === "stderr") {
      pushLine("error", data.text ?? "");
      pushConsole("warn", data.text ?? "");
      return;
    }

    if (data.type === "stopped") {
      setActiveCommandId(null);
      setStatus("idle");
      pushLine("status", `Stopped with code ${data.code ?? 130}`);
      pushConsole("warn", `Command stopped${typeof data.code === "number" ? ` with code ${data.code}` : ""}.`, "system");
      return;
    }

    if (data.type === "error") {
      setActiveCommandId(null);
      setStatus("error");
      pushLine("error", data.message || "Runtime error");
      pushConsole("error", data.message || "Runtime error");
      return;
    }

    if (data.type === "done") {
      setActiveCommandId(null);
      setStatus(data.code === 0 ? "idle" : "error");
      pushLine(data.code === 0 ? "status" : "error", `Exit ${data.code ?? 0} ï¿½ ${data.runtime ?? "runtime"}`);
      pushConsole(data.code === 0 ? "info" : "warn", `${data.runtime ?? "Runtime"} finished with exit ${data.code ?? 0}.`, "system");
    }
  };

  const streamCommand = async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || status === "running") return;

    if (trimmed === "clear") {
      setLines([{ id: 0, type: "info", text: "Terminal cleared." }]);
      setInput("");
      return;
    }

    setHistory((prev) => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
    setHistoryIndex(-1);
    setLastCommand(trimmed);
    setStatus("running");
    pushLine("command", trimmed);
    setInput("");

    try {
      const res = await fetch("/api/runtime/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          cwd: resolvedCwd,
          runtimeMode,
          sessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.error || "Failed to start runtime stream.";
        setStatus("error");
        pushLine("error", message);
        pushConsole("error", message, "system");
        return;
      }

      if (!res.body) {
        setStatus("error");
        pushLine("error", "Runtime stream unavailable.");
        pushConsole("error", "Runtime stream unavailable.", "system");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.replace(/^data:\s*/, "");
            if (!raw) continue;
            try {
              handleRuntimeEvent(JSON.parse(raw));
            } catch {
              // Ignore malformed events.
            }
          }
        }
      }
    } catch (err: any) {
      setStatus("error");
      pushLine("error", err?.message || "Runtime request failed.");
      pushConsole("error", err?.message || "Runtime request failed.", "system");
    }
  };

  const stopCommand = async () => {
    if (!activeCommandId) return;
    try {
      await fetch("/api/runtime/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: activeCommandId }),
      });
    } catch (err: any) {
      const message = err?.message || "Failed to stop command.";
      pushLine("error", message);
      pushConsole("error", message, "system");
    }
  };

  const browseHistory = (direction: "up" | "down") => {
    if (history.length === 0) return;
    if (direction === "up") {
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      return;
    }

    if (historyIndex === -1) return;
    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) {
      setHistoryIndex(-1);
      setInput("");
      return;
    }
    setHistoryIndex(nextIndex);
    setInput(history[nextIndex] ?? "");
  };

  const handleKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      browseHistory("up");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      browseHistory("down");
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    await streamCommand(input);
  };

  return (
    <div
      style={{
        height: "100%",
        background: "var(--builder-inverse-bg)",
        border: "1px solid var(--builder-inverse-border)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono', monospace",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          minHeight: 72,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "0 12px",
          borderBottom: "1px solid var(--builder-inverse-border)",
          flexShrink: 0,
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--accent-strong)" }}>
              <ITerminal />
            </span>
            <span style={{ fontSize: 10, color: "var(--builder-inverse-muted)", letterSpacing: "0.1em" }}>TERMINAL</span>
            <span style={{ fontSize: 9, color: status === "running" ? "#86EFAC" : status === "error" ? "#FCA5A5" : "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>
              {status === "running" ? "RUNNING" : status === "error" ? "ATTENTION" : "READY"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setLines([{ id: 0, type: "info", text: "Terminal cleared." }])}
              style={{ background: "transparent", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-muted)", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: "pointer" }}
            >
              CLEAR
            </button>
            <button
              onClick={() => {
                if (lastCommand) void streamCommand(lastCommand);
              }}
              disabled={!lastCommand || status === "running"}
              style={{ background: "var(--accent-soft)", border: "1px solid rgba(var(--accent-rgb), 0.28)", color: "var(--accent-alt)", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: !lastCommand || status === "running" ? "not-allowed" : "pointer", opacity: !lastCommand || status === "running" ? 0.5 : 1 }}
            >
              RERUN
            </button>
            <button
              onClick={() => void stopCommand()}
              disabled={!activeCommandId}
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: !activeCommandId ? "not-allowed" : "pointer", opacity: !activeCommandId ? 0.5 : 1 }}
            >
              STOP
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={runtimeMode}
            onChange={(e) => setRuntimeMode(e.target.value as RuntimeMode)}
            disabled={status === "running"}
            style={{ width: 110, background: "var(--builder-inverse-panel)", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-text)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
          >
            <option value="auto">AUTO</option>
            <option value="sandbox">SANDBOX</option>
            <option value="local">LOCAL</option>
          </select>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder={suggestedCwd || "project root"}
            style={{ flex: 1, background: "var(--builder-inverse-panel)", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-text)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }} onClick={() => inputRef.current?.focus()}>
        {lines.map((l) => (
          <div
            key={l.id}
            style={{
              fontSize: 12,
              lineHeight: "20px",
              color:
                l.type === "command"
                  ? "var(--accent-alt)"
                  : l.type === "error"
                    ? "#FCA5A5"
                    : l.type === "status"
                      ? "#86EFAC"
                      : l.type === "info"
                        ? "var(--builder-inverse-muted)"
                        : "var(--builder-inverse-text)",
              background: l.type === "command" ? "rgba(var(--accent-rgb), 0.12)" : "transparent",
              borderLeft: l.type === "command" ? "2px solid var(--accent-strong)" : "2px solid transparent",
              paddingLeft: l.type === "command" ? 6 : 0,
              fontWeight: l.type === "command" || l.type === "status" ? 500 : 400,
              whiteSpace: "pre-wrap",
            }}
          >
            {l.text}
          </div>
        ))}
        <div ref={outputRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px 8px", borderTop: "1px solid var(--builder-inverse-border)" }}>
        <span style={{ fontSize: 12, color: "var(--accent-strong)" }}>{">"}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={status === "running" ? "Command is running..." : "Run command in selected workspace..."}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 12,
            color: "var(--builder-inverse-text)",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 400,
          }}
          disabled={status === "running"}
        />
        <button
          onClick={() => void streamCommand(input)}
          disabled={!input.trim() || status === "running"}
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.32)", color: "#86EFAC", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: !input.trim() || status === "running" ? "not-allowed" : "pointer", opacity: !input.trim() || status === "running" ? 0.5 : 1 }}
        >
          RUN
        </button>
      </div>
    </div>
  );
}

interface FileNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: FileNode[];
  lang?: string;
}

function normalizeEntryPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function dirnamePath(value: string) {
  const normalized = normalizeEntryPath(value);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
}

function upsertTreeNode(tree: FileNode[], parts: string[], fullPath: string, leafType: "file" | "folder") {
  if (parts.length === 0) return;
  const [head, ...rest] = parts;
  const isLeaf = rest.length === 0;
  const nodeType = isLeaf ? leafType : "folder";
  const nextId = parts.slice(0, parts.length - rest.length).join("/");
  let node = tree.find((entry) => entry.name === head && entry.type === nodeType);

  if (!node) {
    node = {
      id: isLeaf ? fullPath : nextId,
      name: head,
      type: nodeType,
      children: nodeType === "folder" ? [] : undefined,
    };
    tree.push(node);
  }

  if (nodeType === "folder" && rest.length > 0) {
    if (!node.children) node.children = [];
    upsertTreeNode(node.children, rest, fullPath, leafType);
  }
}

function sortFileTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortFileTree(node.children) : undefined,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function buildTreeFromEntries(filePaths: string[], folderPaths: string[] = []) {
  const tree: FileNode[] = [];
  const normalizedFolders = new Set<string>();

  for (const folderPath of folderPaths) {
    const normalized = normalizeEntryPath(folderPath);
    if (!normalized) continue;
    normalizedFolders.add(normalized);
    upsertTreeNode(tree, normalized.split("/").filter(Boolean), normalized, "folder");
  }

  for (const filePath of filePaths) {
    const normalized = normalizeEntryPath(filePath);
    if (!normalized) continue;
    let parent = dirnamePath(normalized);
    while (parent) {
      normalizedFolders.add(parent);
      parent = dirnamePath(parent);
    }
    upsertTreeNode(tree, normalized.split("/").filter(Boolean), normalized, "file");
  }

  for (const folderPath of normalizedFolders) {
    upsertTreeNode(tree, folderPath.split("/").filter(Boolean), folderPath, "folder");
  }

  return sortFileTree(tree);
}

function findNodeById(nodes: FileNode[], targetId: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children?.length) {
      const nested = findNodeById(node.children, targetId);
      if (nested) return nested;
    }
  }
  return null;
}

const LANG_COLORS: Record<string, string> = {
  tsx: "#3B82F6",
  ts: "#3B82F6",
  js: "#F59E0B",
  jsx: "#F59E0B",
  json: "#22C55E",
  css: "#A855F7",
  md: "#6B7280",
  html: "#EF4444",
};

function ExplorerInputRow({
  depth,
  draft,
  onChange,
  onCommit,
  onCancel,
}: {
  depth: number;
  draft: ExplorerDraft;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "2px 8px 6px",
        padding: "6px 8px",
        paddingLeft: 12 + depth * 12,
        borderRadius: 10,
        border: "1px solid rgba(174,124,26,0.24)",
        background: "rgba(174,124,26,0.08)",
      }}
    >
      <span style={{ color: draft.type === "folder" ? "#AE7C1A" : "#6B7280", display: "flex", flexShrink: 0 }}>
        {draft.type === "folder" ? <IFolder /> : <IPlus />}
      </span>
      <input
        autoFocus
        value={draft.value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={onCommit}
        placeholder={draft.type === "folder" ? "folder-name" : "file-name.tsx"}
        style={{
          flex: 1,
          background: "rgba(4,6,12,0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          color: "#E5E7EB",
          padding: "6px 8px",
          fontSize: 11,
          outline: "none",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />
    </div>
  );
}

function FileTreeItem({
  node,
  depth,
  activeFile,
  selectedPath,
  draft,
  openFolders,
  canRename,
  canDelete,
  dragState,
  onSelectPath,
  onOpenFile,
  onToggleFolder,
  onStartRename,
  onDelete,
  onDraftChange,
  onCommitDraft,
  onCancelDraft,
  onDragStart,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropTarget,
}: {
  node: FileNode;
  depth: number;
  activeFile: string;
  selectedPath: string;
  draft: ExplorerDraft | null;
  openFolders: Set<string>;
  canRename: boolean;
  canDelete: boolean;
  dragState: ExplorerDragState | null;
  onSelectPath: (id: string) => void;
  onOpenFile: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onStartRename: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
  onDragStart: (node: FileNode) => void;
  onDragOverTarget: (node: FileNode) => void;
  onDragLeaveTarget: (node: FileNode) => void;
  onDropTarget: (node: FileNode) => void;
}) {
  const indent = depth * 12;
  const isActive = activeFile === node.id;
  const isSelected = selectedPath === node.id;
  const isRenaming = draft?.mode === "rename" && draft.targetPath === node.id;
  const ext = node.type === "file" ? node.name.split(".").pop() ?? "" : "";
  const dotColor = LANG_COLORS[ext] ?? "#6B7280";
  const isOpen = openFolders.has(node.id);
  const dragActive = dragState?.targetId === node.id;
  const dragValid = dragActive && dragState?.valid;
  const dragInvalid = dragActive && dragState && !dragState.valid;

  return (
    <>
      {isRenaming ? (
        <ExplorerInputRow
          depth={depth}
          draft={draft}
          onChange={onDraftChange}
          onCommit={onCommitDraft}
          onCancel={onCancelDraft}
        />
      ) : (
        <div
          draggable={!!dragState || true}
          onDragStart={() => onDragStart(node)}
          onDragOver={(event) => {
            event.preventDefault();
            onDragOverTarget(node);
          }}
          onDragLeave={() => onDragLeaveTarget(node)}
          onDrop={(event) => {
            event.preventDefault();
            onDropTarget(node);
          }}
          onClick={() => {
            onSelectPath(node.id);
            if (node.type === "folder") onToggleFolder(node.id);
            if (node.type === "file") onOpenFile(node.id);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            paddingLeft: 12 + indent,
            cursor: "pointer",
            userSelect: "none",
            background: dragValid
              ? "rgba(134,239,172,0.12)"
              : dragInvalid
                ? "rgba(248,113,113,0.14)"
                : isSelected
                  ? "rgba(174,124,26,0.12)"
                  : isActive
                    ? "rgba(155,34,38,0.1)"
                    : "transparent",
            borderLeft: isSelected
              ? "1px solid rgba(174,124,26,0.45)"
              : isActive
                ? "1px solid rgba(155,34,38,0.4)"
                : "1px solid transparent",
            borderTop: dragValid ? "1px solid rgba(134,239,172,0.25)" : "1px solid transparent",
            borderBottom: dragValid ? "1px solid rgba(134,239,172,0.25)" : "1px solid transparent",
            transition: "background 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(event) => {
            if (!isSelected && !isActive && !dragActive) event.currentTarget.style.background = "rgba(155,34,38,0.04)";
          }}
          onMouseLeave={(event) => {
            if (!isSelected && !isActive && !dragActive) event.currentTarget.style.background = "transparent";
          }}
        >
          {node.type === "folder" ? (
            <span style={{ color: isSelected ? "#AE7C1A" : "#6B7280", display: "flex", flexShrink: 0 }}>
              {isOpen ? <IChevD /> : <IChevR />}
            </span>
          ) : (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, marginLeft: 4 }} />
          )}
          <span style={{ color: node.type === "folder" ? (isSelected ? "#F5DEB3" : "#AE7C1A") : isSelected || isActive ? "#E2E8F0" : "#8A93A5", display: "flex", flexShrink: 0 }}>
            {node.type === "folder" ? <IFolder /> : <IOpenFile />}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11.5,
              color: node.type === "folder" ? (isSelected ? "#F5DEB3" : "#9CA3AF") : isSelected || isActive ? "#E2E8F0" : "#6B7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {node.name}
          </span>
          {isSelected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {canRename ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartRename(node);
                  }}
                  title="Rename"
                  style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <IPencil />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(node);
                  }}
                  title="Delete"
                  style={{ background: "transparent", border: "none", color: "#FCA5A5", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <ITrash />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {node.type === "folder" && isOpen ? (
        <>
          {draft?.mode === "create" && draft.parentPath === node.id ? (
            <ExplorerInputRow
              depth={depth + 1}
              draft={draft}
              onChange={onDraftChange}
              onCommit={onCommitDraft}
              onCancel={onCancelDraft}
            />
          ) : null}
          {node.children?.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              selectedPath={selectedPath}
              draft={draft}
              openFolders={openFolders}
              canRename={canRename}
              canDelete={canDelete}
              dragState={dragState}
              onSelectPath={onSelectPath}
              onOpenFile={onOpenFile}
              onToggleFolder={onToggleFolder}
              onStartRename={onStartRename}
              onDelete={onDelete}
              onDraftChange={onDraftChange}
              onCommitDraft={onCommitDraft}
              onCancelDraft={onCancelDraft}
              onDragStart={onDragStart}
              onDragOverTarget={onDragOverTarget}
              onDragLeaveTarget={onDragLeaveTarget}
              onDropTarget={onDropTarget}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function FileTree({
  tree,
  activeFile,
  selectedPath,
  draft,
  openFolders,
  canRename,
  canDelete,
  dragState,
  onSelectPath,
  onOpenFile,
  onToggleFolder,
  onStartRename,
  onDelete,
  onDraftChange,
  onCommitDraft,
  onCancelDraft,
  onDragStart,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropTarget,
  onDropRoot,
}: {
  tree: FileNode[];
  activeFile: string;
  selectedPath: string;
  draft: ExplorerDraft | null;
  openFolders: Set<string>;
  canRename: boolean;
  canDelete: boolean;
  dragState: ExplorerDragState | null;
  onSelectPath: (id: string) => void;
  onOpenFile: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onStartRename: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
  onDragStart: (node: FileNode) => void;
  onDragOverTarget: (node: FileNode) => void;
  onDragLeaveTarget: (node: FileNode) => void;
  onDropTarget: (node: FileNode) => void;
  onDropRoot: () => void;
}) {
  return (
    <div
      style={{ padding: "8px 0 10px", overflow: "auto", flex: 1 }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropRoot();
      }}
    >
      {draft?.mode === "create" && draft.parentPath === "" ? (
        <ExplorerInputRow
          depth={0}
          draft={draft}
          onChange={onDraftChange}
          onCommit={onCommitDraft}
          onCancel={onCancelDraft}
        />
      ) : null}
      {tree.map((node) => (
        <FileTreeItem
          key={node.id}
          node={node}
          depth={0}
          activeFile={activeFile}
          selectedPath={selectedPath}
          draft={draft}
          openFolders={openFolders}
          canRename={canRename}
          canDelete={canDelete}
          dragState={dragState}
          onSelectPath={onSelectPath}
          onOpenFile={onOpenFile}
          onToggleFolder={onToggleFolder}
          onStartRename={onStartRename}
          onDelete={onDelete}
          onDraftChange={onDraftChange}
          onCommitDraft={onCommitDraft}
          onCancelDraft={onCancelDraft}
          onDragStart={onDragStart}
          onDragOverTarget={onDragOverTarget}
          onDragLeaveTarget={onDragLeaveTarget}
          onDropTarget={onDropTarget}
        />
      ))}
    </div>
  );
}

function ComingSoonTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="coming-soon" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
      <div
        className="coming-tooltip"
        style={{
          position: "absolute",
          left: "100%",
          marginLeft: 10,
          padding: "6px 10px",
          background: "var(--builder-inverse-panel)",
          border: "1px solid var(--builder-inverse-border)",
          borderRadius: 8,
          color: "var(--accent-alt)",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 9,
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
          boxShadow: "var(--shadow-md)",
          pointerEvents: "none",
        }}
      >
        Coming soon | Stay with the campaign
      </div>
    </div>
  );
}

function AgentWorkflowRail({
  workflows,
  onClose,
  onDecision,
}: {
  workflows: AgentWorkflow[];
  onClose: () => void;
  onDecision: (jobId: string, decision: "allow" | "deny") => void;
}) {
  const statusColor = (status: AgentWorkflowStatus) =>
    ({
      awaiting_approval: "#FBBF24",
      allowed: "#93C5FD",
      running: "#60A5FA",
      completed: "#86EFAC",
      denied: "#FCA5A5",
      failed: "#F87171",
      requested: "#E5C07B",
      proposed: "#E5C07B",
      skipped: "#94A3B8",
      idle: "#6B7280",
    }[status] ?? "#94A3B8");

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--builder-inverse-bg)",
        borderLeft: "1px solid var(--builder-inverse-border)",
      }}
    >
      <div
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--builder-inverse-border)",
        }}
      >
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.08em", color: "var(--accent-alt)" }}>
            AGENT WORKFLOW
          </div>
          <div style={{ fontSize: 10, color: "var(--builder-inverse-muted)", marginTop: 2 }}>
            King-only specialist activity
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: "1px solid var(--builder-inverse-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--builder-inverse-muted)",
            borderRadius: 8,
            padding: "5px 8px",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 9,
          }}
        >
          CLOSE
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {workflows.map((workflow) => (
          <div
            key={workflow.agentType}
            style={{
              borderRadius: 14,
              border: "1px solid var(--builder-inverse-border)",
              background: "var(--builder-inverse-panel)",
              padding: 12,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--builder-inverse-text)", letterSpacing: "0.08em" }}>
                  {AGENT_LABELS[workflow.agentType]}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: `1px solid ${statusColor(workflow.status)}35`,
                    background: `${statusColor(workflow.status)}14`,
                    color: statusColor(workflow.status),
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 8.5,
                    letterSpacing: "0.08em",
                  }}
                >
                  {PARALLEL_STATUS_LABELS[workflow.status] || workflow.status}
                </div>
              </div>
              {typeof workflow.confidence === "number" ? (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "var(--builder-inverse-muted)" }}>
                  {(workflow.confidence * 100).toFixed(0)}%
                </div>
              ) : null}
            </div>

            {workflow.query ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>QUERY</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.55, color: "var(--builder-inverse-text)" }}>{workflow.query}</div>
              </div>
            ) : null}

            {workflow.reason ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>WHY</div>
                <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.55, color: "var(--builder-inverse-muted)" }}>{workflow.reason}</div>
              </div>
            ) : null}

            {workflow.summary ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>SUMMARY</div>
                <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.6, color: "var(--builder-inverse-text)" }}>{workflow.summary}</div>
              </div>
            ) : null}

            {workflow.status === "awaiting_approval" && workflow.jobId ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  onClick={() => onDecision(workflow.jobId!, "allow")}
                  style={{
                    flex: 1,
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.12)",
                    color: "#86EFAC",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10,
                  }}
                >
                  Allow
                </button>
                <button
                  onClick={() => onDecision(workflow.jobId!, "deny")}
                  style={{
                    flex: 1,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#FCA5A5",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10,
                  }}
                >
                  Deny
                </button>
              </div>
            ) : null}

            {workflow.steps.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>STEPS</div>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {workflow.steps.slice(-4).map((step) => (
                    <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(workflow.status), marginTop: 6, flexShrink: 0 }} />
                      <div>
                        {step.stage ? (
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{step.stage}</div>
                        ) : null}
                        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--builder-inverse-text)" }}>{step.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {workflow.sources.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>SOURCES</div>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {workflow.sources.slice(0, 4).map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#93C5FD", fontSize: 11, lineHeight: 1.45, textDecoration: "none" }}
                    >
                      {source.title || source.url}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {workflow.imageUrls.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: "var(--builder-inverse-muted)", letterSpacing: "0.08em" }}>IMAGES</div>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {workflow.imageUrls.slice(0, 4).map((url) => (
                    <div key={url} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--builder-inverse-border)", background: "rgba(255,255,255,0.04)", aspectRatio: "1 / 1" }}>
                      <img src={url} alt={workflow.query || AGENT_LABELS[workflow.agentType]} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const monacoLang = (ext: string): string =>
  (
    {
      tsx: "typescript",
      ts: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      css: "css",
      md: "markdown",
    } as Record<string, string>
  )[ext] ?? "plaintext";

export default function BuilderShell() {
  const navigate = useNavigate();
  const { tokens } = useAppTheme();
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return `session_${Date.now()}`;
    const existing = window.localStorage.getItem("kautilya_session_id");
    if (existing) return existing;
    const fresh = window.crypto?.randomUUID?.() ?? `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    window.localStorage.setItem("kautilya_session_id", fresh);
    return fresh;
  });
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState(DEFAULT_WORKSPACE_FILE);
  const [openTabs, setOpenTabs] = useState([DEFAULT_WORKSPACE_FILE]);
  const [code, setCode] = useState(STARTER_CODE);
  const [fileSnapshots, setFileSnapshots] = useState<Record<string, string>>({});
  const [panelMode, setPanelMode] = useState<PanelMode>("editor");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("code");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");
  const [previewUrl, setPreviewUrl] = useState(() => (typeof window === "undefined" ? "" : window.localStorage.getItem("kautilya_preview_url") ?? ""));
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>("project");
  const [workspaceLabel, setWorkspaceLabel] = useState("Project Workspace");
  const [localReadOnly, setLocalReadOnly] = useState(false);
  const [variant, setVariant] = useState("812+");
  const [section, setSection] = useState("Chanakya Intelligence");
  const [medium, setMedium] = useState("Build");
  const [input, setInput] = useState("");
  const [persistentCommands, setPersistentCommands] = useState<Record<PersistentCommandKey, boolean>>({
    ...DEFAULT_PERSISTENT_COMMANDS,
  });
  const [draftCommands, setDraftCommands] = useState<DraftCommandChip[]>([]);
  const [commandSheetOpen, setCommandSheetOpen] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fileStatus, setFileStatus] = useState<Record<string, FileStatus>>({});
  const [parallelAgents, setParallelAgents] = useState<ParallelAgentPreferences>({
    webResearch: false,
    designInspiration: false,
  });
  const [parallelAgentStates, setParallelAgentStates] = useState<ParallelAgentStateMap>({
    webResearch: "idle",
    designInspiration: "idle",
  });
  const [agentWorkflows, setAgentWorkflows] = useState<AgentWorkflow[]>([]);
  const [workflowRailOpen, setWorkflowRailOpen] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [applyMode, setApplyMode] = useState<"preview" | "write">("preview");
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([]);
  const [selectedExplorerPath, setSelectedExplorerPath] = useState(DEFAULT_WORKSPACE_FILE);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [explorerDraft, setExplorerDraft] = useState<ExplorerDraft | null>(null);
  const [explorerDragState, setExplorerDragState] = useState<ExplorerDragState | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<AttachmentItem[]>([]);
  const [sketchBoardOpen, setSketchBoardOpen] = useState(false);
  const [sketchBoardLoaded, setSketchBoardLoaded] = useState(false);
  const [sketchBoard, setSketchBoard] = useState<SketchBoardValue>(() => createEmptySketchDocument());
  const [activeFileState, setActiveFileState] = useState<ActiveFileState>({ kind: "text" });
  const [consoleEntries, setConsoleEntries] = useState<ConsoleLine[]>([
    {
      id: 0,
      source: "system",
      level: "info",
      text: "Preview console ready. Runtime and browser logs will appear here.",
      timestamp: Date.now(),
    },
  ]);
  const currentDiff = pendingDiffs[0] ?? null;
  const filePickerRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);
  const attachmentFilePickerRef = useRef<HTMLInputElement>(null);
  const attachmentImagePickerRef = useRef<HTMLInputElement>(null);
  const localFilesRef = useRef<Record<string, LocalWorkspaceFile>>({});
  const localFoldersRef = useRef<Set<string>>(new Set());
  const localRootDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const dragExpandTimeoutRef = useRef<number | null>(null);
  const sketchSaveTimeoutRef = useRef<number | null>(null);
  const commandResolution = resolveCommandSet({
    commandNames: draftCommands.map((chip) => chip.name),
    persistentCommands,
    variant,
    section,
    medium: medium.toLowerCase(),
  }) as any;
  const activePersistentIndicators = describePersistentCommands(persistentCommands) as Array<{ name: string; indicator?: string; chipLabel?: string }>;
  const sketchNotes = extractSketchNotes(sketchBoard);

  useEffect(() => {
    const folderInput = folderPickerRef.current;
    if (!folderInput) return;
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
  }, []);

  const appendConsoleEntry = (entry: Omit<ConsoleLine, "id" | "timestamp">) => {
    setConsoleEntries((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        timestamp: Date.now(),
        ...entry,
      },
    ].slice(-500));
  };

  const clearDragExpandTimeout = () => {
    if (dragExpandTimeoutRef.current) {
      window.clearTimeout(dragExpandTimeoutRef.current);
      dragExpandTimeoutRef.current = null;
    }
  };

  const rebuildLocalTree = () => {
    setFileTree(buildTreeFromEntries(Object.keys(localFilesRef.current), Array.from(localFoldersRef.current)));
  };

  const expandFoldersForPath = (value: string) => {
    const normalized = dirnamePath(value);
    if (!normalized) return;
    const next = new Set<string>();
    const parts = normalized.split("/").filter(Boolean);
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      next.add(cursor);
    }
    setOpenFolders((prev) => new Set([...prev, ...next]));
  };

  const setProjectWorkspace = () => {
    setWorkspaceSource("project");
    setWorkspaceLabel("Project Workspace");
    setLocalReadOnly(false);
    localFilesRef.current = {};
    localFoldersRef.current = new Set();
    localRootDirRef.current = null;
  };

  const refreshFileTree = async () => {
    try {
      const res = await fetch("/api/fs/tree");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjectWorkspace();
        setFileTree(data);
        const roots = data.filter((entry) => entry.type === "folder").map((entry) => entry.id);
        setOpenFolders(new Set(roots));
      }
    } catch (err) {
      console.error("Failed to load file tree:", err);
    }
  };

  const openProjectWorkspace = async () => {
    setProjectWorkspace();
    setPanelMode("editor");
    setWorkspaceTab("code");
    setOpenTabs([DEFAULT_WORKSPACE_FILE]);
    setActiveFile(DEFAULT_WORKSPACE_FILE);
    setSelectedExplorerPath(DEFAULT_WORKSPACE_FILE);
    setCode(STARTER_CODE);
    setExplorerDraft(null);
    setExplorerDragState(null);
    setActiveFileState({ kind: "text" });
    await refreshFileTree();
  };

  const loadLocalWorkspace = (
    files: Record<string, LocalWorkspaceFile>,
    label: string,
    readOnly: boolean,
    folderPaths: Set<string> = new Set(),
    rootHandle: FileSystemDirectoryHandle | null = null,
  ) => {
    localFilesRef.current = files;
    localFoldersRef.current = folderPaths;
    localRootDirRef.current = rootHandle;
    setWorkspaceSource("local");
    setWorkspaceLabel(label);
    setLocalReadOnly(readOnly);
    setPreviewUrl("");
    setFileTree(buildTreeFromEntries(Object.keys(files), Array.from(folderPaths)));
    setOpenFolders(new Set(Array.from(folderPaths).filter((entry) => !dirnamePath(entry))));
    setOpenTabs([]);
    setActiveFile("");
    setSelectedExplorerPath("");
    setCode("");
    setExplorerDraft(null);
    setExplorerDragState(null);
    setActiveFileState({ kind: "text" });
    setPanelMode("editor");
    setWorkspaceTab("code");
  };

  const registerPickedFile = async (file: File, handle?: FileSystemFileHandle) => {
    const relativePath = file.name;
    loadLocalWorkspace(
      {
        [relativePath]: {
          path: relativePath,
          file,
          handle,
          readOnly: !handle,
        },
      },
      relativePath,
      !handle,
    );
    setActiveFile(relativePath);
    setSelectedExplorerPath(relativePath);
    setOpenTabs([relativePath]);
  };

  const registerPickedFolder = async (
    entries: Record<string, LocalWorkspaceFile>,
    label: string,
    readOnly: boolean,
    folderPaths: Set<string> = new Set(),
    rootHandle: FileSystemDirectoryHandle | null = null,
  ) => {
    loadLocalWorkspace(entries, label, readOnly, folderPaths, rootHandle);
  };
  const snapshotFile = (filePath: string, content: string) => {
    setFileSnapshots((prev) => ({ ...prev, [filePath]: content }));
  };

  // Fetch file tree on mount
  useEffect(() => {
    refreshFileTree();
  }, []);

  // Fetch file content when activeFile changes
  useEffect(() => {
    if (!activeFile) return;
    if (workspaceSource === "local") {
      const entry = localFilesRef.current[activeFile];
      if (!entry) return;

      const loadLocalFile = async () => {
        try {
          const file = entry.handle ? await entry.handle.getFile() : entry.file;
          if (!file) throw new Error("Local file unavailable");
          const ext = (file.name.split(".").pop() ?? "").toLowerCase();
          if (file.type.startsWith("image/")) {
            setActiveFileState({
              kind: "image",
              url: URL.createObjectURL(file),
              message: entry.readOnly ? "Opened from a local folder in read-only mode." : undefined,
            });
            setCode("");
            return;
          }

          const binaryExtensions = new Set(["pdf", "zip", "rar", "7z", "exe", "dll", "ico", "woff", "woff2", "ttf", "otf"]);
          if (binaryExtensions.has(ext)) {
            setActiveFileState({
              kind: "binary",
              message: entry.readOnly
                ? "This local file was opened in read-only mode and cannot be previewed as text."
                : "This local file cannot be previewed as text.",
            });
            setCode("");
            return;
          }

          const content = await file.text();
          setActiveFileState({
            kind: "text",
            message: entry.readOnly ? "Local workspace is read-only in this browser fallback." : undefined,
          });
          setCode(content);
          snapshotFile(activeFile, content);
        } catch (err) {
          console.error("Failed to load local file:", err);
          setActiveFileState({ kind: "text", message: "Unable to read the selected local file." });
        }
      };

      void loadLocalFile();
      return;
    }

    fetch(`/api/fs/file?path=${encodeURIComponent(activeFile)}`)
      .then(r => {
        if (!r.ok) throw new Error("File not found");
        return r.json();
      })
      .then(data => {
        const nextKind = data.kind === "image" || data.kind === "binary" ? data.kind : "text";
        setActiveFileState({
          kind: nextKind,
          url: data.url,
          message: data.message,
        });

        if (nextKind === "text") {
          const content = data.content ?? "";
          setCode(content);
          snapshotFile(activeFile, content);
          return;
        }

        setCode("");
      })
      .catch(err => {
        console.error("Failed to load file:", err);
        setActiveFileState({ kind: "text" });
      });
  }, [activeFile, workspaceSource]);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/session/keys?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => setApiKeyInfo(data.key ?? null))
      .catch(() => {});

    fetch(`/api/session/commands?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => setPersistentCommands({
        ...DEFAULT_PERSISTENT_COMMANDS,
        ...(data.persistentCommands ?? {}),
      }))
      .catch(() => {});

    fetch(`/api/session/sketch?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        const nextSketch = data.sketch;
        if (nextSketch && Array.isArray(nextSketch.elements)) {
          setSketchBoard({
            ...createEmptySketchDocument(),
            ...nextSketch,
            elements: nextSketch.elements ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setSketchBoardLoaded(true));

    fetch(`/api/credits?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => setCreditStatus(data.credit ?? null))
      .catch(() => {});

    fetch(`/api/checkpoint?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        const cp = data.checkpoint;
        if (!cp) return;
        const next: Record<string, FileStatus> = {};
        (cp.filesCompleted ?? []).forEach((f: string) => { next[f] = "done"; });
        if (cp.fileInProgress) next[cp.fileInProgress] = "in_progress";
        (cp.filePending ?? []).forEach((f: string) => { if (!next[f]) next[f] = "pending"; });
        if (Object.keys(next).length) setFileStatus(next);
        if (cp.contextSummary) {
          setMessages((prev) => [
            ...prev,
            { id: `msg_${Date.now()}_resume`, role: "system", content: `Resume checkpoint loaded (${cp.filesCompleted?.length ?? 0} files done).`, status: "done" },
          ]);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sketchBoardLoaded || !sessionId) return;
    if (sketchSaveTimeoutRef.current) window.clearTimeout(sketchSaveTimeoutRef.current);
    sketchSaveTimeoutRef.current = window.setTimeout(() => {
      fetch("/api/session/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sketch: sketchBoard,
        }),
      }).catch(() => {});
    }, 450);
    return () => {
      if (sketchSaveTimeoutRef.current) {
        window.clearTimeout(sketchSaveTimeoutRef.current);
        sketchSaveTimeoutRef.current = null;
      }
    };
  }, [sessionId, sketchBoard, sketchBoardLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("kautilya_preview_url", previewUrl);
  }, [previewUrl]);


  const writeWorkspaceFile = async (targetPath: string, content: string) => {
    if (workspaceSource === "local") {
      const entry = localFilesRef.current[targetPath];
      if (!entry?.handle) {
        throw new Error(entry?.readOnly ? "This local workspace is read-only in the current browser fallback." : "This local file cannot be saved.");
      }
      const writable = await entry.handle.createWritable();
      await writable.write(content);
      await writable.close();
      localFilesRef.current[targetPath] = {
        ...entry,
        file: await entry.handle.getFile(),
      };
      return;
    }

    await fetch("/api/fs/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: targetPath, content }),
    });
  };

  const handleSave = async () => {
    if (activeFileState.kind !== "text" || !activeFile) return;
    try {
      await writeWorkspaceFile(activeFile, code);
      snapshotFile(activeFile, code);
      console.log("Saved:", activeFile);
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, activeFileState.kind, code, workspaceSource]);

  const makeId = () => `msg_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  const updateMessage = (
    id: string,
    updater: Partial<ChatMessage> | ((msg: ChatMessage) => ChatMessage),
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id) return msg;
        if (typeof updater === "function") return (updater as (m: ChatMessage) => ChatMessage)(msg);
        return { ...msg, ...updater };
      }),
    );
  };

  const addSystemMessage = (content: string, status: ChatMessage["status"] = "running") => {
    appendMessage({ id: makeId(), role: "system", content, status });
  };

  const persistCommands = async (nextCommands: Record<PersistentCommandKey, boolean>) => {
    setPersistentCommands(nextCommands);
    if (!sessionId) return;
    try {
      await fetch("/api/session/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, persistentCommands: nextCommands }),
      });
    } catch {
      // best-effort session persistence
    }
  };

  const resetDraftCommands = () => {
    setDraftCommands([]);
  };

  const setFileState = (file: string, next: FileStatus) => {
    setFileStatus((prev) => ({ ...prev, [file]: next }));
  };

  const setParallelAgentState = (agentType: AgentType, next: AgentWorkflowStatus) => {
    setParallelAgentStates((prev) => ({ ...prev, [agentType]: next }));
  };

  const normalizeAgentSources = (entries: any[]): AgentSource[] => {
    const seen = new Set<string>();
    const items: AgentSource[] = [];
    (entries || []).forEach((entry) => {
      const url = typeof entry === "string" ? entry : entry?.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({
        url,
        title: typeof entry === "string" ? undefined : entry?.title,
      });
    });
    return items;
  };

  const appendAgentStep = (workflow: AgentWorkflow, stage: string | undefined, message: string) => {
    if (!message) return workflow.steps;
    return [
      ...workflow.steps,
      {
        id: `${workflow.agentType}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        stage,
        message,
        timestamp: Date.now(),
      },
    ].slice(-12);
  };

  const upsertAgentWorkflow = (agentType: AgentType, updater: (current: AgentWorkflow | undefined) => AgentWorkflow) => {
    setAgentWorkflows((prev) => {
      const existing = prev.find((workflow) => workflow.agentType === agentType);
      const nextWorkflow = updater(existing);
      const remaining = prev.filter((workflow) => workflow.agentType !== agentType);
      return [...remaining, nextWorkflow];
    });
  };

  const handleParallelAgentToggle = (agentType: AgentType, next: boolean) => {
    setParallelAgents((prev) => ({ ...prev, [agentType]: next }));
    setParallelAgentState(agentType, next ? "requested" : "idle");
    setAgentWorkflows((prev) => prev.filter((workflow) => workflow.agentType !== agentType || workflow.status === "running" || workflow.status === "completed"));
  };

  const handleAcceptDiff = async () => {
    if (!currentDiff) return;
    try {
      await writeWorkspaceFile(currentDiff.file, currentDiff.after);
      snapshotFile(currentDiff.file, currentDiff.after);
      if (activeFile === currentDiff.file) setCode(currentDiff.after);
      if (!openTabs.includes(currentDiff.file)) setOpenTabs((prev) => [...prev, currentDiff.file]);
      setActiveFile(currentDiff.file);
      if (workspaceSource === "project") await refreshFileTree();
      addSystemMessage(`Applied changes to ${currentDiff.file}`, "done");
    } catch (err: any) {
      addSystemMessage(`Failed to apply ${currentDiff.file}: ${err?.message || "unknown error"}`, "error");
    } finally {
      setPendingDiffs((prev) => prev.slice(1));
    }
  };

  const handleRejectDiff = async () => {
    if (!currentDiff) return;
    try {
      if (applyMode === "write") {
        await writeWorkspaceFile(currentDiff.file, currentDiff.before);
        snapshotFile(currentDiff.file, currentDiff.before);
        if (activeFile === currentDiff.file) setCode(currentDiff.before);
      }
      addSystemMessage(`Rejected changes to ${currentDiff.file}`, "done");
    } catch (err: any) {
      addSystemMessage(`Failed to revert ${currentDiff.file}: ${err?.message || "unknown error"}`, "error");
    } finally {
      setPendingDiffs((prev) => prev.slice(1));
    }
  };

  const runTerminalCommand = async (cmd: string) => {
    const res = await fetch("/api/runtime/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: cmd,
        cwd: deriveWorkingDirectory(activeFile),
        runtimeMode: readStoredRuntimeMode(),
        sessionId,
      }),
    });
    const data = await res.json();
    if (data.stdout) appendConsoleEntry({ source: "runtime", level: "info", text: data.stdout });
    if (data.stderr) appendConsoleEntry({ source: "runtime", level: "warn", text: data.stderr });
    if (data.error) appendConsoleEntry({ source: "system", level: "error", text: data.error });
    const output = [data.stdout, data.stderr, data.error ? `Error: ${data.error}` : "", data.code !== undefined ? `Exit ${data.code} ï¿½ ${data.runtime ?? "runtime"}` : ""].filter(Boolean).join("\n");
    return output || "(no output)";
  };

  const handleSetApiKey = async (key: string, model?: string) => {
    try {
      const res = await fetch("/api/session/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, apiKey: key, model }),
      });
      const data = await res.json();
      setApiKeyInfo({ provider: data.provider, model: data.model, tier: data.tier });
      addSystemMessage("API key stored for this session.", "done");
    } catch {
      addSystemMessage("Failed to set API key.", "error");
    }
  };

  const handleSseEvent = (data: any, assistantId: string) => {
    if (!data || typeof data !== "object") return;
    const eventAgentType = data.agentType as AgentType | undefined;
    if (data.type === "stage") {
      setStatus(data.label || "Running...");
      updateMessage(assistantId, { status: "running" });
      if (data.label) addSystemMessage(`Stage: ${data.label}`, "running");
      return;
    }
    if (data.type === "session_commands") {
      setPersistentCommands({
        ...DEFAULT_PERSISTENT_COMMANDS,
        ...(data.persistentCommands ?? {}),
      });
      return;
    }
    if (data.type === "decision_done") {
      addSystemMessage(`Decision: tier ${data.tier} ï¿½ ${data.language ?? "unknown"}`, "done");
      return;
    }
    if (data.type === "king_decision") {
      addSystemMessage(`King: ${data.workBrief || "Decision ready."}`, "done");
      if (Array.isArray(data.filesToTouch)) {
        setFileStatus((prev) => {
          const next = { ...prev };
          data.filesToTouch.forEach((f: string) => {
            if (!next[f]) next[f] = "pending";
          });
          return next;
        });
      }
      if (data.phase === "planning" && data.agentPlan) {
        (["webResearch", "designInspiration"] as AgentType[]).forEach((agentType) => {
          const requested = parallelAgents[agentType];
          const plan = data.agentPlan?.[agentType];
          if (plan?.needed) {
            if (plan.approvalRequired) {
              setParallelAgentState(agentType, "awaiting_approval");
            } else if (requested) {
              setParallelAgentState(agentType, "requested");
            }
            return;
          }
          if (requested) setParallelAgentState(agentType, "skipped");
        });
      }
      return;
    }
    if (data.type === "agent_permission_required") {
      if (!eventAgentType) return;
      setWorkflowRailOpen(true);
      setParallelAgentState(eventAgentType, "awaiting_approval");
      upsertAgentWorkflow(eventAgentType, (current) => ({
        agentId: data.agentId || current?.agentId || `pending-${eventAgentType}`,
        agentType: eventAgentType,
        jobId: data.jobId || current?.jobId,
        status: "awaiting_approval",
        reason: data.reason || current?.reason,
        query: data.query || current?.query,
        whyNow: data.whyNow || current?.whyNow,
        steps: appendAgentStep(current ?? {
          agentId: data.agentId || `pending-${eventAgentType}`,
          agentType: eventAgentType,
          status: "awaiting_approval",
          steps: [],
          sources: [],
          imageUrls: [],
        }, data.stage, data.message || `Approval required for ${AGENT_LABELS[eventAgentType]}.`),
        sources: current?.sources ?? [],
        imageUrls: current?.imageUrls ?? [],
        confidence: current?.confidence,
        summary: current?.summary,
      }));
      addSystemMessage(`King asks to run ${AGENT_LABELS[eventAgentType]}: ${data.reason || data.query || "Approval needed."}`, "done");
      updateMessage(assistantId, { status: "running" });
      setStatus("Awaiting approval");
      return;
    }
    if (data.type === "agent_dispatch") {
      if (!eventAgentType) return;
      setWorkflowRailOpen(true);
      setParallelAgentState(eventAgentType, "running");
      upsertAgentWorkflow(eventAgentType, (current) => ({
        agentId: data.agentId || current?.agentId || `${eventAgentType}_${Date.now()}`,
        agentType: eventAgentType,
        jobId: data.jobId || current?.jobId,
        status: "running",
        reason: data.reason || current?.reason,
        query: data.query || current?.query,
        whyNow: data.whyNow || current?.whyNow,
        steps: appendAgentStep(current ?? {
          agentId: data.agentId || `${eventAgentType}_${Date.now()}`,
          agentType: eventAgentType,
          status: "running",
          steps: [],
          sources: [],
          imageUrls: [],
        }, data.stage, data.message || `${AGENT_LABELS[eventAgentType]} dispatched.`),
        sources: current?.sources ?? [],
        imageUrls: current?.imageUrls ?? [],
        confidence: current?.confidence,
        summary: current?.summary,
      }));
      return;
    }
    if (data.type === "agent_status" || data.type === "agent_step") {
      if (!eventAgentType) return;
      setWorkflowRailOpen(true);
      const nextStatus =
        data.status === "allowed" || data.status === "denied" || data.status === "failed" || data.status === "running"
          ? data.status
          : "running";
      setParallelAgentState(eventAgentType, nextStatus === "allowed" ? "allowed" : nextStatus === "denied" ? "denied" : nextStatus === "failed" ? "failed" : "running");
      upsertAgentWorkflow(eventAgentType, (current) => ({
        agentId: data.agentId || current?.agentId || `${eventAgentType}_${Date.now()}`,
        agentType: eventAgentType,
        jobId: data.jobId || current?.jobId,
        status: nextStatus === "allowed" ? "allowed" : nextStatus === "denied" ? "denied" : nextStatus === "failed" ? "failed" : "running",
        reason: data.reason || current?.reason,
        query: data.query || current?.query,
        whyNow: data.whyNow || current?.whyNow,
        steps: appendAgentStep(current ?? {
          agentId: data.agentId || `${eventAgentType}_${Date.now()}`,
          agentType: eventAgentType,
          status: "running",
          steps: [],
          sources: [],
          imageUrls: [],
        }, data.stage, data.message || `${AGENT_LABELS[eventAgentType]} updated.`),
        sources: normalizeAgentSources([...(current?.sources ?? []), ...(data.sources ?? [])]),
        imageUrls: Array.from(new Set([...(current?.imageUrls ?? []), ...(data.imageUrls ?? [])])),
        confidence: data.confidence ?? current?.confidence,
        summary: data.summary || current?.summary,
      }));
      if (data.status === "denied") addSystemMessage(`${AGENT_LABELS[eventAgentType]} was denied.`, "done");
      return;
    }
    if (data.type === "agent_result") {
      if (!eventAgentType) return;
      setWorkflowRailOpen(true);
      setParallelAgentState(eventAgentType, "completed");
      upsertAgentWorkflow(eventAgentType, (current) => ({
        agentId: data.agentId || current?.agentId || `${eventAgentType}_${Date.now()}`,
        agentType: eventAgentType,
        jobId: data.jobId || current?.jobId,
        status: "completed",
        reason: data.reason || current?.reason,
        query: data.query || current?.query,
        whyNow: data.whyNow || current?.whyNow,
        steps: appendAgentStep(current ?? {
          agentId: data.agentId || `${eventAgentType}_${Date.now()}`,
          agentType: eventAgentType,
          status: "completed",
          steps: [],
          sources: [],
          imageUrls: [],
        }, data.stage, data.message || `${AGENT_LABELS[eventAgentType]} complete.`),
        sources: normalizeAgentSources([...(current?.sources ?? []), ...(data.sources ?? [])]),
        imageUrls: Array.from(new Set([...(current?.imageUrls ?? []), ...(data.imageUrls ?? [])])),
        confidence: data.confidence ?? current?.confidence,
        summary: data.summary || current?.summary,
      }));
      addSystemMessage(`${AGENT_LABELS[eventAgentType]} ready${data.summary ? `: ${String(data.summary).slice(0, 180)}` : "."}`, "done");
      return;
    }
    if (data.type === "agent_error") {
      if (!eventAgentType) return;
      setWorkflowRailOpen(true);
      setParallelAgentState(eventAgentType, "failed");
      upsertAgentWorkflow(eventAgentType, (current) => ({
        agentId: data.agentId || current?.agentId || `${eventAgentType}_${Date.now()}`,
        agentType: eventAgentType,
        jobId: data.jobId || current?.jobId,
        status: "failed",
        reason: data.reason || current?.reason,
        query: data.query || current?.query,
        whyNow: data.whyNow || current?.whyNow,
        steps: appendAgentStep(current ?? {
          agentId: data.agentId || `${eventAgentType}_${Date.now()}`,
          agentType: eventAgentType,
          status: "failed",
          steps: [],
          sources: [],
          imageUrls: [],
        }, data.stage, data.message || `${AGENT_LABELS[eventAgentType]} failed.`),
        sources: current?.sources ?? [],
        imageUrls: current?.imageUrls ?? [],
        confidence: current?.confidence,
        summary: current?.summary,
      }));
      addSystemMessage(`${AGENT_LABELS[eventAgentType]} failed: ${data.message || "unknown error"}`, "error");
      return;
    }
    if (data.type === "memory") {
      addSystemMessage("Memory recall attached.", "done");
      return;
    }
    if (data.type === "web_search") {
      addSystemMessage("Web search attached.", "done");
      return;
    }
    if (data.type === "files") {
      if (Array.isArray(data.files)) {
        setFileStatus((prev) => {
          const next = { ...prev };
          data.files.forEach((f: string) => {
            if (!next[f]) next[f] = "pending";
          });
          return next;
        });
      }
      return;
    }
    if (data.type === "file_start" && data.file) {
      setFileState(data.file, "in_progress");
      addSystemMessage(`Working on ${data.file}`, "running");
      return;
    }
    if (data.type === "file_done" && data.file) {
      setFileState(data.file, "done");
      const before = data.before ?? fileSnapshots[data.file] ?? "";
      const after = data.after ?? "";
      if (after && before !== after) {
        setPendingDiffs((prev) => [...prev, { file: data.file, before, after }]);
      }
      return;
    }
    if (data.type === "token") {
      const text = data.text ?? "";
      updateMessage(assistantId, (msg) => ({ ...msg, content: `${msg.content ?? ""}${text}`, status: "running" }));
      return;
    }
    if (data.type === "understanding" || data.type === "bugs" || data.type === "security" || data.type === "performance" || data.type === "quality" || data.type === "verdict") {
      const labelMap: Record<string, string> = {
        understanding: "Understanding",
        bugs: "Bugs",
        security: "Security",
        performance: "Performance",
        quality: "Quality",
        verdict: "Verdict",
      };
      const nextChunk = `\n\n[${labelMap[data.type] ?? data.type}]\n${data.text ?? ""}`.trim();
      updateMessage(assistantId, (msg) => ({
        ...msg,
        content: `${msg.content ? `${msg.content}\n\n` : ""}${nextChunk}`,
        status: "running",
      }));
      return;
    }
    if (data.type === "credits") {
      setCreditStatus(data.credit ?? null);
      return;
    }
    if (data.type === "pause") {
      addSystemMessage(`Paused: ${data.reason || "credits exhausted"}`, "done");
      setStatus("Paused");
      updateMessage(assistantId, { status: "done" });
      return;
    }
    if (data.type === "king_override") {
      addSystemMessage(`King override: ${data.verdict} ï¿½ ${data.reason || ""}`, "done");
      return;
    }
    if (data.type === "warning") {
      addSystemMessage(data.message || data.reason || "Warning", "done");
      return;
    }
    if (data.type === "error") {
      updateMessage(assistantId, { status: "error" });
      addSystemMessage(data.message || "Pipeline error", "error");
      setStatus("Error");
      setActiveAssistantId((prev) => (prev === assistantId ? null : prev));
      return;
    }
    if (data.type === "done") {
      updateMessage(assistantId, { status: "done" });
      setStatus("Ready");
      setActiveAssistantId((prev) => (prev === assistantId ? null : prev));
    }
  };

  const consumeSseResponse = async (res: Response, assistantId: string) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Request failed");
    }
    if (!res.body) throw new Error("No response stream.");

    updateMessage(assistantId, { status: "running" });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.replace(/^data:\s*/, "");
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            handleSseEvent(parsed, assistantId);
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.replace(/^data:\s*/, "");
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          handleSseEvent(parsed, assistantId);
        } catch {
          // ignore parse errors
        }
      }
    }
  };

  const handleComposerInputChange = (value: string) => {
    const parsed = parseLeadingSlashCommands(value) as {
      tokens: Array<{ name: string; recognized: boolean }>;
      body: string;
    };
    if (parsed.tokens.length > 0) {
      setDraftCommands((prev) => mergeDraftCommands(prev, parsed.tokens.map((token) => buildCommandChip(token.name, token.recognized))));
      setInput(parsed.body);
      return;
    }
    setInput(value);
  };

  const addDraftCommand = (name: string) => {
    const normalized = name.toLowerCase();
    setDraftCommands((prev) => mergeDraftCommands(prev, [buildCommandChip(normalized, Boolean((COMMAND_REGISTRY as Record<string, any>)[normalized]))]));
  };

  const removeDraftCommand = (name: string) => {
    setDraftCommands((prev) => prev.filter((chip) => chip.name !== name));
  };

  const buildSlashStatusMessage = (commandState: Record<PersistentCommandKey, boolean> = persistentCommands) => {
    const activePolicies = (describePersistentCommands(commandState) as Array<{ name: string }>).length
      ? (describePersistentCommands(commandState) as Array<{ name: string }>).map((entry) => `/${entry.name}`).join(", ")
      : "none";
    const draftSummary = commandResolution.commands.length
      ? commandResolution.commands.map((entry: any) => `/${entry.name}`).join(", ")
      : "none";
    return `Active persistent commands: ${activePolicies}\nDraft commands: ${draftSummary}\nBase posture: ${variant} / ${section} / ${medium}`;
  };

  const buildImplicitCommandRequest = (intent: string | null) => {
    switch (intent) {
      case "git":
        return "Generate a conventional commit message for the current changes.";
      case "contextrevise":
        return "Summarize the current project state: done, pending, broken, and next.";
      case "audit":
        return activeFile ? `Audit the current file ${activeFile}.` : "Audit the current implementation.";
      case "secure":
        return activeFile ? `Perform a security review of ${activeFile}.` : "Perform a security review of the current implementation.";
      case "analyse":
        return "Analyze the current project structure before making changes.";
      case "future":
        return "Map the likely next steps for this project.";
      case "perf":
        return activeFile ? `Audit ${activeFile} for performance issues.` : "Audit the current implementation for performance issues.";
      default:
        return "";
    }
  };

  const streamCodeRequest = async (text: string, assistantId: string, requestDirectives: any, effectiveParallelAgents: ParallelAgentPreferences, temporaryCommands: string[]) => {
    const sketchContext = sketchNotes.length > 0 ? { notes: sketchNotes } : undefined;
    const res = await fetch("/api/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        variant,
        section,
        medium: medium.toLowerCase(),
        sessionId,
        activeFile,
        applyMode,
        userModel: apiKeyInfo?.model,
        parallelAgents: effectiveParallelAgents,
        temporaryCommands,
        commandDirectives: requestDirectives,
        sketchContext,
      }),
    });
    await consumeSseResponse(res, assistantId);
  };

  const streamDestroyRequest = async (text: string, assistantId: string) => {
    const res = await fetch("/api/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language: monacoLang(fileExt(activeFile)),
        context: text || `Destroy analysis for ${activeFile || "current workspace"}`,
      }),
    });
    await consumeSseResponse(res, assistantId);
  };

  const resumeAgentJob = async (jobId: string, decision: "allow" | "deny", assistantId: string) => {
    const res = await fetch(`/api/code/jobs/${jobId}/agent-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await consumeSseResponse(res, assistantId);
  };

  const handleSend = async () => {
    let text = input.trim();
    if ((!text && draftCommands.length === 0) || sending) return;

    const utilityCommands = draftCommands.filter((chip) => chip.type === "utility").map((chip) => chip.name);
    if (commandResolution.errors.length > 0) {
      addSystemMessage(commandResolution.errors[0], "error");
      return;
    }
    if (utilityCommands.length > 0 && text) {
      addSystemMessage("Utility slash commands must be sent without a prompt body.", "error");
      return;
    }

    if (!text) {
      text = buildImplicitCommandRequest(commandResolution.directives.intent);
    }

    const displayText = text || draftCommands.map((chip) => chip.token).join(" ");
    const attachments = draftAttachments.map(({ id, name, kind, size, mimeType }) => ({ id, name, kind, size, mimeType }));
    const effectiveParallelAgents: ParallelAgentPreferences = {
      webResearch: parallelAgents.webResearch || Boolean(commandResolution.directives.parallelAgents?.webResearch),
      designInspiration: parallelAgents.designInspiration || Boolean(commandResolution.directives.parallelAgents?.designInspiration),
    };
    const meta = {
      variant,
      section,
      medium,
      attachments,
      sketchNotesCount: sketchNotes.length,
      parallelAgents: effectiveParallelAgents,
      commands: draftCommands.map((chip) => chip.token),
      persistentCommands,
    };
    const userId = makeId();
    const assistantId = makeId();

    const onlyPersistentToggle = !text && draftCommands.every((chip) => chip.type === "persistent");
    const isUtilityOnly = !text && utilityCommands.length > 0;
    if (!text && !onlyPersistentToggle && !isUtilityOnly && commandResolution.directives.intent !== "destroy") {
      addSystemMessage("Add a request after your slash commands.", "error");
      return;
    }

    appendMessage({ id: userId, role: "user", content: displayText, status: "done", meta });
    appendMessage({ id: assistantId, role: "assistant", content: "", status: "queued", meta: { variant, section, medium } });
    setInput("");
    setDraftAttachments([]);
    resetDraftCommands();
    setSending(true);
    setStatus("Queued...");
    setFileStatus({});
    setParallelAgentStates({
      webResearch: effectiveParallelAgents.webResearch ? "requested" : "idle",
      designInspiration: effectiveParallelAgents.designInspiration ? "requested" : "idle",
    });
    setAgentWorkflows([]);
    setWorkflowRailOpen(false);
    setActiveAssistantId(assistantId);

    try {
      if (Object.keys(commandResolution.toggledPersistent).length > 0) {
        await persistCommands(commandResolution.nextPersistent as Record<PersistentCommandKey, boolean>);
      }

      if (utilityCommands.includes("commands")) {
        setCommandSheetOpen(true);
      }
      if (utilityCommands.includes("resetmode")) {
        await persistCommands({ ...DEFAULT_PERSISTENT_COMMANDS });
      }
      if (utilityCommands.includes("status")) {
        updateMessage(assistantId, {
          content: buildSlashStatusMessage(commandResolution.nextPersistent as Record<PersistentCommandKey, boolean>),
          status: "done",
        });
        setStatus("Ready");
        setActiveAssistantId(null);
        if (utilityCommands.length > 0 && !text) return;
      }
      if (utilityCommands.includes("commands") && utilityCommands.length > 0 && !text) {
        updateMessage(assistantId, { content: "Command reference opened.", status: "done" });
        setStatus("Ready");
        setActiveAssistantId(null);
        return;
      }
      if (utilityCommands.includes("resetmode") && utilityCommands.length > 0 && !text) {
        updateMessage(assistantId, { content: "Persistent slash commands cleared.", status: "done" });
        setStatus("Ready");
        setActiveAssistantId(null);
        return;
      }
      if (onlyPersistentToggle) {
        const changed = Object.entries(commandResolution.toggledPersistent)
          .map(([name, enabled]) => `${enabled ? "Enabled" : "Disabled"} /${name}`)
          .join("\n");
        updateMessage(assistantId, { content: changed || "Session mode unchanged.", status: "done" });
        setStatus("Ready");
        setActiveAssistantId(null);
        return;
      }

      if (text.startsWith("#")) {
        const cmd = text.slice(1).trim();
        setWorkspaceTab("terminal");
        setPreviewTab("console");
        const output = cmd ? await runTerminalCommand(cmd) : "No command provided.";
        updateMessage(assistantId, { content: output, status: "done" });
        setStatus("Ready");
        setActiveAssistantId(null);
      } else if (commandResolution.directives.intent === "destroy") {
        await streamDestroyRequest(text, assistantId);
      } else {
        await streamCodeRequest(
          text,
          assistantId,
          commandResolution.directives,
          effectiveParallelAgents,
          commandResolution.directives.temporaryCommands ?? [],
        );
      }
    } catch (err: any) {
      updateMessage(assistantId, { status: "error", content: err?.message || "Request failed." });
      setStatus("Error");
      setActiveAssistantId((prev) => (prev === assistantId ? null : prev));
    } finally {
      setSending(false);
    }
  };

  const handleAgentDecision = async (jobId: string, decision: "allow" | "deny") => {
    const assistantId = activeAssistantId ?? [...messages].reverse().find((msg) => msg.role === "assistant" && msg.status !== "done" && msg.status !== "error")?.id;
    if (!assistantId) return;
    setWorkflowRailOpen(true);
    setSending(true);
    setStatus(decision === "allow" ? "Resuming with agent..." : "Resuming without agent...");
    try {
      await resumeAgentJob(jobId, decision, assistantId);
    } catch (err: any) {
      addSystemMessage(err?.message || "Failed to resume the King pipeline.", "error");
      setStatus("Error");
    } finally {
      setSending(false);
    }
  };

  const rewritePathReferences = (from: string, to: string) => {
    const remap = (value: string) => {
      if (!value) return value;
      if (value === from) return to;
      if (value.startsWith(`${from}/`)) return `${to}${value.slice(from.length)}`;
      return value;
    };
    setOpenTabs((prev) => prev.map(remap));
    setActiveFile((prev) => remap(prev));
    setSelectedExplorerPath((prev) => remap(prev));
    setFileSnapshots((prev) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) next[remap(key)] = value;
      return next;
    });
    setFileStatus((prev) => {
      const next: Record<string, FileStatus> = {};
      for (const [key, value] of Object.entries(prev)) next[remap(key)] = value;
      return next;
    });
  };

  const removePathReferences = (targetPath: string) => {
    const matches = (value: string) => value === targetPath || value.startsWith(`${targetPath}/`);
    setOpenTabs((prev) => prev.filter((entry) => !matches(entry)));
    setActiveFile((prev) => (matches(prev) ? "" : prev));
    setSelectedExplorerPath((prev) => (matches(prev) ? "" : prev));
    setFileSnapshots((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !matches(key))));
    setFileStatus((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !matches(key))) as Record<string, FileStatus>);
  };

  const pickDirectoryEntries = async (
    handle: FileSystemDirectoryHandle,
    prefix = "",
    bucket: { files: Record<string, LocalWorkspaceFile>; folders: Set<string> } = { files: {}, folders: new Set() },
  ) => {
    for await (const entry of (handle as any).values()) {
      const name = entry.name;
      const nextPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === "directory") {
        bucket.folders.add(nextPath);
        await pickDirectoryEntries(entry, nextPath, bucket);
      } else {
        bucket.files[nextPath] = {
          path: nextPath,
          handle: entry,
          readOnly: false,
        };
      }
    }
    return bucket;
  };

  const refreshLocalWorkspaceFromHandle = async () => {
    if (!localRootDirRef.current) return;
    const next = await pickDirectoryEntries(localRootDirRef.current);
    localFilesRef.current = next.files;
    localFoldersRef.current = next.folders;
    rebuildLocalTree();
  };

  const getLocalDirectoryHandle = async (relativePath = "", create = false) => {
    if (!localRootDirRef.current) throw new Error("Local directory write access is unavailable.");
    let current = localRootDirRef.current;
    const normalized = normalizeEntryPath(relativePath);
    if (!normalized) return current;
    const parts = normalized.split("/").filter(Boolean);
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create });
    }
    return current;
  };

  const createLocalEntry = async (relativePath: string, entryType: "file" | "folder", content = "") => {
    const normalized = normalizeEntryPath(relativePath);
    if (!normalized) throw new Error("Path required.");
    const parentPath = dirnamePath(normalized);
    const parentHandle = await getLocalDirectoryHandle(parentPath, true);
    const name = normalized.split("/").pop() ?? normalized;
    if (entryType === "folder") {
      await parentHandle.getDirectoryHandle(name, { create: true });
      localFoldersRef.current.add(normalized);
      await refreshLocalWorkspaceFromHandle();
      return;
    }
    const fileHandle = await parentHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    localFilesRef.current[normalized] = {
      path: normalized,
      handle: fileHandle,
      file: await fileHandle.getFile(),
      readOnly: false,
    };
    await refreshLocalWorkspaceFromHandle();
  };

  const removeLocalEntry = async (relativePath: string, entryType: "file" | "folder") => {
    const normalized = normalizeEntryPath(relativePath);
    const parentHandle = await getLocalDirectoryHandle(dirnamePath(normalized));
    const name = normalized.split("/").pop();
    if (!name) throw new Error("Invalid path.");
    await parentHandle.removeEntry(name, { recursive: entryType === "folder" });
    await refreshLocalWorkspaceFromHandle();
  };

  const copyLocalFile = async (from: string, to: string) => {
    const sourceEntry = localFilesRef.current[from];
    if (!sourceEntry?.handle) throw new Error("Source file handle is unavailable.");
    const sourceFile = await sourceEntry.handle.getFile();
    const destinationParent = await getLocalDirectoryHandle(dirnamePath(to), true);
    const destinationName = normalizeEntryPath(to).split("/").pop();
    if (!destinationName) throw new Error("Invalid destination path.");
    const destinationHandle = await destinationParent.getFileHandle(destinationName, { create: true });
    const writable = await destinationHandle.createWritable();
    await writable.write(await sourceFile.arrayBuffer());
    await writable.close();
  };

  const copyLocalFolder = async (from: string, to: string) => {
    const sourceHandle = await getLocalDirectoryHandle(from, false);
    await getLocalDirectoryHandle(to, true);
    for await (const entry of (sourceHandle as any).values()) {
      const sourcePath = `${from}/${entry.name}`;
      const targetPath = `${to}/${entry.name}`;
      if (entry.kind === "directory") {
        await copyLocalFolder(sourcePath, targetPath);
      } else {
        const sourceFile = await entry.getFile();
        const parentHandle = await getLocalDirectoryHandle(dirnamePath(targetPath), true);
        const fileHandle = await parentHandle.getFileHandle(entry.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(await sourceFile.arrayBuffer());
        await writable.close();
      }
    }
  };

  const moveLocalEntry = async (from: string, to: string, entryType: "file" | "folder") => {
    if (entryType === "folder") {
      await copyLocalFolder(from, to);
      await removeLocalEntry(from, "folder");
      return;
    }
    await copyLocalFile(from, to);
    await removeLocalEntry(from, "file");
  };

  const createWorkspaceEntry = async (relativePath: string, entryType: "file" | "folder", content = "") => {
    if (workspaceSource === "local") {
      if (localReadOnly || !localRootDirRef.current) throw new Error("This local workspace is read-only in the current browser.");
      await createLocalEntry(relativePath, entryType, content);
      return;
    }
    await fetch("/api/fs/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: relativePath, type: entryType, content }),
    });
    await refreshFileTree();
  };

  const moveWorkspaceEntry = async (from: string, to: string, entryType: "file" | "folder") => {
    if (workspaceSource === "local") {
      if (localReadOnly || !localRootDirRef.current) throw new Error("This local workspace is read-only in the current browser.");
      await moveLocalEntry(from, to, entryType);
      rewritePathReferences(from, to);
      expandFoldersForPath(to);
      return;
    }
    await fetch("/api/fs/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    rewritePathReferences(from, to);
    expandFoldersForPath(to);
    await refreshFileTree();
  };

  const deleteWorkspaceEntry = async (targetPath: string, entryType: "file" | "folder") => {
    if (workspaceSource === "local") {
      if (localReadOnly || !localRootDirRef.current) throw new Error("This local workspace is read-only in the current browser.");
      await removeLocalEntry(targetPath, entryType);
      removePathReferences(targetPath);
      return;
    }
    await fetch("/api/fs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: targetPath }),
    });
    removePathReferences(targetPath);
    await refreshFileTree();
  };

  const openSystemFile = async () => {
    try {
      const pickerWindow = window as Window & {
        showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
      };
      if (pickerWindow.showOpenFilePicker) {
        const [handle] = await pickerWindow.showOpenFilePicker();
        if (!handle) return;
        const file = await handle.getFile();
        await registerPickedFile(file, handle);
        return;
      }

      filePickerRef.current?.click();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        addSystemMessage(err?.message || "Unable to open the selected file.", "error");
      }
    }
  };

  const openSystemFolder = async () => {
    try {
      const pickerWindow = window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      };
      if (pickerWindow.showDirectoryPicker) {
        const handle = await pickerWindow.showDirectoryPicker();
        const entries = await pickDirectoryEntries(handle);
        await registerPickedFolder(entries.files, handle.name || "Local Folder", false, entries.folders, handle);
        return;
      }

      folderPickerRef.current?.click();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        addSystemMessage(err?.message || "Unable to open the selected folder.", "error");
      }
    }
  };

  const handlePickedFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await registerPickedFile(file);
  };

  const handlePickedFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const entries: Record<string, LocalWorkspaceFile> = {};
    const folders = new Set<string>();
    for (const file of files) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      entries[relativePath] = {
        path: relativePath,
        file,
        readOnly: true,
      };
      let parent = dirnamePath(relativePath);
      while (parent) {
        folders.add(parent);
        parent = dirnamePath(parent);
      }
    }

    const firstPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || files[0].name;
    const label = firstPath.split("/")[0] || "Selected Folder";
    await registerPickedFolder(entries, label, true, folders);
    addSystemMessage("Folder opened in read-only browser fallback mode.", "done");
  };

  const startCreateEntry = (entryType: "file" | "folder") => {
    const selectedNode = selectedExplorerPath ? findNodeById(fileTree, selectedExplorerPath) : null;
    const parentPath = !selectedNode ? "" : selectedNode.type === "folder" ? selectedNode.id : dirnamePath(selectedNode.id);
    if (parentPath) {
      setOpenFolders((prev) => new Set([...prev, parentPath]));
    }
    setExplorerDraft({
      mode: "create",
      type: entryType,
      parentPath,
      value: "",
    });
  };

  const startRenameEntry = (node: FileNode) => {
    if ((workspaceSource === "local" && localReadOnly) || !node?.id) return;
    setSelectedExplorerPath(node.id);
    setExplorerDraft({
      mode: "rename",
      type: node.type,
      parentPath: dirnamePath(node.id),
      targetPath: node.id,
      value: node.name,
    });
  };

  const commitExplorerDraft = async () => {
    if (!explorerDraft) return;
    const cleanValue = explorerDraft.value.trim().replace(/\\/g, "/");
    if (!cleanValue) {
      setExplorerDraft(null);
      return;
    }
    const nextPath = normalizeEntryPath(explorerDraft.parentPath ? `${explorerDraft.parentPath}/${cleanValue}` : cleanValue);
    try {
      if (explorerDraft.mode === "rename" && explorerDraft.targetPath) {
        if (nextPath && nextPath !== explorerDraft.targetPath) {
          await moveWorkspaceEntry(explorerDraft.targetPath, nextPath, explorerDraft.type);
        }
      } else if (explorerDraft.mode === "create") {
        await createWorkspaceEntry(nextPath, explorerDraft.type, "");
        setSelectedExplorerPath(nextPath);
        if (explorerDraft.type === "file") {
          openFile(nextPath);
          snapshotFile(nextPath, "");
          setCode("");
        }
        expandFoldersForPath(nextPath);
      }
    } catch (err: any) {
      addSystemMessage(err?.message || "Unable to update explorer item.", "error");
    } finally {
      setExplorerDraft(null);
    }
  };

  const deleteExplorerNode = async (node: FileNode) => {
    const ok = window.confirm(`Delete ${node.id}?`);
    if (!ok) return;
    try {
      await deleteWorkspaceEntry(node.id, node.type);
    } catch (err: any) {
      addSystemMessage(err?.message || "Unable to delete explorer item.", "error");
    }
  };

  const openFile = (id: string) => {
    setPanelMode("editor");
    setWorkspaceTab("code");
    setActiveFile(id);
    setSelectedExplorerPath(id);
    expandFoldersForPath(id);
    if (!openTabs.includes(id)) setOpenTabs((prev) => [...prev, id]);
  };
  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = openTabs.filter((t) => t !== id);
    setOpenTabs(next);
    if (activeFile === id) setActiveFile(next[next.length - 1] ?? "");
  };

  const fileName = (id: string) => id.split("/").pop() ?? id;
  const fileExt = (id: string) => id.split(".").pop() ?? "";
  const downloadFile = () => {
    const name = activeFile ? fileName(activeFile) : "";
    const safeName = name || "untitled.txt";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePreviewUrlApply = (nextUrl: string) => {
    setPreviewUrl(nextUrl);
    if (nextUrl) {
      appendConsoleEntry({ source: "system", level: "info", text: `Preview URL loaded: ${nextUrl}` });
    } else {
      appendConsoleEntry({ source: "system", level: "info", text: "Switched back to file preview." });
    }
  };

  const handleUseFilePreview = () => {
    setPreviewUrl("");
    appendConsoleEntry({ source: "system", level: "info", text: "Using active file preview." });
  };

  const handleClearConsole = () => {
    setConsoleEntries([]);
  };

  const canCreateExplorerItem = workspaceSource === "project" || (workspaceSource === "local" && !localReadOnly && !!localRootDirRef.current);
  const canRenameExplorerItem = canCreateExplorerItem;
  const canDeleteExplorerItem = canCreateExplorerItem;
  const canMoveExplorerItem = canCreateExplorerItem;

  const validateDropTarget = (source: ExplorerDragState, target: FileNode | null) => {
    if (!source) return false;
    if (!target) return true;
    if (target.type !== "folder") return false;
    if (target.id === source.sourceId) return false;
    if (source.sourceType === "folder" && target.id.startsWith(`${source.sourceId}/`)) return false;
    return true;
  };

  const handleToggleFolder = (id: string) => {
    setSelectedExplorerPath(id);
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExplorerDragStart = (node: FileNode) => {
    if (!canMoveExplorerItem) return;
    setSelectedExplorerPath(node.id);
    setExplorerDragState({ sourceId: node.id, sourceType: node.type, targetId: null, valid: false });
  };

  const handleExplorerDragOverTarget = (node: FileNode) => {
    setExplorerDragState((prev) => {
      if (!prev) return prev;
      const valid = validateDropTarget(prev, node);
      return { ...prev, targetId: node.id, valid };
    });
    if (node.type === "folder" && !openFolders.has(node.id)) {
      clearDragExpandTimeout();
      dragExpandTimeoutRef.current = window.setTimeout(() => {
        setOpenFolders((prev) => new Set([...prev, node.id]));
      }, 220);
    }
  };

  const handleExplorerDragLeaveTarget = (node: FileNode) => {
    clearDragExpandTimeout();
    setExplorerDragState((prev) => (prev && prev.targetId === node.id ? { ...prev, targetId: null, valid: false } : prev));
  };

  const handleExplorerDropTarget = async (node: FileNode) => {
    clearDragExpandTimeout();
    const state = explorerDragState;
    if (!state || !validateDropTarget(state, node)) {
      setExplorerDragState(null);
      return;
    }
    const name = state.sourceId.split("/").pop() ?? state.sourceId;
    const nextPath = normalizeEntryPath(`${node.id}/${name}`);
    if (nextPath === state.sourceId) {
      setExplorerDragState(null);
      return;
    }
    try {
      await moveWorkspaceEntry(state.sourceId, nextPath, state.sourceType);
      setSelectedExplorerPath(nextPath);
    } catch (err: any) {
      addSystemMessage(err?.message || "Unable to move explorer item.", "error");
    } finally {
      setExplorerDragState(null);
    }
  };

  const handleExplorerDropRoot = async () => {
    clearDragExpandTimeout();
    const state = explorerDragState;
    if (!state) return;
    const name = state.sourceId.split("/").pop() ?? state.sourceId;
    const nextPath = normalizeEntryPath(name);
    if (!nextPath || nextPath === state.sourceId) {
      setExplorerDragState(null);
      return;
    }
    try {
      await moveWorkspaceEntry(state.sourceId, nextPath, state.sourceType);
      setSelectedExplorerPath(nextPath);
    } catch (err: any) {
      addSystemMessage(err?.message || "Unable to move explorer item.", "error");
    } finally {
      setExplorerDragState(null);
    }
  };

  const appendDraftAttachments = (files: FileList | File[], kind: "file" | "image") => {
    const nextAttachments = Array.from(files).map((file) => ({
      id: [file.name, file.size, file.lastModified, kind].join("-"),
      name: file.name,
      kind,
      size: file.size,
      mimeType: file.type,
    }));
    setDraftAttachments((prev) => {
      const known = new Set(prev.map((entry) => entry.id));
      return [...prev, ...nextAttachments.filter((entry) => !known.has(entry.id))];
    });
  };

  const handleAttachFiles = () => {
    attachmentFilePickerRef.current?.click();
  };

  const handleAttachImages = () => {
    attachmentImagePickerRef.current?.click();
  };

  const handleAttachmentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => !file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    appendDraftAttachments(files, "file");
  };

  const handleAttachmentImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const images = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!images.length) return;
    appendDraftAttachments(images, "image");
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setDraftAttachments((prev) => prev.filter((entry) => entry.id !== attachmentId));
  };

  useEffect(() => () => clearDragExpandTimeout(), []);
  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--builder-border);border-radius:999px}
        .tab-btn:hover .tab-close{opacity:1 !important}
        .ghost-btn{background:var(--builder-glass);border:1px solid var(--builder-border);color:var(--builder-muted-strong);border-radius:999px;padding:8px 14px;font-family:'SF Mono','JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;cursor:pointer;transition:all 0.2s}
        .ghost-btn:hover{border-color:rgba(var(--accent-rgb),0.24);color:var(--text-primary);background:var(--accent-soft)}
        .ghost-icon-btn{width:30px;height:30px;border:1px solid var(--builder-border);background:var(--builder-glass);color:var(--builder-muted);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s}
        .ghost-icon-btn:hover{border-color:rgba(var(--accent-rgb),0.22);color:var(--text-primary);background:var(--accent-soft)}
        .ghost-icon-btn:disabled{opacity:0.4;cursor:not-allowed}
        .coming-soon .coming-tooltip{opacity:0;transform:translateX(-4px);transition:all 0.18s ease;pointer-events:none}
        .coming-soon:hover .coming-tooltip{opacity:1;transform:translateX(0)}
      `}</style>
      <div className="builder-shell" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif" }}>
        <div
          className="builder-rail"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "12px 0",
            gap: 8,
            zIndex: 20,
          }}
        >
          <div style={{ color: "var(--accent-strong)", cursor: "pointer" }} onClick={() => navigate("/dashboard")} title="Dashboard">
            <Logo size={20} />
          </div>
          <div style={{ height: 0.5, width: 28, background: "var(--builder-border)", margin: "6px 0 2px" }} />
          {([
            { id: "lab", label: "Lab", icon: IFlask, active: true },
            { id: "integration", label: "Integration", icon: IPlug, comingSoon: true },
            { id: "knowledge", label: "Knowledge", icon: IBrain, comingSoon: true },
            { id: "database", label: "Database", icon: IDatabase, comingSoon: true },
          ] as const).map((item) => {
            const Icon = item.icon;
            const isActive = "active" in item && item.active;
            const isSoon = "comingSoon" in item && item.comingSoon;
            const button = (
              <button
                key={item.id}
                title={item.label}
                onClick={() => {}}
                style={{
                  width: 56,
                  height: 56,
                  border: "none",
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  color: isActive ? "var(--accent-strong)" : "var(--builder-muted)",
                  opacity: isSoon ? 0.4 : 1,
                  cursor: isSoon ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  position: "relative",
                  boxSizing: "border-box",
                  borderLeft: isActive ? "2px solid var(--accent-strong)" : "2px solid transparent",
                }}
              >
                <span style={{ display: "flex" }}><Icon /></span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: "0.08em" }}>{item.label}</span>
              </button>
            );
            return isSoon ? <ComingSoonTooltip key={item.id}>{button}</ComingSoonTooltip> : button;
          })}
          <div style={{ flex: 1 }} />
        </div>
        {chatOpen ? (
          <AIPanel
            variant={variant}
            section={section}
            medium={medium}
            input={input}
            onInputChange={handleComposerInputChange}
            onSend={handleSend}
            status={status}
            sending={sending}
            messages={messages}
            fileStatus={fileStatus}
            creditStatus={creditStatus}
            applyMode={applyMode}
            onApplyModeChange={setApplyMode}
            apiKeyInfo={apiKeyInfo}
            onSetApiKey={handleSetApiKey}
            onVariantChange={setVariant}
            onSectionChange={setSection}
            onMediumChange={setMedium}
            parallelAgents={parallelAgents}
            parallelStatuses={parallelAgentStates}
            onParallelAgentToggle={handleParallelAgentToggle}
            attachments={draftAttachments}
            sketchNotesCount={sketchNotes.length}
            onOpenSketchBoard={() => setSketchBoardOpen(true)}
            onAttachFiles={handleAttachFiles}
            onAttachImages={handleAttachImages}
            onRemoveAttachment={handleRemoveAttachment}
            draftCommands={draftCommands}
            commandErrors={commandResolution.errors}
            commandWarnings={[...commandResolution.warnings, ...commandResolution.notices]}
            canSend={Boolean(input.trim() || draftCommands.length)}
            commandSheetOpen={commandSheetOpen}
            onCommandSheetOpenChange={setCommandSheetOpen}
            onAddDraftCommand={addDraftCommand}
            onRemoveDraftCommand={removeDraftCommand}
            onClose={() => setChatOpen(false)}
          />
        ) : null}
        <div className="builder-main">
          <div className="builder-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {panelMode === "editor" ? (
                <button
                  onClick={() => setFileTreeOpen((v) => !v)}
                  title="Toggle explorer"
                style={{
                    background: fileTreeOpen ? "var(--accent-soft)" : "transparent",
                    border: fileTreeOpen ? "1px solid rgba(var(--accent-rgb), 0.24)" : "1px solid transparent",
                    color: fileTreeOpen ? "var(--accent-strong)" : "var(--builder-muted)",
                    cursor: "pointer",
                    display: "flex",
                    padding: "6px 8px",
                    borderRadius: 10,
                    transition: "all 0.15s",
                  }}
                >
                  <IMenu />
                </button>
              ) : null}
              <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 10, color: "var(--builder-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeFile
                  ? activeFile.split("/").map((p, i, a) => (
                      <span key={`${p}-${i}`}>
                        <span style={{ color: i === a.length - 1 ? "var(--text-primary)" : "var(--builder-muted-soft)" }}>{p}</span>
                        {i < a.length - 1 ? <span style={{ color: "var(--text-quaternary)", margin: "0 3px" }}>/</span> : null}
                      </span>
                    ))
                  : <span style={{ color: "var(--builder-muted-soft)" }}>{workspaceLabel}</span>}
              </div>
              {workspaceSource === "local" ? (
                <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, color: localReadOnly ? "#d97706" : "var(--accent-strong)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  {localReadOnly ? "LOCAL READ ONLY" : "LOCAL FOLDER"}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", padding: 2, borderRadius: 999, border: "1px solid var(--builder-border)", background: "var(--builder-glass)" }}>
                <button onClick={() => setPanelMode("editor")} style={{ background: panelMode === "editor" ? "var(--accent-soft)" : "transparent", border: "none", color: panelMode === "editor" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>EDITOR</button>
                <button onClick={() => setPanelMode("preview")} style={{ background: panelMode === "preview" ? "var(--accent-soft)" : "transparent", border: "none", color: panelMode === "preview" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>PREVIEW</button>
              </div>
              {panelMode === "editor" ? (
                <div style={{ display: "flex", alignItems: "center", padding: 2, borderRadius: 999, border: "1px solid var(--builder-border)", background: "var(--builder-glass)" }}>
                  <button onClick={() => setWorkspaceTab("code")} style={{ background: workspaceTab === "code" ? "var(--accent-soft)" : "transparent", border: "none", color: workspaceTab === "code" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>CODE</button>
                  <button onClick={() => setWorkspaceTab("terminal")} style={{ background: workspaceTab === "terminal" ? "var(--accent-soft)" : "transparent", border: "none", color: workspaceTab === "terminal" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>TERMINAL</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", padding: 2, borderRadius: 999, border: "1px solid var(--builder-border)", background: "var(--builder-glass)" }}>
                  <button onClick={() => setPreviewTab("preview")} style={{ background: previewTab === "preview" ? "var(--accent-soft)" : "transparent", border: "none", color: previewTab === "preview" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>PREVIEW</button>
                  <button onClick={() => setPreviewTab("console")} style={{ background: previewTab === "console" ? "var(--accent-soft)" : "transparent", border: "none", color: previewTab === "console" ? "var(--accent-strong)" : "var(--builder-muted)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em" }}>CONSOLE</button>
                </div>
              )}
              <button
                onClick={() => { setPanelMode("editor"); setWorkspaceTab("terminal"); }}
                title="Open terminal"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--builder-border)", background: "var(--builder-glass)", color: "var(--builder-muted-strong)", cursor: "pointer", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em", transition: "all 0.15s" }}
              >
                <IPlay /> OPEN
              </button>
              <button onClick={downloadFile} title="Download file" style={{ background: "none", border: "none", color: "var(--builder-muted)", cursor: "pointer", display: "flex", padding: 4 }}><IDownload /></button>
              {!chatOpen ? (
                <button onClick={() => setChatOpen(true)} title="Open chat" style={{ background: "var(--accent-soft)", border: "1px solid rgba(var(--accent-rgb), 0.24)", color: "var(--accent-strong)", cursor: "pointer", display: "flex", padding: "6px 8px", borderRadius: 10 }}><IBot /></button>
              ) : null}
            </div>
          </div>
          {panelMode === "editor" ? (
            <div style={{ height: 38, flexShrink: 0, display: "flex", alignItems: "center", background: "var(--builder-glass)", borderBottom: "1px solid var(--builder-border)", overflow: "hidden" }}>
              {openTabs.map((tab) => {
                const ext = fileExt(tab);
                const dotC = LANG_COLORS[ext] ?? "#6B7280";
                const isAct = tab === activeFile;
                return (
                  <div
                    key={tab}
                    className="tab-btn"
                    onClick={() => openFile(tab)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", height: "100%", cursor: "pointer", background: isAct ? "var(--accent-soft)" : "transparent", borderRight: "1px solid var(--builder-border)", borderBottom: isAct ? "1px solid var(--accent-strong)" : "1px solid transparent", minWidth: 0, flexShrink: 0 }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotC, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 11, color: isAct ? "var(--text-primary)" : "var(--builder-muted)", whiteSpace: "nowrap" }}>{fileName(tab)}</span>
                    <span className="tab-close" onClick={(e) => closeTab(tab, e)} style={{ opacity: 0, color: "var(--builder-muted)", display: "flex", transition: "opacity 0.1s", cursor: "pointer", marginLeft: 2 }}><IClose /></span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            {panelMode === "editor" && fileTreeOpen ? (
              <div style={{ width: 286, flexShrink: 0, background: "var(--builder-glass)", borderRight: "1px solid var(--builder-border)", display: "flex", overflow: "hidden", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}>
                <div style={{ width: 44, borderRight: "1px solid var(--builder-border)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 8, background: "var(--builder-sidebar-bg)" }}>
                  <button title="Files" style={{ width: 30, height: 30, border: "none", background: "var(--accent-soft)", color: "var(--accent-strong)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><IFiles /></button>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--builder-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "'SF Mono','JetBrains Mono',monospace", color: "var(--builder-muted)", letterSpacing: "0.08em" }}>EXPLORER</div>
                      <div style={{ fontSize: 11, color: "var(--builder-muted-strong)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspaceLabel}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button className="ghost-icon-btn" onClick={() => startCreateEntry("file")} disabled={!canCreateExplorerItem} title="New File"><IPlus /></button>
                      <button className="ghost-icon-btn" onClick={() => startCreateEntry("folder")} disabled={!canCreateExplorerItem} title="New Folder"><IFolderPlus /></button>
                      <button className="ghost-icon-btn" onClick={() => void (workspaceSource === "project" ? refreshFileTree() : refreshLocalWorkspaceFromHandle())} title="Refresh"><IRefresh /></button>
                      <button className="ghost-icon-btn" onClick={() => setOpenFolders(new Set())} title="Collapse All"><ICollapse /></button>
                    </div>
                  </div>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--builder-border)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button className="ghost-btn" onClick={() => void openSystemFile()}>Open File</button>
                    <button className="ghost-btn" onClick={() => void openSystemFolder()}>Open Folder</button>
                    {workspaceSource === "local" ? <button className="ghost-btn" onClick={() => void openProjectWorkspace()}>Project</button> : null}
                    {localReadOnly ? <span style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 9, color: "#d97706", letterSpacing: "0.08em", alignSelf: "center" }}>READ ONLY</span> : null}
                  </div>
                  <FileTree
                    tree={fileTree}
                    activeFile={activeFile}
                    selectedPath={selectedExplorerPath}
                    draft={explorerDraft}
                    openFolders={openFolders}
                    canRename={canRenameExplorerItem}
                    canDelete={canDeleteExplorerItem}
                    dragState={explorerDragState}
                    onSelectPath={setSelectedExplorerPath}
                    onOpenFile={openFile}
                    onToggleFolder={handleToggleFolder}
                    onStartRename={startRenameEntry}
                    onDelete={deleteExplorerNode}
                    onDraftChange={(value) => setExplorerDraft((prev) => (prev ? { ...prev, value } : prev))}
                    onCommitDraft={() => void commitExplorerDraft()}
                    onCancelDraft={() => setExplorerDraft(null)}
                    onDragStart={handleExplorerDragStart}
                    onDragOverTarget={handleExplorerDragOverTarget}
                    onDragLeaveTarget={handleExplorerDragLeaveTarget}
                    onDropTarget={(node) => void handleExplorerDropTarget(node)}
                    onDropRoot={() => void handleExplorerDropRoot()}
                  />
                </div>
              </div>
            ) : null}
            <EditorSection
              activeFile={activeFile}
              code={code}
              fileState={activeFileState}
              openTabsCount={openTabs.length}
              panelMode={panelMode}
              workspaceTab={workspaceTab}
              previewTab={previewTab}
              previewUrl={previewUrl}
              terminalPanel={<Terminal activeFile={activeFile} sessionId={sessionId} onConsoleEntry={appendConsoleEntry} />}
              consoleEntries={consoleEntries}
              onCodeChange={setCode}
              onPreviewTabChange={setPreviewTab}
              onPreviewUrlApply={handlePreviewUrlApply}
              onUseFilePreview={handleUseFilePreview}
              onClearConsole={handleClearConsole}
              onPreviewConsoleEvent={appendConsoleEntry}
            />
            <input ref={filePickerRef} type="file" onChange={handlePickedFileChange} style={{ display: "none" }} />
            <input ref={folderPickerRef} type="file" multiple onChange={handlePickedFolderChange} style={{ display: "none" }} />
            <input ref={attachmentFilePickerRef} type="file" multiple onChange={handleAttachmentFileChange} style={{ display: "none" }} />
            <input ref={attachmentImagePickerRef} type="file" accept="image/*" multiple onChange={handleAttachmentImageChange} style={{ display: "none" }} />
          </div>
        </div>
        {workflowRailOpen && agentWorkflows.length > 0 ? (
          <AgentWorkflowRail
            workflows={agentWorkflows}
            onClose={() => setWorkflowRailOpen(false)}
            onDecision={handleAgentDecision}
          />
        ) : null}
      </div>
      <SketchBoard
        open={sketchBoardOpen}
        value={sketchBoard}
        onChange={setSketchBoard}
        onNotesChange={() => {
          // sketch note chips are derived from board state in the shell
        }}
        onClose={() => setSketchBoardOpen(false)}
      />
      {currentDiff ? (
        <div style={{ position: "fixed", inset: 0, background: "var(--builder-overlay)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(1100px, 96%)", height: "min(80vh, 820px)", background: "var(--bg-elevated)", border: "1px solid var(--builder-border)", borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--builder-border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.08em", color: "var(--accent-strong)" }}>
              <span>REVIEW AI CHANGES</span>
              <span style={{ color: "var(--builder-muted)" }}>{currentDiff.file}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <DiffEditor
                height="100%"
                original={currentDiff.before}
                modified={currentDiff.after}
                language={monacoLang(fileExt(currentDiff.file))}
                theme={tokens.diffTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--builder-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={handleRejectDiff}
                style={{
                  border: "1px solid rgba(239,68,68,0.22)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#dc2626",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontFamily: "'SF Mono','JetBrains Mono',monospace",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
              <button
                onClick={handleAcceptDiff}
                style={{
                  border: "1px solid rgba(0,122,255,0.2)",
                  background: "rgba(0,122,255,0.08)",
                  color: "#007aff",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontFamily: "'SF Mono','JetBrains Mono',monospace",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="builder-statusbar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 600 }}>KAUTILYA CODE</span>
          <span>{(VARIANTS.find((v) => v.id === variant) ?? VARIANTS[0]).badge} mode</span>
          <span>{section}</span>
          {sketchNotes.length > 0 ? (
            <span style={{ color: "rgba(255,255,255,0.82)" }}>
              {sketchNotes.length} sketch note{sketchNotes.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {activePersistentIndicators.map((entry) => (
            <span
              key={entry.name}
              style={{
                color: "var(--builder-status-text)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "1px 6px",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {entry.indicator || entry.chipLabel || entry.name}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>{monacoLang(fileExt(activeFile)).toUpperCase()}</span>
          <span>
            {creditStatus ? `${creditStatus.used} / ${creditStatus.limit} cords` : "cords --"}
          </span>
          <span>UTF-8</span>
        </div>
      </div>
    </>
  );
}



