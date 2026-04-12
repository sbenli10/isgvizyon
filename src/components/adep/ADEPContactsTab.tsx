// src/components/adep/ADEPContactsTab.tsx

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Phone, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EmergencyContact {
  id: string;
  institution_name: string;
  phone_number: string;
}

interface ADEPContactsTabProps {
  planId: string | undefined;
}

const STANDARD_CONTACTS = [
  { name: "İTFAİYE", phone: "110", icon: "🚒" },
  { name: "AMBULANS", phone: "112", icon: "🚑" },
  { name: "POLİS", phone: "155", icon: "👮" },
  { name: "JANDARMA", phone: "156", icon: "🎖️" },
  { name: "AFAD", phone: "122", icon: "🆘" },
  { name: "ZEHİRLENME", phone: "114", icon: "☠️" },
  { name: "ORMAN YANGINI", phone: "177", icon: "🌲" },
  { name: "ELEKTRİK ARIZA", phone: "186", icon: "⚡" },
  { name: "DOĞALGAZ ARIZA", phone: "187", icon: "🔥" },
];

export default function ADEPContactsTab({ planId }: ADEPContactsTabProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  
  const [contactForm, setContactForm] = useState({
    institution_name: "",
    phone_number: "",
  });

  useEffect(() => {
    if (planId) {
      fetchContacts();
    }
  }, [planId]);

  const fetchContacts = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_emergency_contacts")
        .select("*")
        .eq("plan_id", planId)
        .order("institution_name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Contacts fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeStandardContacts = async () => {
    if (!planId) return;

    try {
      const contactsData = STANDARD_CONTACTS.map((contact) => ({
        plan_id: planId,
        institution_name: contact.name,
        phone_number: contact.phone,
      }));

      const { error } = await supabase
        .from("adep_emergency_contacts")
        .insert(contactsData);

      if (error) throw error;
      
      toast.success("Standart numaralar eklendi");
      fetchContacts();
    } catch (error: any) {
      toast.error("Hata: " + error.message);
    }
  };

  const openDialog = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        institution_name: contact.institution_name,
        phone_number: contact.phone_number,
      });
    } else {
      setEditingContact(null);
      setContactForm({
        institution_name: "",
        phone_number: "",
      });
    }
    setDialogOpen(true);
  };

  const saveContact = async () => {
    if (!planId || !contactForm.institution_name || !contactForm.phone_number) {
      toast.error("Tüm alanlar zorunludur");
      return;
    }

    try {
      const contactData = {
        plan_id: planId,
        institution_name: contactForm.institution_name,
        phone_number: contactForm.phone_number,
      };

      if (editingContact) {
        // Update
        const { error } = await supabase
          .from("adep_emergency_contacts")
          .update(contactData)
          .eq("id", editingContact.id);

        if (error) throw error;
        toast.success("İletişim güncellendi");
      } else {
        // Create
        const { error } = await supabase
          .from("adep_emergency_contacts")
          .insert([contactData]);

        if (error) throw error;
        toast.success("İletişim eklendi");
      }

      setDialogOpen(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Save contact error:", error);
      toast.error("Kaydetme hatası: " + error.message);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Bu iletişim bilgisini silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_emergency_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("İletişim silindi");
      fetchContacts();
    } catch (error: any) {
      toast.error("Silme hatası: " + error.message);
    }
  };

  if (!planId) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            İletişim bilgileri eklemek için önce planı kaydedin
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">2. İşyeri İçin Belirlenen Acil Durumlar</h3>
          <p className="text-sm text-muted-foreground">
            Acil durum telefon numaralarını ve yerel iletişim bilgilerini yönetin
          </p>
        </div>

        <div className="flex gap-2">
          {contacts.length === 0 && (
            <Button onClick={initializeStandardContacts} variant="outline" className="gap-2">
              <Phone className="h-4 w-4" />
              Standart Numaraları Ekle
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Yeni İletişim
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? "İletişim Düzenle" : "Yeni İletişim Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Acil durum için iletişim bilgisi ekleyin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="institution_name">Kurum/Birim Adı *</Label>
                  <Input
                    id="institution_name"
                    value={contactForm.institution_name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, institution_name: e.target.value })
                    }
                    placeholder="Örn: Yerel Hastane"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Telefon Numarası *</Label>
                  <Input
                    id="phone_number"
                    value={contactForm.phone_number}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone_number: e.target.value })
                    }
                    placeholder="Örn: 0212 123 45 67"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  İptal
                </Button>
                <Button onClick={saveContact}>Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Acil Durum Telefon Rehberi
          </CardTitle>
          <CardDescription>
            Belirlenmiş acil durumlar tabloda işaretlenmiştir
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Henüz iletişim bilgisi eklenmedi</p>
              <p className="text-sm mb-6">
                Standart acil durum numaralarını ekleyin veya manuel oluşturun
              </p>
              <Button onClick={initializeStandardContacts} className="gap-2">
                <Phone className="h-4 w-4" />
                Standart Numaraları Ekle
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">✓</TableHead>
                    <TableHead>YANGIN İHTİMALİ</TableHead>
                    <TableHead className="text-right">Telefon</TableHead>
                    <TableHead className="w-24 text-center">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-bold">x</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {contact.institution_name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {contact.phone_number}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteContact(contact.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Standart Numaralar Reference */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-blue-700 dark:text-blue-400 text-base">
            📱 Standart Acil Durum Numaraları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STANDARD_CONTACTS.map((contact) => (
              <div
                key={contact.name}
                className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border"
              >
                <span className="text-2xl">{contact.icon}</span>
                <div>
                  <p className="font-medium text-sm">{contact.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{contact.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}