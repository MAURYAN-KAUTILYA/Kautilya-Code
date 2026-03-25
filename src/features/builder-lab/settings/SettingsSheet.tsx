import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SETTINGS_FEATURES } from "./registry";

export default function SettingsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const orderedFeatures = useMemo(() => SETTINGS_FEATURES, []);
  const [activeId, setActiveId] = useState(orderedFeatures[0]?.id ?? "");
  const activeFeature =
    orderedFeatures.find((entry) => entry.id === activeId) ?? orderedFeatures[0] ?? null;

  if (!isOpen || !activeFeature) {
    return null;
  }

  const ActiveComponent = activeFeature.component;

  return (
    <div className="apple-modal-backdrop settings-sheet-backdrop" onClick={onClose}>
      <div
        className="apple-modal settings-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="settings-sheet__sidebar">
          <div className="settings-sheet__header">
            <span className="apple-badge apple-badge--muted">
              <Settings2 size={12} />
              <span style={{ marginLeft: 6 }}>Settings</span>
            </span>
            <h2 className="apple-subheading" style={{ marginTop: 12 }}>
              Feature settings
            </h2>
            <p className="apple-body" style={{ marginTop: 10 }}>
              Theme Builder is the first module in a reusable settings registry, so more settings
              can be added later without new routes.
            </p>
          </div>

          <nav className="settings-sheet__nav">
            {orderedFeatures.map((feature) => {
              const Icon = feature.icon;
              const active = feature.id === activeFeature.id;

              return (
                <button
                  className={`settings-sheet__nav-item ${active ? "is-active" : ""}`}
                  key={feature.id}
                  onClick={() => setActiveId(feature.id)}
                  type="button"
                >
                  <span className="settings-sheet__nav-icon">
                    <Icon size={16} />
                  </span>
                  <span>
                    <strong>{feature.title}</strong>
                    <small>{feature.description}</small>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="settings-sheet__body">
          <ActiveComponent onClose={onClose} />
        </section>
      </div>
    </div>
  );
}
