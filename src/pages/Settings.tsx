import { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  CreditCard,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Trash2,
  Download,
  LogOut,
  Smartphone,
  Monitor,
  Laptop,
  AlertCircle,
  RefreshCw,
  Crown,
  CheckCircle,
  Clock,
  Upload,
  ImagePlus,
  Bot,
  Activity,
  KeyRound,
  UserPlus,
  Copy,
  Link as LinkIcon,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { backfillMyFeatureUsage } from "@/lib/billing";
import { terminateSession, recordSession } from "@/utils/sessionManager";
import type { BillingHistory, UserSession } from "@/types/subscription";
import { TwoFactorSetupModal } from '@/components/TwoFactorSetupModal';
import { untrustDevice } from '@/utils/deviceFingerprint';
import type { Database } from "@/integrations/supabase/types";

type TabType = "general" | "security" | "billing" | "notifications" | "ai-health";
type AiFunctionLog = Database["public"]["Tables"]["ai_function_logs"]["Row"];

interface ProfileData {
  id: string;
  stamp_url: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  role: string;
  organization_id: string | null;
  two_factor_enabled: boolean;
  two_factor_method: string | null;
}

interface OrganizationData {
  id: string;
  name: string;
  industry: string;
  country: string;
  city: string;
  phone: string;
  website: string;
}

interface OrganizationInviteSummary {
  invite_id: string;
  organization_id: string;
  organization_name: string;
  code: string;
  note: string | null;
  is_active: boolean;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

interface PendingJoinRequestSummary {
  request_id: string;
  organization_id: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_position: string | null;
  status: string;
  message: string | null;
  created_at: string;
}

const getSettingsCacheKey = (userId: string) => `denetron:settings:${userId}`;

export default function Settings() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const {
    status,
    plan,
    plans,
    entitlements,
    daysLeftInTrial,
    isTrialExpired,
    isOrganizationAdmin,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    features,
  } = useSubscription();

  const [currentTab, setCurrentTab] = useState<TabType>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [syncingUsage, setSyncingUsage] = useState(false);
  const [currentFactorId, setCurrentFactorId] = useState<string | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const stampInputRef = useRef<HTMLInputElement | null>(null);

  // Yardımcı state tanımlamaları
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<{
    qr_code: string;
    secret: string;
    uri: string;
  } | null>(null);
  // Profile data
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    position: "",
    department: "",
  });

  const [orgFormData, setOrgFormData] = useState({
    name: "",
    industry: "",
    city: "",
    phone: "",
    website: "",
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    capaAlerts: true,
    riskAlerts: true,
    weeklyReport: true,
    systemUpdates: false,
  });

  // Sessions & Billing
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [aiFunctionLogs, setAiFunctionLogs] = useState<AiFunctionLog[]>([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [animatedSecurityScore, setAnimatedSecurityScore] = useState(0);
  const [organizationInvites, setOrganizationInvites] = useState<OrganizationInviteSummary[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingJoinRequestSummary[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [reviewingJoinRequestId, setReviewingJoinRequestId] = useState<string | null>(null);
  const [deactivatingInviteId, setDeactivatingInviteId] = useState<string | null>(null);
  const [regeneratingInviteId, setRegeneratingInviteId] = useState<string | null>(null);

useEffect(() => {
  if (user) {
    const cached = sessionStorage.getItem(getSettingsCacheKey(user.id));
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setProfileData(parsed.profileData ?? null);
        setOrganizationData(parsed.organizationData ?? null);
        setFormData(
          parsed.formData ?? {
            fullName: "",
            phone: "",
            position: "",
            department: "",
          }
        );
        setOrgFormData(
          parsed.orgFormData ?? {
            name: "",
            industry: "",
            city: "",
            phone: "",
            website: "",
          }
        );
        setNotifications(
          parsed.notifications ?? {
            emailNotifications: true,
            capaAlerts: true,
            riskAlerts: true,
            weeklyReport: true,
            systemUpdates: false,
          }
        );
        setSessions(parsed.sessions ?? []);
        setBillingHistory(parsed.billingHistory ?? []);
        setAiFunctionLogs(parsed.aiFunctionLogs ?? []);
        setTwoFactorEnabled(parsed.twoFactorEnabled ?? false);
        setTrustedDevices(parsed.trustedDevices ?? []);
        setLoading(false);
      } catch {
        sessionStorage.removeItem(getSettingsCacheKey(user.id));
      }
    }

    void fetchSettingsData(Boolean(cached));
    
    // Session bilgisini yalnızca ilk render'da kaydet
    const sessionRecorded = sessionStorage.getItem('session_recorded');
    if (!sessionRecorded) {
      recordSession(user.id);
      sessionStorage.setItem('session_recorded', 'true');
    }
  }
}, [user]);
  

  const fetchSettingsData = async (silent = false) => {
    if (!user) return;

    if (!silent) {
      setLoading(true);
    }
    try {
      console.log("?? Fetching settings data...");
      let loadedOrganizationData: OrganizationData | null = null;
      let typedSessions: UserSession[] = [];
      let typedBilling: BillingHistory[] = [];
      let typedAiLogs: AiFunctionLog[] = [];

      // Profil verisini çek
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const { data: trustedDevicesData } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });

      if (trustedDevicesData) {
        setTrustedDevices(trustedDevicesData);
      }

      setProfileData(profileData as ProfileData);
      setTwoFactorEnabled(profileData.two_factor_enabled || false);
      setFormData({
        fullName: profileData.full_name || "",
        phone: profileData.phone || "",
        position: profileData.position || "",
        department: profileData.department || "",
      });

      // Organizasyon verisini çek
      if (profileData.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profileData.organization_id)
          .single();

        if (!orgError && orgData) {
          loadedOrganizationData = orgData as OrganizationData;
          setOrganizationData(orgData as OrganizationData);
          setOrgFormData({
            name: orgData.name || "",
            industry: orgData.industry || "",
            city: orgData.city || "",
            phone: orgData.phone || "",
            website: orgData.website || "",
          });
        }
      }

      if (profileData.organization_id && profileData.role?.toLowerCase() === "admin") {
        const [{ data: inviteData, error: inviteError }, { data: joinRequestData, error: joinRequestError }] = await Promise.all([
          (supabase as any).rpc("list_my_organization_invites"),
          (supabase as any).rpc("list_organization_join_requests"),
        ]);

        if (!inviteError) {
          setOrganizationInvites((inviteData || []) as OrganizationInviteSummary[]);
        }

        if (!joinRequestError) {
          setPendingJoinRequests((joinRequestData || []) as PendingJoinRequestSummary[]);
        }
      } else {
        setOrganizationInvites([]);
        setPendingJoinRequests([]);
      }

      // Oturum kayıtlarını çek
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_activity", { ascending: false })
        .limit(10);

      if (!sessionsError && sessionsData) {
        // Type cast to UserSession[]
        typedSessions = sessionsData.map((session) => ({
          id: session.id,
          user_id: session.user_id,
          device_name: session.device_name,
          device_type: session.device_type as 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web',
          browser: session.browser,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          last_activity: session.last_activity,
          created_at: session.created_at,
          is_current: session.is_current,
        }));
        setSessions(typedSessions);
      }

      // Fatura geçmişini çek
      const { data: billingData, error: billingError } = await supabase
        .from("billing_history")
        .select("*")
        .eq("user_id", user.id)
        .order("billing_date", { ascending: false })
        .limit(10);

      if (!billingError && billingData) {
        // Type cast to BillingHistory[]
        typedBilling = billingData.map((bill) => ({
          id: bill.id,
          user_id: bill.user_id,
          plan_name: bill.plan_name,
          amount: bill.amount,
          currency: bill.currency,
          status: bill.status as 'paid' | 'pending' | 'failed' | 'refunded',
          invoice_url: bill.invoice_url,
          billing_date: bill.billing_date,
          period_start: bill.period_start,
          period_end: bill.period_end,
          payment_method: bill.payment_method,
        }));
        setBillingHistory(typedBilling);
      }

      const { data: aiLogData, error: aiLogError } = await supabase
        .from("ai_function_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);

      if (!aiLogError && aiLogData) {
        typedAiLogs = aiLogData;
        setAiFunctionLogs(aiLogData);
      }

      // Bildirim tercihlerini localStorage'dan yükle
      const savedNotifications = localStorage.getItem("userNotifications");
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }

      sessionStorage.setItem(
        getSettingsCacheKey(user.id),
        JSON.stringify({
          profileData,
          organizationData: loadedOrganizationData,
          formData: {
            fullName: profileData.full_name || "",
            phone: profileData.phone || "",
            position: profileData.position || "",
            department: profileData.department || "",
          },
          orgFormData: {
            name: loadedOrganizationData?.name || "",
            industry: loadedOrganizationData?.industry || "",
            city: loadedOrganizationData?.city || "",
            phone: loadedOrganizationData?.phone || "",
            website: loadedOrganizationData?.website || "",
          },
          notifications: savedNotifications ? JSON.parse(savedNotifications) : notifications,
          sessions: typedSessions ?? [],
          billingHistory: typedBilling ?? [],
          aiFunctionLogs: typedAiLogs ?? [],
          twoFactorEnabled: profileData.two_factor_enabled || false,
          trustedDevices: trustedDevicesData ?? [],
        })
      );

      console.log("Settings data loaded");
      toast.success("Ayarlar yüklendi");
    } catch (err: any) {
      console.error("Settings error:", err);
      toast.error("Ayarlar yüklenemedi", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Profil bilgilerini kaydet
  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName.trim(),
          phone: formData.phone.trim() || null,
          position: formData.position.trim() || null,
          department: formData.department.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              full_name: formData.fullName,
              phone: formData.phone,
              position: formData.position,
              department: formData.department,
            }
          : null
      );

      toast.success("Profil bilgileri kaydedildi", {
        description: "Değişiklikler başarıyla uygulandı",
      });
    } catch (err: any) {
      console.error("Profile save error:", err);
      toast.error("Kayıt başarısız", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Yalnızca görsel dosyaları yüklenebilir");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kaşe görseli 5MB'ı aşamaz");
      return;
    }

    setUploadingStamp(true);
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `stamps/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dof-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dof-images").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stamp_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfileData((prev) => (prev ? { ...prev, stamp_url: urlData.publicUrl } : prev));
      toast.success("İSG uzmanı kaşesi güncellendi");
    } catch (err: any) {
      console.error("Stamp upload error:", err);
      toast.error("Kaşe yüklenemedi", {
        description: err.message,
      });
    } finally {
      setUploadingStamp(false);
      if (stampInputRef.current) {
        stampInputRef.current.value = "";
      }
    }
  };

  const handleRemoveStamp = async () => {
    if (!user) return;

    setUploadingStamp(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          stamp_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfileData((prev) => (prev ? { ...prev, stamp_url: null } : prev));
      toast.success("Kaşe kaldırıldı");
    } catch (err: any) {
      console.error("Remove stamp error:", err);
      toast.error("Kaşe kaldırılamadı", {
        description: err.message,
      });
    } finally {
      setUploadingStamp(false);
    }
  };
  // Organizasyon bilgilerini kaydet
  const handleSaveOrganization = async () => {
    if (!organizationData) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgFormData.name.trim(),
          industry: orgFormData.industry.trim() || null,
          city: orgFormData.city.trim() || null,
          phone: orgFormData.phone.trim() || null,
          website: orgFormData.website.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationData.id);

      if (error) throw error;

      toast.success("Şirket bilgileri kaydedildi", {
        description: "Organizasyon ayarları güncellendi",
      });
    } catch (err: any) {
      console.error("Organization save error:", err);
      toast.error("Kayıt başarısız", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // ? CHANGE PASSWORD
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Lütfen parolaları girin");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Parolalar eşleşmiyor");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Parola en az 6 karakter olmalıdır");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Parola başarıyla güncellendi", {
        description: "Yeni parolanızla giriş yapabilirsiniz",
      });
    } catch (err: any) {
      console.error("Password change error:", err);
      toast.error("Parola güncellenemedi", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

// 2FA ana akışı
const handleToggle2FA = async (enabled: boolean) => {
  if (!user) return;

  setSaving(true);
  try {
    if (enabled) {
      // Mevcut factor'leri kontrol et
      const { data: existingFactors, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) {
        console.error("List factors error:", listError);
        throw listError;
      }

      console.log("Existing factors:", existingFactors);
      console.log("ALL factors:", existingFactors?.all);

      // ? 2. Verified TOTP factor varsa, kullaniciya bilgi ver
      if (existingFactors && existingFactors.all && existingFactors.all.length > 0) {
        const verifiedTotpFactors = existingFactors.all.filter(
          (factor: any) => 
            factor.factor_type === 'totp' && 
            factor.status === 'verified'
        );

        if (verifiedTotpFactors.length > 0) {
          console.log("Found verified TOTP factors:", verifiedTotpFactors.length);
          
          // Zaten aktif 2FA var
          await supabase
            .from('profiles')
            .update({
              two_factor_enabled: true,
              two_factor_method: 'totp',
            })
            .eq('id', user.id);

          setTwoFactorEnabled(true);
          
          toast.info("2FA zaten aktif", {
            description: "Yeniden kurmak için önce kapatın",
          });
          
          setSaving(false);
          return;
        }

        // ? 3. Unverified factor'leri temizle
        const unverifiedFactors = existingFactors.all.filter(
          (factor: any) => factor.status !== 'verified'
        );

        if (unverifiedFactors.length > 0) {
          console.log('??? Cleaning unverified factors:', unverifiedFactors.length);
          
          for (const factor of unverifiedFactors) {
            try {
              console.log('??? Removing unverified factor:', factor.id);
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
              console.log('? Factor removed:', factor.id);
            } catch (unenrollErr: any) {
              console.error('?? Failed to remove factor:', factor.id, unenrollErr);
            }
          }
          
          // Supabase'in senkronize olması için kısa süre bekle
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // ? 4. Yeni TOTP factor olustur
      console.log("Creating new TOTP factor...");
      
      // Unique friendly name (timestamp + random)
      const uniqueFriendlyName = `ISGVIZYON-${user.email?.split('@')[0] || 'User'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('?? Friendly name:', uniqueFriendlyName);

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: uniqueFriendlyName,
      });

      if (enrollError) {
        console.error("Enroll error:", enrollError);
        throw enrollError;
      }

      if (enrollData && enrollData.totp) {
        console.log("TOTP factor created:", enrollData);
        console.log("Factor ID:", enrollData.id);
        
        // ? Factor ID'yi kaydet
        setCurrentFactorId(enrollData.id);
        
        // QR Code verilerini sakla
        const qrData = {
          qr_code: enrollData.totp.qr_code,
          secret: enrollData.totp.secret,
          uri: enrollData.totp.uri,
        };
        
        console.log('?? Setting QR data:', qrData);
        console.log('?? Setting Factor ID:', enrollData.id);
        
        setQRCodeData(qrData);
        setShow2FASetupModal(true);

        toast.info("2FA kurulumu başlatıldı", {
          description: "Google Authenticator ile QR kodunu tarayın",
          duration: 5000,
        });
      } else {
        throw new Error('TOTP data bulunamadi');
      }
    } else {
      // DISABLE 2FA - tüm factor'leri temizle
      console.log('?? Disabling 2FA...');
      
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) {
        console.error('? List factors error:', listError);
        throw listError;
      }
      
      console.log('?? Factors to remove:', factors?.all?.length || 0);

      // ALL array'inden tüm factor'leri sil
      if (factors && factors.all && factors.all.length > 0) {
        for (const factor of factors.all) {
          try {
            console.log('??? Removing factor:', factor.id, factor.friendly_name);
            
            await supabase.auth.mfa.unenroll({
              factorId: factor.id,
            });
            
            console.log('? Factor removed:', factor.id);
          } catch (unenrollErr: any) {
            console.error('?? Failed to remove factor:', factor.id, unenrollErr);
            // Devam et, diger factor'leri de dene
          }
        }
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_method: null,
        })
        .eq('id', user.id);

      setTwoFactorEnabled(false);
      
      toast.success("İki faktörlü doğrulama kapatıldı", {
        description: "Tüm 2FA ayarları temizlendi",
      });
    }
  } catch (err: any) {
    console.error('? 2FA toggle error:', err);
    
    let errorMessage = 'Islem basarisiz';
    let errorDescription = err.message || 'Bilinmeyen hata';

    // Specific error messages
    if (err.message?.includes('already exists')) {
      errorMessage = "2FA çakışması tespit edildi";
      errorDescription = "Lütfen \"2FA'yı Sıfırla\" butonunu kullanın veya sayfayı yenileyin";
    } else if (err.message?.includes('not found')) {
      errorMessage = 'Factor bulunamadi';
      errorDescription = 'Sayfayi yenileyip tekrar deneyin';
    } else if (err.message?.includes('TOTP data')) {
      errorMessage = 'QR kod olusturulamadi';
      errorDescription = "Lütfen sayfayı yenileyip tekrar deneyin";
    }

    toast.error(`${errorMessage}`, {
      description: errorDescription,
      duration: 5000,
    });
  } finally {
    setSaving(false);
  }
};

