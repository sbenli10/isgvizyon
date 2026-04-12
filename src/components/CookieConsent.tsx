import { useState, useEffect } from "react";
import { Cookie, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CONSENT_KEY = "denetron-cookie-consent";

type ConsentState = "accepted" | "rejected" | null;

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentState;
    if (!stored) {
      // Show banner after a short delay so it doesn't block initial render
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Cookie className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Çerez ve Veri Bildirimi
              </p>
              <p className="text-xs text-muted-foreground">
                Platformumuz, deneyiminizi iyileştirmek ve hizmetlerimizi sunmak için çerezler kullanmaktadır.
                KVKK kapsamında verilerinizin işlenmesini kabul edebilir veya reddedebilirsiniz.{" "}
                <button
                  onClick={() => navigate("/privacy-policy")}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Gizlilik Politikası
                </button>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="text-xs"
            >
              Reddet
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="text-xs"
            >
              <Shield className="mr-1.5 h-3 w-3" />
              Kabul Et
            </Button>
            <button
              onClick={handleDismiss}
              className="ml-1 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
