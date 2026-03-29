import { useEffect, useRef, type ReactNode } from "react";
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

interface WorkspaceSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  selectedText?: string;
}

interface WorkspaceDiagnostic {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  level: string;
  message: string;
  source?: string;
  code?: string;
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
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
  onDiagnosticsChange?: (diagnostics: WorkspaceDiagnostic[]) => void;
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

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const bounded = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(bounded * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${normalized}${alphaHex}`;
}

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
  onSelectionChange,
  onDiagnosticsChange,
}: EditorSectionProps) {
  const { tokens } = useAppTheme();
  const monacoThemeName = `kautilya-${tokens.mode}-${tokens.accentId}`;
  const selectionSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      selectionSubscriptionRef.current?.dispose?.();
    };
  }, []);

  useEffect(() => {
    onSelectionChange?.(null);
    onDiagnosticsChange?.([]);
  }, [activeFile, onDiagnosticsChange, onSelectionChange]);

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
          beforeMount={(monaco) => {
            monaco.editor.defineTheme(monacoThemeName, {
              base: tokens.monacoTheme,
              inherit: true,
              rules: [],
              colors: {
                "editorCursor.foreground": tokens.accentStrong,
                "editor.selectionBackground": withAlpha(tokens.accent, tokens.mode === "dark" ? 0.28 : 0.18),
                "editor.selectionHighlightBackground": withAlpha(tokens.accentAlt, tokens.mode === "dark" ? 0.22 : 0.12),
                "editor.findMatchHighlightBackground": withAlpha(tokens.accentAlt, tokens.mode === "dark" ? 0.18 : 0.12),
                "editor.wordHighlightBackground": withAlpha(tokens.accent, tokens.mode === "dark" ? 0.18 : 0.1),
                "editor.wordHighlightStrongBackground": withAlpha(tokens.accentStrong, tokens.mode === "dark" ? 0.22 : 0.12),
                "editor.lineHighlightBackground": withAlpha(tokens.accent, tokens.mode === "dark" ? 0.08 : 0.05),
                "editorLineNumber.activeForeground": tokens.accentStrong,
                "editor.lineHighlightBorder": withAlpha(tokens.accentStrong, tokens.mode === "dark" ? 0.28 : 0.18),
                "editorBracketMatch.background": withAlpha(tokens.accent, tokens.mode === "dark" ? 0.16 : 0.08),
                "editorBracketMatch.border": withAlpha(tokens.accentStrong, tokens.mode === "dark" ? 0.38 : 0.24),
              },
            });
          }}
          height="100%"
          language={monacoLang(fileExt(activeFile))}
          onChange={(value) => onCodeChange(value ?? "")}
          onMount={(editor) => {
            const emitSelection = () => {
              const selection = editor.getSelection();
              const model = editor.getModel();
              if (!selection || !model || selection.isEmpty()) {
                onSelectionChange?.(null);
                return;
              }
              onSelectionChange?.({
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn,
                selectedText: model.getValueInRange(selection).slice(0, 4000),
              });
            };

            selectionSubscriptionRef.current?.dispose?.();
            selectionSubscriptionRef.current = editor.onDidChangeCursorSelection(emitSelection);
            editor.onDidBlurEditorText(() => onSelectionChange?.(null));
            emitSelection();
          }}
          onValidate={(markers) => {
            onDiagnosticsChange?.(
              markers.map((marker: any) => ({
                file: activeFile,
                line: marker.startLineNumber,
                column: marker.startColumn,
                endLine: marker.endLineNumber,
                endColumn: marker.endColumn,
                level: marker.severity === 8 ? "error" : marker.severity === 4 ? "warning" : "info",
                message: String(marker.message || ""),
                source: marker.source ? String(marker.source) : undefined,
                code: marker.code ? String(typeof marker.code === "object" ? marker.code.value : marker.code) : undefined,
              })),
            );
          }}
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
          theme={monacoThemeName}
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
