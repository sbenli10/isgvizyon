import { CheckCircle2, CircleDashed, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export function OsgbOnboardingChecklist({
  title = "OSGB Başlangıç Akışı",
  description = "İlk kurulumda firmaları havuza alıp sözleşme ve atama akışını bu sırayla tamamlayın.",
  steps,
}: {
  title?: string;
  description?: string;
  steps: Step[];
}) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => navigate(step.href)}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
              step.done
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
            )}
          >
            <div className="mt-0.5">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : index === 0 ? (
                <PlayCircle className="h-5 w-5 text-primary" />
              ) : (
                <CircleDashed className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">{step.title}</div>
              <div className="text-sm text-muted-foreground">{step.description}</div>
            </div>
          </button>
        ))}

        <div className="pt-2">
          <Button variant="outline" onClick={() => navigate(steps.find((step) => !step.done)?.href || steps[0]?.href || "/osgb/company-tracking")}>
            Sıradaki adımı aç
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
