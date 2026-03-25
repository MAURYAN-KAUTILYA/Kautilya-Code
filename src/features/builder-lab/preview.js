import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useAppTheme } from "@/theme/AppThemeProvider";
function buildPreviewDocument(html) {
    const bridgeScript = `<script>
  (function () {
    function serialize(value) {
      if (typeof value === 'string') return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    function send(level, args) {
      parent.postMessage({
        source: 'kautilya-preview-console',
        level: level,
        text: Array.from(args).map(serialize).join(' ')
      }, '*');
    }
    ['log', 'info', 'warn', 'error'].forEach(function (level) {
      var original = console[level];
      console[level] = function () {
        send(level, arguments);
        return original.apply(console, arguments);
      };
    });
    window.addEventListener('error', function (event) {
      send('error', [event.message]);
    });
    window.addEventListener('unhandledrejection', function (event) {
      send('error', ['Unhandled promise rejection', serialize(event.reason)]);
    });
    send('info', ['Preview connected.']);
  })();
  </script>`;
    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, `<head$1>${bridgeScript}`);
    }
    if (/<body[^>]*>/i.test(html)) {
        return html.replace(/<body([^>]*)>/i, `<body$1>${bridgeScript}`);
    }
    if (/<!doctype/i.test(html) || /<html/i.test(html)) {
        return `${bridgeScript}${html}`;
    }
    return `<!doctype html><html><head><meta charset="utf-8">${bridgeScript}</head><body>${html}</body></html>`;
}
function levelColor(level) {
    if (level === "error")
        return "#ef4444";
    if (level === "warn")
        return "#d97706";
    if (level === "info")
        return "#0f766e";
    return "#475569";
}
const shell = {
    border: "1px solid var(--builder-border)",
    borderRadius: 22,
    background: "var(--builder-glass)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
};
export default function PreviewSection({ activeFile, code, fileState, previewTab, previewUrl, consoleEntries, onPreviewTabChange, onPreviewUrlApply, onUseFilePreview, onClearConsole, onConsoleEvent, }) {
    useAppTheme();
    const [draftUrl, setDraftUrl] = useState(previewUrl);
    const ext = activeFile.split(".").pop()?.toLowerCase() ?? "";
    const canRenderHtmlFile = fileState.kind === "text" && (ext === "html" || ext === "htm");
    useEffect(() => {
        setDraftUrl(previewUrl);
    }, [previewUrl]);
    useEffect(() => {
        const handleMessage = (event) => {
            const payload = event.data;
            if (!payload || payload.source !== "kautilya-preview-console")
                return;
            onConsoleEvent({
                source: "preview",
                level: payload.level === "warn" || payload.level === "error" || payload.level === "info"
                    ? payload.level
                    : "log",
                text: typeof payload.text === "string" ? payload.text : String(payload.text ?? ""),
            });
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onConsoleEvent]);
    const previewBody = () => {
        if (previewUrl.trim()) {
            return (_jsxs("div", { style: { flex: 1, minHeight: 0, display: "grid", gap: 10 }, children: [_jsx("div", { className: "apple-body", style: { fontSize: 13 }, children: "External preview is active. Browser console forwarding still depends on the target page cooperating with `postMessage`." }), _jsx("iframe", { src: previewUrl, style: {
                            flex: 1,
                            width: "100%",
                            border: "1px solid var(--builder-border)",
                            borderRadius: 18,
                            background: "var(--bg-strong)",
                        }, title: "Kautilya Preview URL" })] }));
        }
        if (fileState.kind === "image" && fileState.url) {
            return (_jsx("div", { style: {
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                    border: "1px solid var(--builder-border)",
                    borderRadius: 18,
                    background: "var(--bg-elevated)",
                }, children: _jsx("img", { alt: activeFile, src: fileState.url, style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 14 } }) }));
        }
        if (canRenderHtmlFile) {
            return (_jsx("iframe", { sandbox: "allow-scripts allow-same-origin allow-forms", srcDoc: buildPreviewDocument(code), style: {
                    flex: 1,
                    width: "100%",
                    border: "1px solid var(--builder-border)",
                    borderRadius: 18,
                    background: "var(--bg-strong)",
                }, title: "Kautilya File Preview" }));
        }
        if (fileState.kind === "binary") {
            return (_jsx("div", { style: {
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    border: "1px solid var(--builder-border)",
                    borderRadius: 18,
                    background: "var(--bg-elevated)",
                }, children: _jsxs("div", { style: { maxWidth: 380, textAlign: "center" }, children: [_jsx("p", { className: "apple-kicker", children: "Binary preview" }), _jsx("div", { style: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }, children: "Inline preview unavailable" }), _jsx("p", { className: "apple-body", style: { marginTop: 10 }, children: fileState.message || "This file cannot be previewed inline." })] }) }));
        }
        return (_jsx("div", { style: {
                flex: 1,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                border: "1px solid var(--builder-border)",
                borderRadius: 18,
                background: "var(--bg-elevated)",
            }, children: _jsxs("div", { style: { maxWidth: 420, textAlign: "center" }, children: [_jsx("p", { className: "apple-kicker", children: "Preview ready" }), _jsx("div", { style: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }, children: "Switch between file and external preview" }), _jsx("p", { className: "apple-body", style: { marginTop: 10 }, children: "Preview supports HTML files, image assets, or an external runtime URL while console events stay attached to the same surface." })] }) }));
    };
    return (_jsxs("div", { style: {
            ...shell,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
        }, children: [_jsxs("div", { style: {
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--builder-border)",
                    display: "grid",
                    gap: 10,
                }, children: [_jsxs("div", { className: "auth-inline", children: [_jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { className: previewTab === "preview" ? "apple-btn apple-btn--secondary" : "apple-btn apple-btn--ghost", onClick: () => onPreviewTabChange("preview"), style: { minHeight: 34, padding: "0 14px" }, type: "button", children: "Preview" }), _jsx("button", { className: previewTab === "console" ? "apple-btn apple-btn--secondary" : "apple-btn apple-btn--ghost", onClick: () => onPreviewTabChange("console"), style: { minHeight: 34, padding: "0 14px" }, type: "button", children: "Console" })] }), _jsx("span", { className: "brand-lockup__meta", children: activeFile ? activeFile.split("/").pop() : "No file" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("input", { className: "apple-input", onChange: (event) => setDraftUrl(event.target.value), placeholder: "http://localhost:3000 or leave empty for file preview", style: { flex: 1, paddingBlock: 10, fontSize: 13 }, value: draftUrl }), _jsx("button", { className: "apple-btn apple-btn--secondary", onClick: () => onPreviewUrlApply(draftUrl.trim()), style: { minHeight: 40 }, type: "button", children: "Load" }), _jsx("button", { className: "apple-btn apple-btn--ghost", onClick: onUseFilePreview, style: { minHeight: 40 }, type: "button", children: "File" }), _jsx("button", { className: "apple-btn apple-btn--ghost", onClick: onClearConsole, style: { minHeight: 40 }, type: "button", children: "Clear" })] })] }), _jsx("div", { style: { flex: 1, minHeight: 0, padding: 12, display: "flex" }, children: previewTab === "console" ? (_jsx("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }, children: consoleEntries.length === 0 ? (_jsx("div", { className: "apple-body", style: { fontSize: 13 }, children: "Console is clear." })) : (consoleEntries.map((entry) => (_jsxs("div", { style: {
                            border: "1px solid var(--builder-border)",
                            borderRadius: 16,
                            padding: "10px 12px",
                            background: "var(--bg-elevated)",
                        }, children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 6 }, children: [_jsxs("span", { className: "brand-lockup__meta", children: [entry.source.toUpperCase(), " / ", entry.level.toUpperCase()] }), _jsx("span", { className: "brand-lockup__meta", children: new Date(entry.timestamp).toLocaleTimeString() })] }), _jsx("div", { style: { color: levelColor(entry.level), fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }, children: entry.text })] }, entry.id)))) })) : (previewBody()) })] }));
}
