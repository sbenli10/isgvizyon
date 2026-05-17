import React from "react";
import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  FileCheck2,
  Sparkles,
  Workflow,
  ShieldAlert,
  Activity,
  CheckCircle2,
  Lock,
  Cpu,
  Terminal,
  Network
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HeroSectionProps = {
  onRequestDemo: () => void; // LandingPage -> /auth
  onInspectFeatures: () => void; // Özellikler kaydırma alanı
};

export function HeroSection({ onRequestDemo, onInspectFeatures }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#050B1A] pt-24 pb-16">
      {/* Küresel Siber Işımalar ve Arka Plan Izgara Efekti */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 top-[-180px] h-[620px] w-[620px] rounded-full bg-blue-500/10 blur-[180px]" />
        <div className="absolute right-[-280px] top-[10%] h-[750px] w-[750px] rounded-full bg-purple-500/8 blur-[200px]" />
        <div className="absolute left-[30%] bottom-[10%] h-[500px] w-[500px] rounded-full bg-cyan-500/6 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(148,163,184,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.6)_1px,transparent_1px)] [background-size:120px_120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* ASİMETRİK İKİ SÜTUNLU YERLEŞİM */}
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          
          {/* SOL SÜTUN: Başlık, Değer Önerisi ve Güvenlik Bilgileri */}
          <div className="text-left space-y-6">
            <Badge className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-cyan-200 backdrop-blur-md">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              AI DESTEKLİ YENİ NESİL PLATFORMU
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
              İş Güvenliğini
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Kolaylaştırıyoruz
              </span>
            </h1>

            <p className="max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              İSG Robot ve yapay zeka desteğiyle risk analizi, OSGB yönetimi ogları ve tüm dokümantasyon süreçlerinizi <span className="text-cyan-400 font-semibold">%80 daha hızlı</span> tamamlayın. Mevzuata tam uyumlu, akıllı çözüm ortağınız.
            </p>

            {/* Karar Butonları */}
            <div className="flex flex-col gap-3 sm:flex-row pt-2">
              <Button
                onClick={onRequestDemo}
                className="h-14 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-sm font-bold uppercase tracking-wider text-white shadow-[0_20px_50px_rgba(99,102,241,0.25)] hover:shadow-[0_25px_60px_rgba(99,102,241,0.35)] transition-all hover:-translate-y-0.5"
              >
                Şimdi Başla
                <ArrowRight className="ml-2 h-5 w-5 shrink-0" />
              </Button>

              <Button
                variant="outline"
                onClick={onInspectFeatures}
                className="h-14 px-8 rounded-2xl border-white/10 bg-white/[0.02] text-sm font-bold uppercase tracking-wider text-slate-200 backdrop-blur-md hover:bg-white/[0.06] hover:text-white"
              >
                Giriş Yap
              </Button>
            </div>

            {/* Güven Rozetleri */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs font-medium text-slate-400 border-t border-slate-900">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold text-sm">4.9/5</span>
                <span>Kullanıcı Memnuniyeti</span>
              </div>
              <div className="h-4 w-px bg-slate-800 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-cyan-400" />
                <span>KVKK & ISO 27001 Güvencesi</span>
              </div>
            </div>
          </div>

          {/* SAĞ SÜTUN: FÜTURİSTİK SİBER KAM PANELİ (YENİ GÖRSELİN BİREBİR YANSIMASI) */}
          <div className="relative group">
            {/* Panel Arkası Neon Dağılım Işığı */}
            <div className="pointer-events-none absolute -inset-2 rounded-[32px] bg-gradient-to-tr from-cyan-500/20 via-purple-500/10 to-transparent blur-xl opacity-90 transition-opacity group-hover:opacity-100" />
            
            <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 p-5 shadow-[0_40px_100px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              
              {/* Üst Başlık Satırı */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-900 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/40 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <Cpu className="h-3.5 w-3.5 text-cyan-400 animate-spin [animation-duration:10s]" />
                    <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                      ISG-AI-CEKIRDEGI_V2.0
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[9px] tracking-[0.18em] text-emerald-400 rounded-md font-mono px-2.5 py-0.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  YAPAY ZEKA ANALİZİ AKTİF
                </Badge>
              </div>

              {/* GÖRSELDEKİ ULTRA-MODERN İKİLİ MONITOR SEKTÖRÜ */}
              <div className="grid gap-4 sm:grid-cols-2">
                
                {/* SOL PANEL: Dairesel Sinirsel Veri Matrisi Grafik Alanı (AI Radar Map) */}
                <div className="rounded-xl border border-white/5 bg-[#060c18]/90 p-4 flex flex-col justify-between aspect-[4/3.2] relative overflow-hidden group/node">
                  {/* Görseldeki Hafif Yeşil Kod/Grid Süzgeci */}
                  <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.3)_1px,transparent_1px)] [background-size:20px_20px]" />
                  <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-1.5">
                      <Network className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Sinirsel Ağ Haritası</span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                      <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
                      TARANIYOR
                    </span>
                  </div>

                  {/* Görseldeki Fütüristik Dairesel / Katmanlı Yapay Zeka Grafiği */}
                  <div className="my-auto relative flex items-center justify-center h-24">
                    <svg className="absolute w-20 h-20 animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="#10b981" strokeWidth="1" fill="none" strokeDasharray="5,15" className="opacity-30" />
                      <circle cx="50" cy="50" r="30" stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeDasharray="40,20" className="opacity-60" />
                    </svg>
                    <svg className="absolute w-14 h-14 animate-[spin_8s_linear_infinite_reverse]" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="35" stroke="#a855f7" strokeWidth="2" fill="none" strokeDasharray="60,40" className="opacity-50" />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-white tracking-tighter">84</span>
                      <span className="text-[8px] uppercase tracking-widest text-emerald-400 font-mono font-bold">AI SKORU</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900/80 pt-2 relative z-10 font-mono">
                    <span>Mekanik Risk Eğrisi</span>
                    <span className="text-white font-semibold">Tolerans İçi</span>
                  </div>
                </div>

                {/* SAĞ PANEL: Canlı Akış Terminal Alanı ve Sürekli Taranan Log Listesi */}
                <div className="rounded-xl border border-white/5 bg-[#040811] p-3.5 flex flex-col justify-between border-l-emerald-500/20 relative overflow-hidden">
                  {/* Görseldeki Aşağı Doğru Süzülen Tarama Çizgisi (Laser Scan Effect) */}
                  <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent top-0 animate-[scan_3s_ease-in-out_infinite] z-10 pointer-events-none" />

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Karar Destek Günlüğü</span>
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  
                  {/* Şablon Modüllerle Entegre Canlı Türkçe Karar Blokları */}
                  <div className="space-y-2 font-mono text-[9px] flex-1 flex flex-col justify-center">
                    {[
                      { baslik: "Kök Neden Doğrulaması", icerik: "ADEP / Acil durum tahliye izolasyon analizi yapıldı.", sinif: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" },
                      { baslik: "Otomatic Matris Ataması", icerik: "Fine-Kinney üzerinde 24 yeni risk sınıflandırıldı.", sinif: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300" }
                    ].map((item, i) => (
                      <div key={i} className={cn("p-2 rounded-lg border text-left leading-normal border-white/5 bg-slate-950/40", item.sinif)}>
                        <span className="font-bold block text-[8px] uppercase tracking-wide opacity-80">{item.baslik}</span>
                        <span className="mt-0.5 block opacity-90">{item.icerik}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Alt Gerçek Zamanlı Metrik Göstergeleri Satırı */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-900 pt-4">
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 flex items-center justify-between group/stat hover:border-cyan-500/20 transition-colors">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-mono uppercase tracking-wider">Tespit Edilen Tehlike</span>
                    <span className="text-xl font-extrabold text-white tracking-tight group-hover/stat:text-cyan-400 transition-colors">24</span>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-amber-500/80" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 flex items-center justify-between group/stat hover:border-emerald-500/20 transition-colors">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-mono uppercase tracking-wider">Matris Kapsamı</span>
                    <span className="text-xl font-extrabold text-emerald-400 tracking-tight">100%</span>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-emerald-400" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* YATAY GENİŞ İSTATİSTİK ŞERİDİ */}
        <div className="mt-24 grid grid-cols-2 gap-4 md:grid-cols-4 border-t border-slate-900 pt-12">
          {[
            { value: "10.000+", label: "Hazır Risk Kütüphanesi", icon: ClipboardCheck },
            { value: "2.500+", label: "Aktif İSG Profesyoneli", icon: Workflow },
            { value: "50.000+", label: "Oluşturulan Akıllı Rapor", icon: FileCheck2 },
            { value: "7/24", label: "Bulut Erişim & Yedekleme", icon: Activity }
          ].map((stat, idx) => {
            const StatIcon = stat.icon;
            return (
              <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-900 bg-slate-950/10 text-left group hover:border-slate-800 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-white/5 text-cyan-400 shadow-sm group-hover:scale-105 transition-transform">
                  <StatIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-white tracking-tight leading-none">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400 font-medium leading-none">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}