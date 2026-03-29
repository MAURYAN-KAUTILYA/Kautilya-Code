import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
const TERMINAL_RUNTIME_KEY = "kautilya_terminal_runtime_mode";
const TERMINAL_CWD_KEY = "kautilya_terminal_cwd";
function deriveWorkingDirectory(filePath) {
    if (!filePath)
        return "";
    const normalized = filePath.replace(/\\/g, "/");
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
}
function readStoredRuntimeMode() {
    if (typeof window === "undefined")
        return "auto";
    const stored = window.localStorage.getItem(TERMINAL_RUNTIME_KEY);
    return stored === "sandbox" || stored === "local" ? stored : "auto";
}
function normalizeStreamText(text) {
    return String(text || "").replace(/\r?\n/g, "\r\n");
}
export default function RuntimeTerminal({ activeFile, sessionId, workspaceContext, onConsoleEntry, }) {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    const lineBufferRef = useRef("");
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const activeCommandIdRef = useRef(null);
    const statusRef = useRef("idle");
    const lastCommandRef = useRef("");
    const [cwd, setCwd] = useState(() => (typeof window === "undefined" ? "" : window.localStorage.getItem(TERMINAL_CWD_KEY) ?? ""));
    const [runtimeMode, setRuntimeMode] = useState(() => readStoredRuntimeMode());
    const [status, setStatus] = useState("idle");
    const [lastCommand, setLastCommand] = useState("");
    const suggestedCwd = useMemo(() => deriveWorkingDirectory(activeFile), [activeFile]);
    const resolvedCwd = cwd.trim() || suggestedCwd;
    const prompt = () => `kautilya:${resolvedCwd || "."}$ `;
    const syncStatus = (next) => {
        statusRef.current = next;
        setStatus(next);
    };
    const appendConsole = (level, text, source = "runtime") => {
        const lines = String(text || "")
            .replace(/\r\n/g, "\n")
            .split("\n")
            .filter((line, index, all) => line.length > 0 || index < all.length - 1);
        lines.forEach((line) => onConsoleEntry({ source, level, text: line }));
    };
    const writePrompt = () => {
        const term = terminalRef.current;
        if (!term)
            return;
        lineBufferRef.current = "";
        term.write(prompt());
    };
    const replaceBuffer = (value) => {
        const term = terminalRef.current;
        if (!term)
            return;
        while (lineBufferRef.current.length > 0) {
            term.write("\b \b");
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        }
        lineBufferRef.current = value;
        if (value)
            term.write(value);
    };
    const browseHistory = (direction) => {
        if (!historyRef.current.length)
            return;
        if (direction === "up") {
            const nextIndex = historyIndexRef.current === -1 ? historyRef.current.length - 1 : Math.max(0, historyIndexRef.current - 1);
            historyIndexRef.current = nextIndex;
            replaceBuffer(historyRef.current[nextIndex] ?? "");
            return;
        }
        if (historyIndexRef.current === -1)
            return;
        const nextIndex = historyIndexRef.current + 1;
        if (nextIndex >= historyRef.current.length) {
            historyIndexRef.current = -1;
            replaceBuffer("");
            return;
        }
        historyIndexRef.current = nextIndex;
        replaceBuffer(historyRef.current[nextIndex] ?? "");
    };
    const stopCommand = async () => {
        if (!activeCommandIdRef.current)
            return;
        try {
            await fetch("/api/runtime/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commandId: activeCommandIdRef.current }),
            });
        }
        catch (error) {
            const message = error?.message || "Failed to stop command.";
            terminalRef.current?.writeln(message);
            appendConsole("error", message, "system");
        }
    };
    const handleRuntimeEvent = (payload) => {
        const term = terminalRef.current;
        if (!term || !payload || typeof payload !== "object")
            return;
        if (payload.type === "start") {
            activeCommandIdRef.current = payload.commandId ?? null;
            syncStatus("running");
            term.writeln(`[runtime:${payload.runtime ?? "runtime"}] started in ${resolvedCwd || "."}`);
            appendConsole("info", `Started ${payload.runtime ?? "runtime"} command in ${resolvedCwd || "."}`, "system");
            return;
        }
        if (payload.type === "stdout") {
            term.write(normalizeStreamText(payload.text ?? ""));
            appendConsole("info", payload.text ?? "");
            return;
        }
        if (payload.type === "stderr") {
            term.write(normalizeStreamText(payload.text ?? ""));
            appendConsole("warn", payload.text ?? "");
            return;
        }
        if (payload.type === "stopped") {
            activeCommandIdRef.current = null;
            syncStatus("idle");
            term.writeln(`\r\n[stopped] exit ${payload.code ?? 130}`);
            appendConsole("warn", `Command stopped${typeof payload.code === "number" ? ` with code ${payload.code}` : ""}.`, "system");
            writePrompt();
            return;
        }
        if (payload.type === "error") {
            activeCommandIdRef.current = null;
            syncStatus("error");
            term.writeln(`\r\n[error] ${payload.message || "Runtime error"}`);
            appendConsole("error", payload.message || "Runtime error", "system");
            writePrompt();
            return;
        }
        if (payload.type === "done") {
            activeCommandIdRef.current = null;
            syncStatus(payload.code === 0 ? "idle" : "error");
            term.writeln(`\r\n[done] exit ${payload.code ?? 0} via ${payload.runtime ?? "runtime"}`);
            appendConsole(payload.code === 0 ? "info" : "warn", `${payload.runtime ?? "Runtime"} finished with exit ${payload.code ?? 0}.`, "system");
            writePrompt();
        }
    };
    const streamCommand = async (command) => {
        const term = terminalRef.current;
        const trimmed = command.trim();
        if (!term || !trimmed || statusRef.current === "running")
            return;
        if (trimmed === "clear") {
            term.clear();
            writePrompt();
            return;
        }
        if (historyRef.current[historyRef.current.length - 1] !== trimmed) {
            historyRef.current = [...historyRef.current, trimmed];
        }
        historyIndexRef.current = -1;
        lastCommandRef.current = trimmed;
        setLastCommand(trimmed);
        syncStatus("running");
        try {
            const response = await fetch("/api/runtime/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    command: trimmed,
                    cwd: resolvedCwd,
                    runtimeMode,
                    sessionId,
                    workspaceContext,
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                const message = payload.error || "Failed to start runtime stream.";
                syncStatus("error");
                term.writeln(`[error] ${message}`);
                appendConsole("error", message, "system");
                writePrompt();
                return;
            }
            if (!response.body) {
                syncStatus("error");
                term.writeln("[error] Runtime stream unavailable.");
                appendConsole("error", "Runtime stream unavailable.", "system");
                writePrompt();
                return;
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";
                for (const part of parts) {
                    const lines = part.split("\n");
                    for (const line of lines) {
                        if (!line.startsWith("data:"))
                            continue;
                        const raw = line.replace(/^data:\s*/, "");
                        if (!raw)
                            continue;
                        try {
                            handleRuntimeEvent(JSON.parse(raw));
                        }
                        catch {
                            // Ignore malformed events.
                        }
                    }
                }
            }
        }
        catch (error) {
            syncStatus("error");
            const message = error?.message || "Runtime request failed.";
            term.writeln(`[error] ${message}`);
            appendConsole("error", message, "system");
            writePrompt();
        }
    };
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        window.localStorage.setItem(TERMINAL_RUNTIME_KEY, runtimeMode);
    }, [runtimeMode]);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        window.localStorage.setItem(TERMINAL_CWD_KEY, cwd);
    }, [cwd]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        const terminal = new XTerm({
            convertEol: true,
            cursorBlink: true,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            scrollback: 2000,
            theme: {
                background: "#09111b",
                foreground: "#dbeafe",
                cursor: "#60a5fa",
                selectionBackground: "rgba(96,165,250,0.22)",
                black: "#0f172a",
                red: "#f87171",
                green: "#4ade80",
                yellow: "#facc15",
                blue: "#60a5fa",
                magenta: "#c084fc",
                cyan: "#22d3ee",
                white: "#e2e8f0",
                brightBlack: "#475569",
                brightRed: "#fca5a5",
                brightGreen: "#86efac",
                brightYellow: "#fde68a",
                brightBlue: "#93c5fd",
                brightMagenta: "#d8b4fe",
                brightCyan: "#67e8f9",
                brightWhite: "#f8fafc",
            },
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        fitAddon.fit();
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        terminal.writeln("Kautilya Terminal");
        terminal.writeln("Real xterm surface on top of the runtime stream backend.");
        writePrompt();
        const disposable = terminal.onData((data) => {
            if (statusRef.current === "running") {
                if (data === "\u0003")
                    void stopCommand();
                return;
            }
            if (data === "\r") {
                const command = lineBufferRef.current;
                terminal.write("\r\n");
                void streamCommand(command);
                return;
            }
            if (data === "\u007f") {
                if (lineBufferRef.current.length > 0) {
                    lineBufferRef.current = lineBufferRef.current.slice(0, -1);
                    terminal.write("\b \b");
                }
                return;
            }
            if (data === "\u001b[A") {
                browseHistory("up");
                return;
            }
            if (data === "\u001b[B") {
                browseHistory("down");
                return;
            }
            if (data === "\u0003") {
                terminal.write("^C");
                terminal.write("\r\n");
                writePrompt();
                return;
            }
            if (data === "\u000c") {
                terminal.clear();
                writePrompt();
                return;
            }
            if (data >= " " && data !== "\u007f") {
                lineBufferRef.current += data;
                terminal.write(data);
            }
        });
        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);
        return () => {
            disposable.dispose();
            window.removeEventListener("resize", handleResize);
            terminal.dispose();
            terminalRef.current = null;
            fitAddonRef.current = null;
        };
    }, []);
    useEffect(() => {
        fitAddonRef.current?.fit();
    }, [cwd]);
    return (_jsxs("div", { style: {
            height: "100%",
            background: "var(--builder-inverse-bg)",
            border: "1px solid var(--builder-inverse-border)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
        }, children: [_jsxs("div", { style: {
                    minHeight: 72,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "0 12px",
                    borderBottom: "1px solid var(--builder-inverse-border)",
                    flexShrink: 0,
                    justifyContent: "center",
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: { fontSize: 10, color: "var(--builder-inverse-muted)", letterSpacing: "0.1em" }, children: "XTERM" }), _jsx("span", { style: { fontSize: 9, color: status === "running" ? "#86EFAC" : status === "error" ? "#FCA5A5" : "var(--builder-inverse-muted)", letterSpacing: "0.08em" }, children: status === "running" ? "RUNNING" : status === "error" ? "ATTENTION" : "READY" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("button", { onClick: () => {
                                            terminalRef.current?.clear();
                                            writePrompt();
                                        }, style: { background: "transparent", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-muted)", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: "pointer" }, children: "CLEAR" }), _jsx("button", { onClick: () => {
                                            if (!lastCommandRef.current || statusRef.current === "running")
                                                return;
                                            terminalRef.current?.write("\r\n");
                                            void streamCommand(lastCommandRef.current);
                                        }, disabled: !lastCommand || status === "running", style: { background: "var(--accent-soft)", border: "1px solid rgba(var(--accent-rgb), 0.28)", color: "var(--accent-alt)", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: !lastCommand || status === "running" ? "not-allowed" : "pointer", opacity: !lastCommand || status === "running" ? 0.5 : 1 }, children: "RERUN" }), _jsx("button", { onClick: () => void stopCommand(), disabled: !activeCommandIdRef.current, style: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", borderRadius: 8, padding: "6px 10px", fontSize: 10, cursor: !activeCommandIdRef.current ? "not-allowed" : "pointer", opacity: !activeCommandIdRef.current ? 0.5 : 1 }, children: "STOP" })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsxs("select", { value: runtimeMode, onChange: (event) => setRuntimeMode(event.target.value), disabled: status === "running", style: { width: 110, background: "var(--builder-inverse-panel)", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-text)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }, children: [_jsx("option", { value: "auto", children: "AUTO" }), _jsx("option", { value: "sandbox", children: "SANDBOX" }), _jsx("option", { value: "local", children: "LOCAL" })] }), _jsx("input", { value: cwd, onChange: (event) => setCwd(event.target.value), placeholder: suggestedCwd || "project root", style: { flex: 1, background: "var(--builder-inverse-panel)", border: "1px solid var(--builder-inverse-border)", color: "var(--builder-inverse-text)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" } })] })] }), _jsx("div", { style: { flex: 1, minHeight: 0, padding: "8px 10px", background: "#09111b" }, children: _jsx("div", { ref: containerRef, style: { height: "100%", width: "100%" } }) })] }));
}
