import { Check, Moon, Sparkles, SunMedium } from "lucide-react";
import { useMemo, useState } from "react";
import {
  THEME_ACCENT_OPTIONS,
  buildThemeTokens,
  useAppTheme,
  type ThemeMode,
} from "@/theme/AppThemeProvider";
import type { SettingsFeatureComponentProps } from "../types";

function ThemePreviewSection({
  sectionMode,
  open,
  onToggle,
}: {
  sectionMode: ThemeMode;
  open: boolean;
  onToggle: () => void;
}) {
  const { accentId, preference, setAccentId } = useAppTheme();
  const previewModeLabel = sectionMode === "light" ? "Light Theme" : "Dark Theme";
  const sectionTheme = useMemo(
    () => buildThemeTokens({ ...preference, mode: sectionMode }),
    [preference, sectionMode],
  );

  return (
    <section className="theme-builder__section apple-card">
      <button className="theme-builder__section-header" onClick={onToggle} type="button">
        <div>
          <p className="apple-kicker">{previewModeLabel}</p>
          <p className="apple-body" style={{ marginTop: 6 }}>
            {sectionMode === "light"
              ? "White-based surfaces, dark typography, and accent-led highlights."
              : "Charcoal surfaces, softened text, and restrained accent glow."}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="theme-builder__caret"
          style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
        >
          ^
        </span>
      </button>

      {open ? (
        <div className="theme-builder__section-body">
          <div
            className="theme-builder__preview"
            style={{
              background:
                sectionMode === "light"
                  ? `linear-gradient(180deg, rgba(255,255,255,0.98), ${sectionTheme.surfaceSecondary})`
                  : sectionTheme.builderInverseBackground,
              borderColor:
                sectionMode === "light" ? sectionTheme.border : sectionTheme.builderInverseBorder,
              color:
                sectionMode === "light"
                  ? sectionTheme.textPrimary
                  : sectionTheme.builderInverseText,
            }}
          >
            <div className="theme-builder__preview-top">
              <span
                className="theme-builder__preview-dot"
                style={{ background: sectionTheme.accentGradient }}
              />
              <span
                className="theme-builder__preview-label"
                style={{
                  color:
                    sectionMode === "light"
                      ? sectionTheme.textSecondary
                      : sectionTheme.builderInverseMuted,
                }}
              >
                {previewModeLabel} preview
              </span>
            </div>
            <h3 className="theme-builder__preview-title">Theme Builder keeps colour in service of action.</h3>
            <p
              className="theme-builder__preview-copy"
              style={{
                color:
                  sectionMode === "light"
                    ? sectionTheme.textSecondary
                    : sectionTheme.builderInverseMuted,
              }}
            >
              Accent touches live on buttons, underlines, highlights, and control emphasis while the
              background stays calm.
            </p>
            <div className="theme-builder__preview-actions">
              <button
                className="apple-btn"
                style={{ background: sectionTheme.accentGradient, boxShadow: "none" }}
                type="button"
              >
                Primary action
              </button>
              <span
                className="theme-builder__preview-link"
                style={{ color: sectionTheme.accentStrong, borderBottomColor: sectionTheme.accent }}
              >
                Accent underline
              </span>
            </div>
          </div>

          <div className="theme-builder__option-grid">
            {THEME_ACCENT_OPTIONS.map((option) => {
              const optionTheme = buildThemeTokens({
                ...preference,
                accentId: option.id,
                mode: sectionMode,
              });
              const selected = accentId === option.id;

              return (
                <button
                  className={`theme-builder__option ${selected ? "is-selected" : ""}`}
                  key={`${sectionMode}-${option.id}`}
                  onClick={() => setAccentId(option.id)}
                  style={{
                    borderColor: selected ? optionTheme.accent : optionTheme.border,
                    background:
                      sectionMode === "light"
                        ? optionTheme.surfaceElevated
                        : optionTheme.builderGlassStrong,
                    color:
                      sectionMode === "light"
                        ? optionTheme.textPrimary
                        : optionTheme.builderInverseText,
                    boxShadow: selected ? `0 0 0 3px ${optionTheme.focusRing}` : "none",
                  }}
                  type="button"
                >
                  <div
                    className="theme-builder__swatch"
                    style={{ background: optionTheme.accentGradient }}
                  />
                  <div className="theme-builder__option-head">
                    <div>
                      <strong>{option.label}</strong>
                      <p
                        style={{
                          margin: "6px 0 0",
                          color:
                            sectionMode === "light"
                              ? optionTheme.textSecondary
                              : optionTheme.builderInverseMuted,
                        }}
                      >
                        {option.description}
                      </p>
                    </div>
                    {selected ? (
                      <span
                        className="theme-builder__check"
                        style={{
                          background: optionTheme.accentSoft,
                          color: optionTheme.accentStrong,
                        }}
                      >
                        <Check size={14} />
                      </span>
                    ) : null}
                  </div>
                  <div className="theme-builder__option-preview">
                    <span
                      className="theme-builder__mini-pill"
                      style={{
                        background: optionTheme.accentSoft,
                        color: optionTheme.accentStrong,
                      }}
                    >
                      Highlight
                    </span>
                    <span
                      className="theme-builder__mini-line"
                      style={{ background: optionTheme.accentGradient }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function ThemeBuilderFeature({ onClose }: SettingsFeatureComponentProps) {
  const { accentId, accentOptions, mode, setMode } = useAppTheme();
  const [openSections, setOpenSections] = useState<Record<ThemeMode, boolean>>({
    light: mode === "light",
    dark: mode === "dark",
  });

  const activeAccent = accentOptions.find((entry) => entry.id === accentId) ?? accentOptions[0];

  return (
    <div className="theme-builder">
      <div className="theme-builder__intro">
        <div>
          <p className="apple-kicker">Theme Builder</p>
          <h2 className="apple-subheading">A shared theme system for every routed Kautilya surface.</h2>
          <p className="apple-body" style={{ marginTop: 12 }}>
            Backgrounds stay neutral. Accent colour drives button emphasis, underlines, highlights,
            focus, and active UI detail across intro, login, dashboard, and builder.
          </p>
        </div>
        <button className="apple-btn apple-btn--ghost" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="theme-builder__mode-bar">
        <button
          className={mode === "light" ? "apple-btn" : "apple-btn apple-btn--secondary"}
          onClick={() => setMode("light")}
          style={mode === "light" ? { background: "var(--accent-gradient)" } : undefined}
          type="button"
        >
          <SunMedium size={16} />
          <span style={{ marginLeft: 8 }}>Light</span>
        </button>
        <button
          className={mode === "dark" ? "apple-btn" : "apple-btn apple-btn--secondary"}
          onClick={() => setMode("dark")}
          style={mode === "dark" ? { background: "var(--accent-gradient)" } : undefined}
          type="button"
        >
          <Moon size={16} />
          <span style={{ marginLeft: 8 }}>Dark</span>
        </button>
      </div>

      <div className="theme-builder__meta">
        <span className="apple-badge">
          <Sparkles size={12} />
          <span>{activeAccent.label}</span>
        </span>
        <span className="brand-lockup__meta">
          Saved locally now, structured for future account sync.
        </span>
      </div>

      <ThemePreviewSection
        sectionMode="light"
        open={openSections.light}
        onToggle={() =>
          setOpenSections((current) => ({ ...current, light: !current.light }))
        }
      />
      <ThemePreviewSection
        sectionMode="dark"
        open={openSections.dark}
        onToggle={() =>
          setOpenSections((current) => ({ ...current, dark: !current.dark }))
        }
      />
    </div>
  );
}
