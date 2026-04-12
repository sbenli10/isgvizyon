import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Sentry } from "@/lib/sentry";

type AuthProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  refreshProfile: () => Promise<void>;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  refreshProfile: async () => {},
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to get profile:", error);
      setProfile(null);
      return;
    }

    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;

    const hasAuthParams =
      window.location.search.includes("code=") ||
      window.location.search.includes("access_token=") ||
      window.location.hash.includes("access_token=") ||
      window.location.pathname === "/auth/callback";

    const applySession = async (nextSession: Session | null, finishLoading = false) => {
      if (!mounted) return;
      setSession(nextSession);
      Sentry.setUser(
        nextSession?.user
          ? {
              id: nextSession.user.id,
              email: nextSession.user.email,
            }
          : null,
      );
      await fetchProfile(nextSession?.user?.id ?? null);
      if (mounted && finishLoading) {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void applySession(nextSession, initialSessionResolved);
      }
    );

    const initializeSession = async () => {
      setLoading(true);

      if (hasAuthParams) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Auth initialization failed:", error);
            break;
          }

          if (data.session) {
            if (!mounted) return;
            initialSessionResolved = true;
            await applySession(data.session, true);
            return;
          }

          await wait(250);
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Failed to get session:", error);
      }

      initialSessionResolved = true;
      await applySession(data.session, true);
    };

    void initializeSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        refreshProfile: async () => {
          await fetchProfile(session?.user?.id ?? null);
        },
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
