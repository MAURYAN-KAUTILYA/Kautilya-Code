import type { ReactNode } from "react";
import Editor from "@monaco-editor/react";
import KautilyaLogo from "@/components/KautilyaLogo";
import { useAppTheme } from "@/theme/AppThemeProvider";
import PreviewSection from "./preview";

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

interface EditorSectionProps {
  activeFile: string;
  code: string;
  fileState: ActiveFileState;
  openTabsCount: number;
  panelMode: "editor" | "preview";
  workspaceTab: "code" | "terminal";
  previewTab: "preview" | "console";
  previewUrl: string;
  terminalPanel: ReactNode;
  consoleEntries: ConsoleLine[];
  onCodeChange: (value: string) => void;
  onPreviewTabChange: (tab: "preview" | "console") => void;
  onPreviewUrlApply: (url: string) => void;
  onUseFilePreview: () => void;
  onClearConsole: () => void;
  onPreviewConsoleEvent: (entry: Omit<ConsoleLine, "id" | "timestamp">) => void;
}

const surface = {
  border: "1px solid var(--builder-border)",
  borderRadius: 22,
  background: "var(--builder-glass)",
  boxShadow: "var(--shadow-md)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
} as const;

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
      html: "html",
    } as Record<string, string>
  )[ext] ?? "plaintext";

const fileExt = (id: string) => id.split(".").pop() ?? "";

function EmptyState() {
  return (
    <div
      style={{
        ...surface,
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 16, textAlign: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            background: "var(--bg-elevated)",
            border: "1px solid var(--builder-border)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent-strong)",
          }}
        >
          <KautilyaLogo size={48} />
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            Open a file to begin.
          </div>
          <p className="apple-body" style={{ marginTop: 8, maxWidth: 320 }}>
            The builder keeps code, runtime, and preview in the same frame once a workspace file is selected.
          </p>
        </div>
      </div>
    </div>
  );
}

function NonTextState({ fileState }: { fileState: ActiveFileState }) {
  return (
    <div
      style={{
        ...surface,
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p className="apple-kicker">Asset preview</p>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          {fileState.kind === "image" ? "Image selected" : "Binary file selected"}
        </div>
        <p className="apple-body" style={{ marginTop: 10 }}>
          {fileState.kind === "image"
            ? "Use the preview pane to inspect this asset while keeping the editor focused on editable files."
            : fileState.message || "This file cannot be edited inline here."}
        </p>
      </div>
    </div>
  );
}

export default function EditorSection({
  activeFile,
  code,
  fileState,
  openTabsCount,
  panelMode,
  workspaceTab,
  previewTab,
  previewUrl,
  terminalPanel,
  consoleEntries,
  onCodeChange,
  onPreviewTabChange,
  onPreviewUrlApply,
  onUseFilePreview,
  onClearConsole,
  onPreviewConsoleEvent,
}: EditorSectionProps) {
  const { tokens } = useAppTheme();

  const workspaceBody =
    workspaceTab === "terminal" ? (
      terminalPanel
    ) : openTabsCount === 0 ? (
      <EmptyState />
    ) : fileState.kind !== "text" ? (
      <NonTextState fileState={fileState} />
    ) : (
      <div style={{ ...surface, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Editor
          height="100%"
          language={monacoLang(fileExt(activeFile))}
          onChange={(value) => onCodeChange(value ?? "")}
          options={{
            fontSize: 13,
            fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: "gutter",
            lineNumbers: "on",
            glyphMargin: false,
            folding: true,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: "smooth",
            smoothScrolling: true,
            tabSize: 2,
          }}
          theme={tokens.monacoTheme}
          value={code}
        />
      </div>
    );

  if (panelMode === "preview") {
    return (
      <div style={{ flex: 1, minWidth: 0, display: "flex", padding: 14, background: "transparent" }}>
        <PreviewSection
          activeFile={activeFile}
          code={code}
          consoleEntries={consoleEntries}
          fileState={fileState}
          onClearConsole={onClearConsole}
          onConsoleEvent={onPreviewConsoleEvent}
          onPreviewTabChange={onPreviewTabChange}
          onPreviewUrlApply={onPreviewUrlApply}
          onUseFilePreview={onUseFilePreview}
          previewTab={previewTab}
          previewUrl={previewUrl}
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", padding: 14, background: "transparent" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "0 4px",
            color: "var(--builder-muted)",
            fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          <span>{workspaceTab === "terminal" ? "WORKSPACE / TERMINAL" : "WORKSPACE / CODE"}</span>
          {activeFile ? <span>{activeFile}</span> : null}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{workspaceBody}</div>
      </div>
    </div>
  );
}
