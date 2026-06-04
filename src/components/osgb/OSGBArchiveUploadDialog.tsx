import { useEffect, useMemo, useRef, useState } from "react";
import { FolderInput, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { uploadOsgbArchiveFile, type OsgbWorkspaceCompanyOption } from "@/lib/osgbPlatform";

interface OSGBArchiveUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: OsgbWorkspaceCompanyOption[];
  selectedCompanyId: string | null;
  onUploaded: () => void;
}

type FileWithRelativePath = File & { webkitRelativePath?: string };

const folderOptions = [
  { value: "__root__", label: "Ana Dizin" },
  { value: "Belgeler", label: "Belgeler" },
  { value: "Sözleşmeler", label: "Sözleşmeler" },
  { value: "Raporlar", label: "Raporlar" },
  { value: "Fotoğraflar", label: "Fotoğraflar" },
];

const selectTriggerClass = "h-10 rounded-xl border-slate-700/70 bg-slate-800/80 text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[150] border-slate-700 bg-slate-900 text-slate-100";

const getRelativeDirectory = (file: FileWithRelativePath) => {
  const relativePath = file.webkitRelativePath || "";
  if (!relativePath.includes("/")) return "";
  return relativePath.split("/").slice(0, -1).join("/");
};

export function OSGBArchiveUploadDialog({ open, onOpenChange, companies, selectedCompanyId, onUploaded }: OSGBArchiveUploadDialogProps) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companyId, setCompanyId] = useState("");
  const [folderPath, setFolderPath] = useState("__root__");
  const [files, setFiles] = useState<FileWithRelativePath[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(selectedCompanyId || companies[0]?.id || "");
    setFolderPath("__root__");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (directoryInputRef.current) directoryInputRef.current.value = "";
  }, [companies, open, selectedCompanyId]);

  const uploadLabel = useMemo(() => {
    if (uploading) return "Yükleniyor...";
    return `${files.length} Dosya Yükle`;
  }, [files.length, uploading]);

  const addFiles = (fileList: FileList | null) => {
    const nextFiles = Array.from(fileList || []) as FileWithRelativePath[];
    setFiles(nextFiles);
  };

  const buildFolderPath = (file: FileWithRelativePath) => {
    const baseFolder = folderPath === "__root__" ? "" : folderPath;
    const relativeDirectory = getRelativeDirectory(file);
    return [baseFolder, relativeDirectory].filter(Boolean).join("/");
  };

  const handleUpload = async () => {
    if (!companyId) return toast.error("Dosya yüklemek için firma seçin.");
    if (!user?.id) return toast.error("Dosya yüklemek için oturum gerekli.");
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        await uploadOsgbArchiveFile({
          userId: user.id,
          organizationId,
          companyId,
          folderPath: buildFolderPath(file),
          file,
        });
      }
      toast.success(`${files.length} dosya yüklendi.`);
      onUploaded();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[100] bg-slate-950/80 backdrop-blur-sm"
        className="z-[140] max-w-[480px] overflow-hidden rounded-2xl border border-slate-700/70 bg-[#1b2638] p-0 text-white shadow-2xl [&>button.absolute]:hidden"
      >
        <DialogTitle className="sr-only">Dosya Yükle</DialogTitle>
        <DialogDescription className="sr-only">OSGB firma arşivine dosya yükleyin.</DialogDescription>

        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-xl font-black text-white">Dosya Yükle</h2>
          <DialogClose asChild>
            <button type="button" className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-700/70 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </DialogClose>
        </div>

        <div className="space-y-4 px-6 pb-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-100">Firma *</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Firma seçin" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-100">Klasör (opsiyonel)</label>
            <Select value={folderPath} onValueChange={setFolderPath}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Ana Dizin" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.value} value={folder.value}>{folder.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "grid min-h-[120px] w-full place-items-center rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/30 p-4 text-center transition",
              "hover:border-blue-400/70 hover:bg-slate-900/60",
            )}
          >
            <span>
              <Upload className="mx-auto h-9 w-9 text-slate-500" />
              <span className="mt-3 block text-sm font-semibold text-white">Dosyaları sürükleyin veya tıklayın</span>
              <span className="mt-2 block text-xs leading-5 text-slate-400">PDF, Excel (.xlsx, .xls), Word (.docx, .doc), Resim (.jpg, .png, .gif, .webp)</span>
              {files.length > 0 ? <span className="mt-2 block text-xs font-bold text-blue-300">{files.length} dosya seçildi</span> : null}
            </span>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
          <input
            ref={directoryInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
            {...{ webkitdirectory: "", directory: "" }}
          />

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
            onClick={() => directoryInputRef.current?.click()}
          >
            <FolderInput className="mr-2 h-4 w-4" />
            Klasör Seç (hiyerarşi korunur)
          </Button>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6 pt-1">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-white">İptal</Button>
          </DialogClose>
          <Button type="button" disabled={files.length === 0 || !companyId || uploading} className="bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-800/70 disabled:text-slate-400" onClick={handleUpload}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {uploadLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
