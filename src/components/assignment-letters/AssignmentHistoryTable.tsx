import { Download, Pencil, Trash2 } from "lucide-react";
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
    <Card className="border-slate-700/70 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-slate-100">Belge Geçmişi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firma</TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Atama Türü</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="w-[260px] text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Henüz oluşturulmuş atama yazısı bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.companyName}</TableCell>
                    <TableCell>{item.employeeName}</TableCell>
                    <TableCell>{item.assignmentTypeLabel}</TableCell>
                    <TableCell>{item.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(item.id)}>
                          <Pencil className="h-4 w-4" />
                          Düzenle
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => onDownload(item.id)}>
                          <Download className="h-4 w-4" />
                          PDF İndir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
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
