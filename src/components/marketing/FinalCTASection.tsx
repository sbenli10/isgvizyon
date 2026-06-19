import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type FinalCTASectionProps = {
  onRequestDemo: () => void;
};

export function FinalCTASection({ onRequestDemo }: FinalCTASectionProps) {
  return (
    <section className="rounded-[34px] border border-sky-200 bg-sky-50 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-700">Son adım</p>
        <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          İSG süreçlerinizi daha görünür ve yönetilebilir hale getirin
        </h2>
        <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
          ISGVizyon'u firmanızın operasyon yapısına göre birlikte inceleyelim.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            onClick={onRequestDemo}
            className="h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 text-base font-black text-white hover:from-blue-500 hover:to-cyan-400"
          >
            Demo Talep Et
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
