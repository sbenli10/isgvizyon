// src/components/adep/ADEPTeamsTab.tsx

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Users, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  company_id?: string;
}

interface Team {
  id: string;
  team_name: string;
  team_leader_id: string | null;
  members: string[];
  team_leader?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string;
  };
}

interface ADEPTeamsTabProps {
  planId: string | undefined;
}

const STANDARD_TEAMS = [
  { name: "Yangın Söndürme Ekibi", icon: "🔥" },
  { name: "İlk Yardım Ekibi", icon: "🚑" },
  { name: "Arama Kurtarma Ekibi", icon: "⛑️" },
  { name: "Güvenlik Ekibi", icon: "🛡️" },
];

export default function ADEPTeamsTab({ planId }: ADEPTeamsTabProps) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  const [teamForm, setTeamForm] = useState({
    team_name: "",
    team_leader_id: "",
  });

  useEffect(() => {
    if (planId) {
      fetchTeams();
    }
    fetchEmployees();
  }, [planId]);

  const fetchEmployees = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, job_title, department, company_id")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;

      // User'ın şirketlerinin çalışanlarını filtrele
      const { data: companies } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id);

      const companyIds = companies?.map(c => c.id) || [];
      const filteredEmployees = data?.filter(e => companyIds.includes(e.company_id || "")) || [];

      setEmployees(filteredEmployees);
    } catch (error: any) {
      console.error("Employees fetch error:", error);
    }
  };

  const fetchTeams = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_teams")
        .select(`
          *,
          team_leader:employees!team_leader_id(id, first_name, last_name, job_title)
        `)
        .eq("plan_id", planId)
        .order("created_at");

      if (error) throw error;

      // ✅ Type conversion: Json -> string[]
      const typedTeams: Team[] = (data || []).map(team => ({
        id: team.id,
        team_name: team.team_name,
        team_leader_id: team.team_leader_id,
        members: Array.isArray(team.members) 
          ? (team.members as string[])
          : [],
        team_leader: team.team_leader ? {
          id: team.team_leader.id,
          first_name: team.team_leader.first_name,
          last_name: team.team_leader.last_name,
          job_title: team.team_leader.job_title,
        } : undefined,
      }));

      setTeams(typedTeams);
    } catch (error: any) {
      console.error("Teams fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({
        team_name: team.team_name,
        team_leader_id: team.team_leader_id || "",
      });
      setSelectedEmployees(team.members || []);
    } else {
      setEditingTeam(null);
      setTeamForm({
        team_name: "",
        team_leader_id: "",
      });
      setSelectedEmployees([]);
    }
    setDialogOpen(true);
  };

  const saveTeam = async () => {
    if (!planId || !teamForm.team_name) {
      toast.error("Ekip adı zorunludur");
      return;
    }

    try {
      const teamData = {
        plan_id: planId,
        team_name: teamForm.team_name,
        team_leader_id: teamForm.team_leader_id || null,
        members: selectedEmployees,
      };

      if (editingTeam) {
        // Update
        const { error } = await supabase
          .from("adep_teams")
          .update(teamData)
          .eq("id", editingTeam.id);

        if (error) throw error;
        toast.success("Ekip güncellendi");
      } else {
        // Create
        const { error } = await supabase
          .from("adep_teams")
          .insert([teamData]);

        if (error) throw error;
        toast.success("Ekip oluşturuldu");
      }

      setDialogOpen(false);
      fetchTeams();
    } catch (error: any) {
      console.error("Save team error:", error);
      toast.error("Kaydetme hatası: " + error.message);
    }
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Bu ekibi silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_teams")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Ekip silindi");
      fetchTeams();
    } catch (error: any) {
      toast.error("Silme hatası: " + error.message);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : "Bilinmeyen";
  };

  if (!planId) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Ekip oluşturmak için önce planı kaydedin
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
          <h3 className="text-lg font-semibold">Acil Durum Ekipleri</h3>
          <p className="text-sm text-muted-foreground">
            İşyerinizin acil durum ekiplerini oluşturun ve yönetin
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Yeni Ekip
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? "Ekibi Düzenle" : "Yeni Ekip Oluştur"}
              </DialogTitle>
              <DialogDescription>
                Ekip adı, lider ve üyeleri belirleyin
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Ekip Adı */}
              <div className="space-y-2">
                <Label htmlFor="team_name">Ekip Adı *</Label>
                <Input
                  id="team_name"
                  value={teamForm.team_name}
                  onChange={(e) =>
                    setTeamForm({ ...teamForm, team_name: e.target.value })
                  }
                  placeholder="Örn: Yangın Söndürme Ekibi"
                />
              </div>

              {/* Standart Ekipler */}
              <div className="flex flex-wrap gap-2">
                {STANDARD_TEAMS.map((team) => (
                  <Badge
                    key={team.name}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setTeamForm({ ...teamForm, team_name: team.name })}
                  >
                    {team.icon} {team.name}
                  </Badge>
                ))}
              </div>

              {/* Ekip Lideri */}
              <div className="space-y-2">
                <Label htmlFor="team_leader">Ekip Lideri</Label>
                <Select
                  value={teamForm.team_leader_id}
                  onValueChange={(value) =>
                    setTeamForm({ ...teamForm, team_leader_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ekip lideri seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} - {employee.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ekip Üyeleri */}
              <div className="space-y-2">
                <Label>Ekip Üyeleri ({selectedEmployees.length})</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Henüz çalışan kaydı bulunmuyor
                    </p>
                  ) : (
                    employees.map((employee) => (
                      <div
                        key={employee.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedEmployees.includes(employee.id)
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => toggleEmployeeSelection(employee.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employee.job_title} - {employee.department}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={saveTeam}>Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams List */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Henüz ekip oluşturulmadı</p>
              <p className="text-sm mb-6">
                İlk acil durum ekibinizi oluşturun
              </p>
              <Button onClick={() => openDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                İlk Ekibi Oluştur
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{team.team_name}</CardTitle>
                    <CardDescription>
                      {team.members?.length || 0} üye
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(team)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTeam(team.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Ekip Lideri */}
                {team.team_leader_id && team.team_leader && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ekip Lideri</p>
                      <p className="font-medium">
                        {team.team_leader.first_name} {team.team_leader.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {team.team_leader.job_title}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ekip Üyeleri */}
                {team.members && team.members.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Ekip Üyeleri:</p>
                    <div className="space-y-1">
                      {team.members.map((memberId) => (
                        <div
                          key={memberId}
                          className="flex items-center gap-2 text-sm p-2 bg-muted rounded"
                        >
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                          <span>{getEmployeeName(memberId)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}