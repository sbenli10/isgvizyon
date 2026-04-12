import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Users,
  AlertTriangle,
  FileText,
  Clipboard,
  Settings,
  LogOut,
  RefreshCw,
  AlertCircle,
  Loader2,
  Camera,
  Mail,
  Edit2,
  Save,
  X,
  Sparkles,
  Wand2,
  Shield,
  CreditCard,
  Bell,
  ArrowRight,
  NotebookPen,
  Search,
  Trash2,
  CheckCircle2,
  CircleDashed,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  organization_id: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
}

interface StatsData {
  companies: number;
  employees: number;
  risks: number;
  inspections: number;
  assessments: number;
}

type ProfileTab = "profile" | "workspace" | "avatar" | "notebook";

type NoteStatusFilter = "all" | "pending" | "completed" | "upcoming";

interface ProfileNote {
  id: string;
  category: string;
  content: string;
  company_id: string | null;
  company_name: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

const noteCategories = [
  "Genel",
  "İş",
  "Toplantı",
  "Acil",
  "Görev",
  "Hatırlat",
  "Bilgi",
  "Kişisel",
] as const;

const statItems = [
  {
    key: "companies",
    label: "Firmalarım",
    icon: Building2,
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    key: "employees",
    label: "Çalışanlar",
    icon: Users,
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
  },
  {
    key: "risks",
    label: "Risk Maddeleri",
    icon: AlertTriangle,
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
  },
  {
    key: "inspections",
    label: "Denetimler",
    icon: FileText,
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
  },
  {
    key: "assessments",
    label: "Değerlendirmeler",
    icon: Clipboard,
    textColor: "text-pink-600 dark:text-pink-400",
    borderColor: "border-pink-500/30",
  },
] as const;

const avatarGradients = [
  ["#2563eb", "#1d4ed8"],
  ["#9333ea", "#7e22ce"],
  ["#db2777", "#be185d"],
  ["#ea580c", "#c2410c"],
  ["#059669", "#047857"],
  ["#0891b2", "#0e7490"],
  ["#4f46e5", "#4338ca"],
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function createISGVizyonAvatarDataUrl(seed: string, fullName: string): string {
  const hashed = hashSeed(seed || fullName || "denetron");
  const gradient = avatarGradients[hashed % avatarGradients.length];
  const initials = getInitials(fullName || "İSGVizyon");
  const shapeA = (hashed % 40) + 20;
  const shapeB = (hashed % 30) + 35;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
      <stop stop-color="${gradient[0]}"/>
      <stop offset="1" stop-color="${gradient[1]}"/>
    </linearGradient>
  </defs>
  <rect width="240" height="240" rx="52" fill="url(#g)"/>
  <circle cx="${shapeA}" cy="42" r="16" fill="white" fill-opacity="0.2"/>
  <circle cx="198" cy="${shapeB}" r="12" fill="white" fill-opacity="0.18"/>
  <path d="M28 176C62 144 84 158 114 132C146 104 172 108 212 74" stroke="white" stroke-opacity="0.22" stroke-width="9" stroke-linecap="round"/>
  <text x="120" y="138" text-anchor="middle" font-size="78" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="white">${initials}</text>
  <text x="120" y="204" text-anchor="middle" font-size="18" font-weight="600" font-family="Segoe UI, Arial, sans-serif" fill="white" fill-opacity="0.9">İSGVİZYON</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentTab, setCurrentTab] = useState<ProfileTab>("profile");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData>({
    companies: 0,
    employees: 0,
    risks: 0,
    inspections: 0,
    assessments: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    position: "",
    department: "",
  });
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [notes, setNotes] = useState<ProfileNote[]>([]);
  const [noteForm, setNoteForm] = useState({
    category: "Genel",
    content: "",
    company_id: "none",
    due_date: "",
  });
  const [noteSearch, setNoteSearch] = useState("");
  const [noteFilter, setNoteFilter] = useState<NoteStatusFilter>("all");

  useEffect(() => {
    if (user) {
      void fetchProfileData();
      void loadUserCompanies();
      void loadProfileNotes();
    }
  }, [user]);

  const loadUserCompanies = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      toast.error("Firma listesi alınamadı", { description: error.message });
      return;
    }

