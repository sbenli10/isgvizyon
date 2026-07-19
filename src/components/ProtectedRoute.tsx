import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { saveIntendedRoute } from "@/lib/navigationPersistence";

function AuthRedirect({ intendedPath }: { intendedPath: string }) {
  useEffect(() => {
    saveIntendedRoute(intendedPath);
  }, [intendedPath]);

  return <Navigate to="/landing" replace />;
}

export function AppBootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08111f] px-4 text-slate-100">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/85 px-4 py-3 text-sm shadow-2xl">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
        Oturum doğrulanıyor...
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isAuthLoading, authInitialized } = useAuth();
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

  if (!authInitialized || isAuthLoading) {
    return <AppBootScreen />;
  }

  if (!session) {
    return <AuthRedirect intendedPath={`${location.pathname}${location.search}${location.hash}`} />;
  }

  return <>{children}</>;
}
