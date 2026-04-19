import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CircleHelp,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  FolderArchive,
  Info,
  LibraryBig,
  Loader2,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type LibraryTab = "topics" | "official" | "archive";
type CollectionRow = Database["public"]["Tables"]["library_collections"]["Row"];
type ItemRow = Database["public"]["Tables"]["library_items"]["Row"];
type HazardRow = Database["public"]["Tables"]["safety_library"]["Row"];

interface ArchiveFile {
  name: string;
  displayName: string;
  url: string;
  created_at: string;
  size: number;
}

interface LibraryCollection {
  id: string;
  slug: string;
  title: string;
  description: string;
  collectionType: string;
  isOfficial: boolean;
}

interface LibraryItem {
  id: string;
  title: string;
  summary: string;
  body: string;
  itemType: string;
  sector: string;
  audience: string;
  sourceName: string;
  sourceUrl: string;
  fileUrl: string;
  publishedYear?: number | null;
  isOfficial: boolean;
  tags: string[];
  collectionSlug: string;
  collectionTitle: string;
  prevention?: string;
  regulation?: string;
}

const emptyItemForm = {
  collectionId: "",
  itemType: "guide",
  title: "",
  summary: "",
  body: "",
  sourceName: "",
  sourceUrl: "",
  sector: "",
  audience: "",
  publishedYear: "",
  tags: "",
};

const fallbackCollections: LibraryCollection[] = [
  {
    id: "topic-guides",
    slug: "topic-guides",
    title: "Konu rehberleri",
    description: "Sahada hızlı başvuru için konu bazlı kısa İSG özetleri.",
    collectionType: "topics",
    isOfficial: false,
  },
  {
    id: "official-publications",
    slug: "official-publications",
    title: "Resmi yayınlar",
    description: "Resmi kaynak bağlantılarıyla afiş, broşür ve yayın arşivi.",
    collectionType: "official_publications",
    isOfficial: true,
  },
  {
    id: "internal-archive",
    slug: "internal-archive",
    title: "Kurum içi dokümanlar",
    description: "Prosedür, talimat, form ve kurum içi kayıt arşivi.",
    collectionType: "internal_archive",
    isOfficial: false,
  },
];

const fallbackOfficialItems: LibraryItem[] = [
  {
    id: "official-main-catalog",
    title: "İş sağlığı ve güvenliği genel müdürlüğü yayınlar ve afişler arşivi",
    summary:
      "Resmi afiş, broşür, dergi, kitap ve diğer yayınların toplu erişim sayfası.",
    body: "Resmi yayınların listelendiği ana kaynak kayıt. Mümkün olduğunda içerikleri resmi kaynaktan açın.",
    itemType: "link",
    sector: "Genel",
    audience: "Tüm kullanıcılar",
    sourceName:
      "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı İş Sağlığı ve Güvenliği Genel Müdürlüğü",
    sourceUrl: "https://www.csgb.gov.tr/isggm/yayinlar-ve-afisler/",
    fileUrl: "",
    publishedYear: 2026,
    isOfficial: true,
    tags: ["resmi yayın", "afiş", "broşür", "dergi"],
    collectionSlug: "official-publications",
    collectionTitle: "Resmi yayınlar",
  },
];

const getArchiveDisplayName = (storedName: string) => {
  if (!storedName.includes("__")) return storedName;
  const parts = storedName.split("__");
  return parts.slice(1).join("__") || storedName;
};

const getTypeLabel = (value: string) => {
  switch (value) {
    case "topic":
      return "Konu kartı";
    case "poster":
      return "Afiş";
    case "guide":
      return "Rehber";
    case "book":
      return "Kitap";
    case "magazine":
      return "Dergi";
    case "brochure":
      return "Broşür";
    case "procedure":
      return "Prosedür";
    case "form":
      return "Form";
    case "regulation":
      return "Mevzuat";
    case "link":
      return "Bağlantı";
    default:
      return "Kayıt";
  }
};

