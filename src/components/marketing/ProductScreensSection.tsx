import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingProductScreenTabs } from "@/lib/landingContent";

function getToneClasses(tone?: "primary" | "success" | "warning") {
  if (tone === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }
  if (tone === "warning") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
}

export function ProductScreensSection() {
  return (
    <section className="space-y-10" id="product-screens">
      <LandingSectionHeading
        eyebrow="Ürün Ekranları"
        title="Operasyonu gör, takip et, raporla"
        description="İSGVizyon, saha ve ofis süreçlerini aynı panelde birleştirir. Her ekran yalnızca veri göstermeye değil, sonraki operasyon adımını hızlandırmaya çalışır."
      />

      <Tabs defaultValue={landingProductScreenTabs[0].id} className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[24px] border border-white/10 bg-white/[0.04] p-2">
          {landingProductScreenTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-2xl px-4 py-3 text-sm text-slate-300 data-[state=active]:bg-cyan-400 data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {landingProductScreenTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr] xl:items-start">
              <article className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white">{tab.title}</h3>
                <p className="mt-4 text-base leading-8 text-slate-300">{tab.description}</p>

                <div className="mt-6 grid gap-3">
                  {tab.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
                      <p className="text-sm leading-7 text-slate-200">{bullet}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {tab.stats.map((stat) => (
                    <div key={stat.label} className="rounded-[20px] border border-white/8 bg-[#0d1526] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,20,34,0.96),rgba(7,11,20,0.98))] p-4 shadow-[0_28px_90px_rgba(2,6,23,0.3)] sm:p-6">
                <div className="rounded-[28px] border border-white/8 bg-[#09101f]">
                  <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{tab.panelTitle}</p>
                      <p className="mt-1 text-xs text-slate-400">{tab.panelSubtitle}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Canlı görünüm
                    </span>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {tab.panelRows.map((row) => (
                          <div key={row.label} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-slate-300">{row.label}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getToneClasses(row.tone)}`}>
                                {row.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-[#0d1526] p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">İzleme katmanı</p>
                        <div className="mt-4 space-y-3">
                          {["Firma görünümü", "Sorumlu atama", "Termin takibi"].map((item) => (
                            <div key={item} className="flex items-center justify-between rounded-[16px] bg-white/[0.04] px-3 py-3">
                              <span className="text-sm text-slate-200">{item}</span>
                              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,24,39,0.96),rgba(10,15,27,0.98))] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">Örnek çalışma alanı</p>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                          Tek panel
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {[
                          { title: "Sorumlu atandı", detail: "İş güvenliği uzmanı / operasyon ekibi" },
                          { title: "Termin işlendi", detail: "Takvim ve dashboard görünümüne yansıdı" },
                          { title: "Rapor hazırlandı", detail: "Excel/CSV ve yönetici görünümünde çıktılandı" },
                        ].map((item, index) => (
                          <div key={item.title} className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-slate-200">
                                0{index + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="mt-2 text-sm leading-7 text-slate-400">{item.detail}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
