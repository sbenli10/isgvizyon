import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingProductScreenTabs } from "@/lib/landingContent";

function getToneClasses(tone?: "primary" | "success" | "warning") {
  if (tone === "success") {
    return "border-slate-200 bg-white text-slate-950";
  }
  if (tone === "warning") {
    return "border-slate-200 bg-white text-slate-950";
  }
  return "border-slate-200 bg-white text-slate-950";
}

export function ProductScreensSection() {
  return (
    <section className="space-y-10 text-slate-950" id="product-screens">
      <LandingSectionHeading
        eyebrow="Ürün Ekranları"
        title="Operasyonu gör, takip et, raporla"
        description="ISGVizyon, saha ve ofis süreçlerini aynı panelde birleştirir. Her ekran yalnızca veri göstermeye değil, sonraki operasyon adımını hızlandırmaya çalışır."
      />

      <Tabs defaultValue={landingProductScreenTabs[0].id} className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[24px] border border-slate-200 bg-white p-2">
          {landingProductScreenTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-950 data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {landingProductScreenTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr] xl:items-start">
              <article className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
                <h3 className="text-3xl font-black tracking-[-0.04em] text-slate-950">{tab.title}</h3>
                <p className="mt-4 text-base font-medium leading-8 text-slate-950">{tab.description}</p>

                <div className="mt-6 grid gap-3">
                  {tab.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-slate-950"
                    >
                      <CheckCircle2 className="mt-1 h-4 w-4 text-slate-950" />
                      <p className="text-sm font-medium leading-7 text-slate-950">{bullet}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {tab.stats.map((stat) => (
                    <div key={stat.label} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-950">{stat.label}</p>
                      <p className="mt-3 text-2xl font-black text-slate-950">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-4 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.10)] sm:p-6">
                <div className="rounded-[28px] border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div>
                      <p className="text-sm font-black text-slate-950">{tab.panelTitle}</p>
                      <p className="mt-1 text-xs font-medium text-slate-950">{tab.panelSubtitle}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950">
                      Canlı görünüm
                    </span>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {tab.panelRows.map((row) => (
                          <div key={row.label} className="rounded-[20px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-slate-950">{row.label}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getToneClasses(row.tone)}`}>
                                {row.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-950">İzleme katmanı</p>
                        <div className="mt-4 space-y-3">
                          {["Firma görünümü", "Sorumlu atama", "Termin takibi"].map((item) => (
                            <div key={item} className="flex items-center justify-between rounded-[16px] bg-white px-3 py-3">
                              <span className="text-sm font-bold text-slate-950">{item}</span>
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-950" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-950">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-950">Örnek çalışma alanı</p>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-950">
                          Tek panel
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {[
                          { title: "Sorumlu atandı", detail: "İş güvenliği uzmanı / operasyon ekibi" },
                          { title: "Termin işlendi", detail: "Takvim ve dashboard görünümüne yansıdı" },
                          { title: "Rapor hazırlandı", detail: "Excel/CSV ve yönetici görünümünde çıktılandı" },
                        ].map((item, index) => (
                          <div key={item.title} className="rounded-[18px] border border-slate-200 bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-black text-slate-950">
                                0{index + 1}
                              </span>
                              <div>
                                <p className="text-sm font-black text-slate-950">{item.title}</p>
                                <p className="mt-2 text-sm font-medium leading-7 text-slate-950">{item.detail}</p>
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
