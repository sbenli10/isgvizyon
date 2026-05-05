import { useNavigate } from "react-router-dom";
import { AudienceSection } from "@/components/marketing/AudienceSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";

import { HeroSection } from "@/components/marketing/HeroSection";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { ProductScreensSection } from "@/components/marketing/ProductScreensSection";
import { SolutionSection } from "@/components/marketing/SolutionSection";
import { TrustSection } from "@/components/marketing/TrustSection";

export function LandingPage() {
  const navigate = useNavigate();

  const handleRequestDemo = () => {
    navigate("/auth");
  };

  const handleInspectFeatures = () => {
    const target = document.getElementById("features");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    navigate("/landing/features");
  };

  return (
    <div className="space-y-24 pb-4 sm:space-y-28">
      <HeroSection onRequestDemo={handleRequestDemo} onInspectFeatures={handleInspectFeatures} />
      <ProblemSection />
      <SolutionSection />
      <ProductScreensSection />
      <FeaturesSection />
      <AudienceSection />
      <TrustSection />
      <LandingFooter />
    </div>
  );
}