// 2FA'yı zorla sıfırla
const handleForceReset2FA = async () => {
  if (!user) return;
  
  if (!confirm("Mevcut 2FA ayarlarınız silinecek. Devam edilsin mi?")) {
    return;
  }

  setSaving(true);
  try {
    console.log('?? Force resetting 2FA...');
    
    // Get all factors
    const { data: factors } = await supabase.auth.mfa.listFactors();
    
    // Remove ALL factors (even unverified)
    if (factors && factors.all) {
      for (const factor of factors.all) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
          console.log('? Removed factor:', factor.id);
        } catch (err) {
          console.error('Failed to remove factor:', factor.id, err);
        }
      }
    }

    // Reset profile
    await supabase
      .from('profiles')
      .update({
        two_factor_enabled: false,
        two_factor_method: null,
      })
      .eq('id', user.id);

    setTwoFactorEnabled(false);
    
    toast.success("2FA tamamen sıfırlandı", {
      description: "Şimdi yeniden kurulum yapabilirsiniz",
    });
    
    // Refresh page
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (err: any) {
    console.error('Force reset error:', err);
    toast.error("Sıfırlama başarısız");
  } finally {
    setSaving(false);
  }
};
  // SAVE NOTIFICATIONS
  const handleSaveNotifications = () => {
    localStorage.setItem("userNotifications", JSON.stringify(notifications));
    toast.success("Bildirim tercihleri kaydedildi");
  };

  // TERMINATE SESSION
  const handleTerminateSession = async (sessionId: string) => {
    const success = await terminateSession(sessionId);

    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Oturum sonlandırıldı", {
        description: "Cihaz bağlantısı kesildi",
      });
    } else {
      toast.error("Oturum sonlandırılamadı");
    }
  };

  // FORCE CLEAN - Tüm factor'leri temizle (debug için)
  const handleForceCleanFactors = async () => {
    if (!user) return;

    const confirmed = confirm(
      "UYARI: Tüm 2FA ayarlarınız silinecek!\n\n" +
      "Bu işlem:\n" +
      "• Tüm factor'leri siler\n" +
      "• 2FA'yı tamamen devre dışı bırakır\n" +
      "• Sayfayı yeniler\n\n" +
      "Devam etmek istiyor musunuz?"
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      console.log("FORCE CLEANING ALL FACTORS...");

      const { data: factors } = await supabase.auth.mfa.listFactors();
      console.log("Total factors found:", factors?.all?.length || 0);

      if (factors?.all) {
        console.log(
          "Deleting factors:",
          factors.all.map((factor: any) => ({
            id: factor.id,
            name: factor.friendly_name,
            type: factor.factor_type,
            status: factor.status,
          }))
        );

        for (const factor of factors.all) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
            console.log("Deleted:", factor.id);
          } catch (err) {
            console.error("Failed to delete:", factor.id, err);
          }
        }
      }

      await supabase
        .from("profiles")
        .update({
          two_factor_enabled: false,
          two_factor_method: null,
        })
        .eq("id", user.id);

      toast.success("Tüm 2FA ayarları temizlendi", {
        description: "Sayfa yenileniyor...",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Force clean error:", err);
      toast.error("Temizleme başarısız", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // LOGOUT
  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  // DOWNLOAD DATA
  const handleDownloadData = () => {
    const data = {
      profile: profileData,
      organization: organizationData,
      subscription: { status, plan, features },
      downloadedAt: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `denetron-data-${new Date().toISOString().split("T")[0]}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    toast.success("Veriler indirildi", {
        description: "JSON dosyası bilgisayarınıza kaydedildi",
    });
  };

  // DELETE ACCOUNT
  const handleDeleteAccount = () => {
    if (
      confirm(
        "Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem GERİ ALINAMAZ!"
      )
    ) {
      toast.error("Hesap silme talebi alındı", {
        description: "Destek ekibimiz en kısa sürede sizinle iletişime geçecek",
        duration: 8000,
      });
    }
  };

  const handleCreateOrganizationInvite = async () => {
    if (!profileData?.organization_id) return;

    setCreatingInvite(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_organization_invite", {
        p_expires_in_days: 7,
        p_max_uses: 1,
        p_note: "Profil ekranından davet akışı",
      });

      if (error) throw error;

      const createdInvite = Array.isArray(data) ? data[0] : null;
      if (createdInvite) {
        setOrganizationInvites((prev) => [createdInvite as OrganizationInviteSummary, ...prev].slice(0, 10));
      }

      toast.success("Davet kodu oluşturuldu", {
        description: createdInvite?.code
          ? `${createdInvite.code} kodu ekibinizle paylaşılabilir.`
          : "Yeni katılım kodu hazır.",
      });
    } catch (err: any) {
      toast.error("Davet kodu oluşturulamadı", {
        description: err.message,
      });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Davet kodu kopyalandı");
    } catch {
      toast.error("Davet kodu kopyalanamadı");
    }
  };

  const buildInviteLink = (code: string) => {
    const url = new URL("/profile", window.location.origin);
    url.searchParams.set("join", "1");
    url.searchParams.set("invite", code);
    return url.toString();
  };

  const handleCopyInviteLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(code));
      toast.success("Davet linki kopyalandı");
    } catch {
      toast.error("Davet linki kopyalanamadı");
    }
  };

  const handleShareInviteOnWhatsApp = (code: string) => {
    const inviteLink = buildInviteLink(code);
    const message = `ISG Vizyon organizasyon davetiniz hazir. Bu linkten girip davet kodunu otomatik doldurabilirsiniz: ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleDeactivateInvite = async (inviteId: string) => {
    setDeactivatingInviteId(inviteId);
    try {
      const { error } = await (supabase as any).rpc("deactivate_organization_invite", {
        p_invite_id: inviteId,
      });

      if (error) throw error;

      setOrganizationInvites((prev) =>
        prev.map((invite) => (invite.invite_id === inviteId ? { ...invite, is_active: false } : invite))
      );

      toast.success("Davet kodu pasifleştirildi");
    } catch (err: any) {
      toast.error("Davet kodu pasifleştirilemedi", {
        description: err.message,
      });
    } finally {
      setDeactivatingInviteId(null);
    }
  };

  const handleRegenerateInvite = async (inviteId: string) => {
    setRegeneratingInviteId(inviteId);
    try {
      const { data, error } = await (supabase as any).rpc("regenerate_organization_invite", {
        p_invite_id: inviteId,
        p_expires_in_days: 7,
        p_max_uses: 1,
      });

      if (error) throw error;

      const regeneratedInvite = Array.isArray(data) ? data[0] : null;
      if (regeneratedInvite) {
        setOrganizationInvites((prev) => {
          const next = prev.map((invite) =>
            invite.invite_id === inviteId ? { ...invite, is_active: false } : invite
          );
          return [regeneratedInvite as OrganizationInviteSummary, ...next].slice(0, 10);
        });
      }

      toast.success("Davet kodu yenilendi", {
        description: regeneratedInvite?.code
          ? `Yeni kod hazır: ${regeneratedInvite.code}`
          : "Yeni davet kodu oluşturuldu.",
      });
    } catch (err: any) {
      toast.error("Davet kodu yenilenemedi", {
        description: err.message,
      });
    } finally {
      setRegeneratingInviteId(null);
    }
  };

  const handleReviewJoinRequest = async (requestId: string, decision: "approved" | "rejected") => {
    setReviewingJoinRequestId(requestId);
    try {
      const { error } = await (supabase as any).rpc("review_organization_join_request", {
        p_request_id: requestId,
        p_decision: decision,
      });

      if (error) throw error;

      setPendingJoinRequests((prev) => prev.filter((item) => item.request_id !== requestId));
      toast.success(decision === "approved" ? "Katılım isteği onaylandı" : "Katılım isteği reddedildi");
    } catch (err: any) {
      toast.error("İstek işlenemedi", {
        description: err.message,
      });
    } finally {
      setReviewingJoinRequestId(null);
    }
  };

  const handleSyncUsage = async () => {
    if (!isOrganizationAdmin) {
      toast.error("Bu işlemi yalnızca organizasyon yöneticisi çalıştırabilir.");
      return;
    }

    setSyncingUsage(true);
    try {
      await backfillMyFeatureUsage();
      toast.success("Kullanım sayaçları güncellendi", {
        description: "Mevcut kayıtlarınız plan limitleriyle eşitlendi.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kullanım özeti senkronize edilemedi.";
      toast.error("Senkronizasyon başarısız", {
        description: message,
      });
    } finally {
      setSyncingUsage(false);
    }
  };

  const tabs = [
    {
      id: "general" as const,
      label: "Genel",
      icon: <SettingsIcon className="h-4 w-4" />,
      badgeCount: pendingJoinRequests.length > 0 ? pendingJoinRequests.length : undefined,
    },
    { id: "security" as const, label: "Güvenlik", icon: <Shield className="h-4 w-4" /> },
    { id: "billing" as const, label: "Faturalama", icon: <CreditCard className="h-4 w-4" /> },
    { id: "notifications" as const, label: "Bildirimler", icon: <Bell className="h-4 w-4" /> },
    { id: "ai-health" as const, label: "AI Sağlık", icon: <Bot className="h-4 w-4" /> },
  ];

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "windows":
      case "linux":
        return <Monitor className="h-5 w-5 text-blue-400" />;
      case "macos":
        return <Laptop className="h-5 w-5 text-gray-400" />;
      case "android":
      case "ios":
        return <Smartphone className="h-5 w-5 text-green-400" />;
      default:
        return <Monitor className="h-5 w-5 text-slate-400" />;
    }
  };

  const subscriptionLabel =
    status === "premium"
      ? "Premium üyelik aktif"
      : status === "trial"
        ? `Deneme sürümü · ${daysLeftInTrial} gün kaldı`
        : "Temel plan";

  const subscriptionTone =
    status === "premium"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : status === "trial" && !isTrialExpired
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : "border-rose-400/20 bg-rose-400/10 text-rose-100";

  const premiumInputClassName =
    "h-11 rounded-2xl border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus-visible:border-cyan-400/40 focus-visible:ring-2 focus-visible:ring-cyan-400/20";
  const premiumOutlineButtonClassName =
    "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white";
  const premiumPrimaryButtonClassName =
    "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_14px_30px_rgba(34,211,238,0.18)] hover:from-fuchsia-500 hover:to-cyan-400";
  const premiumGhostButtonClassName =
    "text-slate-200 hover:bg-white/10 hover:text-white";
  const microCardEyebrowClassName =
    "text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400";
  const microCardTitleClassName = "mt-2 text-xl font-semibold text-white";
  const microCardBodyClassName = "mt-2 text-sm text-slate-300";

  const securityRiskLevel = !twoFactorEnabled
    ? "Yüksek"
    : trustedDevices.length >= 5
      ? "Orta"
      : "Düşük";

  const securityRiskTone =
    securityRiskLevel === "Yüksek"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
      : securityRiskLevel === "Orta"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";

  const securityRecommendedAction = !twoFactorEnabled
    ? "Google Authenticator kurulumu tamamlanmalı ve en az bir güvenilir cihaz doğrulanmalı."
    : trustedDevices.length >= 5
      ? "Güvenilir cihaz listesini gözden geçirip artık kullanılmayan cihazları kaldırın."
      : "Mevcut koruma dengeli görünüyor. Parola rotasyonu ve oturum kontrolünü sürdürün.";

  const enabledFeatureCount = entitlements.filter((item) => item.isEnabled).length;
  const premiumPlan = plans.find((item) => item.planCode === "premium");
  const monthlyPlanPrice = premiumPlan?.price ?? 250;
  const yearlyPlanPrice = Math.round(monthlyPlanPrice * 10);
  const yearlyEquivalent = monthlyPlanPrice * 12;
  const yearlySavingsPercent = Math.round(((yearlyEquivalent - yearlyPlanPrice) / yearlyEquivalent) * 100);

  const securityScore = Math.max(
    24,
    Math.min(
      100,
      (twoFactorEnabled ? 58 : 24) +
        Math.min(trustedDevices.length, 3) * 9 +
        Math.min(sessions.length, 4) * 4
    )
  );

  const usageSummary = [
    {
      label: "Açık özellik",
      value: `${enabledFeatureCount}+`,
      detail: "Planınızla erişebildiğiniz modül ve premium araç sayısı.",
    },
    {
      label: "Aktif durum",
      value: status === "premium" ? "Tam erişim" : status === "trial" ? "Deneme" : "Temel",
      detail: "Hesabınızın güncel kullanım kapsamı.",
    },
    {
      label: "Fatura kaydı",
      value: `${billingHistory.length}`,
      detail: "Arşivlenen ödeme veya fatura hareketi.",
    },
    {
      label: "Firma limiti",
      value: features.maxCompanies === null ? "Sınırsız" : `${features.maxCompanies}`,
      detail: "Planınızla oluşturabileceğiniz toplam firma sayısı.",
    },
  ];

  const aiSuccessCount = aiFunctionLogs.filter((log) => log.status === "success").length;
  const aiErrorCount = aiFunctionLogs.filter((log) => log.status === "error").length;
  const aiFallbackCount = aiFunctionLogs.filter((log) => (log.attempted_models?.length || 0) > 1).length;
  const latestAiLog = aiFunctionLogs[0] ?? null;
  const aiHealthTone =
    aiErrorCount === 0
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : aiErrorCount <= Math.max(1, Math.round(aiFunctionLogs.length * 0.2))
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : "border-rose-400/20 bg-rose-400/10 text-rose-100";

  const handleRefreshAiLogs = async () => {
    await fetchSettingsData(true);
    toast.success("AI sağlık verileri yenilendi");
  };

  useEffect(() => {
    const duration = 700;
    const stepMs = 16;
    const steps = Math.max(1, Math.round(duration / stepMs));
    const increment = securityScore / steps;
    let current = 0;

    setAnimatedSecurityScore(0);

    const interval = window.setInterval(() => {
      current += increment;
      if (current >= securityScore) {
        setAnimatedSecurityScore(securityScore);
        window.clearInterval(interval);
        return;
      }
      setAnimatedSecurityScore(Math.round(current));
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [securityScore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-80 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-48 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
          <div className="space-y-6">
            <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-6 md:p-8 space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(17,24,39,0.84))] shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100">
                <SettingsIcon className="h-3.5 w-3.5" />
                Hesap ve operasyon ayarları
              </div>
              <div className="space-y-3">
                <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner shadow-cyan-500/10">
                    <SettingsIcon className="h-6 w-6 text-cyan-300" />
                  </span>
                  Ayarlar
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Profilinizi, güvenlik tercihlerinizi, bildirim akışınızı ve kurumsal bilgilerinizi
                  tek merkezden yönetin. Bu alan ekip kullanımını daha güvenli ve daha tutarlı
                  hale getirmek için tasarlandı.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${subscriptionTone}`}>
                  {subscriptionLabel}
                </Badge>
                <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {twoFactorEnabled ? "2FA aktif" : "2FA önerilir"}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className={microCardEyebrowClassName}>Plan durumu</p>
                <p className={microCardTitleClassName}>{status === "premium" ? "Premium" : status === "trial" ? "Deneme" : "Temel"}</p>
                <p className={microCardBodyClassName}>
                  {status === "premium"
                    ? "Tüm gelişmiş modüller aktif."
                    : status === "trial"
                      ? `${daysLeftInTrial} gün daha tüm premium özellikler açık.`
                      : "Temel kullanım paketiyle devam ediyorsunuz."}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className={microCardEyebrowClassName}>Güvenlik özeti</p>
                <p className={microCardTitleClassName}>{twoFactorEnabled ? "Koruma açık" : "Ek doğrulama kapalı"}</p>
                <p className={microCardBodyClassName}>
                  {twoFactorEnabled
                    ? `${trustedDevices.length} güvenilir cihaz kayıtlı.`
                    : "Google Authenticator ile hesabınızı ek katmanla koruyabilirsiniz."}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/20 px-6 py-4 md:px-8">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" />
              Ayarlar değişiklikleri hesabınıza anında yansır.
            </div>
            <Button variant="outline" onClick={() => navigate("/profile")} className={premiumOutlineButtonClassName}>
              Geri Dön
            </Button>
          </div>
        </section>

        {status === "trial" && !isTrialExpired && (
          <Card className="border border-amber-400/20 bg-amber-400/10 shadow-[0_16px_40px_rgba(245,158,11,0.08)]">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-50">Deneme sürümü aktif</p>
                  <p className="text-sm text-amber-100/80">{daysLeftInTrial} gün kaldı. Tüm premium özellikler şu anda kullanılabilir.</p>
                </div>
              </div>
              <Button onClick={() => setShowUpgradeModal(true)} className="bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white hover:from-fuchsia-500 hover:to-cyan-400">
                <Crown className="mr-2 h-4 w-4" />
                Paketi Yükselt
              </Button>
            </CardContent>
          </Card>
        )}

        {status === "trial" && isTrialExpired && (
          <Card className="border border-rose-400/20 bg-rose-400/10 shadow-[0_16px_40px_rgba(244,63,94,0.08)]">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-rose-300" />
                <div>
                  <p className="font-semibold text-rose-50">Deneme süresi sona erdi</p>
                  <p className="text-sm text-rose-100/80">Premium modülleri kullanmaya devam etmek için uygun planı seçin.</p>
                </div>
              </div>
              <Button onClick={() => setShowUpgradeModal(true)} className="bg-gradient-to-r from-rose-600 to-orange-500 text-white hover:from-rose-500 hover:to-orange-400">
                Planı Gör
              </Button>
            </CardContent>
          </Card>
        )}

        {status === "premium" && (
          <Card className="border border-emerald-400/20 bg-emerald-400/10 shadow-[0_16px_40px_rgba(16,185,129,0.08)]">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-semibold text-emerald-50">Premium üyelik aktif</p>
                  <p className="text-sm text-emerald-100/80">Tüm gelişmiş özellikler, güvenlik ayarları ve çıktı araçları kullanımda.</p>
                </div>
              </div>
              <Badge className="rounded-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-3 py-1 text-white">
                <Crown className="mr-1 h-3 w-3" />
                Premium plan
              </Badge>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-slate-950/55 shadow-[0_24px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <CardContent className="p-4 md:p-5">
            <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                    currentTab === tab.id
                      ? "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_12px_30px_rgba(34,211,238,0.22)]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badgeCount ? (
                    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-100">
                      {tab.badgeCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Sekme içeriği */}
            <div className="mt-6">
              {/* GENERAL TAB */}
              {currentTab === "general" && (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="mb-5">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Profil merkezi</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">Profil Bilgileri</h2>
                      <p className="mt-1 text-sm text-slate-400">Kişisel iletişim ve görev bilgilerinizi ekip görünürlüğü için güncel tutun.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ad Soyad *</Label>
                        <Input
                          className={premiumInputClassName}
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData({ ...formData, fullName: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-posta</Label>
                        <Input value={profileData?.email || ""} disabled className={premiumInputClassName} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefon</Label>
                        <Input
                          className={premiumInputClassName}
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+90 5XX XXX XX XX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pozisyon</Label>
                        <Input
                          className={premiumInputClassName}
                          value={formData.position}
                          onChange={(e) =>
                            setFormData({ ...formData, position: e.target.value })
                          }
                          placeholder="İSG Uzmanı"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Departman</Label>
                        <Input
                          className={premiumInputClassName}
                          value={formData.department}
                          onChange={(e) =>
                            setFormData({ ...formData, department: e.target.value })
                          }
                          placeholder="İSG Departmanı"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label>İSG Uzmanı Kaşesi</Label>
                      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-indigo-400/30 bg-slate-950/40">
                                {profileData?.stamp_url ? (
                                  <img src={profileData.stamp_url} alt="Kaşe önizleme" className="h-full w-full object-contain p-2" />
                                ) : (
                                  <ImagePlus className="h-8 w-8 text-indigo-300" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">Toplu DÖF, kurul ve resmî çıktı alanlarında kullanılır.</p>
                                <p className="text-sm text-muted-foreground">PNG veya JPG yükleyin. Şeffaf arka planlı PNG en iyi sonucu verir.</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <input ref={stampInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleStampUpload} />
                              <Button type="button" variant="outline" onClick={() => stampInputRef.current?.click()} disabled={uploadingStamp} className={premiumOutlineButtonClassName}>
                                {uploadingStamp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Kaşe Yükle
                              </Button>
                              {profileData?.stamp_url ? (
                                <Button type="button" variant="ghost" onClick={handleRemoveStamp} disabled={uploadingStamp} className="border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Kaldır
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className={`mt-4 ${premiumPrimaryButtonClassName}`}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Kaydediliyor...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Profili Kaydet
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Organization Section */}
                  {organizationData && (
                    <>
                      <div className="h-px bg-border" />
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                        <div className="mb-5">
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-fuchsia-300/80">Kurumsal kimlik</p>
                          <h2 className="mt-2 text-lg font-semibold text-white">Şirket Bilgileri</h2>
                          <p className="mt-1 text-sm text-slate-400">Fatura, çıktı ve rapor üst bilgileri için kullanılan kurumsal verileri yönetin.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Şirket Adı</Label>
                            <Input
                              className={premiumInputClassName}
                              value={orgFormData.name}
                              onChange={(e) =>
                                setOrgFormData({ ...orgFormData, name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Sektör</Label>
                            <Input
                              className={premiumInputClassName}
                              value={orgFormData.industry}
                              onChange={(e) =>
                                setOrgFormData({ ...orgFormData, industry: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Şehir</Label>
                            <Input
                              className={premiumInputClassName}
                              value={orgFormData.city}
                              onChange={(e) =>
                                setOrgFormData({ ...orgFormData, city: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Telefon</Label>
                            <Input
                              className={premiumInputClassName}
                              value={orgFormData.phone}
                              onChange={(e) =>
                                setOrgFormData({ ...orgFormData, phone: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Website</Label>
                            <Input
                              className={premiumInputClassName}
                              value={orgFormData.website}
                              onChange={(e) =>
                                setOrgFormData({ ...orgFormData, website: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleSaveOrganization}
                          disabled={saving}
                          className={`mt-4 ${premiumPrimaryButtonClassName}`}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Kaydediliyor...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Şirket Bilgilerini Kaydet
                            </>
                          )}
                        </Button>
                      </div>

                      {profileData?.role?.toLowerCase() === "admin" ? (
                        <>
                          <div className="h-px bg-border" />
                          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Ekip daveti</p>
                              <h3 className="mt-2 text-lg font-semibold text-white">Davet kodu ile hızlı katılım</h3>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                Google ile giriş yapan uzmanlar bu kodu profile ekranına girerek doğrudan organizasyonunuza bağlanabilir.
                              </p>
                              <Button
                                onClick={handleCreateOrganizationInvite}
                                disabled={creatingInvite}
                                className={`mt-4 ${premiumPrimaryButtonClassName}`}
                              >
                                {creatingInvite ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Kod oluşturuluyor...
                                  </>
                                ) : (
                                  <>
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    Yeni Davet Kodu Oluştur
                                  </>
                                )}
                              </Button>
                              <div className="mt-4 space-y-3">
                                {organizationInvites.length > 0 ? (
                                  organizationInvites.map((invite) => (
                                    <div key={invite.invite_id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                          <p className="text-base font-semibold text-white">{invite.code}</p>
                                          <p className="mt-1 text-xs text-slate-400">
                                            {invite.expires_at
                                              ? `Bitiş: ${new Date(invite.expires_at).toLocaleString("tr-TR")}`
                                              : "Süresiz davet"}{" "}
                                            · {invite.used_count}/{invite.max_uses} kullanım
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge className={invite.is_active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300"}>
                                            {invite.is_active ? "Aktif" : "Pasif"}
                                          </Badge>
                                          <Button type="button" variant="outline" className={premiumOutlineButtonClassName} onClick={() => void handleCopyInviteCode(invite.code)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Kopyala
                                          </Button>
                                          <Button type="button" variant="outline" className={premiumOutlineButtonClassName} onClick={() => void handleCopyInviteLink(invite.code)}>
                                            <LinkIcon className="mr-2 h-4 w-4" />
                                            Link üret
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                                            onClick={() => handleShareInviteOnWhatsApp(invite.code)}
                                          >
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            WhatsApp
                                          </Button>
                                          {invite.is_active ? (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                                              onClick={() => handleDeactivateInvite(invite.invite_id)}
                                              disabled={deactivatingInviteId === invite.invite_id || regeneratingInviteId === invite.invite_id}
                                            >
                                              {deactivatingInviteId === invite.invite_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                              Pasifleştir
                                            </Button>
                                          ) : null}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15"
                                            onClick={() => handleRegenerateInvite(invite.invite_id)}
                                            disabled={regeneratingInviteId === invite.invite_id || deactivatingInviteId === invite.invite_id}
                                          >
                                            {regeneratingInviteId === invite.invite_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            Yeniden üret
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                                    Henüz oluşturulmuş davet kodu yok. İlk kodu üretip ekibinizle paylaşabilirsiniz.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] text-fuchsia-300/80">Katılım istekleri</p>
                              <div className="mt-2 flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-white">Yönetici onayı bekleyen kullanıcılar</h3>
                                <Badge className="border-rose-400/20 bg-rose-500/15 text-rose-100">
                                  {pendingJoinRequests.length} bekleyen
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                Davet kodu kullanmayan uzmanlar liste seçerek size katılım isteği gönderir. Buradan onaylayabilir veya reddedebilirsiniz.
                              </p>
                              <div className="mt-4 space-y-3">
                                {pendingJoinRequests.length > 0 ? (
                                  pendingJoinRequests.map((request) => (
                                    <div key={request.request_id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-1">
                                          <p className="text-base font-semibold text-white">{request.requester_name || "İsimsiz kullanıcı"}</p>
                                          <p className="text-sm text-slate-300">{request.requester_email || "E-posta yok"}</p>
                                          <p className="text-xs text-slate-400">
                                            {[request.requester_position, new Date(request.created_at).toLocaleString("tr-TR")].filter(Boolean).join(" · ")}
                                          </p>
                                          {request.message ? <p className="pt-2 text-sm leading-6 text-slate-300">{request.message}</p> : null}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            type="button"
                                            onClick={() => handleReviewJoinRequest(request.request_id, "approved")}
                                            disabled={reviewingJoinRequestId === request.request_id}
                                            className={premiumPrimaryButtonClassName}
                                          >
                                            {reviewingJoinRequestId === request.request_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                            Onayla
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleReviewJoinRequest(request.request_id, "rejected")}
                                            disabled={reviewingJoinRequestId === request.request_id}
                                            className="border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                                          >
                                            Reddet
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                                    Şu an bekleyen katılım isteği yok.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              )}

              {/* SECURITY TAB */}
              {currentTab === "security" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/10 p-5">
                      <p className={microCardEyebrowClassName}>Güvenlik durumu</p>
                      <p className={microCardTitleClassName}>{twoFactorEnabled ? "Çok katmanlı koruma açık" : "Ek koruma öneriliyor"}</p>
                      <p className={microCardBodyClassName}>{twoFactorEnabled ? "2FA, güvenilir cihazlar ve oturum yönetimi aktif durumda." : "Google Authenticator kurulumu ile hesabınızı daha güçlü koruyabilirsiniz."}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className={microCardEyebrowClassName}>Aktif görünüm</p>
                      <p className={microCardTitleClassName}>{sessions.length} oturum · {trustedDevices.length} güvenilir cihaz</p>
                      <p className={microCardBodyClassName}>Oturumlarınızı kapatın, güvenilir cihaz listesini güncelleyin ve 2FA akışını tek panelden yönetin.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className={`rounded-[24px] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${securityRiskTone}`}>
                      <p className={microCardEyebrowClassName}>Risk seviyesi</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-2xl font-semibold">{securityRiskLevel}</p>
                          <p className="mt-2 text-sm opacity-90">
                            {securityRiskLevel === "Yüksek"
                              ? "2FA kapalı olduğu için hesabınız ek koruma gerektiriyor."
                              : securityRiskLevel === "Orta"
                                ? "Çok sayıda güvenilir cihaz olduğu için periyodik kontrol önerilir."
                                : "Hesap koruması dengeli görünüyor."}
                          </p>
                        </div>
                        <Shield className="h-8 w-8 opacity-80" />
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className={microCardEyebrowClassName}>Önerilen aksiyon</p>
                      <p className="mt-3 text-lg font-semibold text-white">Güvenlik akışını bir sonraki seviyeye taşıyın</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{securityRecommendedAction}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                          {twoFactorEnabled ? "2FA aktif" : "2FA kurulmalı"}
                        </Badge>
                        <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                          {trustedDevices.length} güvenilir cihaz
                        </Badge>
                        <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                          {sessions.length} aktif oturum
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                      <p className={microCardEyebrowClassName}>Güven puanı</p>
                      <div className="mt-4 flex items-center gap-5">
                        <div
                          className="relative flex h-24 w-24 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(${securityScore >= 75 ? "#34d399" : securityScore >= 45 ? "#f59e0b" : "#fb7185"} ${animatedSecurityScore}%, rgba(255,255,255,0.08) ${animatedSecurityScore}% 100%)`,
                          }}
                        >
                          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_62%)] animate-pulse" />
                          <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-slate-950 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div>
                              <p className="text-xl font-semibold text-white">{animatedSecurityScore}</p>
                              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">/100</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Güvenlik görünümü dengesi</p>
                          <p className="text-sm leading-6 text-slate-300">
                            Güven puanı; 2FA kullanımı, güvenilir cihaz sayısı ve aktif oturum yoğunluğuna göre hesaplanır.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                              {twoFactorEnabled ? "2FA katkısı yüksek" : "2FA katkısı yok"}
                            </Badge>
                            <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                              {trustedDevices.length} cihaz etkisi
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                      <p className={microCardEyebrowClassName}>Önerilen güvenlik adımları</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <p className="text-sm font-semibold text-white">2FA</p>
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {twoFactorEnabled ? "Etkin, yeniden kurulum yedeği hazır tutulmalı." : "Öncelikli olarak kurulmalı."}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <p className="text-sm font-semibold text-white">Cihazlar</p>
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {trustedDevices.length > 3 ? "Eski cihazları temizleyin." : "Cihaz listesi kontrollü görünüyor."}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <p className="text-sm font-semibold text-white">Oturumlar</p>
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {sessions.length > 3 ? "Açık oturumları gözden geçirin." : "Oturum yoğunluğu dengeli."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Change Password */}
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="mb-5">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Kimlik doğrulama</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">Parola Değiştir</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Yeni Parola</Label>
                        <div className="relative">
                          <Input
                            className={premiumInputClassName}
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="En az 6 karakter"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                         <Label>Parolayı Onayla</Label>
                        <Input
                          className={premiumInputClassName}
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Tekrar girin"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={saving}
                      className={`mt-4 ${premiumPrimaryButtonClassName}`}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Güncelleniyor...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Parolayı Güncelle
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="mb-5">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/80">Oturum güvenliği</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">Güvenilir Cihazlar</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Bu cihazlardan giriş yaparken 2FA kodu sorulmaz
                    </p>

                    <div className="space-y-3">
                      {trustedDevices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Henüz güvenilir cihaz yok
                        </p>
                      ) : (
                        trustedDevices.map((device) => (
                          <Card key={device.id} className="border-white/10 bg-slate-950/50">
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getDeviceIcon(device.device_type)}
                                <div>
                                  <p className="font-semibold">{device.device_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {device.ip_address} · Son kullanım:{" "}
                                    {new Date(device.last_used_at).toLocaleString("tr-TR")}
                                  </p>
                                  <p className="text-xs text-green-500 mt-1">
                                    Güvenilir · Süresi:{" "}
                                    {new Date(device.expires_at).toLocaleDateString("tr-TR")}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm("Bu cihazı güvenilir listesinden çıkar?")) {
                                    const success = await untrustDevice(device.id);
                                    if (success) {
                                      setTrustedDevices((prev) => prev.filter((d) => d.id !== device.id));
                                      toast.success("Cihaz kaldırıldı");
                                    }
                                  }
                                }}
                                className="border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  {/* 2FA */}
                  <div className="rounded-[24px] border border-purple-400/15 bg-[linear-gradient(180deg,rgba(88,28,135,0.18),rgba(15,23,42,0.35))] p-5 shadow-[0_20px_60px_rgba(88,28,135,0.15)] md:p-6">
                    <div className="mb-5">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-fuchsia-200/80">İleri koruma</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">İki Faktörlü Doğrulama</h2>
                    </div>
                    
                    <Card className="border-white/10 bg-slate-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-5 w-5 text-purple-500" />
                              <p className="font-semibold text-foreground">
                                Google Authenticator ile 2FA
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              Hesabınızı ekstra bir güvenlik katmanı ile koruyun. 
                              Giriş yaparken Google Authenticator'dan alacağınız 6 haneli kodu girmeniz gerekecek.
                            </p>
                            
                            {/* Status Badge */}
                            {twoFactorEnabled ? (
                             <div className="mt-4 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  toast.info("Yedek kodlar özelliği yakında eklenecek");
                                }}
                                className="border-blue-500/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 hover:text-white"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Yedek Kodları İndir
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleForceReset2FA}
                                disabled={saving}
                                className="border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                2FA'yı Sıfırla
                              </Button>
                            </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-3">
                                  <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/20 px-3 py-1.5">
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  <span className="text-sm font-semibold text-yellow-600">
                                     2FA Kapalı
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Hesabınız risk altında olabilir
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Switch */}
                          <div className="flex flex-col items-end gap-2">
                            <Switch
                              checked={twoFactorEnabled}
                              onCheckedChange={handleToggle2FA}
                              disabled={saving}
                              className="data-[state=checked]:bg-green-500"
                            />
                            <span className="text-xs text-muted-foreground">
                               {twoFactorEnabled ? "Açık" : "Kapalı"}
                            </span>
                          </div>
                        </div>

                        {/* Info Box */}
                        {!twoFactorEnabled && (
                          <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                            <div className="flex gap-3">
                              <div className="shrink-0">
                                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                  <Shield className="h-4 w-4 text-blue-500" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground mb-1">
                                  Neden 2FA kullanmalısınız?
                                </p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  <li>Hesabınız çalınsa bile güvende kalırsınız</li>
                                  <li>Şifreniz ele geçse bile giriş yapılamaz</li>
                                  <li>Google Authenticator tamamen ücretsizdir</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Already Enabled - Options */}
                        {twoFactorEnabled && (
                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Show backup codes modal
                                toast.info("Yedek kodlar özelliği yakında eklenecek");
                              }}
                              className="border-blue-500/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 hover:text-white"
                            >
                              <Download className="h-4 w-4 mr-2" />
                               Yedek Kodları İndir
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Re-setup 2FA
                                handleToggle2FA(false);
                                setTimeout(() => handleToggle2FA(true), 500);
                              }}
                              disabled={saving}
                              className="border-purple-500/30 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20 hover:text-white"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Yeniden Kurulum
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* How to Use Guide */}
                    {!twoFactorEnabled && (
                      <Card className="mt-4 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
                        <CardContent className="p-4">
                          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🔐</span>
                            Google Authenticator Kurulumu
                          </p>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex gap-2">
                              <span className="font-bold text-purple-500">1.</span>
                              <p>
                                Google Authenticator uygulamasını telefonunuza indirin 
                                <a 
                                  href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline ml-1"
                                >
                                  (Android)
                                </a>
                                <a 
                                  href="https://apps.apple.com/app/google-authenticator/id388497605" 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline ml-1"
                                >
                                  (iOS)
                                </a>
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-bold text-purple-500">2.</span>
                              <p>Yukarıdaki anahtarı açın ve QR kodu tarayın</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-bold text-purple-500">3.</span>
                              <p>Uygulamadan aldığınız 6 haneli kodu girin</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-bold text-purple-500">4.</span>
                              <p>Tamamlandı! Artık giriş yaparken kod istenecek</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="h-px bg-border" />
                  {/* Active Sessions */}
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold">Aktif Oturumlar</h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const nonCurrentSessions = sessions.filter((s) => !s.is_current);
                          
                          if (nonCurrentSessions.length === 0) {
                            toast.info("Kapatılacak başka oturum yok");
                            return;
                          }

                          const confirmed = confirm(
                            `${nonCurrentSessions.length} oturum kapatılacak. Devam edilsin mi?`
                          );

                          if (!confirmed) return;

                          setSaving(true);
                          let successCount = 0;

                          for (const session of nonCurrentSessions) {
                            const success = await terminateSession(session.id);
                            if (success) successCount++;
                          }

                          setSessions((prev) => prev.filter((s) => s.is_current));

                          toast.success(
                            `${successCount} oturum kapatıldı`,
                            {
                              description: `${nonCurrentSessions.length - successCount} oturum kapatılamadı`,
                            }
                          );

                          setSaving(false);
                          fetchSettingsData(); // Refresh
                        }}
                        disabled={saving || sessions.filter((s) => !s.is_current).length === 0}
                        className={`text-destructive ${premiumOutlineButtonClassName}`}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Diğerlerini Kapat ({sessions.filter((s) => !s.is_current).length})
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Aktif oturum bulunamadı
                        </p>
                      ) : (
                        sessions.map((session) => (
                          <Card key={session.id} className="border-white/10 bg-slate-950/50">
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getDeviceIcon(session.device_type)}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">
                                      {session.device_name}
                                    </p>
                                    {session.is_current && (
                                      <Badge variant="secondary" className="rounded-full bg-cyan-400/15 text-cyan-100">Bu cihaz</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {session.ip_address} ·{" "}
                                    {new Date(session.last_activity).toLocaleString("tr-TR")}
                                  </p>
                                </div>
                              </div>
                              {!session.is_current && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTerminateSession(session.id)}
                                  className="border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                                >
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* BILLING TAB */}
              {currentTab === "billing" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-fuchsia-400/15 bg-fuchsia-400/10 p-5">
                      <p className={microCardEyebrowClassName}>Plan özeti</p>
                      <p className={microCardTitleClassName}>{plan === "premium" ? "Premium plan aktif" : "Free plan aktif"}</p>
                      <p className={microCardBodyClassName}>
                        {status === "trial"
                          ? `${daysLeftInTrial} gün daha tüm premium modüller açık.`
                          : status === "premium"
                            ? cancelAtPeriodEnd
                              ? "Aboneliğiniz dönem sonunda iptale ayarlı, ancak şu an tüm premium araçlar açık."
                              : "Tüm premium araçlar ve yüksek limitler hesabınızda kullanılabilir durumda."
                            : "Yalnızca temel özellikler açık. Yükseltme veya deneme ile limitleri artırabilirsiniz."}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className={microCardEyebrowClassName}>Fatura görünümü</p>
                      <p className={microCardTitleClassName}>{billingHistory.length} kayıt</p>
                      <p className={microCardBodyClassName}>Geçmiş ödeme ve fatura hareketlerini tek merkezden takip edin.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                      <div className="mb-5">
                        <p className={microCardEyebrowClassName}>Aylık / yıllık kıyas</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Ödeme ritmine göre plan görünümü</h2>
                        <p className="mt-1 text-sm text-slate-400">Detaylı modül ve limit karşılaştırması yükseltme ekranında gösterilir.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 shadow-[0_14px_30px_rgba(217,70,239,0.1)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">Aylık plan</p>
                            <div className="flex items-center gap-2">
                              <Badge className="rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-1 text-white">
                                Avantajlı fiyat
                              </Badge>
                              <Badge className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/15 px-3 py-1 text-fuchsia-100">
                                Esnek
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-white">₺{monthlyPlanPrice.toLocaleString("tr-TR")}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">aylık faturalama</p>
                          <ul className="mt-4 space-y-2 text-sm text-slate-300">
                            <li>İstediğiniz zaman yükseltme veya iptal</li>
                            <li>Stripe portalı üzerinden yönetim</li>
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 shadow-[0_14px_30px_rgba(34,211,238,0.1)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">Yıllık plan</p>
                            <div className="flex items-center gap-2">
                              <Badge className="rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1 text-white">En avantajlı</Badge>
                              <Badge className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                                %{yearlySavingsPercent} tasarruf
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-white">₺{yearlyPlanPrice.toLocaleString("tr-TR")}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">yıllık tahmini paket</p>
                          <ul className="mt-4 space-y-2 text-sm text-slate-200">
                            <li>Daha öngörülebilir bütçe planlaması</li>
                            <li>Kurumsal ekipler için güçlü süreklilik</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                        <div className="mb-5">
                          <p className={microCardEyebrowClassName}>Kullanım özeti</p>
                          <h2 className="mt-2 text-lg font-semibold text-white">Hesabınız şu anda ne kullanıyor?</h2>
                        </div>
                        <div className="space-y-3">
                          {usageSummary.map((item) => (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-semibold text-white">{item.value}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                        <div className="mb-5">
                          <p className={microCardEyebrowClassName}>Yükseltme notu</p>
                          <h2 className="mt-2 text-lg font-semibold text-white">Detaylar yükseltme ekranında</h2>
                        </div>
                        <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 p-4">
                          <p className="text-sm font-semibold text-white">
                            {plan === "premium" ? "Premium plan kullanıyorsunuz" : "Yükseltme ekranında tüm farklar listelenir"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Free ve Premium arasındaki modül farkları, AI kotaları, kilitli araçlar ve tüm limitler artık Upgrade modal içinde daha net gösterilir.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                              {enabledFeatureCount}+ aktif avantaj
                            </Badge>
                            <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                              {billingHistory.length} fatura kaydı
                            </Badge>
                            <Badge className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-200">
                              {isOrganizationAdmin ? "Yönetici hesabı" : "Yönetici gerekir"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Current Plan */}
                  <Card className="border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(15,23,42,0.18))] shadow-[0_20px_60px_rgba(34,211,238,0.08)]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold">
                            {plan === 'premium' ? 'Premium Paket' : 'Free Paket'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {status === 'trial'
                              ? `Deneme sürümü · ${daysLeftInTrial} gün kaldı`
                              : status === 'premium'
                              ? cancelAtPeriodEnd && currentPeriodEnd
                                ? `Premium aktif · ${new Date(currentPeriodEnd).toLocaleDateString("tr-TR")} tarihinde kapanacak`
                                : 'Premium üyelik aktif'
                              : 'Temel özellikler'}
                          </p>
                          {plan === 'premium' && (
                            <p className="text-2xl font-bold mt-2">₺{monthlyPlanPrice.toLocaleString("tr-TR")}/ay</p>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => void handleSyncUsage()}
                            disabled={!isOrganizationAdmin || syncingUsage}
                            className={premiumOutlineButtonClassName}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4 ${syncingUsage ? "animate-spin" : ""}`} />
                            Sayaçları senkronize et
                          </Button>
                          <Button
                            onClick={() => setShowUpgradeModal(true)}
                            className={premiumPrimaryButtonClassName}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            {plan === 'premium' ? 'Aboneliği Yönet' : 'Yükselt'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing History */}
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="mb-5">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Finans geçmişi</p>
                      <h2 className="mt-2 text-lg font-semibold text-white">Fatura Geçmişi</h2>
                    </div>
                    <div className="space-y-3">
                      {billingHistory.length === 0 ? (
                        <Card className="border-white/10 bg-slate-950/50">
                          <CardContent className="p-8 text-center">
                            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground">
                              Henüz fatura geçmişiniz yok
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        billingHistory.map((bill) => (
                          <Card key={bill.id} className="border-white/10 bg-slate-950/50">
                            <CardContent className="p-4 flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{bill.plan_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(bill.billing_date).toLocaleDateString("tr-TR")} ·{" "}
                                  {bill.currency} {bill.amount}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    bill.status === "paid" ? "default" : "secondary"
                                  }
                                >
                                  {bill.status === "paid" ? "Ödendi" : bill.status === "failed" ? "Başarısız" : "Bekliyor"}
                                </Badge>
                                {bill.invoice_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-200 hover:bg-white/10 hover:text-white"
                                    onClick={() => window.open(bill.invoice_url!, "_blank", "noopener,noreferrer")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS TAB */}
              {currentTab === "notifications" && (
                <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                  <div className="mb-1">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Bildirim akışı</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Bildirim Tercihleri</h2>
                  </div>
                  {Object.entries(notifications).map(([key, value]) => (
                    <Card key={key} className="border-white/10 bg-slate-950/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {key === "emailNotifications" && "E-posta Bildirimleri"}
                            {key === "capaAlerts" && "CAPA Uyarıları"}
                            {key === "riskAlerts" && "Risk Uyarıları"}
                            {key === "weeklyReport" && "Haftalık Rapor"}
                            {key === "systemUpdates" && "Sistem Güncellemeleri"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {key === "emailNotifications" &&
                              "Yeni denetim raporları için"}
                            {key === "capaAlerts" && "Yüksek riskli bulgular için"}
                            {key === "riskAlerts" && "Kritik risk tespitleri için"}
                            {key === "weeklyReport" && "Haftalık özet raporu"}
                            {key === "systemUpdates" && "Uygulama güncellemeleri"}
                          </p>
                        </div>
                        <Switch
                          checked={value}
                          onCheckedChange={(checked) =>
                            setNotifications({
                              ...notifications,
                              [key]: checked,
                            })
                          }
                        />
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    onClick={handleSaveNotifications}
                    className={premiumPrimaryButtonClassName}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Bildirimleri Kaydet
                  </Button>
                </div>
              )}

              {currentTab === "ai-health" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className={`rounded-[24px] border p-5 ${aiHealthTone}`}>
                      <p className={microCardEyebrowClassName}>Genel durum</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {aiErrorCount === 0 ? "Stabil" : aiErrorCount <= Math.max(1, Math.round(aiFunctionLogs.length * 0.2)) ? "Dikkat" : "Yoğun hata"}
                      </p>
                      <p className={microCardBodyClassName}>Edge function AI akışlarının son görünümü.</p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className={microCardEyebrowClassName}>Başarılı istek</p>
                      <p className="mt-2 text-xl font-semibold text-white">{aiSuccessCount}</p>
                      <p className={microCardBodyClassName}>Son 40 log içinde başarıyla tamamlanan çağrılar.</p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className={microCardEyebrowClassName}>Fallback kullanılan</p>
                      <p className="mt-2 text-xl font-semibold text-white">{aiFallbackCount}</p>
                      <p className={microCardBodyClassName}>Birden fazla modele düşen istek sayısı.</p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className={microCardEyebrowClassName}>Son model</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {latestAiLog?.resolved_model || "Henüz veri yok"}
                      </p>
                      <p className={microCardBodyClassName}>En son çalışan isteğin çözülen modeli.</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Edge function görünürlüğü</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">AI Sağlık ve Model Logları</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Hangi isteğin hangi modele düştüğünü, fallback zincirine girip girmediğini ve hata oranını buradan takip edin.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void handleRefreshAiLogs()}
                        className={premiumOutlineButtonClassName}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Logları Yenile
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {aiFunctionLogs.length === 0 ? (
                        <Card className="border-white/10 bg-slate-950/50">
                          <CardContent className="p-8 text-center">
                            <Activity className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                            <p className="text-sm text-slate-300">Henüz AI log kaydı oluşmadı.</p>
                            <p className="mt-2 text-xs text-slate-500">İlk edge function çağrısından sonra model sağlık verileri burada görünecek.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        aiFunctionLogs.map((log) => {
                          const metadata =
                            log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
                              ? (log.metadata as Record<string, unknown>)
                              : {};
                          const usedFallback = (log.attempted_models?.length || 0) > 1;

                          return (
                            <Card key={log.id} className="border-white/10 bg-slate-950/50">
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className="rounded-full bg-cyan-500/15 text-cyan-100">
                                        {log.function_name}
                                      </Badge>
                                      <Badge
                                        className={`rounded-full ${
                                          log.status === "success"
                                            ? "bg-emerald-500/15 text-emerald-100"
                                            : "bg-rose-500/15 text-rose-100"
                                        }`}
                                      >
                                        {log.status === "success" ? "Başarılı" : "Hata"}
                                      </Badge>
                                      {usedFallback && (
                                        <Badge className="rounded-full bg-amber-500/15 text-amber-100">
                                          Fallback kullanıldı
                                        </Badge>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-white">
                                        {log.request_label || "Adsız istek"}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-400">
                                        {new Date(log.created_at).toLocaleString("tr-TR")} · {log.duration_ms ?? 0} ms
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2 lg:min-w-[360px]">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Çözülen model</p>
                                      <p className="mt-2 font-medium text-white">{log.resolved_model || "-"}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Denenen zincir</p>
                                      <p className="mt-2 font-medium text-white">{(log.attempted_models || []).join(" → ") || "-"}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  <span>Toplam deneme: {log.attempts_count}</span>
                                  {log.error_code && <span>Hata kodu: {log.error_code}</span>}
                                  {typeof metadata.imageCount === "number" && <span>Görsel: {metadata.imageCount}</span>}
                                  {typeof metadata.promptLength === "number" && <span>Prompt: {metadata.promptLength} karakter</span>}
                                  {typeof metadata.hasPrompt === "boolean" && <span>{metadata.hasPrompt ? "Prompt var" : "Prompt yok"}</span>}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tehlikeli işlemler */}
        <Card className="border border-rose-400/20 bg-rose-500/5 shadow-[0_18px_40px_rgba(244,63,94,0.08)]">
          <CardHeader>
            <CardTitle className="text-destructive">Tehlikeli İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleDownloadData}
                variant="outline"
                className={`justify-start ${premiumOutlineButtonClassName}`}
              >
                <Download className="h-4 w-4 mr-2" />
                Verilerinizi İndir
              </Button>
              <Button
                onClick={handleDeleteAccount}
                variant="outline"
                className="justify-start border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hesabı Sil
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/profile")} className={premiumOutlineButtonClassName}>
            Geri Dön
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </div>

      {/* Upgrade modalı */}
    <UpgradeModal
      open={showUpgradeModal}
      onOpenChange={setShowUpgradeModal}
      triggeredBy="manual"
    />
   {/* 2FA kurulum modalı */}
    {qrCodeData && show2FASetupModal && currentFactorId && (
      <TwoFactorSetupModal
        open={show2FASetupModal}
        onOpenChange={setShow2FASetupModal}
        factorId={currentFactorId} // ? YENI PROP
        qrCodeUri={qrCodeData.uri}
        secret={qrCodeData.secret}
        onSuccess={() => {
          console.log("2FA verification successful");
          setTwoFactorEnabled(true);
          setQRCodeData(null);
          setCurrentFactorId(null); // ? Temizle
          fetchSettingsData();
        }}
      />
    )}
    </>
  );
}