const formatDate = (value?: string) => {
  if (!value) return "Tarih yok";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Tarih yok" : parsed.toLocaleDateString("tr-TR");
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeCollections = (rows: CollectionRow[]): LibraryCollection[] =>
  rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    collectionType: row.collection_type,
    isOfficial: row.is_official,
  }));

const normalizeItems = (
  rows: ItemRow[],
  collections: LibraryCollection[],
): LibraryItem[] => {
  const collectionMap = new Map(collections.map((item) => [item.id, item]));
  return rows.map((row) => {
    const collection = row.collection_id ? collectionMap.get(row.collection_id) : undefined;
    return {
      id: row.id,
      title: row.title,
      summary: row.summary || "Özet girilmemiş.",
      body: row.body || "Detay açıklaması girilmemiş.",
      itemType: row.item_type,
      sector: row.sector || "Genel",
      audience: row.audience || "Genel kullanım",
      sourceName: row.source_name || "Kurum içi bilgi merkezi",
      sourceUrl: row.source_url || "",
      fileUrl: row.file_url || "",
      publishedYear: row.published_year,
      isOfficial: row.is_official,
      tags: row.tags || [],
      collectionSlug: collection?.slug || "uncategorized",
      collectionTitle: collection?.title || "Diğer kayıtlar",
    };
  });
};

const normalizeLegacyHazards = (rows: HazardRow[]): LibraryItem[] =>
  rows.map((row) => ({
    id: row.id,
    title: row.hazard_name,
    summary: row.prevention_text,
    body: row.details || "Detay açıklaması girilmemiş.",
    itemType: "topic",
    sector: row.category_label,
    audience: "İş güvenliği uzmanı ve saha sorumlusu",
    sourceName: "Kurum içi tehlike kaydı",
    sourceUrl: "",
    fileUrl: "",
    publishedYear: null,
    isOfficial: false,
    tags: [row.category_label, row.risk_level || "risk"],
    collectionSlug: "topic-guides",
    collectionTitle: "Konu rehberleri",
    prevention: row.prevention_text,
    regulation: row.regulation || "Belirtilmemiş",
  }));

