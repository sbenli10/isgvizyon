import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { saveIntendedRoute } from "@/lib/navigationPersistence";

function AuthRedirect({ intendedPath }: { intendedPath: string }) {
  useEffect(() => {
    saveIntendedRoute(intendedPath);
  }, [intendedPath]);

  return <Navigate to="/landing" replace />;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    if (session) {
      return <>{children}</>;
    }

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-screen-2xl animate-pulse space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-800" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-slate-800" />
                <div className="h-3 w-20 rounded bg-slate-900" />
              </div>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="hidden rounded-2xl border border-slate-800 bg-slate-900/60 lg:block lg:h-[70vh]" />
            <div className="space-y-4 lg:col-span-3">
              <div className="h-24 rounded-2xl border border-slate-800 bg-slate-900/60" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 rounded-2xl border border-slate-800 bg-slate-900/60"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthRedirect intendedPath={`${location.pathname}${location.search}${location.hash}`} />;
  }

  return <>{children}</>;
}
