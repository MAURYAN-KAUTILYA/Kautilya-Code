import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SETTINGS_FEATURES } from "./registry";
export default function SettingsSheet({ isOpen, onClose, }) {
    const orderedFeatures = useMemo(() => SETTINGS_FEATURES, []);
    const [activeId, setActiveId] = useState(orderedFeatures[0]?.id ?? "");
    const activeFeature = orderedFeatures.find((entry) => entry.id === activeId) ?? orderedFeatures[0] ?? null;
    if (!isOpen || !activeFeature) {
        return null;
    }
    const ActiveComponent = activeFeature.component;
    return (_jsx("div", { className: "apple-modal-backdrop settings-sheet-backdrop", onClick: onClose, children: _jsxs("div", { className: "apple-modal settings-sheet", onClick: (event) => event.stopPropagation(), children: [_jsxs("aside", { className: "settings-sheet__sidebar", children: [_jsxs("div", { className: "settings-sheet__header", children: [_jsxs("span", { className: "apple-badge apple-badge--muted", children: [_jsx(Settings2, { size: 12 }), _jsx("span", { style: { marginLeft: 6 }, children: "Settings" })] }), _jsx("h2", { className: "apple-subheading", style: { marginTop: 12 }, children: "Feature settings" }), _jsx("p", { className: "apple-body", style: { marginTop: 10 }, children: "Theme Builder is the first module in a reusable settings registry, so more settings can be added later without new routes." })] }), _jsx("nav", { className: "settings-sheet__nav", children: orderedFeatures.map((feature) => {
                                const Icon = feature.icon;
                                const active = feature.id === activeFeature.id;
                                return (_jsxs("button", { className: `settings-sheet__nav-item ${active ? "is-active" : ""}`, onClick: () => setActiveId(feature.id), type: "button", children: [_jsx("span", { className: "settings-sheet__nav-icon", children: _jsx(Icon, { size: 16 }) }), _jsxs("span", { children: [_jsx("strong", { children: feature.title }), _jsx("small", { children: feature.description })] })] }, feature.id));
                            }) })] }), _jsx("section", { className: "settings-sheet__body", children: _jsx(ActiveComponent, { onClose: onClose }) })] }) }));
}
