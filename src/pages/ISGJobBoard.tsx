import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type JobPost = {
  id: string;
  source_type: "user" | "external" | "admin";
  source_name: string;
  title: string;
  content: string;
  city: string;
  contact_phone: string | null;
  contact_email: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
};

type JobComment = {
  id: string;
  job_post_id: string;
  author_name: string;
  is_anonymous: boolean;
  comment: string;
  created_at: string;
};

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  action_url: string | null;
  published_at: string;
};

const PAGE_SIZE = 8;
const pinnedCities = ["İstanbul", "Ankara", "İzmir"];
const allCities = [
  "Tüm Türkiye",
  ...pinnedCities,
  "Adana",
  "Antalya",
  "Bursa",
  "Çanakkale",
  "Denizli",
  "Diyarbakır",
  "Eskişehir",
  "Gaziantep",
  "Hatay",
  "Kayseri",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Mersin",
  "Muğla",
  "Sakarya",
  "Samsun",
  "Tekirdağ",
  "Trabzon",
].filter((city, index, list) => list.indexOf(city) === index);

const highlightTerms = [
  "A Sınıfı İş Güvenliği Uzmanı",
  "B Sınıfı İş Güvenliği Uzmanı",
  "C Sınıfı İş Güvenliği Uzmanı",
  "İşyeri Hekimi",
  "Diğer Sağlık Personeli",
  "DSP",
  "İş Güvenliği Uzmanı",
];

const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").trim();

function extractPhone(text: string) {
  return text.match(/(?:\+90|0)?\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/)?.[0]?.trim() || "";
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim() || "";
}

