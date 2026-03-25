import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, Moon, Sparkles, SunMedium } from "lucide-react";
import { useMemo, useState } from "react";
import { THEME_ACCENT_OPTIONS, buildThemeTokens, useAppTheme, } from "@/theme/AppThemeProvider";
function ThemePreviewSection({ sectionMode, open, onToggle, }) {
    const { accentId, preference, setAccentId } = useAppTheme();
    const previewModeLabel = sectionMode === "light" ? "Light Theme" : "Dark Theme";
    const sectionTheme = useMemo(() => buildThemeTokens({ ...preference, mode: sectionMode }), [preference, sectionMode]);
    return (_jsxs("section", { className: "theme-builder__section apple-card", children: [_jsxs("button", { className: "theme-builder__section-header", onClick: onToggle, type: "button", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: previewModeLabel }), _jsx("p", { className: "apple-body", style: { marginTop: 6 }, children: sectionMode === "light"
                                    ? "White-based surfaces, dark typography, and accent-led highlights."
                                    : "Charcoal surfaces, softened text, and restrained accent glow." })] }), _jsx("span", { "aria-hidden": "true", className: "theme-builder__caret", style: { transform: open ? "rotate(0deg)" : "rotate(180deg)" }, children: "^" })] }), open ? (_jsxs("div", { className: "theme-builder__section-body", children: [_jsxs("div", { className: "theme-builder__preview", style: {
                            background: sectionMode === "light"
                                ? `linear-gradient(180deg, rgba(255,255,255,0.98), ${sectionTheme.surfaceSecondary})`
                                : sectionTheme.builderInverseBackground,
                            borderColor: sectionMode === "light" ? sectionTheme.border : sectionTheme.builderInverseBorder,
                            color: sectionMode === "light"
                                ? sectionTheme.textPrimary
                                : sectionTheme.builderInverseText,
                        }, children: [_jsxs("div", { className: "theme-builder__preview-top", children: [_jsx("span", { className: "theme-builder__preview-dot", style: { background: sectionTheme.accentGradient } }), _jsxs("span", { className: "theme-builder__preview-label", style: {
                                            color: sectionMode === "light"
                                                ? sectionTheme.textSecondary
                                                : sectionTheme.builderInverseMuted,
                                        }, children: [previewModeLabel, " preview"] })] }), _jsx("h3", { className: "theme-builder__preview-title", children: "Theme Builder keeps colour in service of action." }), _jsx("p", { className: "theme-builder__preview-copy", style: {
                                    color: sectionMode === "light"
                                        ? sectionTheme.textSecondary
                                        : sectionTheme.builderInverseMuted,
                                }, children: "Accent touches live on buttons, underlines, highlights, and control emphasis while the background stays calm." }), _jsxs("div", { className: "theme-builder__preview-actions", children: [_jsx("button", { className: "apple-btn", style: { background: sectionTheme.accentGradient, boxShadow: "none" }, type: "button", children: "Primary action" }), _jsx("span", { className: "theme-builder__preview-link", style: { color: sectionTheme.accentStrong, borderBottomColor: sectionTheme.accent }, children: "Accent underline" })] })] }), _jsx("div", { className: "theme-builder__option-grid", children: THEME_ACCENT_OPTIONS.map((option) => {
                            const optionTheme = buildThemeTokens({
                                ...preference,
                                accentId: option.id,
                                mode: sectionMode,
                            });
                            const selected = accentId === option.id;
                            return (_jsxs("button", { className: `theme-builder__option ${selected ? "is-selected" : ""}`, onClick: () => setAccentId(option.id), style: {
                                    borderColor: selected ? optionTheme.accent : optionTheme.border,
                                    background: sectionMode === "light"
                                        ? optionTheme.surfaceElevated
                                        : optionTheme.builderGlassStrong,
                                    color: sectionMode === "light"
                                        ? optionTheme.textPrimary
                                        : optionTheme.builderInverseText,
                                    boxShadow: selected ? `0 0 0 3px ${optionTheme.focusRing}` : "none",
                                }, type: "button", children: [_jsx("div", { className: "theme-builder__swatch", style: { background: optionTheme.accentGradient } }), _jsxs("div", { className: "theme-builder__option-head", children: [_jsxs("div", { children: [_jsx("strong", { children: option.label }), _jsx("p", { style: {
                                                            margin: "6px 0 0",
                                                            color: sectionMode === "light"
                                                                ? optionTheme.textSecondary
                                                                : optionTheme.builderInverseMuted,
                                                        }, children: option.description })] }), selected ? (_jsx("span", { className: "theme-builder__check", style: {
                                                    background: optionTheme.accentSoft,
                                                    color: optionTheme.accentStrong,
                                                }, children: _jsx(Check, { size: 14 }) })) : null] }), _jsxs("div", { className: "theme-builder__option-preview", children: [_jsx("span", { className: "theme-builder__mini-pill", style: {
                                                    background: optionTheme.accentSoft,
                                                    color: optionTheme.accentStrong,
                                                }, children: "Highlight" }), _jsx("span", { className: "theme-builder__mini-line", style: { background: optionTheme.accentGradient } })] })] }, `${sectionMode}-${option.id}`));
                        }) })] })) : null] }));
}
export default function ThemeBuilderFeature({ onClose }) {
    const { accentId, accentOptions, mode, setMode } = useAppTheme();
    const [openSections, setOpenSections] = useState({
        light: mode === "light",
        dark: mode === "dark",
    });
    const activeAccent = accentOptions.find((entry) => entry.id === accentId) ?? accentOptions[0];
    return (_jsxs("div", { className: "theme-builder", children: [_jsxs("div", { className: "theme-builder__intro", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Theme Builder" }), _jsx("h2", { className: "apple-subheading", children: "A shared theme system for every routed Kautilya surface." }), _jsx("p", { className: "apple-body", style: { marginTop: 12 }, children: "Backgrounds stay neutral. Accent colour drives button emphasis, underlines, highlights, focus, and active UI detail across intro, login, dashboard, and builder." })] }), _jsx("button", { className: "apple-btn apple-btn--ghost", onClick: onClose, type: "button", children: "Close" })] }), _jsxs("div", { className: "theme-builder__mode-bar", children: [_jsxs("button", { className: mode === "light" ? "apple-btn" : "apple-btn apple-btn--secondary", onClick: () => setMode("light"), style: mode === "light" ? { background: "var(--accent-gradient)" } : undefined, type: "button", children: [_jsx(SunMedium, { size: 16 }), _jsx("span", { style: { marginLeft: 8 }, children: "Light" })] }), _jsxs("button", { className: mode === "dark" ? "apple-btn" : "apple-btn apple-btn--secondary", onClick: () => setMode("dark"), style: mode === "dark" ? { background: "var(--accent-gradient)" } : undefined, type: "button", children: [_jsx(Moon, { size: 16 }), _jsx("span", { style: { marginLeft: 8 }, children: "Dark" })] })] }), _jsxs("div", { className: "theme-builder__meta", children: [_jsxs("span", { className: "apple-badge", children: [_jsx(Sparkles, { size: 12 }), _jsx("span", { children: activeAccent.label })] }), _jsx("span", { className: "brand-lockup__meta", children: "Saved locally now, structured for future account sync." })] }), _jsx(ThemePreviewSection, { sectionMode: "light", open: openSections.light, onToggle: () => setOpenSections((current) => ({ ...current, light: !current.light })) }), _jsx(ThemePreviewSection, { sectionMode: "dark", open: openSections.dark, onToggle: () => setOpenSections((current) => ({ ...current, dark: !current.dark })) })] }));
}
