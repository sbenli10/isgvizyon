import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  Download,
  Eye,
  FileText,
  Grid2X2,
  List,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteOsgbArchiveFile,
  downloadOsgbArchiveFile,
  listOsgbArchiveFiles,
  listOsgbWorkspaceCompanies,
  type OsgbArchiveFileRecord,
  type OsgbWorkspaceCompanyOption,
} from "@/lib/osgbPlatform";
import { OSGBArchiveUploadDialog } from "@/components/osgb/OSGBArchiveUploadDialog";

type ArchiveViewMode = "grid" | "list";

const STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const inputClass = "h-10 rounded-xl border-slate-700/70 bg-slate-800/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("tr-TR");
};

const getFileKind = (file: OsgbArchiveFileRecord) => {
  const extension = file.fileName.split(".").pop()?.toUpperCase();
  if (extension) return extension;
  if (file.fileType?.includes("pdf")) return "PDF";
  if (file.fileType?.startsWith("image/")) return "RESİM";
  return "DOSYA";
};

function EmptyState({ icon: Icon, title, description }: { icon: typeof Archive; title: string; description: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center p-8 text-center">
      <div>
        <Icon className="mx-auto h-14 w-14 text-slate-600" />
        <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function FileActions({ file, onDownloaded, onDeleted }: { file: OsgbArchiveFileRecord; onDownloaded: () => void; onDeleted: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadOsgbArchiveFile(file);
      onDownloaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya indirilemedi.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOsgbArchiveFile(file);
      toast.success("Dosya silindi.");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="icon" variant="outline" className="h-9 w-9 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white" onClick={handleDownload} disabled={downloading}>
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
      <Button type="button" size="icon" variant="outline" className="h-9 w-9 border-slate-700 bg-slate-900 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" onClick={handleDelete} disabled={deleting}>
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function OSGBArchivePanel({ refreshKey }: { refreshKey: number }) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [files, setFiles] = useState<OsgbArchiveFileRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ArchiveViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [companyRows, fileRows] = await Promise.all([
        listOsgbWorkspaceCompanies(organizationId),
        listOsgbArchiveFiles(organizationId),
      ]);
      setCompanies(companyRows);
      setFiles(fileRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Arşiv verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const fileCountByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) counts.set(file.companyId, (counts.get(file.companyId) || 0) + 1);
    return counts;
  }, [files]);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;
  const usedBytes = files.reduce((sum, file) => sum + file.fileSize, 0);
  const usageRatio = Math.min(100, (usedBytes / STORAGE_LIMIT_BYTES) * 100);
  const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
  const visibleFiles = files.filter((file) => {
    if (selectedCompanyId && file.companyId !== selectedCompanyId) return false;
    if (!normalizedSearch) return true;
    return `${file.fileName} ${file.folderPath}`.toLocaleLowerCase("tr-TR").includes(normalizedSearch);
  });

  return (
    <div className="h-full space-y-4 overflow-hidden text-slate-100">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-[260px] space-y-4">
            <div className="flex items-center gap-3">
              <Archive className="h-6 w-6 text-orange-400" />
              <h2 className="text-xl font-black text-white">Arşiv</h2>
            </div>
            <div className="flex max-w-sm items-center gap-4 text-xs font-semibold text-slate-400">
              <Archive className="h-4 w-4" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-4">
                  <span>{formatBytes(usedBytes)} / 2 GB</span>
                  <span>{files.length} dosya</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${usageRatio}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative w-full md:w-[340px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dosya ara..." />
            </div>
            <div className="flex rounded-xl border border-slate-700 bg-slate-800/80 p-1">
              <Button type="button" size="icon" className={cn("h-8 w-8", viewMode === "grid" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-700")} onClick={() => setViewMode("grid")}>
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" className={cn("h-8 w-8", viewMode === "list" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-700")} onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" variant="outline" className="h-10 rounded-xl border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={() => toast.info("Otomatik arşivleme yakında aktif olacak.")}>
              <Eye className="mr-2 h-4 w-4" />
              Oto. Arşiv
            </Button>
            <Button type="button" className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-500" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Dosya Yükle
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[360px] gap-4 overflow-hidden lg:grid-cols-[310px_1fr]">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Firmalar</h3>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
            {loading ? (
              <div className="grid min-h-[260px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-blue-300" /></div>
            ) : companies.length ? (
              companies.map((company) => {
                const active = selectedCompanyId === company.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(company.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-slate-800/70",
                      active ? "border-blue-500/60 bg-blue-600/20 text-white" : "border-transparent bg-transparent text-slate-300",
                    )}
                  >
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400")}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{company.companyName}</p>
                      <p className="mt-1 text-xs text-slate-500">{fileCountByCompany.get(company.id) || 0} dosya</p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="grid min-h-[260px] place-items-center text-sm font-semibold text-slate-500">Henüz firma yok</div>
            )}
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-sm">
          {!selectedCompany ? (
            <EmptyState icon={Building2} title="Firma Seçin" description="Sol panelden bir firma seçerek dosya ve klasörlerini görüntüleyin." />
          ) : visibleFiles.length === 0 ? (
            <EmptyState icon={Archive} title="Dosya bulunamadı" description="Bu firma için henüz arşiv dosyası yüklenmemiş." />
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleFiles.map((file) => (
                <div key={file.id} className="rounded-2xl border border-slate-700/60 bg-slate-950/30 p-4 transition hover:border-blue-500/40 hover:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <FileActions file={file} onDownloaded={() => undefined} onDeleted={() => void loadData()} />
                  </div>
                  <p className="mt-4 truncate font-black text-white" title={file.fileName}>{file.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">{file.folderPath || "Ana Dizin"}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-400">
                    <span>{getFileKind(file)}</span>
                    <span>{formatBytes(file.fileSize)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(file.uploadedAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFiles.map((file) => (
                <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-950/30 p-4 transition hover:border-blue-500/40 hover:bg-slate-900 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white" title={file.fileName}>{file.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{getFileKind(file)} · {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)} · {file.folderPath || "Ana Dizin"}</p>
                    </div>
                  </div>
                  <FileActions file={file} onDownloaded={() => undefined} onDeleted={() => void loadData()} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <OSGBArchiveUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onUploaded={() => void loadData()}
      />
    </div>
  );
}
