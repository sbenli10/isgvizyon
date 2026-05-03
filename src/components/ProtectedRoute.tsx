import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { saveIntendedRoute } from "@/lib/navigationPersistence";
import { Loader2 } from "lucide-react";

function AuthRedirect({ intendedPath }: { intendedPath: string }) {
  useEffect(() => {
    saveIntendedRoute(intendedPath);
  }, [intendedPath]);

  return <Navigate to="/landing" replace />;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log("ProtectedRoute MOUNTED", {
      pathname: location.pathname,
    });

    return () => {
      console.log("ProtectedRoute UNMOUNTED", {
        pathname: location.pathname,
      });
    };
  }, []);

  if (!loading && !session) {
    return <AuthRedirect intendedPath={`${location.pathname}${location.search}${location.hash}`} />;
  }

  return (
    <>
      {children}
      {loading ? (
        <div className="pointer-events-none fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/12 px-4 py-6 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/10 bg-slate-950/88 px-4 py-3 text-sm text-slate-100 shadow-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Oturum doğrulanıyor...
          </div>
        </div>
      ) : null}
    </>
  );
}
