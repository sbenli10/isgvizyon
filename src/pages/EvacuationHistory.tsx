import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { History, FileImage, FileDown, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SavedProject {
  id: string;
  project_name: string;
  canvas_json: string;
  created_at: string;
  thumbnail_data_url?: string;
}

const STORAGE_KEY = "evacuation-editor-projects";
const LOAD_KEY = "evacuation-editor-load-project";

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function EvacuationHistory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<SavedProject[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((item) => item.project_name.toLowerCase().includes(q));
  }, [projects, query]);

  const removeProject = (id: string) => {
    const next = projects.filter((item) => item.id !== id);
    setProjects(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const openInEditor = (id: string) => {
    localStorage.setItem(LOAD_KEY, id);
    navigate("/evacuation-editor");
  };

  const exportPdfFromHistory = (project: SavedProject) => {
    if (!project.thumbnail_data_url) return;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, 842, 58, "F");
    pdf.setTextColor(248, 250, 252);
    pdf.setFontSize(15);
    pdf.text(project.project_name, 24, 36);
    pdf.setFontSize(10);
    pdf.text(`Tarih: ${format(new Date(project.created_at), "dd.MM.yyyy HH:mm")}`, 640, 36);
    pdf.addImage(project.thumbnail_data_url, "PNG", 24, 80, 794, 420, undefined, "FAST");
    pdf.save(`${project.project_name.replace(/\s+/g, "-").toLowerCase()}-history.pdf`);
  };

  return (
    <div className="flex h-[calc(100vh-5.2rem)] min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#020b22] to-[#04133b] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2 text-slate-100">
          <History className="h-5 w-5 text-cyan-400" />
          <h1 className="text-xl font-bold">Kroki Geçmişleri</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Proje ara"
            className="h-9 w-[220px] border-slate-700 bg-slate-900/80 text-slate-100"
          />
          <Button variant="outline" onClick={() => navigate("/evacuation-editor")}>Editöre Dön</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => (
          <div key={project.id} className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
            <div className="mb-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              {project.thumbnail_data_url ? (
                <img src={project.thumbnail_data_url} alt={project.project_name} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center text-xs text-slate-400">Önizleme yok</div>
              )}
            </div>

            <p className="truncate text-sm font-semibold text-slate-100">{project.project_name}</p>
            <p className="mb-3 text-xs text-slate-400">{format(new Date(project.created_at), "dd.MM.yyyy HH:mm")}</p>

            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openInEditor(project.id)}>
                <RotateCcw className="h-3.5 w-3.5" /> Yükle
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => project.thumbnail_data_url && downloadDataUrl(project.thumbnail_data_url, `${project.project_name}.png`)}
              >
                <FileImage className="h-3.5 w-3.5" /> PNG
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => exportPdfFromHistory(project)}>
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => removeProject(project.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
            Kayıtlı kroki bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
