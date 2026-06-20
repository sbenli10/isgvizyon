import { Download, FileClock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface AssignmentHistoryItem {
  id: string;
  companyName: string;
  employeeName: string;
  assignmentTypeLabel: string;
  createdAt: string;
}

interface AssignmentHistoryTableProps {
  items: AssignmentHistoryItem[];
  onDownload: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AssignmentHistoryTable({ items, onDownload, onEdit, onDelete }: AssignmentHistoryTableProps) {
  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-xl shadow-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-950">
      <CardHeader className="border-b border-slate-200/80 bg-slate-50/80 pb-4 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-700 dark:text-blue-200">
              <FileClock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-950 dark:text-white">Belge Geçmişi</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Oluşturulan belgeleri indirin, düzenleyin veya arşivden temizleyin.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
            {items.length} kayıt
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200/80 bg-white hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-950">
                <TableHead className="min-w-[220px] text-xs font-black uppercase tracking-wider text-slate-500">Firma</TableHead>
                <TableHead className="min-w-[180px] text-xs font-black uppercase tracking-wider text-slate-500">Personel</TableHead>
                <TableHead className="min-w-[240px] text-xs font-black uppercase tracking-wider text-slate-500">Belge Türü</TableHead>
                <TableHead className="min-w-[140px] text-xs font-black uppercase tracking-wider text-slate-500">Tarih</TableHead>
                <TableHead className="min-w-[280px] text-right text-xs font-black uppercase tracking-wider text-slate-500">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      <FileClock className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-950 dark:text-white">Henüz belge oluşturulmadı</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      İlk formu oluşturduğunuzda geçmiş listesi burada görünecek.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="border-slate-200/70 transition hover:bg-cyan-50/40 dark:border-slate-800 dark:hover:bg-slate-900/70">
                    <TableCell>
                      <p className="font-bold text-slate-950 dark:text-white">{item.companyName || "-"}</p>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">{item.employeeName || "-"}</TableCell>
                    <TableCell>
                      <Badge className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-200">
                        {item.assignmentTypeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">{item.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => onEdit(item.id)}>
                          <Pencil className="h-4 w-4" />
                          Düzenle
                        </Button>
                        <Button size="sm" className="gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500" onClick={() => onDownload(item.id)}>
                          <Download className="h-4 w-4" />
                          Word İndir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-xl border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
