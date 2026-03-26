import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
const STORAGE_KEY = "kautilya.theme.preference";
const THEME_VERSION = 1;
const DEFAULT_THEME_PREFERENCE = {
    mode: "light",
    accentId: "classic",
    version: THEME_VERSION,
    updatedAt: new Date(0).toISOString(),
};
const ACCENT_FAMILIES = {
    classic: {
        label: "Classic",
        description: "Default red-orange Kautilya accent.",
        light: {
            accent: "#e15a2a",
            accentStrong: "#b9471d",
            accentAlt: "#ff9b43",
            accentRgb: "225, 90, 42",
            accentAltRgb: "255, 155, 67",
        },
        dark: {
            accent: "#ff8f66",
            accentStrong: "#ffb48d",
            accentAlt: "#ffbb67",
            accentRgb: "255, 143, 102",
            accentAltRgb: "255, 187, 103",
        },
    },
    "green-yellow": {
        label: "Green Yellow",
        description: "Fresh green to citrus yellow.",
        light: {
            accent: "#2f9d57",
            accentStrong: "#237641",
            accentAlt: "#d2dd39",
            accentRgb: "47, 157, 87",
            accentAltRgb: "210, 221, 57",
        },
        dark: {
            accent: "#63d789",
            accentStrong: "#9befa9",
            accentAlt: "#e1ef69",
            accentRgb: "99, 215, 137",
            accentAltRgb: "225, 239, 105",
        },
    },
    pink: {
        label: "Pink",
        description: "Magenta-driven highlight palette.",
        light: {
            accent: "#e14577",
            accentStrong: "#ba305f",
            accentAlt: "#ff7cb4",
            accentRgb: "225, 69, 119",
            accentAltRgb: "255, 124, 180",
        },
        dark: {
            accent: "#ff73a1",
            accentStrong: "#ff9dc0",
            accentAlt: "#ff8bc5",
            accentRgb: "255, 115, 161",
            accentAltRgb: "255, 139, 197",
        },
    },
    blue: {
        label: "Blue",
        description: "Trust-led electric blue gradient.",
        light: {
            accent: "#0b78e3",
            accentStrong: "#095db4",
            accentAlt: "#6cb7ff",
            accentRgb: "11, 120, 227",
            accentAltRgb: "108, 183, 255",
        },
        dark: {
            accent: "#67b6ff",
            accentStrong: "#9cd0ff",
            accentAlt: "#7fd0ff",
            accentRgb: "103, 182, 255",
            accentAltRgb: "127, 208, 255",
        },
    },
};
export const THEME_ACCENT_OPTIONS = Object.entries(ACCENT_FAMILIES).map(([id, accent]) => ({
    id,
    label: accent.label,
    description: accent.description,
    gradient: `linear-gradient(135deg, ${accent.light.accent} 0%, ${accent.light.accentAlt} 100%)`,
}));
const AppThemeContext = createContext(null);
function alpha(rgb, value) {
    return `rgba(${rgb}, ${value})`;
}
function isThemeMode(value) {
    return value === "light" || value === "dark";
}
function isThemeAccentId(value) {
    return value === "classic" || value === "green-yellow" || value === "pink" || value === "blue";
}
function normalizePreference(value) {
    if (!value || typeof value !== "object") {
        return {
            ...DEFAULT_THEME_PREFERENCE,
            updatedAt: new Date().toISOString(),
        };
    }
    const candidate = value;
    return {
        mode: isThemeMode(candidate.mode) ? candidate.mode : DEFAULT_THEME_PREFERENCE.mode,
        accentId: isThemeAccentId(candidate.accentId)
            ? candidate.accentId
            : DEFAULT_THEME_PREFERENCE.accentId,
        version: typeof candidate.version === "number" ? candidate.version : THEME_VERSION,
        updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt
            ? candidate.updatedAt
            : new Date().toISOString(),
    };
}
function readStoredPreference() {
    if (typeof window === "undefined") {
        return {
            ...DEFAULT_THEME_PREFERENCE,
            updatedAt: new Date().toISOString(),
        };
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                ...DEFAULT_THEME_PREFERENCE,
                updatedAt: new Date().toISOString(),
            };
        }
        return normalizePreference(JSON.parse(raw));
    }
    catch {
        return {
            ...DEFAULT_THEME_PREFERENCE,
            updatedAt: new Date().toISOString(),
        };
    }
}
export function buildThemeTokens(preference) {
    const isDark = preference.mode === "dark";
    const accent = ACCENT_FAMILIES[preference.accentId][preference.mode];
    const background = isDark ? "#0d1015" : "#f6f7fb";
    const pageBackground = isDark ? "#10141b" : "#fbfbfe";
    const surface = isDark ? "rgba(20, 23, 29, 0.82)" : "rgba(255, 255, 255, 0.86)";
    const surfaceSecondary = isDark ? "rgba(25, 28, 35, 0.86)" : "rgba(248, 250, 252, 0.86)";
    const surfaceElevated = isDark ? "rgba(18, 20, 27, 0.98)" : "rgba(255, 255, 255, 0.98)";
    const border = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(17, 24, 39, 0.08)";
    const borderStrong = isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(17, 24, 39, 0.14)";
    const textPrimary = isDark ? "rgba(245, 247, 250, 0.96)" : "rgba(17, 24, 39, 0.98)";
    const textSecondary = isDark ? "rgba(226, 232, 240, 0.74)" : "rgba(17, 24, 39, 0.72)";
    const textTertiary = isDark ? "rgba(226, 232, 240, 0.48)" : "rgba(17, 24, 39, 0.46)";
    const textQuaternary = isDark ? "rgba(226, 232, 240, 0.28)" : "rgba(17, 24, 39, 0.24)";
    const shadowSm = isDark
        ? "0 1px 3px rgba(0, 0, 0, 0.34), 0 10px 24px rgba(0, 0, 0, 0.24)"
        : "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)";
    const shadowMd = isDark
        ? "0 2px 8px rgba(0, 0, 0, 0.38), 0 24px 60px rgba(0, 0, 0, 0.3)"
        : "0 2px 8px rgba(15, 23, 42, 0.07), 0 24px 60px rgba(15, 23, 42, 0.08)";
    const shadowLg = isDark
        ? "0 16px 48px rgba(0, 0, 0, 0.44), 0 40px 100px rgba(0, 0, 0, 0.36)"
        : "0 16px 48px rgba(15, 23, 42, 0.12), 0 40px 100px rgba(15, 23, 42, 0.12)";
    const accentSoft = alpha(accent.accentRgb, isDark ? 0.2 : 0.14);
    const accentGradient = `linear-gradient(135deg, ${accent.accent} 0%, ${accent.accentAlt} 100%)`;
    const focusRing = alpha(accent.accentRgb, isDark ? 0.34 : 0.26);
    const highlight = alpha(accent.accentAltRgb, isDark ? 0.26 : 0.18);
    const selectionBg = alpha(accent.accentRgb, isDark ? 0.32 : 0.22);
    const materialRegular = isDark ? "rgba(18, 20, 27, 0.8)" : "rgba(255, 255, 255, 0.76)";
    const materialThick = isDark ? "rgba(18, 20, 27, 0.92)" : "rgba(255, 255, 255, 0.9)";
    const builderShellBackground = isDark
        ? "linear-gradient(180deg, rgba(10, 12, 17, 1) 0%, rgba(7, 9, 13, 1) 100%)"
        : "linear-gradient(180deg, rgba(250, 251, 255, 1) 0%, rgba(243, 246, 250, 1) 100%)";
    const builderRailBackground = isDark ? "rgba(15, 17, 23, 0.92)" : "rgba(255, 255, 255, 0.76)";
    const builderTopbarBackground = isDark ? "rgba(15, 17, 23, 0.9)" : "rgba(255, 255, 255, 0.78)";
    const builderGlass = isDark ? "rgba(17, 20, 27, 0.88)" : "rgba(255, 255, 255, 0.78)";
    const builderGlassStrong = isDark ? "rgba(21, 24, 32, 0.96)" : "rgba(255, 255, 255, 0.94)";
    const builderSidebarBackground = isDark ? "rgba(12, 14, 20, 0.92)" : "rgba(247, 249, 252, 0.88)";
    const builderBorder = border;
    const builderBorderSubtle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(17, 24, 39, 0.05)";
    const builderMuted = isDark ? "rgba(226, 232, 240, 0.58)" : "rgba(17, 24, 39, 0.56)";
    const builderMutedStrong = isDark ? "rgba(226, 232, 240, 0.8)" : "rgba(17, 24, 39, 0.72)";
    const builderMutedSoft = isDark ? "rgba(226, 232, 240, 0.4)" : "rgba(17, 24, 39, 0.4)";
    const builderInverseBackground = "linear-gradient(180deg, rgba(17, 20, 27, 0.98) 0%, rgba(10, 12, 18, 1) 100%)";
    const builderInversePanel = "rgba(15, 18, 24, 0.92)";
    const builderInverseBorder = "rgba(255, 255, 255, 0.08)";
    const builderInverseText = "rgba(245, 247, 250, 0.94)";
    const builderInverseMuted = "rgba(148, 163, 184, 0.72)";
    const builderOverlay = isDark ? "rgba(2, 4, 7, 0.46)" : "rgba(12, 14, 18, 0.22)";
    const builderStatusBackground = accentGradient;
    const builderStatusText = "rgba(255, 255, 255, 0.96)";
    const cssVariables = {
        "--accent": accent.accent,
        "--accent-strong": accent.accentStrong,
        "--accent-alt": accent.accentAlt,
        "--accent-rgb": accent.accentRgb,
        "--accent-alt-rgb": accent.accentAltRgb,
        "--accent-soft": accentSoft,
        "--accent-gradient": accentGradient,
        "--focus-ring": focusRing,
        "--highlight": highlight,
        "--selection-bg": selectionBg,
        "--selection-text": isDark ? "#ffffff" : "#0f172a",
        "--bg-app": background,
        "--bg-page": pageBackground,
        "--bg-primary": surface,
        "--bg-secondary": surfaceSecondary,
        "--bg-tertiary": surfaceElevated,
        "--bg-elevated": surfaceElevated,
        "--bg-muted": isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(17, 24, 39, 0.06)",
        "--bg-strong": isDark ? "#141821" : "#ffffff",
        "--text-primary": textPrimary,
        "--text-secondary": textSecondary,
        "--text-tertiary": textTertiary,
        "--text-quaternary": textQuaternary,
        "--separator": border,
        "--separator-strong": borderStrong,
        "--shadow-sm": shadowSm,
        "--shadow-md": shadowMd,
        "--shadow-lg": shadowLg,
        "--material-regular": materialRegular,
        "--material-thick": materialThick,
        "--builder-shell-bg": builderShellBackground,
        "--builder-rail-bg": builderRailBackground,
        "--builder-topbar-bg": builderTopbarBackground,
        "--builder-glass": builderGlass,
        "--builder-glass-strong": builderGlassStrong,
        "--builder-sidebar-bg": builderSidebarBackground,
        "--builder-border": builderBorder,
        "--builder-border-subtle": builderBorderSubtle,
        "--builder-muted": builderMuted,
        "--builder-muted-strong": builderMutedStrong,
        "--builder-muted-soft": builderMutedSoft,
        "--builder-inverse-bg": builderInverseBackground,
        "--builder-inverse-panel": builderInversePanel,
        "--builder-inverse-border": builderInverseBorder,
        "--builder-inverse-text": builderInverseText,
        "--builder-inverse-muted": builderInverseMuted,
        "--builder-overlay": builderOverlay,
        "--builder-status-bg": builderStatusBackground,
        "--builder-status-text": builderStatusText,
    };
    return {
        mode: preference.mode,
        accentId: preference.accentId,
        accent: accent.accent,
        accentStrong: accent.accentStrong,
        accentAlt: accent.accentAlt,
        accentGradient,
        accentSoft,
        focusRing,
        highlight,
        background,
        pageBackground,
        surface,
        surfaceSecondary,
        surfaceElevated,
        border,
        borderStrong,
        textPrimary,
        textSecondary,
        textTertiary,
        builderShellBackground,
        builderRailBackground,
        builderTopbarBackground,
        builderGlass,
        builderGlassStrong,
        builderSidebarBackground,
        builderBorder,
        builderBorderSubtle,
        builderMuted,
        builderMutedStrong,
        builderMutedSoft,
        builderInverseBackground,
        builderInversePanel,
        builderInverseBorder,
        builderInverseText,
        builderInverseMuted,
        builderOverlay,
        builderStatusBackground,
        builderStatusText,
        monacoTheme: isDark ? "vs-dark" : "vs",
        diffTheme: isDark ? "vs-dark" : "vs",
        cssVariables,
    };
}
function applyThemeToDocument(tokens) {
    if (typeof document === "undefined") {
        return;
    }
    const root = document.documentElement;
    root.dataset.themeMode = tokens.mode;
    root.dataset.themeAccent = tokens.accentId;
    root.style.colorScheme = tokens.mode;
    Object.entries(tokens.cssVariables).forEach(([name, value]) => {
        root.style.setProperty(name, value);
    });
}
export function AppThemeProvider({ children }) {
    const [preference, setPreference] = useState(() => readStoredPreference());
    const tokens = useMemo(() => buildThemeTokens(preference), [preference]);
    useEffect(() => {
        applyThemeToDocument(tokens);
    }, [tokens]);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    }, [preference]);
    const value = useMemo(() => ({
        preference,
        mode: preference.mode,
        accentId: preference.accentId,
        accentOptions: THEME_ACCENT_OPTIONS,
        tokens,
        setMode: (mode) => setPreference((current) => ({
            ...current,
            mode,
            version: THEME_VERSION,
            updatedAt: new Date().toISOString(),
        })),
        setAccentId: (accentId) => setPreference((current) => ({
            ...current,
            accentId,
            version: THEME_VERSION,
            updatedAt: new Date().toISOString(),
        })),
    }), [preference, tokens]);
    return _jsx(AppThemeContext.Provider, { value: value, children: children });
}
export function useAppTheme() {
    const context = useContext(AppThemeContext);
    if (!context) {
        throw new Error("useAppTheme must be used inside AppThemeProvider");
    }
    return context;
}
