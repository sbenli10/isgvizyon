import { LandingLayout } from "@/components/marketing/LandingLayout";
import { LandingPage } from "@/components/marketing/LandingPage";

export default function Index() {
  return (
    <LandingLayout showHero={false} showClosingCta={false}>
      <LandingPage />
    </LandingLayout>
  );
}