export default function SafetyLibrary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<LibraryTab>("topics");
  const [collections, setCollections] = useState<LibraryCollection[]>(fallbackCollections);
  const [items, setItems] = useState<LibraryItem[]>(fallbackOfficialItems);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState(emptyItemForm);
  const activeCompanyId = searchParams.get("companyId") || "";
  const activeCompanyName = searchParams.get("companyName") || "";

  useEffect(() => {
    void fetchCatalog();
    void fetchFiles();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const [{ data: collectionRows, error: collectionError }, { data: itemRows, error: itemError }, { data: hazardRows, error: hazardError }] = await Promise.all([
        supabase.from("library_collections").select("*").order("sort_order"),
        supabase.from("library_items").select("*").order("is_featured", { ascending: false }).order("published_year", { ascending: false }),
        supabase.from("safety_library").select("*"),
      ]);

      if (collectionError || itemError) throw collectionError || itemError;

      const normalizedCollections = normalizeCollections((collectionRows || []) as CollectionRow[]);
      const normalizedItems = normalizeItems((itemRows || []) as ItemRow[], normalizedCollections);
      const legacyItems = hazardError ? [] : normalizeLegacyHazards((hazardRows || []) as HazardRow[]);

      setCollections(normalizedCollections.length > 0 ? normalizedCollections : fallbackCollections);
      setItems(normalizedItems.length > 0 ? [...normalizedItems, ...legacyItems] : [...fallbackOfficialItems, ...legacyItems]);
      setCatalogReady(normalizedCollections.length > 0 || normalizedItems.length > 0);
      setNewItem((prev) => ({
        ...prev,
        collectionId: normalizedCollections[0]?.id || fallbackCollections[0].id,
      }));
    } catch (error) {
      console.error("Safety catalog fetch failed:", error);
      toast.error("Yeni kütüphane kataloğu henüz hazır değil. Örnek resmi kayıtlar gösteriliyor.");

      try {
        const { data } = await supabase.from("safety_library").select("*");
        const legacyItems = normalizeLegacyHazards((data || []) as HazardRow[]);
        setItems([...fallbackOfficialItems, ...legacyItems]);
      } catch {
        setItems(fallbackOfficialItems);
      }

      setCollections(fallbackCollections);
      setCatalogReady(false);
      setNewItem((prev) => ({ ...prev, collectionId: fallbackCollections[0].id }));
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    setArchiveLoading(true);
    try {
      const { data, error } = await supabase.storage.from("safety_documents").list();
      if (error) throw error;

      setFiles(
        (data || [])
          .filter((file) => file.name !== ".emptyFolderPlaceholder")
          .map((file) => {
            const { data: urlData } = supabase.storage.from("safety_documents").getPublicUrl(file.name);
            return {
              name: file.name,
              displayName: getArchiveDisplayName(file.name),
              url: urlData.publicUrl,
              created_at: file.created_at,
              size: file.metadata?.size || 0,
            };
          })
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
      );
    } catch (error) {
      console.error("Safety documents fetch failed:", error);
      toast.error("Doküman arşivi yüklenemedi.");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const tags = newItem.tags.split(",").map((value) => value.trim()).filter(Boolean);
      const { error } = await supabase.from("library_items").insert({
        collection_id: newItem.collectionId,
        item_type: newItem.itemType,
        title: newItem.title.trim(),
        summary: newItem.summary.trim(),
        body: newItem.body.trim(),
        source_name: newItem.sourceName.trim() || null,
        source_url: newItem.sourceUrl.trim() || null,
        sector: newItem.sector.trim() || null,
        audience: newItem.audience.trim() || null,
        published_year: newItem.publishedYear ? Number(newItem.publishedYear) : null,
        tags,
      });
      if (error) throw error;

      toast.success("Yeni kütüphane kaydı eklendi.");
      setAddModalOpen(false);
      setNewItem((prev) => ({ ...emptyItemForm, collectionId: prev.collectionId }));
      await fetchCatalog();
    } catch (error: any) {
      toast.error(error?.message || "Kayıt eklenemedi.");
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const safeOriginalName = file.name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
      const fileName = `${Date.now()}__${safeOriginalName}`;
      const { error } = await supabase.storage.from("safety_documents").upload(fileName, file);
      if (error) throw error;

      toast.success("Doküman arşive yüklendi.");
      await fetchFiles();
    } catch (error) {
      console.error("Safety document upload failed:", error);
      toast.error("Dosya yüklenemedi.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from("safety_documents").remove([fileName]);
      if (error) throw error;
      toast.success("Dosya arşivden kaldırıldı.");
      await fetchFiles();
    } catch {
      toast.error("Dosya silinemedi.");
    }
  };

  const handleStartInspection = (item: LibraryItem) => {
    const notes = [
      `Konu: ${item.title}`,
      item.summary ? `Özet: ${item.summary}` : null,
      item.prevention ? `Önerilen önlem: ${item.prevention}` : null,
      item.regulation ? `İlgili mevzuat: ${item.regulation}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigate(`/inspections${activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : ""}`, {
      state: {
        prefilledNotes: notes,
        hazardName: item.title,
      },
    });
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items
      .filter((item) => (activeTab === "topics" ? !item.isOfficial : item.isOfficial))
      .filter((item) => (collectionFilter === "all" ? true : item.collectionSlug === collectionFilter))
      .filter((item) => (typeFilter === "all" ? true : item.itemType === typeFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;
        return (
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.summary.toLowerCase().includes(normalizedSearch) ||
          item.body.toLowerCase().includes(normalizedSearch) ||
          item.sourceName.toLowerCase().includes(normalizedSearch) ||
          item.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
        );
      });
  }, [activeTab, collectionFilter, items, search, typeFilter]);

  const visibleCollections = useMemo(
    () => collections.filter((item) => (activeTab === "topics" ? !item.isOfficial : item.isOfficial)),
    [activeTab, collections],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
          <div className="mt-3 h-4 w-[28rem] animate-pulse rounded bg-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="theme-page-readable space-y-6">
      {activeCompanyId || activeCompanyName ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Firma baglami aktif</p>
              <p className="text-sm text-muted-foreground">
                {activeCompanyName || "Secili firma"} icin arsiv ve kutuphane akisindasiniz. Buradan baslatilan denetim notlari ayni firma baglamiyla devam eder.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("companyId");
                next.delete("companyName");
                setSearchParams(next);
              }}
            >
              Baglami kaldir
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-100">
              Kurumsal bilgi merkezi
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">İSG Kütüphanesi</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Konu kartlarını, resmi yayınları ve kurum içi dokümanları tek sayfada toplayın.
                Denetim hazırlığı, eğitim ve doküman erişimi aynı arşiv düzeninde ilerlesin.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Koleksiyon</p><p className="mt-2 text-2xl font-semibold text-white">{collections.length}</p></CardContent></Card>
            <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Katalog kaydı</p><p className="mt-2 text-2xl font-semibold text-white">{items.length}</p></CardContent></Card>
            <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Arşiv dosyası</p><p className="mt-2 text-2xl font-semibold text-white">{files.length}</p></CardContent></Card>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1">
          <button type="button" onClick={() => setActiveTab("topics")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "topics" ? "bg-emerald-600 text-white" : "text-slate-400"}`}>Konu kütüphanesi</button>
          <button type="button" onClick={() => setActiveTab("official")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "official" ? "bg-blue-600 text-white" : "text-slate-400"}`}>Resmi yayınlar</button>
          <button type="button" onClick={() => setActiveTab("archive")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === "archive" ? "bg-amber-600 text-white" : "text-slate-400"}`}>Kurum içi arşiv</button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => navigate("/safety-library/guide")} className="gap-2 border-slate-700 bg-slate-950 text-slate-200">
            <CircleHelp className="h-4 w-4" />
            Nasıl kullanılır?
          </Button>
          {activeTab === "archive" ? (
            <label htmlFor="safety-doc-upload">
              <Button asChild className="gap-2 bg-amber-600 text-white hover:bg-amber-700">
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Doküman yükle</span>
              </Button>
            </label>
          ) : (
            <Button onClick={() => setAddModalOpen(true)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Yeni kütüphane kaydı
            </Button>
          )}
        </div>
      </div>

      {!catalogReady && (
        <Card className="border-amber-500/25 bg-amber-500/10">
          <CardContent className="p-5 text-sm text-amber-100">
            Yeni katalog tabloları henüz boş ya da migration uygulanmamış olabilir. Sayfa şu anda örnek resmi kayıtlar ve mevcut kurum içi tehlike kartlarıyla çalışıyor.
          </CardContent>
        </Card>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <LibraryBig className="h-5 w-5 text-blue-300" />
              {selectedItem?.title}
            </DialogTitle>
            <DialogDescription className="text-slate-400">Kayıt özeti, kaynak bilgisi ve detay açıklama tek ekranda.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-300">{selectedItem.collectionTitle}</Badge>
                <Badge variant="outline" className={selectedItem.isOfficial ? "border-blue-500/30 bg-blue-500/10 text-blue-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}>{getTypeLabel(selectedItem.itemType)}</Badge>
              </div>
              <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><h4 className="text-sm font-semibold text-white">Özet</h4><p className="mt-2 text-sm leading-6 text-slate-300">{selectedItem.summary}</p></CardContent></Card>
              <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><h4 className="text-sm font-semibold text-white">Detay açıklama</h4><p className="mt-2 text-sm leading-6 text-slate-300">{selectedItem.body}</p></CardContent></Card>
              {selectedItem.regulation && <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><h4 className="text-sm font-semibold text-white">İlgili mevzuat</h4><p className="mt-2 text-sm leading-6 text-slate-300">{selectedItem.regulation}</p></CardContent></Card>}
              <div className="flex flex-col gap-2 sm:flex-row">
                {!selectedItem.isOfficial && <Button className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleStartInspection(selectedItem)}>Bu kayıtla denetim başlat<ArrowRight className="h-4 w-4" /></Button>}
                {(selectedItem.fileUrl || selectedItem.sourceUrl) && <Button variant="outline" className="flex-1 gap-2 border-slate-700 bg-slate-900 text-slate-200" onClick={() => window.open(selectedItem.fileUrl || selectedItem.sourceUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />Kaynağı aç</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-2xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Yeni kütüphane kaydı ekle</DialogTitle>
            <DialogDescription className="text-slate-400">Konu kartı, rehber, bağlantı veya kurum içi yayın kaydı oluşturabilirsiniz.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <select className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none" value={newItem.collectionId} onChange={(event) => setNewItem((prev) => ({ ...prev, collectionId: event.target.value }))}>
                {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}
              </select>
              <select className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none" value={newItem.itemType} onChange={(event) => setNewItem((prev) => ({ ...prev, itemType: event.target.value }))}>
                <option value="topic">Konu kartı</option>
                <option value="guide">Rehber</option>
                <option value="procedure">Prosedür</option>
                <option value="form">Form</option>
                <option value="poster">Afiş kaydı</option>
                <option value="link">Bağlantı</option>
              </select>
            </div>
            <Input required placeholder="Başlık" value={newItem.title} onChange={(event) => setNewItem((prev) => ({ ...prev, title: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            <Textarea required placeholder="Özet" value={newItem.summary} onChange={(event) => setNewItem((prev) => ({ ...prev, summary: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            <Textarea placeholder="Detay açıklama" value={newItem.body} onChange={(event) => setNewItem((prev) => ({ ...prev, body: event.target.value }))} className="min-h-[120px] border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Kaynak adı" value={newItem.sourceName} onChange={(event) => setNewItem((prev) => ({ ...prev, sourceName: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
              <Input placeholder="Kaynak bağlantısı" value={newItem.sourceUrl} onChange={(event) => setNewItem((prev) => ({ ...prev, sourceUrl: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input placeholder="Sektör" value={newItem.sector} onChange={(event) => setNewItem((prev) => ({ ...prev, sector: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
              <Input placeholder="Hedef kullanıcı" value={newItem.audience} onChange={(event) => setNewItem((prev) => ({ ...prev, audience: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
              <Input placeholder="Yıl" value={newItem.publishedYear} onChange={(event) => setNewItem((prev) => ({ ...prev, publishedYear: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            </div>
            <Input placeholder="Etiketler: kimyasal, eğitim, depo" value={newItem.tags} onChange={(event) => setNewItem((prev) => ({ ...prev, tags: event.target.value }))} className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)} className="border-slate-700 bg-slate-900 text-slate-200">İptal</Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">Kaydet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {activeTab === "archive" ? (
        <div className="space-y-4">
          <input type="file" id="safety-doc-upload" className="hidden" onChange={handleFileUpload} disabled={uploading} />

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-amber-500/25 bg-amber-500/10">
              <CardContent className="space-y-2 p-5 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-semibold text-amber-50">
                  <FolderArchive className="h-4 w-4" />
                  Arşiv düzeni önerisi
                </div>
                <p>Prosedür, talimat, form ve toplantı tutanaklarını ayrı başlıklarla adlandırın.</p>
                <p className="text-amber-50">Örnek: prosedur__yuksekte-calisma__v2.pdf</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/25 bg-blue-500/10">
              <CardContent className="space-y-2 p-5 text-sm text-blue-100">
                <div className="flex items-center gap-2 font-semibold text-blue-50">
                  <ShieldCheck className="h-4 w-4" />
                  Hazır import dosyaları
                </div>
                <p>Resmi yayınları toplu içe almak için örnek JSON ve CSV formatları proje içinde <span className="font-medium text-blue-50">supabase/templates</span> klasörüne eklendi.</p>
              </CardContent>
            </Card>
          </div>

          {archiveLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <Card className="border-dashed border-slate-800 bg-slate-950/70">
              <CardContent className="px-6 py-14 text-center">
                <FolderArchive className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-4 text-sm font-medium text-slate-200">Henüz yüklenmiş doküman yok.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {files.map((file) => (
                <Card key={file.name} className="border-slate-800 bg-slate-950/70">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white" title={file.displayName}>{file.displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
                        <p className="text-xs text-slate-500">{formatDate(file.created_at)}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                      <Button variant="ghost" size="sm" className="gap-1 text-slate-300" onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}>
                        <Download className="h-4 w-4" />
                        Aç
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-300" onClick={() => handleDeleteFile(file.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-slate-800 bg-slate-950/70">
            <CardHeader>
              <CardTitle className="text-lg text-white">Koleksiyonlar</CardTitle>
              <CardDescription>Kayıtları konu veya kaynak grubuna göre filtreleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleCollections.map((collection) => (
                <button key={collection.id} type="button" onClick={() => setCollectionFilter((prev) => (prev === collection.slug ? "all" : collection.slug))} className={`w-full rounded-2xl border p-4 text-left transition ${collectionFilter === collection.slug ? "border-blue-500/40 bg-blue-500/10" : "border-slate-800 bg-slate-900/70"}`}>
                  <p className="font-semibold text-white">{collection.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{collection.description}</p>
                </button>
              ))}
              {activeTab === "official" && (
                <Card className="border-blue-500/25 bg-blue-500/10">
                  <CardContent className="space-y-2 p-4 text-sm text-blue-100">
                    <div className="flex items-center gap-2 font-semibold text-blue-50">
                      <Scale className="h-4 w-4" />
                      Resmi kaynak notu
                    </div>
                    <p>Resmi yayınları mümkün olduğunda kaynak bağlantısıyla açın ve kurum adını kayıt içinde saklayın.</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-950/70">
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Başlık, özet, etiket veya kaynak adı ile ara" className="border-slate-800 bg-slate-900 pl-9 text-white placeholder:text-slate-500" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-transparent text-sm text-white outline-none">
                    <option value="all">Tüm kayıt tipleri</option>
                    <option value="topic">Konu kartı</option>
                    <option value="poster">Afiş</option>
                    <option value="guide">Rehber</option>
                    <option value="book">Kitap</option>
                    <option value="magazine">Dergi</option>
                    <option value="brochure">Broşür</option>
                    <option value="link">Bağlantı</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-950/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-white">{activeTab === "topics" ? "Konu kütüphanesi" : "Resmi yayın kataloğu"}</CardTitle>
                <CardDescription>{filteredItems.length} kayıt bulundu.</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-12 text-center">
                    <FileSearch className="mx-auto h-8 w-8 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-200">Filtrelere uygun kayıt bulunamadı.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {filteredItems.map((item) => (
                      <Card key={item.id} className="border-slate-800 bg-slate-900/70">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-slate-700 text-slate-300">{item.collectionTitle}</Badge>
                                <Badge variant="outline" className={item.isOfficial ? "border-blue-500/30 bg-blue-500/10 text-blue-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}>{getTypeLabel(item.itemType)}</Badge>
                              </div>
                              <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400" onClick={() => { setSelectedItem(item); setDetailOpen(true); }}>
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="line-clamp-3 text-sm leading-6 text-slate-300">{item.summary}</p>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Kaynak</p>
                            <p className="mt-1 text-xs text-slate-300">{item.sourceName}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.tags.slice(0, 4).map((tag) => <Badge key={`${item.id}-${tag}`} variant="outline" className="border-slate-700 text-slate-400">{tag}</Badge>)}
                          </div>
                          {activeTab === "topics" ? (
                            <Button className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleStartInspection(item)}>
                              Denetimde kullan
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => {
                              const target = item.fileUrl || item.sourceUrl;
                              if (!target) {
                                toast.error("Bu kayıt için açık bağlantı bulunamadı.");
                                return;
                              }
                              window.open(target, "_blank", "noopener,noreferrer");
                            }}>
                              Resmi kaynağı aç
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
