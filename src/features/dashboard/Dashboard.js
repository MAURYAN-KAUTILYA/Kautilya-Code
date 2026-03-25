import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, BookOpen, ChevronLeft, Command, KeyRound, LayoutDashboard, LogOut, Settings2, UserRound, Users, WandSparkles, } from "lucide-react";
import { useNavigate } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import SettingsSheet from "@/features/builder-lab/settings/SettingsSheet";
import { signOut, supabase } from "@/lib/supabaseClient";
import { useAppTheme } from "@/theme/AppThemeProvider";
const MOCK_USER = {
    name: "Mauryan",
    tier: "812+",
    cordsUsed: 420,
    cordsTotal: 700,
};
const MOCK_STATS = [
    { label: "Sessions this week", value: "14", sub: "+3 from last week" },
    { label: "Most used tier", value: "T4", sub: "Chanakya Intelligence" },
    { label: "Division passes", value: "86", sub: "Across recent sessions" },
    { label: "Memory patterns", value: "31", sub: "Stored in session context" },
];
const MOCK_SESSIONS = [
    {
        id: 1,
        prompt: "Build a JWT authentication system with refresh tokens",
        tier: "T4",
        score: "9/10",
        time: "2h ago",
    },
    {
        id: 2,
        prompt: "Write a rate limiter middleware for Express",
        tier: "T3",
        score: "8/10",
        time: "5h ago",
    },
    {
        id: 3,
        prompt: "Create a debounce hook with TypeScript generics",
        tier: "T2",
        score: "8/10",
        time: "Yesterday",
    },
];
const MOCK_DIVISIONS = [
    { name: "Kantaka", count: 86 },
    { name: "Amatya", count: 82 },
    { name: "Sanchara", count: 80 },
    { name: "Dharmashta", count: 75 },
];
const MOCK_NOTIFICATIONS = [
    { id: 1, text: "Builder session review is ready to approve.", time: "Just now", unread: true },
    { id: 2, text: "New documentation blocks are available soon.", time: "1h ago", unread: true },
    { id: 3, text: "Weekly usage summary has been refreshed.", time: "Yesterday", unread: false },
];
const KEYBOARD_SHORTCUTS = [
    { key: "Ctrl + B", desc: "Open Builder" },
    { key: "Ctrl + /", desc: "Toggle sidebar" },
    { key: "Ctrl + N", desc: "Start a new builder session" },
    { key: "Esc", desc: "Close overlays" },
];
const PLATFORM_ITEMS = [
    {
        id: "builder",
        title: "Builder",
        body: "The flagship workspace for prompt, files, preview, and runtime in one surface.",
        cta: "Open Builder",
        route: "/builder",
        available: true,
    },
    {
        id: "docs",
        title: "Kautilya Docs",
        body: "Documentation and doctrine remain visible as part of the product horizon, but the route is not live yet.",
        cta: "Coming soon",
        route: "/docs",
        available: false,
    },
    {
        id: "community",
        title: "Community",
        body: "Social and tournament surfaces stay in the roadmap without exposing a broken path.",
        cta: "Coming soon",
        route: "/community",
        available: false,
    },
    {
        id: "wallet",
        title: "API Wallet",
        body: "Bring your own model access and keep it attached to the Kautilya workflow.",
        cta: "Manage keys",
        route: null,
        available: true,
    },
];
function modalTheme(theme) {
    return {
        colorScheme: theme.mode,
        background: theme.surfaceElevated,
        color: theme.textPrimary,
        borderColor: theme.border,
    };
}
function WalletModal({ onClose, theme, }) {
    const [keyValue, setKeyValue] = useState("");
    const [provider, setProvider] = useState("anthropic");
    return (_jsx("div", { className: "apple-modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "apple-modal", onClick: (event) => event.stopPropagation(), style: modalTheme(theme), children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 18 }, children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "API wallet" }), _jsx("h3", { style: { margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }, children: "Connect your model key" })] }), _jsx("button", { className: "dashboard-icon-btn", onClick: onClose, type: "button", children: _jsx(ChevronLeft, { size: 16, style: { transform: "rotate(45deg)" } }) })] }), _jsx("div", { className: "apple-grid-3", style: { marginBottom: 16 }, children: ["anthropic", "openai", "google"].map((entry) => {
                        const active = entry === provider;
                        return (_jsx("button", { className: "apple-btn apple-btn--ghost", onClick: () => setProvider(entry), style: {
                                background: active ? theme.accentSoft : "transparent",
                                color: active ? theme.accent : theme.textSecondary,
                                border: `0.5px solid ${active ? theme.borderStrong : theme.border}`,
                            }, type: "button", children: entry.toUpperCase() }, entry));
                    }) }), _jsxs("div", { className: "auth-form", children: [_jsx("input", { className: "apple-input", onChange: (event) => setKeyValue(event.target.value), placeholder: provider === "anthropic"
                                ? "sk-ant-..."
                                : provider === "openai"
                                    ? "sk-..."
                                    : "AIza...", type: "password", value: keyValue }), _jsxs("div", { className: "apple-card", style: { padding: 16 }, children: [_jsx("p", { className: "apple-kicker", children: "Auto-detection" }), _jsx("p", { className: "apple-body", children: "Kautilya can still surface capability-aware behavior without changing the frontend flow. This modal remains a UI surface only." })] }), _jsx("button", { className: "apple-btn", disabled: !keyValue, type: "button", children: "Connect key" })] })] }) }));
}
function ShortcutOverlay({ onClose, theme, }) {
    return (_jsx("div", { className: "apple-modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "apple-modal", onClick: (event) => event.stopPropagation(), style: modalTheme(theme), children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 18 }, children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Keyboard shortcuts" }), _jsx("h3", { style: { margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }, children: "Quick navigation" })] }), _jsx("button", { className: "dashboard-icon-btn", onClick: onClose, type: "button", children: _jsx(ChevronLeft, { size: 16, style: { transform: "rotate(45deg)" } }) })] }), _jsx("div", { className: "dashboard-list", children: KEYBOARD_SHORTCUTS.map((shortcut) => (_jsxs("div", { className: "dashboard-list__row", children: [_jsx("span", { style: { color: theme.textPrimary, fontSize: "14px" }, children: shortcut.desc }), _jsx("span", { className: "apple-badge apple-badge--muted", children: shortcut.key })] }, shortcut.key))) })] }) }));
}
function NotificationPanel({ onClose, theme, }) {
    const unread = MOCK_NOTIFICATIONS.filter((entry) => entry.unread).length;
    return (_jsxs("div", { className: "dashboard-overlay-card apple-surface-strong", style: {
            background: theme.surfaceElevated,
            borderColor: theme.border,
            color: theme.textPrimary,
        }, children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 10 }, children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Notifications" }), _jsxs("p", { style: { margin: 0, color: theme.textPrimary, fontWeight: 600 }, children: [unread, " unread updates"] })] }), _jsx("button", { className: "dashboard-icon-btn", onClick: onClose, type: "button", children: _jsx(ChevronLeft, { size: 16, style: { transform: "rotate(45deg)" } }) })] }), _jsx("div", { className: "dashboard-list", children: MOCK_NOTIFICATIONS.map((notification) => (_jsxs("div", { className: "dashboard-list__row", children: [_jsxs("div", { children: [_jsx("div", { style: { color: theme.textPrimary, fontSize: "14px", lineHeight: 1.5 }, children: notification.text }), _jsx("div", { style: { color: theme.textTertiary, fontSize: "12px", marginTop: 4 }, children: notification.time })] }), notification.unread ? (_jsx("span", { className: "apple-badge apple-badge--status", children: "New" })) : null] }, notification.id))) })] }));
}
export default function Dashboard() {
    const navigate = useNavigate();
    const { mode, tokens: theme } = useAppTheme();
    const [user, setUser] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeNav, setActiveNav] = useState("home");
    const [showWallet, setShowWallet] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user: nextUser } }) => {
            setUser(nextUser);
        });
    }, []);
    const themeVars = { colorScheme: mode };
    const displayName = user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        MOCK_USER.name;
    const cordsPercent = Math.round((MOCK_USER.cordsUsed / MOCK_USER.cordsTotal) * 100);
    const navigateIfAvailable = (route, available) => {
        if (!route || !available)
            return;
        navigate(route);
    };
    const handleLogout = async () => {
        try {
            await signOut();
            navigate("/login", { replace: true });
        }
        catch (error) {
            console.error("Logout failed:", error);
        }
    };
    const navItems = [
        { id: "home", label: "Home", icon: _jsx(LayoutDashboard, { size: 18 }), action: () => setActiveNav("home"), available: true },
        { id: "builder", label: "Builder", icon: _jsx(WandSparkles, { size: 18 }), action: () => navigate("/builder"), available: true },
        { id: "docs", label: "Docs", icon: _jsx(BookOpen, { size: 18 }), action: () => { }, available: false },
        { id: "community", label: "Community", icon: _jsx(Users, { size: 18 }), action: () => { }, available: false },
        { id: "wallet", label: "API Wallet", icon: _jsx(KeyRound, { size: 18 }), action: () => setShowWallet(true), available: true },
    ];
    return (_jsxs("div", { className: "dashboard-page apple-page", style: themeVars, children: [_jsx(SettingsSheet, { isOpen: showSettings, onClose: () => setShowSettings(false) }), showWallet ? _jsx(WalletModal, { onClose: () => setShowWallet(false), theme: theme }) : null, showShortcuts ? _jsx(ShortcutOverlay, { onClose: () => setShowShortcuts(false), theme: theme }) : null, _jsxs("div", { className: "dashboard-shell", children: [_jsxs("aside", { className: "apple-surface dashboard-sidebar", children: [_jsxs("div", { className: "brand-lockup", children: [_jsx("div", { className: "brand-lockup__mark", style: { color: theme.accent }, children: _jsx(KautilyaLogo, { size: 26 }) }), sidebarOpen ? (_jsxs("div", { children: [_jsx("p", { className: "brand-lockup__title", children: "Kautilya" }), _jsx("p", { className: "brand-lockup__meta", children: "Refined dashboard surface" })] })) : null] }), _jsx("div", { className: "dashboard-sidebar__nav", children: navItems.map((item) => {
                                    const isActive = activeNav === item.id;
                                    return (_jsxs("button", { className: [
                                            "dashboard-nav-item",
                                            isActive ? "dashboard-nav-item--active" : "",
                                            item.available ? "" : "dashboard-nav-item--disabled",
                                        ]
                                            .filter(Boolean)
                                            .join(" "), onClick: () => {
                                            if (!item.available)
                                                return;
                                            item.action();
                                            setActiveNav(item.id);
                                        }, type: "button", children: [_jsx("span", { children: item.icon }), sidebarOpen ? _jsx("span", { children: item.label }) : null, !item.available && sidebarOpen ? (_jsx("span", { className: "coming-soon-badge", style: { marginLeft: "auto", fontSize: "10px" }, children: "Soon" })) : null] }, item.id));
                                }) }), _jsxs("div", { className: "section-stack", children: [sidebarOpen ? (_jsxs("div", { className: "apple-card", style: { padding: 18 }, children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 8 }, children: [_jsx("span", { className: "apple-kicker", style: { marginBottom: 0 }, children: "Cords" }), _jsxs("span", { className: "brand-lockup__meta", children: [MOCK_USER.cordsUsed, "/", MOCK_USER.cordsTotal] })] }), _jsx("div", { className: "dashboard-progress", children: _jsx("span", { style: { width: `${cordsPercent}%` } }) }), _jsxs("p", { className: "apple-body", style: { marginTop: 10 }, children: [MOCK_USER.cordsTotal - MOCK_USER.cordsUsed, " remaining this week."] })] })) : null, _jsxs("button", { className: "dashboard-nav-item", onClick: () => setSidebarOpen((current) => !current), type: "button", children: [_jsx(ChevronLeft, { size: 18, style: { transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)" } }), sidebarOpen ? _jsx("span", { children: "Collapse" }) : null] })] })] }), _jsxs("main", { className: "dashboard-main", children: [_jsxs("div", { className: "apple-surface dashboard-topbar", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Dashboard" }), _jsxs("h1", { style: {
                                                    margin: 0,
                                                    fontSize: "28px",
                                                    lineHeight: 1.05,
                                                    letterSpacing: "-0.03em",
                                                    fontWeight: 600,
                                                }, children: ["Good afternoon, ", displayName] })] }), _jsxs("div", { className: "dashboard-topbar__actions", children: [_jsx("button", { className: "dashboard-icon-btn", onClick: () => setShowShortcuts(true), type: "button", children: _jsx(Command, { size: 16 }) }), _jsx("button", { className: "dashboard-icon-btn", onClick: () => setShowSettings(true), type: "button", children: _jsx(Settings2, { size: 16 }) }), _jsxs("div", { className: "dashboard-overlay-anchor", children: [_jsx("button", { className: "dashboard-icon-btn", onClick: () => setShowNotifs((current) => !current), type: "button", children: _jsx(Bell, { size: 16 }) }), showNotifs ? _jsx(NotificationPanel, { onClose: () => setShowNotifs(false), theme: theme }) : null] }), _jsxs("div", { className: "dashboard-overlay-anchor", children: [_jsx("button", { className: "dashboard-icon-btn", onClick: () => setShowProfileMenu((current) => !current), type: "button", children: _jsx(UserRound, { size: 16 }) }), showProfileMenu ? (_jsx("div", { className: "dashboard-overlay-card apple-surface-strong", style: {
                                                            background: theme.surfaceElevated,
                                                            borderColor: theme.border,
                                                            color: theme.textPrimary,
                                                            width: 220,
                                                        }, children: _jsxs("div", { className: "section-stack", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Signed in as" }), _jsx("p", { style: { margin: 0, fontSize: "14px", lineHeight: 1.5 }, children: user?.email })] }), _jsxs("button", { className: "dashboard-nav-item", onClick: () => setShowProfileMenu(false), type: "button", children: [_jsx(UserRound, { size: 16 }), _jsx("span", { children: "Profile" })] }), _jsxs("button", { className: "dashboard-nav-item", onClick: handleLogout, type: "button", children: [_jsx(LogOut, { size: 16 }), _jsx("span", { children: "Logout" })] })] }) })) : null] })] })] }), _jsxs("div", { className: "dashboard-content", children: [_jsxs("section", { className: "dashboard-section", children: [_jsx("div", { className: "apple-card section-block", children: _jsxs("div", { className: "auth-inline", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Current focus" }), _jsx("h2", { className: "apple-subheading", children: "Launch the builder, monitor usage, and keep product intent visible." })] }), _jsx("button", { className: "apple-btn", onClick: () => navigate("/builder"), type: "button", children: "Open builder" })] }) }), _jsx("div", { className: "dashboard-card-grid", children: MOCK_STATS.map((stat) => (_jsxs("article", { className: "apple-card dashboard-card", children: [_jsx("p", { className: "apple-kicker", children: stat.label }), _jsx("h3", { style: { fontSize: "32px", marginBottom: 6 }, children: stat.value }), _jsx("p", { children: stat.sub })] }, stat.label))) })] }), _jsxs("section", { className: "dashboard-section dashboard-split", children: [_jsxs("article", { className: "apple-card dashboard-card", children: [_jsx("p", { className: "apple-kicker", children: "Recent sessions" }), _jsx("div", { className: "dashboard-list", children: MOCK_SESSIONS.map((session) => (_jsxs("div", { className: "dashboard-list__row", children: [_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: "14px", lineHeight: 1.55 }, children: session.prompt }), _jsx("div", { className: "brand-lockup__meta", style: { marginTop: 6 }, children: session.time })] }), _jsxs("div", { className: "section-stack", style: { gap: 8, justifyItems: "end" }, children: [_jsx("span", { className: "apple-badge apple-badge--muted", children: session.tier }), _jsx("span", { className: "apple-badge apple-badge--status", children: session.score })] })] }, session.id))) })] }), _jsxs("article", { className: "apple-card dashboard-card", children: [_jsx("p", { className: "apple-kicker", children: "Division activity" }), _jsx("div", { className: "dashboard-list", children: MOCK_DIVISIONS.map((division) => (_jsxs("div", { children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: "14px", fontWeight: 500 }, children: division.name }), _jsxs("span", { className: "brand-lockup__meta", children: [division.count, " passes"] })] }), _jsx("div", { className: "dashboard-progress", children: _jsx("span", { style: { width: `${Math.round((division.count / MOCK_DIVISIONS[0].count) * 100)}%` } }) })] }, division.name))) })] })] }), _jsxs("section", { className: "dashboard-section", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Platform surfaces" }), _jsx("h2", { className: "apple-subheading", children: "Keep the value visible, disable the routes that are not ready." })] }), _jsx("div", { className: "dashboard-platform-grid", children: PLATFORM_ITEMS.map((item) => {
                                                    const disabled = !item.available;
                                                    return (_jsxs("article", { className: `apple-card dashboard-card ${disabled ? "is-disabled" : ""}`, children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 12 }, children: [_jsx("h3", { style: { marginBottom: 0 }, children: item.title }), disabled ? (_jsx("span", { className: "coming-soon-badge", children: "Coming soon" })) : null] }), _jsx("p", { children: item.body }), _jsx("div", { style: { height: 16 } }), _jsxs("button", { className: disabled ? "apple-btn apple-btn--ghost" : "apple-btn apple-btn--secondary", onClick: () => {
                                                                    if (item.route === null && item.available) {
                                                                        setShowWallet(true);
                                                                        return;
                                                                    }
                                                                    navigateIfAvailable(item.route, item.available);
                                                                }, type: "button", children: [item.cta, !disabled ? _jsx(ArrowRight, { size: 14, style: { marginLeft: 8 } }) : null] })] }, item.id));
                                                }) })] }), _jsxs("section", { className: "dashboard-section", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Quick actions" }), _jsx("h2", { className: "apple-subheading", children: "Fast paths for the surfaces that already exist." })] }), _jsx("div", { className: "dashboard-action-grid", children: [
                                                    {
                                                        title: "New session",
                                                        body: "Jump directly into the builder workspace.",
                                                        available: true,
                                                        action: () => navigate("/builder"),
                                                    },
                                                    {
                                                        title: "Docs",
                                                        body: "Visible in the roadmap, disabled until the route exists.",
                                                        available: false,
                                                        action: () => { },
                                                    },
                                                    {
                                                        title: "Community",
                                                        body: "Kept as product value, not as a broken link.",
                                                        available: false,
                                                        action: () => { },
                                                    },
                                                    {
                                                        title: "API wallet",
                                                        body: "Open the current wallet surface.",
                                                        available: true,
                                                        action: () => setShowWallet(true),
                                                    },
                                                ].map((card) => (_jsxs("button", { className: `apple-card dashboard-quick-card ${card.available ? "" : "is-disabled"}`, onClick: card.action, style: {
                                                        border: "0.5px solid var(--separator)",
                                                        background: "var(--bg-elevated)",
                                                        textAlign: "left",
                                                        cursor: card.available ? "pointer" : "not-allowed",
                                                    }, type: "button", children: [_jsxs("div", { className: "auth-inline", style: { marginBottom: 10 }, children: [_jsx("h3", { style: { marginBottom: 0 }, children: card.title }), card.available ? _jsx(ArrowRight, { size: 14 }) : _jsx("span", { className: "coming-soon-badge", children: "Soon" })] }), _jsx("p", { children: card.body })] }, card.title))) })] })] })] })] })] }));
}
