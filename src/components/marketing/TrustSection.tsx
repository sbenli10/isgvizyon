import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingTrustPoints, trustMetrics } from "@/lib/landingContent";

export function TrustSection() {
  return (
    <section className="grid gap-6 text-slate-950 xl:grid-cols-[0.96fr_1.04fr] xl:items-start">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-8">
        <LandingSectionHeading
          eyebrow="Güven ve Raporlama"
          title="Denetlenebilir, izlenebilir ve raporlanabilir İSG yönetimi"
          description="Her işlem kayıt altında, her aksiyon sorumluya bağlı, her süreç raporlanabilir. Bu yapı yönetim görünürlüğünü artırmak için tasarlanır."
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {landingTrustPoints.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <CheckCircle2 className="mt-1 h-4 w-4 text-slate-950" />
              <p className="text-sm font-bold leading-7 text-slate-950">{item}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[32px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Yönetim görünürlüğü</p>
        <h3 className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950">
          Operasyon tek yerdeyse rapor da tek yerde çıkar
        </h3>
        <p className="mt-4 text-base font-medium leading-8 text-slate-950">
          ISGVizyon, günlük kayıt akışını sonradan raporlanan bir yük olmaktan çıkarır; çünkü süreç zaten ölçülebilir bir yapıda ilerler.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {trustMetrics.map((metric) => (
            <div key={metric.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-950">{metric.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-950">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">Kurumsal yaklaşım</p>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-950">
            Sahadaki kayıt, merkezdeki görünürlük ve yönetici raporu aynı operasyon dilinde birleştiğinde süreç kişilere değil sisteme bağlı hale gelir.
          </p>
        </div>
      </article>
    </section>
  );
}
