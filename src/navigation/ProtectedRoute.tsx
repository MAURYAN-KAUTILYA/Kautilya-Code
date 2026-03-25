import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="apple-page app-loader">
        <div className="apple-card app-loader__card">
          <div
            style={{
              color: "var(--accent)",
              display: "flex",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <KautilyaLogo size={34} />
          </div>
          <div className="app-loader__spinner" />
          <p className="apple-kicker" style={{ marginBottom: 8 }}>
            Protected route
          </p>
          <p className="apple-body">Verifying the current session before opening the workspace.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <>{children}</>;
}
