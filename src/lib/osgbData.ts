import { supabase } from "@/integrations/supabase/client";
import {
  listIsgkatipCompanies,
  listIsgkatipComplianceFlags,
  listIsgkatipPredictiveAlerts,
} from "@/domain/isgkatip/isgkatipQueries";
import { listOsgbCompanyTrackingWorkspace } from "@/lib/osgbPlatform";

export interface OsgbCompanyRecord {
  id: string;
  sgkNo: string;
  companyName: string;
  employeeCount: number;
  hazardClass: string;
  assignedMinutes: number;
  requiredMinutes: number;
  complianceStatus: string;
  riskScore: number;
  contractStart: string | null;
  contractEnd: string | null;
  assignedPersonName: string | null;
  serviceProviderName: string | null;
  naceCode: string | null;
  workPeriod: string | null;
  lastSyncedAt: string | null;
}

export interface OsgbFlagRecord {
  id: string;
  companyId: string | null;
  ruleName: string;
  severity: string;
  message: string;
  createdAt: string | null;
  status: string;
}

export interface OsgbAlertRecord {
  id: string;
  companyId: string | null;
  alertType: string;
  severity: string;
  message: string;
  predictedDate: string | null;
  confidenceScore: number | null;
  status: string;
  createdAt: string | null;
}

export interface OsgbExpertLoad {
  expertName: string;
  companyCount: number;
  totalAssignedMinutes: number;
  totalRequiredMinutes: number;
  totalEmployees: number;
  averageRiskScore: number;
  overloaded: boolean;
}

export interface OsgbDashboardSummary {
  totalCompanies: number;
  totalEmployees: number;
  criticalCompanies: number;
  warningCompanies: number;
  compliantCompanies: number;
  expiringContracts: number;
  expiredContracts: number;
  openFlags: number;
  openAlerts: number;
  averageRiskScore: number;
  coverageRate: number;
}

export interface OsgbDashboardData {
  summary: OsgbDashboardSummary;
  companies: OsgbCompanyRecord[];
  flags: OsgbFlagRecord[];
  alerts: OsgbAlertRecord[];
  expertLoads: OsgbExpertLoad[];
}

export interface OsgbDashboardCatalogData {
  summary: OsgbDashboardSummary;
  expertLoads: OsgbExpertLoad[];
  latestSyncDate: string | null;
  latestContractDate: string | null;
  latestFlagDate: string | null;
  latestAlertDate: string | null;
}

const normalizeCompany = (row: any): OsgbCompanyRecord => ({
  id: row.id,
  sgkNo: row.sgk_no,
  companyName: row.company_name,
  employeeCount: row.employee_count || 0,
  hazardClass: row.hazard_class || "Bilinmiyor",
  assignedMinutes: row.assigned_minutes || 0,
  requiredMinutes: row.required_minutes || 0,
  complianceStatus: row.compliance_status || "UNKNOWN",
  riskScore: row.risk_score || 0,
  contractStart: row.contract_start || null,
  contractEnd: row.contract_end || null,
  assignedPersonName: row.assigned_person_name || null,
  serviceProviderName: row.service_provider_name || null,
  naceCode: row.nace_code || null,
  workPeriod: row.work_period || null,
  lastSyncedAt: row.last_synced_at || null,
});

const normalizeFlag = (row: any): OsgbFlagRecord => ({
  id: row.id,
  companyId: row.company_id,
  ruleName: row.rule_name,
  severity: row.severity,
  message: row.message,
  createdAt: row.created_at || null,
  status: row.status,
});

const normalizeAlert = (row: any): OsgbAlertRecord => ({
  id: row.id,
  companyId: row.company_id,
  alertType: row.alert_type,
  severity: row.severity,
  message: row.message,
  predictedDate: row.predicted_date || null,
  confidenceScore: row.confidence_score || null,
  status: row.status,
  createdAt: row.created_at || null,
});

const deriveCompanyComplianceStatus = (item: {
  assignmentApprovalStatus: string;
  totalAssignedMinutes: number;
  totalRequiredMinutes: number;
}) => {
  if (item.totalAssignedMinutes <= 0) return "UNKNOWN";
  if (item.totalAssignedMinutes < item.totalRequiredMinutes) return "WARNING";
  if (item.assignmentApprovalStatus === "approved") return "COMPLIANT";
  return "WARNING";
};

