import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingTrustPoints, trustMetrics } from "@/lib/landingContent";

export function TrustSection() {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr] xl:items-start">
      <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(7,11,20,0.98))] p-6 sm:p-8">
        <LandingSectionHeading
          eyebrow="Güven ve Raporlama"
          title="Denetlenebilir, izlenebilir ve raporlanabilir İSG yönetimi"
          description="Her işlem kayıt altında, her aksiyon sorumluya bağlı, her süreç raporlanabilir. Bu yapı yalnızca düzen sağlamak için değil, yönetim görünürlüğünü artırmak için de tasarlanır."
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {landingTrustPoints.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
              <p className="text-sm leading-7 text-slate-200">{item}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[32px] border border-cyan-400/16 bg-cyan-400/[0.05] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Yönetim görünürlüğü</p>
        <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
          Operasyon tek yerdeyse rapor da tek yerde çıkar
        </h3>
        <p className="mt-4 text-base leading-8 text-slate-300">
          İSGVizyon, günlük kayıt akışını sonradan raporlanan bir yük olmaktan çıkarır; çünkü süreç zaten ölçülebilir bir yapıda ilerler.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {trustMetrics.map((metric) => (
            <div key={metric.label} className="rounded-[24px] border border-white/10 bg-[#0a1120] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-[#0d1527] p-5">
          <p className="text-sm font-semibold text-white">Kurumsal yaklaşım</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Sahadaki kayıt, merkezdeki görünürlük ve yönetici raporu aynı operasyon dilinde birleştiğinde süreç kişilere değil sisteme bağlı hale gelir.
          </p>
        </div>
      </article>
    </section>
  );
}
