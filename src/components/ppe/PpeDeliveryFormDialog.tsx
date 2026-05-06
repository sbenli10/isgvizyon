import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Plus, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/types/companies";
import type { PpeEmployeeOption, PpeInventoryRecord } from "@/lib/ppeOperations";

export interface PpeDeliverySelectionItem {
  key: string;
  itemName: string;
  category: string;
  quantity: string;
  selected: boolean;
}

export interface PpeDeliveryFormState {
  companyMode: "system" | "manual";
  companyId: string;
  manualCompanyName: string;
  employeeMode: "system" | "manual";
  employeeId: string;
  manualEmployeeName: string;
  manualEmployeeTc: string;
  manualEmployeeJobTitle: string;
  deliveryDate: string;
  periodicControlDate: string;
  delivererName: string;
  delivererTc: string;
  delivererJobTitle: string;
  selectedItems: PpeDeliverySelectionItem[];
  manualItemName: string;
  manualItemQuantity: string;
}

interface PpeDeliveryFormDialogProps {
  open: boolean;
  saving: boolean;
  companies: Company[];
  employees: PpeEmployeeOption[];
  inventory: PpeInventoryRecord[];
  value: PpeDeliveryFormState;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<PpeDeliveryFormState>) => void;
  onToggleItem: (key: string, checked: boolean) => void;
  onChangeItemQuantity: (key: string, quantity: string) => void;
  onAddManualItem: () => void;
  onSubmit: () => void;
}