function highlightContent(text: string) {
  const escaped = highlightTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(regex).map((part, index) => {
    const isMatch = highlightTerms.some((term) => normalize(term) === normalize(part));
    return isMatch ? (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-300/15 px-1 font-black text-yellow-300">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function ISGJobBoard() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [comments, setComments] = useState<Record<string, JobComment[]>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("Tüm İller");
  const [dateFilter, setDateFilter] = useState<"all" | "3" | "7" | "10">("all");
  const [page, setPage] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [commentDialogPost, setCommentDialogPost] = useState<JobPost | null>(null);
  const [newPost, setNewPost] = useState({ title: "", content: "", city: "Tüm Türkiye", contactPhone: "", contactEmail: "" });
  const [newComment, setNewComment] = useState({ comment: "", anonymous: false });
  const [submitting, setSubmitting] = useState(false);

  const unreadAnnouncementCount = announcements.filter((item) => !readAnnouncementIds.includes(item.id)).length;

  const loadData = async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    try {
      const [{ data: postsData, error: postsError }, { data: announcementsData, error: announcementsError }] = await Promise.all([
        supabase
          .from("isg_job_posts")
          .select("id, source_type, source_name, title, content, city, contact_phone, contact_email, view_count, published_at, created_at")
          .eq("status", "approved")
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("isg_job_announcements")
          .select("id, title, message, type, action_url, published_at")
          .eq("is_active", true)
          .order("published_at", { ascending: false }),
      ]);

      if (postsError) throw postsError;
      if (announcementsError) throw announcementsError;

      const nextPosts = (postsData || []) as JobPost[];
      setPosts(nextPosts);
      setAnnouncements((announcementsData || []) as Announcement[]);

      if (nextPosts.length > 0) {
        const { data: commentData, error: commentError } = await supabase
          .from("isg_job_comments")
          .select("id, job_post_id, author_name, is_anonymous, comment, created_at")
          .eq("status", "approved")
          .in("job_post_id", nextPosts.map((post) => post.id))
          .order("created_at", { ascending: true });
        if (commentError) throw commentError;
        setComments(
          ((commentData || []) as JobComment[]).reduce<Record<string, JobComment[]>>((acc, item) => {
            acc[item.job_post_id] = [...(acc[item.job_post_id] || []), item];
            return acc;
          }, {}),
        );
      } else {
        setComments({});
      }

      if (user?.id) {
        const { data: reads } = await supabase
          .from("isg_job_announcement_reads")
          .select("announcement_id")
          .eq("user_id", user.id);
        setReadAnnouncementIds((reads || []).map((item: any) => item.announcement_id));
      }
    } catch (error) {
      console.error("İş ilanları yüklenemedi:", error);
      toast.error("İş ilanları yüklenemedi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const filteredPosts = useMemo(() => {
    const now = Date.now();
    const maxAgeMs = dateFilter === "all" ? null : Number(dateFilter) * 24 * 60 * 60 * 1000;
    const term = normalize(search);

    return posts.filter((post) => {
      const haystack = normalize(`${post.title} ${post.content} ${post.city}`);
      const matchesSearch = !term || haystack.includes(term);
      const matchesCity = city === "Tüm İller" || post.city === city || post.city === "Tüm Türkiye";
      const postTime = new Date(post.published_at || post.created_at).getTime();
      const matchesDate = !maxAgeMs || now - postTime <= maxAgeMs;
      return matchesSearch && matchesCity && matchesDate;
    });
  }, [posts, search, city, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPosts = filteredPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, city, dateFilter]);

  const clearFilters = () => {
    setSearch("");
    setCity("Tüm İller");
    setDateFilter("all");
  };

  const openPostDialog = () => {
    if (!user) {
      toast.info("İlan vermek için giriş yapmanız gerekir.");
      return;
    }
    setPostDialogOpen(true);
  };

  const submitPost = async () => {
    if (!user) {
      toast.error("İlan vermek için giriş yapmanız gerekir.");
      return;
    }
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error("İlan başlığı ve ilan metni zorunludur.");
      return;
    }

    setSubmitting(true);
    try {
      const content = newPost.content.trim();
      const { error } = await supabase.from("isg_job_posts").insert({
        user_id: user.id,
        source_type: "user",
        source_name: profile?.display_name || user.email || "İSGVizyon Kullanıcısı",
        title: newPost.title.trim(),
        content,
        city: newPost.city,
        contact_phone: newPost.contactPhone.trim() || extractPhone(content) || null,
        contact_email: newPost.contactEmail.trim() || extractEmail(content) || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("İlanınız admin onayına gönderildi.");
      setPostDialogOpen(false);
      setNewPost({ title: "", content: "", city: "Tüm Türkiye", contactPhone: "", contactEmail: "" });
    } catch (error) {
      console.error("İlan gönderilemedi:", error);
      toast.error("İlan gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!user || !commentDialogPost) {
      toast.error("Yorum yapmak için giriş yapmanız gerekir.");
      return;
    }
    if (!newComment.comment.trim()) {
      toast.error("Yorum alanı boş bırakılamaz.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("isg_job_comments").insert({
        job_post_id: commentDialogPost.id,
        user_id: user.id,
        author_name: newComment.anonymous ? "Anonim" : profile?.display_name || user.email || "Kullanıcı",
        is_anonymous: newComment.anonymous,
        comment: newComment.comment.trim(),
        status: "pending",
      });
      if (error) throw error;
      toast.success("Yorumunuz admin onayına gönderildi.");
      setCommentDialogPost(null);
      setNewComment({ comment: "", anonymous: false });
    } catch (error) {
      console.error("Yorum gönderilemedi:", error);
      toast.error("Yorum gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const markAnnouncementsRead = async () => {
    setAnnouncementOpen(true);
    if (!user?.id || unreadAnnouncementCount === 0) return;
    const unread = announcements.filter((item) => !readAnnouncementIds.includes(item.id));
    window.setTimeout(() => {
      void supabase
        .from("isg_job_announcement_reads")
        .upsert(
          unread.map((item) => ({ announcement_id: item.id, user_id: user.id })),
          { onConflict: "announcement_id,user_id" },
        )
        .then(() => setReadAnnouncementIds((current) => [...new Set([...current, ...unread.map((item) => item.id)])]));
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BriefcaseBusiness className="h-8 w-8 text-violet-400" />
              <h1 className="text-3xl font-black tracking-tight text-white">İş İlanları</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="mt-3 h-8 border-yellow-400/30 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15">
              <HelpCircle className="mr-2 h-4 w-4" />
              Nasıl Yapılır?
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={markAnnouncementsRead} variant="outline" className="relative border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700">
              <Bell className="mr-2 h-4 w-4" />
              Bildirimler
              {unreadAnnouncementCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                  {unreadAnnouncementCount}
                </span>
              ) : null}
            </Button>
            <Button onClick={openPostDialog} className="bg-emerald-600 text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500">
              <Plus className="mr-2 h-4 w-4" />
              Ücretsiz İlan Ver
            </Button>
            <Button onClick={() => void loadData(true)} disabled={refreshing} className="bg-violet-600 text-white shadow-lg shadow-violet-950/30 hover:bg-violet-500">
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Yenile
            </Button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İlan içeriğinde ara..." className="h-12 border-slate-700 bg-slate-950/50 pl-12 text-white placeholder:text-slate-500" />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-12 border-slate-700 bg-slate-950/50 text-white">
                <MapPin className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[80] max-h-80 border-slate-700 bg-slate-950 text-white">
                <SelectItem value="Tüm İller">Tüm İller</SelectItem>
                {allCities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || city !== "Tüm İller" || dateFilter !== "all") && (
              <Button onClick={clearFilters} variant="outline" className="h-12 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">
                <X className="mr-2 h-4 w-4" />
                Temizle
              </Button>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <CalendarDays className="h-4 w-4" />
          <span>Tarih:</span>
          {[
            ["3", "Son 3 Gün"],
            ["7", "Son 7 Gün"],
            ["10", "Son 10 Gün"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDateFilter(dateFilter === value ? "all" : (value as "3" | "7" | "10"))}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                dateFilter === value ? "border-violet-400 bg-violet-600 text-white" : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{filteredPosts.length} ilan gösteriliyor</span>
        </div>

        <main className="space-y-4">
          {loading ? (
            <div className="grid h-72 place-items-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-400">
              <Loader2 className="mb-3 h-6 w-6 animate-spin" />
              İlanlar yükleniyor...
            </div>
          ) : currentPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center">
              <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-500" />
              <h2 className="mt-4 text-xl font-black text-white">Bu filtrede ilan bulunamadı</h2>
              <p className="mt-2 text-sm text-slate-400">Filtreleri temizleyebilir veya yeni bir ilan gönderebilirsiniz.</p>
            </div>
          ) : (
            currentPosts.map((post) => {
              const phone = post.contact_phone || extractPhone(post.content);
              const email = post.contact_email || extractEmail(post.content);
              return (
                <article key={post.id} className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-5 shadow-lg shadow-black/10">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sky-300">@{post.source_name || "İSGVizyon"}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(post.published_at || post.created_at), { addSuffix: true, locale: tr })}</span>
                    <Badge className="ml-auto border-slate-600 bg-slate-900 text-slate-200">{post.city}</Badge>
                  </div>

                  <h2 className="mt-6 text-lg font-black text-yellow-300">{highlightContent(post.title)}</h2>
                  <div className="mt-6 whitespace-pre-line text-sm leading-7 text-white">{highlightContent(post.content)}</div>

                  {(phone || email) && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {phone && (
                        <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center rounded-lg bg-blue-600/40 px-3 py-2 text-sm font-bold text-blue-100 transition hover:bg-blue-600">
                          <Phone className="mr-2 h-4 w-4 text-pink-300" />
                          {phone}
                        </a>
                      )}
                      {email && (
                        <a href={`mailto:${email}`} className="inline-flex items-center rounded-lg bg-emerald-600/40 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-600">
                          <Mail className="mr-2 h-4 w-4" />
                          {email}
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-6 border-t border-slate-700 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{formatDate(post.published_at || post.created_at)}</span>
                      <span>{post.view_count || 0} görüntülenme</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => setCommentDialogPost(post)} className="bg-violet-600 text-white hover:bg-violet-500">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Yorumlar ({comments[post.id]?.length || 0})
                      </Button>
                      <Button onClick={() => setCommentDialogPost(post)} variant="outline" className="border-slate-600 bg-slate-700 text-white hover:bg-slate-600">
                        <Send className="mr-2 h-4 w-4" />
                        Yorum Yap
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </main>

        {totalPages > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, index) => (
              <Button key={index} onClick={() => setPage(index + 1)} variant={page === index + 1 ? "default" : "outline"} className={cn("h-9 w-9 p-0", page === index + 1 ? "bg-violet-600 text-white" : "border-slate-700 bg-slate-900 text-slate-200")}>
                {index + 1}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-3xl border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Adım Adım Kullanım</DialogTitle>
            <DialogDescription className="text-slate-400">İş ilanları ekranını hızlı ve doğru kullanmak için kısa rehber.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["İlan listesine göz atın", "İlanlar en yeniden eskiye doğru sıralanır. Yenile butonuyla güncel kayıtları çekebilir, sayfalama ile diğer ilanlara geçebilirsiniz."],
              ["Arama ve şehir filtresiyle daraltın", "İlan içeriğinde arama yapabilir, Tüm İller menüsünden şehir seçebilir ve filtreleri tek tıkla temizleyebilirsiniz."],
              ["İlan sahibiyle iletişime geçin", "Telefon ve e-posta bilgileri tıklanabilir. Başvuru doğrudan ilan sahibiyle yapılır; yorumlar admin onayından sonra görünür."],
              ["Ücretsiz ilan yayınlayın", "Ücretsiz İlan Ver butonuyla ilanınızı gönderin. İlanlar admin onayından sonra yayınlanır."],
              ["Bildirimleri takip edin", "Zil simgesinden platform duyurularını görebilir, okunmamış duyuruları otomatik okunduya çevirebilirsiniz."],
            ].map(([title, body], index) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-sm font-black">{index + 1}</div>
                <div>
                  <h3 className="font-black text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ücretsiz İlan Ver</DialogTitle>
            <DialogDescription className="text-slate-400">İlanınız admin onayından sonra yayınlanır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>İlan Başlığı</Label>
              <Input value={newPost.title} onChange={(event) => setNewPost((current) => ({ ...current, title: event.target.value }))} className="mt-1 border-slate-700 bg-slate-900 text-white" placeholder="Örn. C Sınıfı İş Güvenliği Uzmanı aranıyor" />
            </div>
            <div>
              <Label>Şehir</Label>
              <Select value={newPost.city} onValueChange={(value) => setNewPost((current) => ({ ...current, city: value }))}>
                <SelectTrigger className="mt-1 border-slate-700 bg-slate-900 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[90] border-slate-700 bg-slate-950 text-white">
                  {allCities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>İlan Metni</Label>
              <Textarea value={newPost.content} onChange={(event) => setNewPost((current) => ({ ...current, content: event.target.value }))} className="mt-1 min-h-44 border-slate-700 bg-slate-900 text-white" placeholder="Pozisyon, çalışma şekli, şehir ve iletişim bilgilerini net yazın." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={newPost.contactPhone} onChange={(event) => setNewPost((current) => ({ ...current, contactPhone: event.target.value }))} className="border-slate-700 bg-slate-900 text-white" placeholder="Telefon (opsiyonel)" />
              <Input value={newPost.contactEmail} onChange={(event) => setNewPost((current) => ({ ...current, contactEmail: event.target.value }))} className="border-slate-700 bg-slate-900 text-white" placeholder="E-posta (opsiyonel)" />
            </div>
            <Button onClick={submitPost} disabled={submitting} className="w-full bg-emerald-600 text-white hover:bg-emerald-500">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Gönder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(commentDialogPost)} onOpenChange={(open) => !open && setCommentDialogPost(null)}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yorumlar</DialogTitle>
            <DialogDescription className="text-slate-400">{commentDialogPost?.title}</DialogDescription>
          </DialogHeader>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-2">
            {(commentDialogPost ? comments[commentDialogPost.id] || [] : []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">Henüz onaylı yorum yok.</p>
            ) : (
              (commentDialogPost ? comments[commentDialogPost.id] || [] : []).map((comment) => (
                <div key={comment.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    <span>{comment.author_name}</span>
                    <span>•</span>
                    <span>{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{comment.comment}</p>
                </div>
              ))
            )}
          </div>
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <Textarea value={newComment.comment} onChange={(event) => setNewComment((current) => ({ ...current, comment: event.target.value }))} className="min-h-24 border-slate-700 bg-slate-900 text-white" placeholder="Yorumunuzu yazın..." />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={newComment.anonymous} onChange={(event) => setNewComment((current) => ({ ...current, anonymous: event.target.checked }))} />
              Anonim paylaş
            </label>
            <Button onClick={submitComment} disabled={submitting} className="w-full bg-violet-600 text-white hover:bg-violet-500">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Yorumu Onaya Gönder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Platform Bildirimleri</DialogTitle>
            <DialogDescription className="text-slate-400">İş ilanları ve platform duyuruları.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {announcements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">Henüz bildirim yok.</p>
            ) : (
              announcements.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.message}</p>
                    </div>
                    {!readAnnouncementIds.includes(item.id) ? <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