    setCompanies((data || []).map((item) => ({ id: item.id, name: item.name })));
  };

  const loadProfileNotes = async () => {
    if (!user) return;

    setNotesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("profile_notes")
        .select(
          "id, category, content, company_id, due_date, is_completed, created_at, companies:company_id(name)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: ProfileNote[] = (data || []).map((item: any) => ({
        id: item.id,
        category: item.category || "Genel",
        content: item.content || "",
        company_id: item.company_id || null,
        company_name: item.companies?.name || null,
        due_date: item.due_date || null,
        is_completed: Boolean(item.is_completed),
        created_at: item.created_at,
      }));

      setNotes(mapped);
    } catch (err: any) {
      toast.error("Notlar yüklenemedi", { description: err.message });
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!user) return;
    if (!noteForm.content.trim()) {
      toast.error("Lütfen bir not içeriği yazın");
      return;
    }

    setNoteSaving(true);
    try {
      const payload = {
        user_id: user.id,
        organization_id: profile?.organization_id || null,
        category: noteForm.category,
        content: noteForm.content.trim(),
        company_id: noteForm.company_id === "none" ? null : noteForm.company_id,
        due_date: noteForm.due_date || null,
        is_completed: false,
      };

      const { error } = await (supabase as any).from("profile_notes").insert(payload);
      if (error) throw error;

      toast.success("Not kaydedildi");
      setNoteForm({ category: "Genel", content: "", company_id: "none", due_date: "" });
      await loadProfileNotes();
    } catch (err: any) {
      toast.error("Not kaydedilemedi", { description: err.message });
    } finally {
      setNoteSaving(false);
    }
  };

  const handleToggleNote = async (noteId: string, completed: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("profile_notes")
        .update({ is_completed: completed })
        .eq("id", noteId);

      if (error) throw error;
      setNotes((prev) =>
        prev.map((item) => (item.id === noteId ? { ...item, is_completed: completed } : item))
      );
    } catch (err: any) {
      toast.error("Not güncellenemedi", { description: err.message });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await (supabase as any).from("profile_notes").delete().eq("id", noteId);
      if (error) throw error;

      setNotes((prev) => prev.filter((item) => item.id !== noteId));
      toast.success("Not silindi");
    } catch (err: any) {
      toast.error("Not silinemedi", { description: err.message });
    }
  };
  const fetchProfileData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw new Error("Profil verisi yüklenemedi");
      }

      const mappedProfile: ProfileData = {
        id: profileData.id,
        full_name: profileData.full_name || "Kullanıcı",
        email: profileData.email || user.email || "",
        avatar_url: profileData.avatar_url,
        phone: profileData.phone,
        position: profileData.position,
        department: profileData.department,
        organization_id: profileData.organization_id,
        is_active: profileData.is_active ?? true,
        role: profileData.role || "staff",
        created_at: profileData.created_at,
      };

      setProfile(mappedProfile);
      setFormData({
        full_name: mappedProfile.full_name,
        phone: mappedProfile.phone || "",
        position: mappedProfile.position || "",
        department: mappedProfile.department || "",
      });

      const { count: companyCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      const { data: assessmentIds } = await supabase
        .from("risk_assessments")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_deleted", false);

      let riskCount = 0;
      if (assessmentIds && assessmentIds.length > 0) {
        const ids = assessmentIds.map((a) => a.id);
        const { count } = await supabase
          .from("risk_items")
          .select("*", { count: "exact", head: true })
          .in("assessment_id", ids);
        riskCount = count || 0;
      }

      const { count: inspectionCount } = await supabase
        .from("inspections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: assessmentCount } = await supabase
        .from("risk_assessments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_deleted", false);

      let employeeCount = 0;
      const { data: userCompanies } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id);

      if (userCompanies && userCompanies.length > 0) {
        const companyIds = userCompanies.map((c) => c.id);
        const { count } = await supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds)
          .eq("is_active", true);
        employeeCount = count || 0;
      }

      setStats({
        companies: companyCount || 0,
        employees: employeeCount,
        risks: riskCount,
        inspections: inspectionCount || 0,
        assessments: assessmentCount || 0,
      });
    } catch (err: any) {
      setError(err.message || "Profil yüklenirken bir sorun oluştu");
      toast.error("Veri yüklenemedi", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar boyutu 5MB'ı aşamaz");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: urlData.publicUrl } : null
      );

      toast.success("Avatar güncellendi");
    } catch (err: any) {
      toast.error("Avatar yüklenemedi", {
        description: err.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateISGVizyonAvatar = async () => {
    if (!user || !profile) return;

    const dataUrl = createISGVizyonAvatarDataUrl(user.id, profile.full_name || "İSGVizyon");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: dataUrl })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, avatar_url: dataUrl } : null));
      toast.success("İSGVizyon avatarı oluşturuldu");
    } catch (err: any) {
      toast.error("Avatar kaydedilemedi", {
        description: err.message,
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !formData.full_name.trim()) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          position: formData.position.trim() || null,
          department: formData.department.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: formData.full_name.trim(),
              phone: formData.phone.trim() || null,
              position: formData.position.trim() || null,
              department: formData.department.trim() || null,
            }
          : null
      );

      setEditing(false);
      toast.success("Profil güncellendi");
    } catch (err: any) {
      toast.error("Profil güncellenemedi", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
      toast.success("Çıkış yapıldı");
    } catch {
      toast.error("Çıkış yapılamadı");
    }
  };

  const completionScore = useMemo(() => {
    if (!profile) return 0;
    const checks = [
      profile.full_name,
      profile.phone,
      profile.position,
      profile.department,
      profile.avatar_url,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [profile]);


  const filteredNotes = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    return notes.filter((note) => {
      const textMatch =
        note.content.toLowerCase().includes(noteSearch.toLowerCase()) ||
        note.category.toLowerCase().includes(noteSearch.toLowerCase()) ||
        (note.company_name || "").toLowerCase().includes(noteSearch.toLowerCase());

      if (!textMatch) return false;

      if (noteFilter === "completed") return note.is_completed;
      if (noteFilter === "pending") return !note.is_completed;
      if (noteFilter === "upcoming") {
        if (note.is_completed || !note.due_date) return false;
        const due = new Date(note.due_date);
        return due >= now && due <= nextWeek;
      }
      return true;
    });
  }, [notes, noteSearch, noteFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-900" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="h-[420px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          <div className="space-y-6">
            <div className="h-52 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-52 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">Hata Oluştu</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={() => void fetchProfileData()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tekrar Dene
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-card/60 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-24 w-24 rounded-2xl object-cover border"
                />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-primary/15 border grid place-items-center text-2xl font-bold text-primary">
                  {getInitials(profile?.full_name || "K")}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md disabled:opacity-70"
                type="button"
                aria-label="Avatar değiştir"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile?.full_name}</h1>
                <Badge variant={profile?.is_active ? "default" : "secondary"}>
                  {profile?.is_active ? "Aktif" : "Pasif"}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {profile?.role || "user"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profile?.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Üyelik başlangıcı: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("tr-TR") : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/settings")}> 
              <Settings className="h-4 w-4 mr-2" />
              Ayarlar
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        <Separator className="my-5" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {statItems.map((item) => {
            const Icon = item.icon;
            const value = stats[item.key as keyof StatsData];
            return (
              <Card key={item.key} className={`border ${item.borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-4 w-4 ${item.textColor}`} />
                    <span className="text-xl font-bold">{value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as ProfileTab)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="workspace">Çalışma Alanı</TabsTrigger>
          <TabsTrigger value="avatar">İSGVizyon Avatar</TabsTrigger>
          <TabsTrigger value="notebook">Not Defteri</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Profil Bilgileri</CardTitle>
                <CardDescription>Kişisel iletişim ve görev bilgilerinizi güncelleyin.</CardDescription>
              </div>
              {!editing && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ad Soyad</Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="+90 5XX XXX XX XX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pozisyon</Label>
                      <Input
                        value={formData.position}
                        onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                        placeholder="İSG Uzmanı"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Departman</Label>
                      <Input
                        value={formData.department}
                        onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                        placeholder="İSG Departmanı"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateProfile} disabled={saving || !formData.full_name.trim()}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Kaydet
                    </Button>
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        setEditing(false);
                        setFormData({
                          full_name: profile?.full_name || "",
                          phone: profile?.phone || "",
                          position: profile?.position || "",
                          department: profile?.department || "",
                        });
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ad Soyad</p>
                    <p className="font-medium">{profile?.full_name || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="font-medium">{profile?.phone || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Pozisyon</p>
                    <p className="font-medium">{profile?.position || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Departman</p>
                    <p className="font-medium">{profile?.department || "-"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs text-muted-foreground">E-posta</p>
                    <p className="font-medium">{profile?.email || "-"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil Tamamlanma Skoru</CardTitle>
              <CardDescription>Hesap bilgilerinizin tamamlanma düzeyi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Tamamlanma</p>
                <p className="text-xl font-bold">%{completionScore}</p>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${completionScore}%` }} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Güvenlik ve Oturum
                </CardTitle>
                <CardDescription>2FA, cihazlar ve oturum yönetimi</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>Ayarları Aç <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Plan ve Faturalandırma
                </CardTitle>
                <CardDescription>Abonelik durumunuzu yönetin</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>Planı Yönet <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Bildirimler
                </CardTitle>
                <CardDescription>E-posta ve uygulama bildirimleri</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>Bildirim Ayarları <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="avatar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                İSGVizyon Avatar Stüdyosu
              </CardTitle>
              <CardDescription>
                Yüklediğiniz fotoğrafı kullanabilir veya tek tıkla size özel İSGVizyon avatarı üretebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="h-28 w-28 rounded-2xl overflow-hidden border bg-muted/30">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar önizleme" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xl font-bold text-muted-foreground">
                      {getInitials(profile?.full_name || "K")}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                    Fotoğraf Yükle
                  </Button>
                  <Button variant="outline" onClick={handleGenerateISGVizyonAvatar}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    İSGVizyon Avatar Üret
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Avatar önerisi: Profil adı, kullanıcı kimliği ve marka stiline göre deterministik olarak üretilir.
                İsterseniz daha sonra tekrar üreterek farklı bir varyasyon kaydedebilirsiniz.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notebook" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <NotebookPen className="h-5 w-5 text-primary" />
                  Not Ekle
                </CardTitle>
                <CardDescription>Hızlı not, görev ya da hatırlatma kaydedin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {noteCategories.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={noteForm.category === category ? "default" : "outline"}
                      onClick={() => setNoteForm((prev) => ({ ...prev, category }))}
                    >
                      {category}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Not İçeriği</Label>
                  <Textarea
                    placeholder="Notunu hızlıca yaz..."
                    value={noteForm.content}
                    onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Firma (opsiyonel)</Label>
                    <Select
                      value={noteForm.company_id}
                      onValueChange={(value) => setNoteForm((prev) => ({ ...prev, company_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Firma seç" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Firma seçme</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Tarih (opsiyonel)</Label>
                    <Input
                      type="date"
                      value={noteForm.due_date}
                      onChange={(e) => setNoteForm((prev) => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={handleCreateNote} disabled={noteSaving}>
                  {noteSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Kaydet
                </Button>
              </CardContent>
            </Card>

            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Notlarım</CardTitle>
                <CardDescription>Kayıtlı notlarınızı arayın ve durumunu yönetin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      className="pl-9"
                      placeholder="Notlarda ara..."
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                    />
                  </div>

                  <Select value={noteFilter} onValueChange={(v) => setNoteFilter(v as NoteStatusFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Durum filtresi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="pending">Bekleyen</SelectItem>
                      <SelectItem value="completed">Tamamlanan</SelectItem>
                      <SelectItem value="upcoming">Yaklaşan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {notesLoading ? (
                  <div className="h-56 grid place-items-center border rounded-xl">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Notlar yükleniyor...</p>
                    </div>
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="h-56 grid place-items-center border rounded-xl bg-muted/20 text-center p-4">
                    <div>
                      <NotebookPen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Görüntülenecek not bulunamadı.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                    {filteredNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          note.is_completed ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary">{note.category}</Badge>
                              {note.company_name && <Badge variant="outline">{note.company_name}</Badge>}
                              {note.due_date && (
                                <Badge variant="outline" className="gap-1">
                                  <Clock3 className="h-3 w-3" />
                                  {new Date(note.due_date).toLocaleDateString("tr-TR")}
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm ${note.is_completed ? "line-through text-muted-foreground" : ""}`}>
                              {note.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Oluşturulma: {new Date(note.created_at).toLocaleString("tr-TR")}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleToggleNote(note.id, !note.is_completed)}
                              title={note.is_completed ? "Bekleyen yap" : "Tamamlandı yap"}
                            >
                              {note.is_completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <CircleDashed className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteNote(note.id)}
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}