export function PpeDeliveryFormDialog({
  open,
  saving,
  companies,
  employees,
  inventory,
  value,
  onOpenChange,
  onValueChange,
  onToggleItem,
  onChangeItemQuantity,
  onAddManualItem,
  onSubmit,
}: PpeDeliveryFormDialogProps) {
  const [inventorySearch, setInventorySearch] = useState("");

  const filteredEmployees = useMemo(() => {
    if (value.employeeMode !== "system" || value.companyMode !== "system" || !value.companyId) {
      return [];
    }

    return employees.filter((employee) => employee.companyId === value.companyId);
  }, [employees, value.companyId, value.companyMode, value.employeeMode]);

  const groupedInventory = useMemo(() => {
    const filtered = inventory.filter((item) => {
      const term = inventorySearch.trim().toLocaleLowerCase("tr-TR");
      if (!term) return item.is_active;
      return item.is_active && `${item.item_name} ${item.category}`.toLocaleLowerCase("tr-TR").includes(term);
    });

    return filtered.reduce<Record<string, PpeInventoryRecord[]>>((acc, item) => {
      const groupKey = item.category || "Diğer";
      acc[groupKey] = [...(acc[groupKey] || []), item];
      return acc;
    }, {});
  }, [inventory, inventorySearch]);

  const selectedCount = value.selectedItems.filter((item) => item.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader className="space-y-4">
          <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 p-5 shadow-[0_20px_60px_rgba(79,70,229,0.35)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-left text-2xl font-bold text-white">KKD Zimmet Formu</DialogTitle>
                  <DialogDescription className="text-left text-slate-100/85">
                    Kişisel koruyucu donanım teslim belgesini sistemden seçerek veya manuel girerek hazırlayın.
                  </DialogDescription>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
                <p className="text-slate-200">Seçili ekipman</p>
                <p className="text-lg font-semibold text-white">{selectedCount} kalem</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="rounded-t-3xl bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white">1. Firma Bilgileri</div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center gap-3">
                  <Label>Manuel firma girişi</Label>
                  <Switch
                    checked={value.companyMode === "manual"}
                    onCheckedChange={(checked) =>
                      onValueChange({
                        companyMode: checked ? "manual" : "system",
                        companyId: checked ? "" : value.companyId,
                      })
                    }
                  />
                </div>
                {value.companyMode === "manual" ? (
                  <Input
                    value={value.manualCompanyName}
                    onChange={(event) => onValueChange({ manualCompanyName: event.target.value })}
                    placeholder="Firma adını manuel girin"
                  />
                ) : (
                  <Select value={value.companyId || undefined} onValueChange={(selected) => onValueChange({ companyId: selected, employeeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sistemde kayıtlı firma seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Teslim tarihi</Label>
                <Input type="date" value={value.deliveryDate} onChange={(event) => onValueChange({ deliveryDate: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-3 lg:max-w-xs">
                <Label>Periyodik kontrol tarihi</Label>
                <Input
                  type="date"
                  value={value.periodicControlDate}
                  onChange={(event) => onValueChange({ periodicControlDate: event.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="rounded-t-3xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white">2. Çalışan Seçimi</div>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Label>Manuel çalışan girişi</Label>
                <Switch
                  checked={value.employeeMode === "manual"}
                  onCheckedChange={(checked) =>
                    onValueChange({
                      employeeMode: checked ? "manual" : "system",
                      employeeId: checked ? "" : value.employeeId,
                    })
                  }
                />
              </div>

              {value.employeeMode === "manual" ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Ad Soyad</Label>
                    <Input value={value.manualEmployeeName} onChange={(event) => onValueChange({ manualEmployeeName: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>TC Kimlik No</Label>
                    <Input value={value.manualEmployeeTc} onChange={(event) => onValueChange({ manualEmployeeTc: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Departman / Görev</Label>
                    <Input value={value.manualEmployeeJobTitle} onChange={(event) => onValueChange({ manualEmployeeJobTitle: event.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Çalışan Seç</Label>
                  <Select
                    value={value.employeeId || undefined}
                    onValueChange={(selected) => onValueChange({ employeeId: selected })}
                    disabled={!value.companyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={value.companyId ? "Çalışan seçin" : "Önce firma seçin veya manuel moda geçin"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.fullName} {employee.jobTitle ? `• ${employee.jobTitle}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="rounded-t-3xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white">3. KKD Seçimi</div>
            <div className="space-y-4 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">Toplam {inventory.length} ürün</Badge>
                  <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-300">Seçili {selectedCount} ürün</Badge>
                </div>
                <Input
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder="KKD veya kategori ara"
                  className="lg:max-w-sm"
                />
              </div>

              <Accordion type="multiple" defaultValue={Object.keys(groupedInventory)} className="space-y-3">
                {Object.entries(groupedInventory).map(([category, items]) => (
                  <AccordionItem key={category} value={category} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">{category}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">{items.length} ürün</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {items.map((item) => {
                          const selectedItem = value.selectedItems.find((entry) => entry.key === item.id);
                          return (
                            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={Boolean(selectedItem?.selected)}
                                  onCheckedChange={(checked) => onToggleItem(item.id, checked === true)}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-white">{item.item_name}</p>
                                  <p className="mt-1 text-xs text-slate-400">{item.standard_code || "Standart kodu yok"}</p>
                                  <div className="mt-3 flex items-center gap-2">
                                    <Label className="text-xs text-slate-400">Adet</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={selectedItem?.quantity || "1"}
                                      onChange={(event) => onChangeItemQuantity(item.id, event.target.value)}
                                      className="h-9 max-w-[110px]"
                                      disabled={!selectedItem?.selected}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
                <p className="mb-3 text-sm font-medium text-white">Manuel KKD ekle</p>
                <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                  <Input
                    value={value.manualItemName}
                    onChange={(event) => onValueChange({ manualItemName: event.target.value })}
                    placeholder="Örn: Baret / Kulaklık"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={value.manualItemQuantity}
                    onChange={(event) => onValueChange({ manualItemQuantity: event.target.value })}
                    placeholder="Adet"
                  />
                  <Button type="button" variant="outline" onClick={onAddManualItem}>
                    <Plus className="h-4 w-4" />
                    Ekle
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="rounded-t-3xl bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white">4. Teslim Bilgileri</div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Teslim eden adı soyadı</Label>
                <Input value={value.delivererName} onChange={(event) => onValueChange({ delivererName: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teslim eden TC</Label>
                <Input value={value.delivererTc} onChange={(event) => onValueChange({ delivererTc: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teslim eden görevi</Label>
                <Input value={value.delivererJobTitle} onChange={(event) => onValueChange({ delivererJobTitle: event.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Word Çıktısı Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
