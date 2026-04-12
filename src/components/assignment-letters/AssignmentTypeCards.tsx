import { FileText, ShieldCheck, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssignmentType } from "@/lib/assignmentPdfGenerator";

interface AssignmentTypeItem {
  type: AssignmentType;
  title: string;
  description: string;
  icon: typeof FileText;
}

const assignmentTypes: AssignmentTypeItem[] = [
  {
    type: "risk_assessment_team",
    title: "Risk Değerlendirme Ekibi Atama",
    description: "Risk değerlendirme çalışmalarında görev alacak personel için resmi ekip görevlendirme yazısı oluşturun.",
    icon: ShieldCheck,
  },
  {
    type: "support_staff",
    title: "Destek Elemanı Atama",
    description: "Acil durum, tahliye ve yangınla mücadele görevleri için resmi destek elemanı atama belgesi hazırlayın.",
    icon: FileText,
  },
  {
    type: "employee_representative",
    title: "Çalışan Temsilcisi Atama",
    description: "Çalışan temsilcisi görevlendirmeleri için resmi atama belgesi üretin ve arşivleyin.",
    icon: Users2,
  },
];

interface AssignmentTypeCardsProps {
  onCreate: (type: AssignmentType) => void;
}

export function AssignmentTypeCards({ onCreate }: AssignmentTypeCardsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {assignmentTypes.map((item) => (
        <Card
          key={item.type}
          className="border-slate-700/70 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-slate-900/70 shadow-[0_18px_50px_rgba(2,6,23,0.35)]"
        >
          <CardHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-slate-100">{item.title}</CardTitle>
              <CardDescription className="text-slate-400">{item.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => onCreate(item.type)}>
              Oluştur
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
