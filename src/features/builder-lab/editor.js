import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import KautilyaLogo from "@/components/KautilyaLogo";
import { useAppTheme } from "@/theme/AppThemeProvider";
import PreviewSection from "./preview";
const surface = {
    border: "1px solid var(--builder-border)",
    borderRadius: 22,
    background: "var(--builder-glass)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
};
const monacoLang = (ext) => ({
    tsx: "typescript",
    ts: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    md: "markdown",
    html: "html",
}[ext] ?? "plaintext");
const fileExt = (id) => id.split(".").pop() ?? "";
function withAlpha(hex, alpha) {
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
    return (_jsx("div", { style: {
            ...surface,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
        }, children: _jsxs("div", { style: { display: "grid", justifyItems: "center", gap: 16, textAlign: "center" }, children: [_jsx("div", { style: {
                        width: 96,
                        height: 96,
                        borderRadius: 28,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--builder-border)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--accent-strong)",
                    }, children: _jsx(KautilyaLogo, { size: 48 }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }, children: "Open a file to begin." }), _jsx("p", { className: "apple-body", style: { marginTop: 8, maxWidth: 320 }, children: "The builder keeps code, runtime, and preview in the same frame once a workspace file is selected." })] })] }) }));
}
function NonTextState({ fileState }) {
    return (_jsx("div", { style: {
            ...surface,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
        }, children: _jsxs("div", { style: { maxWidth: 420, textAlign: "center" }, children: [_jsx("p", { className: "apple-kicker", children: "Asset preview" }), _jsx("div", { style: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }, children: fileState.kind === "image" ? "Image selected" : "Binary file selected" }), _jsx("p", { className: "apple-body", style: { marginTop: 10 }, children: fileState.kind === "image"
                        ? "Use the preview pane to inspect this asset while keeping the editor focused on editable files."
                        : fileState.message || "This file cannot be edited inline here." })] }) }));
}
export default function EditorSection({ activeFile, code, fileState, openTabsCount, panelMode, workspaceTab, previewTab, previewUrl, terminalPanel, consoleEntries, onCodeChange, onPreviewTabChange, onPreviewUrlApply, onUseFilePreview, onClearConsole, onPreviewConsoleEvent, onSelectionChange, onDiagnosticsChange, }) {
    const { tokens } = useAppTheme();
    const monacoThemeName = `kautilya-${tokens.mode}-${tokens.accentId}`;
    const selectionSubscriptionRef = useRef(null);
    useEffect(() => {
        return () => {
            selectionSubscriptionRef.current?.dispose?.();
        };
    }, []);
    useEffect(() => {
        onSelectionChange?.(null);
        onDiagnosticsChange?.([]);
    }, [activeFile, onDiagnosticsChange, onSelectionChange]);
    const workspaceBody = workspaceTab === "terminal" ? (terminalPanel) : openTabsCount === 0 ? (_jsx(EmptyState, {})) : fileState.kind !== "text" ? (_jsx(NonTextState, { fileState: fileState })) : (_jsx("div", { style: { ...surface, flex: 1, minHeight: 0, overflow: "hidden" }, children: _jsx(Editor, { beforeMount: (monaco) => {
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
            }, height: "100%", language: monacoLang(fileExt(activeFile)), onChange: (value) => onCodeChange(value ?? ""), onMount: (editor) => {
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
            }, onValidate: (markers) => {
                onDiagnosticsChange?.(markers.map((marker) => ({
                    file: activeFile,
                    line: marker.startLineNumber,
                    column: marker.startColumn,
                    endLine: marker.endLineNumber,
                    endColumn: marker.endColumn,
                    level: marker.severity === 8 ? "error" : marker.severity === 4 ? "warning" : "info",
                    message: String(marker.message || ""),
                    source: marker.source ? String(marker.source) : undefined,
                    code: marker.code ? String(typeof marker.code === "object" ? marker.code.value : marker.code) : undefined,
                })));
            }, options: {
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
            }, theme: monacoThemeName, value: code }) }));
    if (panelMode === "preview") {
        return (_jsx("div", { style: { flex: 1, minWidth: 0, display: "flex", padding: 14, background: "transparent" }, children: _jsx(PreviewSection, { activeFile: activeFile, code: code, consoleEntries: consoleEntries, fileState: fileState, onClearConsole: onClearConsole, onConsoleEvent: onPreviewConsoleEvent, onPreviewTabChange: onPreviewTabChange, onPreviewUrlApply: onPreviewUrlApply, onUseFilePreview: onUseFilePreview, previewTab: previewTab, previewUrl: previewUrl }) }));
    }
    return (_jsx("div", { style: { flex: 1, minWidth: 0, display: "flex", padding: 14, background: "transparent" }, children: _jsxs("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }, children: [_jsxs("div", { style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: "0 4px",
                        color: "var(--builder-muted)",
                        fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                    }, children: [_jsx("span", { children: workspaceTab === "terminal" ? "WORKSPACE / TERMINAL" : "WORKSPACE / CODE" }), activeFile ? _jsx("span", { children: activeFile }) : null] }), _jsx("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: workspaceBody })] }) }));
}