const deriveCompanyRiskScore = (item: {
  employeeCount: number;
  totalAssignedMinutes: number;
  totalRequiredMinutes: number;
}) => {
  if (item.totalRequiredMinutes <= 0) return 0;
  const gapRatio = Math.max(0, item.totalRequiredMinutes - item.totalAssignedMinutes) / item.totalRequiredMinutes;
  const employeePressure = Math.min(20, Math.round(item.employeeCount / 10));
  return Math.min(100, Math.round(gapRatio * 80) + employeePressure);
};

const daysUntil = (dateValue: string | null) => {
  if (!dateValue) return null;
  const today = new Date();
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const calculateSummary = (
  companies: OsgbCompanyRecord[],
  flags: OsgbFlagRecord[],
  alerts: OsgbAlertRecord[],
): OsgbDashboardSummary => {
  const totalCompanies = companies.length;
  const totalEmployees = companies.reduce((sum, company) => sum + company.employeeCount, 0);
  const criticalCompanies = companies.filter((company) => company.complianceStatus === "CRITICAL" || company.riskScore >= 70).length;
  const warningCompanies = companies.filter((company) => company.complianceStatus === "WARNING").length;
  const compliantCompanies = companies.filter((company) => company.complianceStatus === "COMPLIANT").length;
  const expiringContracts = companies.filter((company) => {
    const remaining = daysUntil(company.contractEnd);
    return remaining !== null && remaining >= 0 && remaining <= 30;
  }).length;
  const expiredContracts = companies.filter((company) => {
    const remaining = daysUntil(company.contractEnd);
    return remaining !== null && remaining < 0;
  }).length;
  const openFlags = flags.filter((flag) => flag.status === "OPEN").length;
  const openAlerts = alerts.filter((alert) => alert.status === "OPEN").length;
  const averageRiskScore = totalCompanies
    ? Math.round(companies.reduce((sum, company) => sum + company.riskScore, 0) / totalCompanies)
    : 0;
  const totalRequiredMinutes = companies.reduce((sum, company) => sum + company.requiredMinutes, 0);
  const totalAssignedMinutes = companies.reduce((sum, company) => sum + company.assignedMinutes, 0);
  const coverageRate = totalRequiredMinutes > 0 ? Math.round((totalAssignedMinutes / totalRequiredMinutes) * 100) : 0;

  return {
    totalCompanies,
    totalEmployees,
    criticalCompanies,
    warningCompanies,
    compliantCompanies,
    expiringContracts,
    expiredContracts,
    openFlags,
    openAlerts,
    averageRiskScore,
    coverageRate,
  };
};

const calculateExpertLoads = (companies: OsgbCompanyRecord[]): OsgbExpertLoad[] => {
  const expertMap = new Map<string, OsgbExpertLoad>();

  companies.forEach((company) => {
    const expertName = company.assignedPersonName || "Atanmamış";
    const current = expertMap.get(expertName) || {
      expertName,
      companyCount: 0,
      totalAssignedMinutes: 0,
      totalRequiredMinutes: 0,
      totalEmployees: 0,
      averageRiskScore: 0,
      overloaded: false,
    };

    current.companyCount += 1;
    current.totalAssignedMinutes += company.assignedMinutes;
    current.totalRequiredMinutes += company.requiredMinutes;
    current.totalEmployees += company.employeeCount;
    current.averageRiskScore += company.riskScore;

    expertMap.set(expertName, current);
  });

  return Array.from(expertMap.values())
    .map((expert) => ({
      ...expert,
      averageRiskScore: expert.companyCount ? Math.round(expert.averageRiskScore / expert.companyCount) : 0,
      overloaded: expert.totalAssignedMinutes < expert.totalRequiredMinutes,
    }))
    .sort((left, right) => {
      if (left.overloaded !== right.overloaded) {
        return left.overloaded ? -1 : 1;
      }
      return right.totalEmployees - left.totalEmployees;
    });
};

export const getOsgbDashboardData = async (orgId: string): Promise<OsgbDashboardData> => {
  const [workspace, flagsResponse, alertsResponse] = await Promise.all([
    listOsgbCompanyTrackingWorkspace(orgId),
    listIsgkatipComplianceFlags({
      organizationId: orgId,
      select: "*",
      status: "OPEN",
    }),
    listIsgkatipPredictiveAlerts({
      organizationId: orgId,
      select: "*",
      status: "OPEN",
    }),
  ]);

  const managedCompanyIds = new Set(workspace.companies.map((item) => item.id));

  const companies = workspace.companies.map((item) =>
    normalizeCompany({
      id: item.id,
      sgk_no: item.sgkNo,
      company_name: item.companyName,
      employee_count: item.employeeCount,
      hazard_class: item.hazardClass,
      assigned_minutes: item.totalAssignedMinutes,
      required_minutes: item.totalRequiredMinutes,
      compliance_status: deriveCompanyComplianceStatus(item),
      risk_score: deriveCompanyRiskScore(item),
      contract_start: item.contractStart,
      contract_end: item.contractEnd,
      assigned_person_name: item.contactName,
      service_provider_name: null,
      nace_code: null,
      work_period: null,
      last_synced_at: item.managedAt,
    }),
  );
  const flags = (flagsResponse || [])
    .filter((row: any) => !row.company_id || managedCompanyIds.has(row.company_id))
    .map(normalizeFlag);
  const alerts = (alertsResponse || [])
    .filter((row: any) => !row.company_id || managedCompanyIds.has(row.company_id))
    .map(normalizeAlert);

  return {
    summary: calculateSummary(companies, flags, alerts),
    companies,
    flags,
    alerts,
    expertLoads: calculateExpertLoads(companies),
  };
};

export const getOsgbDashboardCatalogData = async (orgId: string): Promise<OsgbDashboardCatalogData> => {
  const [workspace, flagsResponse, alertsResponse] = await Promise.all([
    listOsgbCompanyTrackingWorkspace(orgId),
    listIsgkatipComplianceFlags({
      organizationId: orgId,
      select: "company_id, created_at",
      status: "OPEN",
    }),
    listIsgkatipPredictiveAlerts({
      organizationId: orgId,
      select: "company_id, created_at",
      status: "OPEN",
    }),
  ]);

  const managedCompanyIds = new Set(workspace.companies.map((item) => item.id));

  const companies = workspace.companies.map((item) =>
    normalizeCompany({
      id: item.id,
      employee_count: item.employeeCount,
      assigned_minutes: item.totalAssignedMinutes,
      required_minutes: item.totalRequiredMinutes,
      compliance_status: deriveCompanyComplianceStatus(item),
      risk_score: deriveCompanyRiskScore(item),
      contract_end: item.contractEnd,
      assigned_person_name: item.contactName,
      last_synced_at: item.managedAt,
      sgk_no: null,
      company_name: item.companyName,
      hazard_class: item.hazardClass,
      contract_start: item.contractStart,
      service_provider_name: null,
      nace_code: null,
      work_period: null,
    }),
  );

  const flags = (flagsResponse ?? [])
    .filter((row: any) => !row.company_id || managedCompanyIds.has(row.company_id))
    .map((row: any) =>
    normalizeFlag({
      ...row,
      id: "",
      company_id: null,
      rule_name: "",
      severity: "",
      message: "",
      status: "OPEN",
    }));

  const alerts = (alertsResponse ?? [])
    .filter((row: any) => !row.company_id || managedCompanyIds.has(row.company_id))
    .map((row: any) =>
    normalizeAlert({
      ...row,
      id: "",
      company_id: null,
      alert_type: "",
      severity: "",
      message: "",
      predicted_date: null,
      confidence_score: null,
      status: "OPEN",
    }));

  return {
    summary: calculateSummary(companies, flags, alerts),
    expertLoads: calculateExpertLoads(companies),
    latestSyncDate: companies
      .map((company) => company.lastSyncedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right as string).getTime() - new Date(left as string).getTime())[0] || null,
    latestContractDate: companies
      .map((company) => company.contractEnd)
      .filter(Boolean)
      .sort((left, right) => new Date(left as string).getTime() - new Date(right as string).getTime())[0] || null,
    latestFlagDate: flags[0]?.createdAt || null,
    latestAlertDate: alerts[0]?.createdAt || null,
  };
};
