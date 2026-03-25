import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  ChevronLeft,
  Command,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings2,
  UserRound,
  Users,
  WandSparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import SettingsSheet from "@/features/builder-lab/settings/SettingsSheet";
import { signOut, supabase } from "@/lib/supabaseClient";
import { useAppTheme, type AppThemeTokens } from "@/theme/AppThemeProvider";
import type { User } from "@supabase/supabase-js";

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
] as const;

function modalTheme(theme: AppThemeTokens): CSSProperties {
  return {
    colorScheme: theme.mode,
    background: theme.surfaceElevated,
    color: theme.textPrimary,
    borderColor: theme.border,
  };
}

function WalletModal({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme: AppThemeTokens;
}) {
  const [keyValue, setKeyValue] = useState("");
  const [provider, setProvider] = useState<"anthropic" | "openai" | "google">("anthropic");

  return (
    <div className="apple-modal-backdrop" onClick={onClose}>
      <div
        className="apple-modal"
        onClick={(event) => event.stopPropagation()}
        style={modalTheme(theme)}
      >
        <div className="auth-inline" style={{ marginBottom: 18 }}>
          <div>
            <p className="apple-kicker">API wallet</p>
            <h3 style={{ margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }}>Connect your model key</h3>
          </div>
          <button className="dashboard-icon-btn" onClick={onClose} type="button">
            <ChevronLeft size={16} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>

        <div className="apple-grid-3" style={{ marginBottom: 16 }}>
          {(["anthropic", "openai", "google"] as const).map((entry) => {
            const active = entry === provider;
            return (
              <button
                key={entry}
                className="apple-btn apple-btn--ghost"
                onClick={() => setProvider(entry)}
                style={{
                  background: active ? theme.accentSoft : "transparent",
                  color: active ? theme.accent : theme.textSecondary,
                  border: `0.5px solid ${active ? theme.borderStrong : theme.border}`,
                }}
                type="button"
              >
                {entry.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div className="auth-form">
          <input
            className="apple-input"
            onChange={(event) => setKeyValue(event.target.value)}
            placeholder={
              provider === "anthropic"
                ? "sk-ant-..."
                : provider === "openai"
                  ? "sk-..."
                  : "AIza..."
            }
            type="password"
            value={keyValue}
          />
          <div className="apple-card" style={{ padding: 16 }}>
            <p className="apple-kicker">Auto-detection</p>
            <p className="apple-body">
              Kautilya can still surface capability-aware behavior without changing the frontend flow.
              This modal remains a UI surface only.
            </p>
          </div>
          <button className="apple-btn" disabled={!keyValue} type="button">
            Connect key
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutOverlay({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme: AppThemeTokens;
}) {
  return (
    <div className="apple-modal-backdrop" onClick={onClose}>
      <div
        className="apple-modal"
        onClick={(event) => event.stopPropagation()}
        style={modalTheme(theme)}
      >
        <div className="auth-inline" style={{ marginBottom: 18 }}>
          <div>
            <p className="apple-kicker">Keyboard shortcuts</p>
            <h3 style={{ margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }}>Quick navigation</h3>
          </div>
          <button className="dashboard-icon-btn" onClick={onClose} type="button">
            <ChevronLeft size={16} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>

        <div className="dashboard-list">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <div className="dashboard-list__row" key={shortcut.key}>
              <span style={{ color: theme.textPrimary, fontSize: "14px" }}>{shortcut.desc}</span>
              <span className="apple-badge apple-badge--muted">{shortcut.key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme: AppThemeTokens;
}) {
  const unread = MOCK_NOTIFICATIONS.filter((entry) => entry.unread).length;

  return (
    <div
      className="dashboard-overlay-card apple-surface-strong"
      style={{
        background: theme.surfaceElevated,
        borderColor: theme.border,
        color: theme.textPrimary,
      }}
    >
      <div className="auth-inline" style={{ marginBottom: 10 }}>
        <div>
          <p className="apple-kicker">Notifications</p>
          <p style={{ margin: 0, color: theme.textPrimary, fontWeight: 600 }}>
            {unread} unread updates
          </p>
        </div>
        <button className="dashboard-icon-btn" onClick={onClose} type="button">
          <ChevronLeft size={16} style={{ transform: "rotate(45deg)" }} />
        </button>
      </div>

      <div className="dashboard-list">
        {MOCK_NOTIFICATIONS.map((notification) => (
          <div className="dashboard-list__row" key={notification.id}>
            <div>
              <div style={{ color: theme.textPrimary, fontSize: "14px", lineHeight: 1.5 }}>
                {notification.text}
              </div>
              <div style={{ color: theme.textTertiary, fontSize: "12px", marginTop: 4 }}>
                {notification.time}
              </div>
            </div>
            {notification.unread ? (
              <span className="apple-badge apple-badge--status">New</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { mode, tokens: theme } = useAppTheme();
  const [user, setUser] = useState<User | null>(null);
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

  const themeVars = { colorScheme: mode } as CSSProperties;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    MOCK_USER.name;

  const cordsPercent = Math.round((MOCK_USER.cordsUsed / MOCK_USER.cordsTotal) * 100);

  const navigateIfAvailable = (route: string | null, available: boolean) => {
    if (!route || !available) return;
    navigate(route);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { id: "home", label: "Home", icon: <LayoutDashboard size={18} />, action: () => setActiveNav("home"), available: true },
    { id: "builder", label: "Builder", icon: <WandSparkles size={18} />, action: () => navigate("/builder"), available: true },
    { id: "docs", label: "Docs", icon: <BookOpen size={18} />, action: () => {}, available: false },
    { id: "community", label: "Community", icon: <Users size={18} />, action: () => {}, available: false },
    { id: "wallet", label: "API Wallet", icon: <KeyRound size={18} />, action: () => setShowWallet(true), available: true },
  ] as const;

  return (
    <div className="dashboard-page apple-page" style={themeVars}>
      <SettingsSheet isOpen={showSettings} onClose={() => setShowSettings(false)} />
      {showWallet ? <WalletModal onClose={() => setShowWallet(false)} theme={theme} /> : null}
      {showShortcuts ? <ShortcutOverlay onClose={() => setShowShortcuts(false)} theme={theme} /> : null}

      <div className="dashboard-shell">
        <aside className="apple-surface dashboard-sidebar">
          <div className="brand-lockup">
            <div className="brand-lockup__mark" style={{ color: theme.accent }}>
              <KautilyaLogo size={26} />
            </div>
            {sidebarOpen ? (
              <div>
                <p className="brand-lockup__title">Kautilya</p>
                <p className="brand-lockup__meta">Refined dashboard surface</p>
              </div>
            ) : null}
          </div>

          <div className="dashboard-sidebar__nav">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  className={[
                    "dashboard-nav-item",
                    isActive ? "dashboard-nav-item--active" : "",
                    item.available ? "" : "dashboard-nav-item--disabled",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.id}
                  onClick={() => {
                    if (!item.available) return;
                    item.action();
                    setActiveNav(item.id);
                  }}
                  type="button"
                >
                  <span>{item.icon}</span>
                  {sidebarOpen ? <span>{item.label}</span> : null}
                  {!item.available && sidebarOpen ? (
                    <span className="coming-soon-badge" style={{ marginLeft: "auto", fontSize: "10px" }}>
                      Soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="section-stack">
            {sidebarOpen ? (
              <div className="apple-card" style={{ padding: 18 }}>
                <div className="auth-inline" style={{ marginBottom: 8 }}>
                  <span className="apple-kicker" style={{ marginBottom: 0 }}>
                    Cords
                  </span>
                  <span className="brand-lockup__meta">
                    {MOCK_USER.cordsUsed}/{MOCK_USER.cordsTotal}
                  </span>
                </div>
                <div className="dashboard-progress">
                  <span style={{ width: `${cordsPercent}%` }} />
                </div>
                <p className="apple-body" style={{ marginTop: 10 }}>
                  {MOCK_USER.cordsTotal - MOCK_USER.cordsUsed} remaining this week.
                </p>
              </div>
            ) : null}

            <button
              className="dashboard-nav-item"
              onClick={() => setSidebarOpen((current) => !current)}
              type="button"
            >
              <ChevronLeft
                size={18}
                style={{ transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)" }}
              />
              {sidebarOpen ? <span>Collapse</span> : null}
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="apple-surface dashboard-topbar">
            <div>
              <p className="apple-kicker">Dashboard</p>
              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  fontWeight: 600,
                }}
              >
                Good afternoon, {displayName}
              </h1>
            </div>

            <div className="dashboard-topbar__actions">
              <button className="dashboard-icon-btn" onClick={() => setShowShortcuts(true)} type="button">
                <Command size={16} />
              </button>
              <button className="dashboard-icon-btn" onClick={() => setShowSettings(true)} type="button">
                <Settings2 size={16} />
              </button>

              <div className="dashboard-overlay-anchor">
                <button className="dashboard-icon-btn" onClick={() => setShowNotifs((current) => !current)} type="button">
                  <Bell size={16} />
                </button>
                {showNotifs ? <NotificationPanel onClose={() => setShowNotifs(false)} theme={theme} /> : null}
              </div>

              <div className="dashboard-overlay-anchor">
                <button
                  className="dashboard-icon-btn"
                  onClick={() => setShowProfileMenu((current) => !current)}
                  type="button"
                >
                  <UserRound size={16} />
                </button>

                {showProfileMenu ? (
                  <div
                    className="dashboard-overlay-card apple-surface-strong"
                    style={{
                      background: theme.surfaceElevated,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                      width: 220,
                    }}
                  >
                    <div className="section-stack">
                      <div>
                        <p className="apple-kicker">Signed in as</p>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{user?.email}</p>
                      </div>
                      <button className="dashboard-nav-item" onClick={() => setShowProfileMenu(false)} type="button">
                        <UserRound size={16} />
                        <span>Profile</span>
                      </button>
                      <button className="dashboard-nav-item" onClick={handleLogout} type="button">
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="dashboard-content">
            <section className="dashboard-section">
              <div className="apple-card section-block">
                <div className="auth-inline">
                  <div>
                    <p className="apple-kicker">Current focus</p>
                    <h2 className="apple-subheading">Launch the builder, monitor usage, and keep product intent visible.</h2>
                  </div>
                  <button className="apple-btn" onClick={() => navigate("/builder")} type="button">
                    Open builder
                  </button>
                </div>
              </div>

              <div className="dashboard-card-grid">
                {MOCK_STATS.map((stat) => (
                  <article className="apple-card dashboard-card" key={stat.label}>
                    <p className="apple-kicker">{stat.label}</p>
                    <h3 style={{ fontSize: "32px", marginBottom: 6 }}>{stat.value}</h3>
                    <p>{stat.sub}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-section dashboard-split">
              <article className="apple-card dashboard-card">
                <p className="apple-kicker">Recent sessions</p>
                <div className="dashboard-list">
                  {MOCK_SESSIONS.map((session) => (
                    <div className="dashboard-list__row" key={session.id}>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.55 }}>{session.prompt}</p>
                        <div className="brand-lockup__meta" style={{ marginTop: 6 }}>
                          {session.time}
                        </div>
                      </div>
                      <div className="section-stack" style={{ gap: 8, justifyItems: "end" }}>
                        <span className="apple-badge apple-badge--muted">{session.tier}</span>
                        <span className="apple-badge apple-badge--status">{session.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="apple-card dashboard-card">
                <p className="apple-kicker">Division activity</p>
                <div className="dashboard-list">
                  {MOCK_DIVISIONS.map((division) => (
                    <div key={division.name}>
                      <div className="auth-inline" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: "14px", fontWeight: 500 }}>{division.name}</span>
                        <span className="brand-lockup__meta">{division.count} passes</span>
                      </div>
                      <div className="dashboard-progress">
                        <span style={{ width: `${Math.round((division.count / MOCK_DIVISIONS[0].count) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="dashboard-section">
              <div>
                <p className="apple-kicker">Platform surfaces</p>
                <h2 className="apple-subheading">Keep the value visible, disable the routes that are not ready.</h2>
              </div>

              <div className="dashboard-platform-grid">
                {PLATFORM_ITEMS.map((item) => {
                  const disabled = !item.available;
                  return (
                    <article className={`apple-card dashboard-card ${disabled ? "is-disabled" : ""}`} key={item.id}>
                      <div className="auth-inline" style={{ marginBottom: 12 }}>
                        <h3 style={{ marginBottom: 0 }}>{item.title}</h3>
                        {disabled ? (
                          <span className="coming-soon-badge">Coming soon</span>
                        ) : null}
                      </div>
                      <p>{item.body}</p>
                      <div style={{ height: 16 }} />
                      <button
                        className={disabled ? "apple-btn apple-btn--ghost" : "apple-btn apple-btn--secondary"}
                        onClick={() => {
                          if (item.route === null && item.available) {
                            setShowWallet(true);
                            return;
                          }
                          navigateIfAvailable(item.route, item.available);
                        }}
                        type="button"
                      >
                        {item.cta}
                        {!disabled ? <ArrowRight size={14} style={{ marginLeft: 8 }} /> : null}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="dashboard-section">
              <div>
                <p className="apple-kicker">Quick actions</p>
                <h2 className="apple-subheading">Fast paths for the surfaces that already exist.</h2>
              </div>

              <div className="dashboard-action-grid">
                {[
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
                    action: () => {},
                  },
                  {
                    title: "Community",
                    body: "Kept as product value, not as a broken link.",
                    available: false,
                    action: () => {},
                  },
                  {
                    title: "API wallet",
                    body: "Open the current wallet surface.",
                    available: true,
                    action: () => setShowWallet(true),
                  },
                ].map((card) => (
                  <button
                    className={`apple-card dashboard-quick-card ${card.available ? "" : "is-disabled"}`}
                    key={card.title}
                    onClick={card.action}
                    style={{
                      border: "0.5px solid var(--separator)",
                      background: "var(--bg-elevated)",
                      textAlign: "left",
                      cursor: card.available ? "pointer" : "not-allowed",
                    }}
                    type="button"
                  >
                    <div className="auth-inline" style={{ marginBottom: 10 }}>
                      <h3 style={{ marginBottom: 0 }}>{card.title}</h3>
                      {card.available ? <ArrowRight size={14} /> : <span className="coming-soon-badge">Soon</span>}
                    </div>
                    <p>{card.body}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
