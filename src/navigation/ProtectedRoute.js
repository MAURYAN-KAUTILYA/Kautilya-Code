import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import { supabase } from "@/lib/supabaseClient";
export default function ProtectedRoute({ children }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const location = useLocation();
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        return () => {
            subscription.unsubscribe();
        };
    }, []);
    if (loading) {
        return (_jsx("div", { className: "apple-page app-loader", children: _jsxs("div", { className: "apple-card app-loader__card", children: [_jsx("div", { style: {
                            color: "var(--accent)",
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 14,
                        }, children: _jsx(KautilyaLogo, { size: 34 }) }), _jsx("div", { className: "app-loader__spinner" }), _jsx("p", { className: "apple-kicker", style: { marginBottom: 8 }, children: "Protected route" }), _jsx("p", { className: "apple-body", children: "Verifying the current session before opening the workspace." })] }) }));
    }
    if (!user) {
        return _jsx(Navigate, { replace: true, state: { from: location }, to: "/login" });
    }
    return _jsx(_Fragment, { children: children });
}
