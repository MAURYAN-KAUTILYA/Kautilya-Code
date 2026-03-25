import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import { supabase } from "@/lib/supabaseClient";
function GoogleIcon() {
    return (_jsxs("svg", { "aria-hidden": "true", height: "16", viewBox: "0 0 24 24", width: "16", children: [_jsx("path", { d: "M5.26 9.77A7.2 7.2 0 0 1 12 4.8c1.74 0 3.3.6 4.54 1.6l3.36-3.36A12 12 0 0 0 0 12c0 2.08.54 4.04 1.48 5.74l3.78-2.93a7.2 7.2 0 0 1 0-5.04z", fill: "#EA4335" }), _jsx("path", { d: "M12 24c3.24 0 5.98-1.08 7.98-2.92l-3.74-2.9A7.18 7.18 0 0 1 4.26 14.23L.48 17.16A12 12 0 0 0 12 24z", fill: "#FBBC05" }), _jsx("path", { d: "M23.74 12.27c0-.78-.07-1.54-.2-2.27H12v4.3h6.6a5.64 5.64 0 0 1-2.44 3.7l3.74 2.9C21.98 18.9 23.74 15.84 23.74 12.27z", fill: "#4285F4" }), _jsx("path", { d: "M4.26 14.23a7.2 7.2 0 0 1 0-4.46L.48 6.84A12 12 0 0 0 0 12c0 1.92.46 3.74 1.28 5.36l2.98-3.13z", fill: "#34A853" })] }));
}
function GithubIcon() {
    return (_jsx("svg", { "aria-hidden": "true", fill: "currentColor", height: "16", viewBox: "0 0 24 24", width: "16", children: _jsx("path", { d: "M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" }) }));
}
function EyeIcon({ open }) {
    return open ? (_jsxs("svg", { "aria-hidden": "true", fill: "none", height: "16", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", viewBox: "0 0 24 24", width: "16", children: [_jsx("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }), _jsx("line", { x1: "1", x2: "23", y1: "1", y2: "23" })] })) : (_jsxs("svg", { "aria-hidden": "true", fill: "none", height: "16", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", viewBox: "0 0 24 24", width: "16", children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }));
}
export default function LoginPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [showPass, setShowPass] = useState(false);
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                navigate("/dashboard", { replace: true });
            }
        });
    }, [navigate]);
    const handleGoogle = async () => {
        setError("");
        setStatus("");
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (oauthError)
            setError(oauthError.message);
    };
    const handleGithub = async () => {
        setError("");
        setStatus("");
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (oauthError)
            setError(oauthError.message);
    };
    const handleEmail = async (event) => {
        event.preventDefault();
        if (!email || !password)
            return;
        setLoading(true);
        setError("");
        setStatus("");
        try {
            if (mode === "login") {
                const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
                if (authError)
                    throw authError;
                navigate("/dashboard", { replace: true });
            }
            else {
                const { error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/dashboard` },
                });
                if (authError)
                    throw authError;
                setStatus("Check your email to confirm your account.");
            }
        }
        catch (unknownError) {
            setError(unknownError instanceof Error ? unknownError.message : "Authentication failed");
        }
        finally {
            setLoading(false);
        }
    };
    const handleReset = async () => {
        if (!email) {
            setError("Enter your email first.");
            return;
        }
        setLoading(true);
        setError("");
        setStatus("");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        setLoading(false);
        if (resetError) {
            setError(resetError.message);
        }
        else {
            setStatus("Reset link sent. Check your inbox.");
        }
    };
    const title = mode === "login" ? "Welcome back." : "Create your account.";
    const subtitle = mode === "login"
        ? "Resume your sessions, workflow preferences, and builder context."
        : "Join Kautilya and start with a calmer frontend built around the product itself.";
    return (_jsx("div", { className: "apple-page login-page", children: _jsx("div", { className: "apple-shell", children: _jsxs("div", { className: "auth-layout", children: [_jsxs("aside", { className: "apple-card auth-aside", children: [_jsxs("div", { className: "auth-stack", children: [_jsxs("div", { className: "brand-lockup", children: [_jsx("div", { className: "brand-lockup__mark", children: _jsx(KautilyaLogo, { size: 28 }) }), _jsxs("div", { children: [_jsx("p", { className: "brand-lockup__title", children: "Kautilya Code" }), _jsx("p", { className: "brand-lockup__meta", children: "Private sessions, protected routes, consistent review flow" })] })] }), _jsxs("div", { children: [_jsx("span", { className: "apple-badge", children: "Secure access" }), _jsx("div", { style: { height: 18 } }), _jsx("h1", { className: "apple-subheading", children: "A premium sign-in flow with the product still doing the talking." }), _jsx("div", { style: { height: 14 } }), _jsx("p", { className: "apple-body", children: "Authentication stays quiet, direct, and familiar. Your session state, route protection, and redirects remain unchanged." })] }), _jsxs("div", { className: "section-stack", children: [_jsxs("div", { className: "apple-card", style: { padding: 18 }, children: [_jsx("p", { className: "apple-kicker", children: "What stays intact" }), _jsx("p", { className: "apple-body", children: "Google OAuth, GitHub OAuth, email sign-in, sign-up, password reset, and dashboard redirect behavior." })] }), _jsxs("div", { className: "apple-card", style: { padding: 18 }, children: [_jsx("p", { className: "apple-kicker", children: "Why it feels calmer" }), _jsx("p", { className: "apple-body", children: "Clear typography, native-feeling controls, and less theatrical chrome around the same auth flow." })] })] })] }), _jsx("div", { className: "brand-lockup__meta", children: "Protected access for `/dashboard` and `/builder` is preserved exactly as before." })] }), _jsx("section", { className: "apple-card auth-panel", children: _jsxs("div", { className: "auth-stack", children: [_jsxs("div", { children: [_jsx("span", { className: "apple-badge apple-badge--muted", children: mode === "login" ? "Sign in" : "Sign up" }), _jsx("div", { style: { height: 16 } }), _jsx("h2", { className: "apple-subheading", children: title }), _jsx("div", { style: { height: 10 } }), _jsx("p", { className: "apple-body", children: subtitle })] }), _jsxs("div", { className: "auth-oauth", children: [_jsxs("button", { className: "apple-btn apple-btn--ghost", onClick: handleGoogle, type: "button", children: [_jsx(GoogleIcon, {}), _jsx("span", { style: { marginLeft: 8 }, children: "Google" })] }), _jsxs("button", { className: "apple-btn apple-btn--ghost", onClick: handleGithub, type: "button", children: [_jsx(GithubIcon, {}), _jsx("span", { style: { marginLeft: 8 }, children: "GitHub" })] })] }), _jsx("div", { className: "apple-divider" }), _jsxs("form", { className: "auth-form", onSubmit: handleEmail, children: [_jsx("input", { autoComplete: "email", className: "apple-input", onChange: (event) => setEmail(event.target.value), placeholder: "Email address", type: "email", value: email }), _jsxs("div", { style: { position: "relative" }, children: [_jsx("input", { autoComplete: mode === "login" ? "current-password" : "new-password", className: "apple-input", onChange: (event) => setPassword(event.target.value), placeholder: "Password", type: showPass ? "text" : "password", value: password }), _jsx("button", { onClick: () => setShowPass((current) => !current), style: {
                                                        position: "absolute",
                                                        top: "50%",
                                                        right: 12,
                                                        transform: "translateY(-50%)",
                                                        border: "none",
                                                        background: "transparent",
                                                        color: "var(--text-tertiary)",
                                                        cursor: "pointer",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }, type: "button", children: _jsx(EyeIcon, { open: showPass }) })] }), mode === "login" ? (_jsxs("div", { className: "auth-inline", children: [_jsx("span", { className: "brand-lockup__meta", children: "Need a reset link?" }), _jsx("button", { className: "apple-link", onClick: handleReset, type: "button", children: "Forgot password" })] })) : null, error ? _jsx("div", { className: "status-banner status-banner--error", children: error }) : null, status ? _jsx("div", { className: "status-banner status-banner--success", children: status }) : null, _jsx("button", { className: "apple-btn", disabled: loading || !email || !password, type: "submit", children: loading ? "Authenticating..." : mode === "login" ? "Sign in" : "Create account" })] }), _jsxs("div", { className: "auth-footer", children: [_jsx("span", { children: mode === "login" ? "Need an account?" : "Already have one?" }), _jsx("button", { className: "apple-link", onClick: () => {
                                                setMode((current) => (current === "login" ? "signup" : "login"));
                                                setError("");
                                                setStatus("");
                                            }, type: "button", children: mode === "login" ? "Create one" : "Sign in" })] })] }) })] }) }) }));
}
