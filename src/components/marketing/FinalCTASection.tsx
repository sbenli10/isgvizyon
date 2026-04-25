import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type FinalCTASectionProps = {
  onRequestDemo: () => void;
};

export function FinalCTASection({ onRequestDemo }: FinalCTASectionProps) {
  return (
    <section className="rounded-[34px] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(18,26,44,0.94),rgba(8,12,22,0.98))] p-7 shadow-[0_30px_80px_rgba(2,6,23,0.22)] sm:p-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Son adım</p>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          İSG süreçlerinizi daha görünür ve yönetilebilir hale getirin
        </h2>
        <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">
          İSGVizyon’u firmanızın operasyon yapısına göre birlikte inceleyelim.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            onClick={onRequestDemo}
            className="h-12 rounded-2xl bg-cyan-400 px-6 text-base font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Demo Talep Et
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
