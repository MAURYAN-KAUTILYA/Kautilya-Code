import { useEffect, useState } from "react";
import { useAppTheme } from "@/theme/AppThemeProvider";

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

interface PreviewSectionProps {
  activeFile: string;
  code: string;
  fileState: ActiveFileState;
  previewTab: "preview" | "console";
  previewUrl: string;
  consoleEntries: ConsoleLine[];
  onPreviewTabChange: (tab: "preview" | "console") => void;
  onPreviewUrlApply: (url: string) => void;
  onUseFilePreview: () => void;
  onClearConsole: () => void;
  onConsoleEvent: (entry: Omit<ConsoleLine, "id" | "timestamp">) => void;
}

function buildPreviewDocument(html: string) {
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

function levelColor(level: ConsoleLine["level"]) {
  if (level === "error") return "#ef4444";
  if (level === "warn") return "#d97706";
  if (level === "info") return "#0f766e";
  return "#475569";
}

const shell = {
  border: "1px solid var(--builder-border)",
  borderRadius: 22,
  background: "var(--builder-glass)",
  boxShadow: "var(--shadow-md)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
} as const;

export default function PreviewSection({
  activeFile,
  code,
  fileState,
  previewTab,
  previewUrl,
  consoleEntries,
  onPreviewTabChange,
  onPreviewUrlApply,
  onUseFilePreview,
  onClearConsole,
  onConsoleEvent,
}: PreviewSectionProps) {
  useAppTheme();
  const [draftUrl, setDraftUrl] = useState(previewUrl);
  const ext = activeFile.split(".").pop()?.toLowerCase() ?? "";
  const canRenderHtmlFile = fileState.kind === "text" && (ext === "html" || ext === "htm");

  useEffect(() => {
    setDraftUrl(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || payload.source !== "kautilya-preview-console") return;
      onConsoleEvent({
        source: "preview",
        level:
          payload.level === "warn" || payload.level === "error" || payload.level === "info"
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
      return (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gap: 10 }}>
          <div className="apple-body" style={{ fontSize: 13 }}>
            External preview is active. Browser console forwarding still depends on the target page
            cooperating with `postMessage`.
          </div>
          <iframe
            src={previewUrl}
            style={{
              flex: 1,
              width: "100%",
              border: "1px solid var(--builder-border)",
              borderRadius: 18,
              background: "var(--bg-strong)",
            }}
            title="Kautilya Preview URL"
          />
        </div>
      );
    }

    if (fileState.kind === "image" && fileState.url) {
      return (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            border: "1px solid var(--builder-border)",
            borderRadius: 18,
            background: "var(--bg-elevated)",
          }}
        >
          <img
            alt={activeFile}
            src={fileState.url}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 14 }}
          />
        </div>
      );
    }

    if (canRenderHtmlFile) {
      return (
        <iframe
          sandbox="allow-scripts allow-same-origin allow-forms"
          srcDoc={buildPreviewDocument(code)}
          style={{
            flex: 1,
            width: "100%",
            border: "1px solid var(--builder-border)",
            borderRadius: 18,
            background: "var(--bg-strong)",
          }}
          title="Kautilya File Preview"
        />
      );
    }

    if (fileState.kind === "binary") {
      return (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            border: "1px solid var(--builder-border)",
            borderRadius: 18,
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ maxWidth: 380, textAlign: "center" }}>
            <p className="apple-kicker">Binary preview</p>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              Inline preview unavailable
            </div>
            <p className="apple-body" style={{ marginTop: 10 }}>
              {fileState.message || "This file cannot be previewed inline."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          border: "1px solid var(--builder-border)",
          borderRadius: 18,
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p className="apple-kicker">Preview ready</p>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            Switch between file and external preview
          </div>
          <p className="apple-body" style={{ marginTop: 10 }}>
            Preview supports HTML files, image assets, or an external runtime URL while console events
            stay attached to the same surface.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        ...shell,
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--builder-border)",
          display: "grid",
          gap: 10,
        }}
      >
        <div className="auth-inline">
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={previewTab === "preview" ? "apple-btn apple-btn--secondary" : "apple-btn apple-btn--ghost"}
              onClick={() => onPreviewTabChange("preview")}
              style={{ minHeight: 34, padding: "0 14px" }}
              type="button"
            >
              Preview
            </button>
            <button
              className={previewTab === "console" ? "apple-btn apple-btn--secondary" : "apple-btn apple-btn--ghost"}
              onClick={() => onPreviewTabChange("console")}
              style={{ minHeight: 34, padding: "0 14px" }}
              type="button"
            >
              Console
            </button>
          </div>
          <span className="brand-lockup__meta">{activeFile ? activeFile.split("/").pop() : "No file"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            className="apple-input"
            onChange={(event) => setDraftUrl(event.target.value)}
            placeholder="http://localhost:3000 or leave empty for file preview"
            style={{ flex: 1, paddingBlock: 10, fontSize: 13 }}
            value={draftUrl}
          />
          <button className="apple-btn apple-btn--secondary" onClick={() => onPreviewUrlApply(draftUrl.trim())} style={{ minHeight: 40 }} type="button">
            Load
          </button>
          <button className="apple-btn apple-btn--ghost" onClick={onUseFilePreview} style={{ minHeight: 40 }} type="button">
            File
          </button>
          <button className="apple-btn apple-btn--ghost" onClick={onClearConsole} style={{ minHeight: 40 }} type="button">
            Clear
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: 12, display: "flex" }}>
        {previewTab === "console" ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {consoleEntries.length === 0 ? (
              <div className="apple-body" style={{ fontSize: 13 }}>
                Console is clear.
              </div>
            ) : (
              consoleEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid var(--builder-border)",
                    borderRadius: 16,
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div className="auth-inline" style={{ marginBottom: 6 }}>
                    <span className="brand-lockup__meta">
                      {entry.source.toUpperCase()} / {entry.level.toUpperCase()}
                    </span>
                    <span className="brand-lockup__meta">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: levelColor(entry.level), fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {entry.text}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          previewBody()
        )}
      </div>
    </div>
  );
}
