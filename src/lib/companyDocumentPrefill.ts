import type { Company } from "@/types/companies";

export type ProfileEmergencyTeamPerson = {
  employeeId: string;
  fullName: string;
  tcNo: string;
};

export type ProfileEmergencyTeamFields = {
  fire: ProfileEmergencyTeamPerson[];
  rescue: ProfileEmergencyTeamPerson[];
  protection: ProfileEmergencyTeamPerson[];
  firstAid: ProfileEmergencyTeamPerson[];
};

export type ProfileCompanyDocumentFields = {
  employer_representative_name?: string | null;
  employer_representative_tc_no?: string | null;
  employer_representative_phone?: string | null;
  occupational_safety_specialist_name?: string | null;
  occupational_safety_specialist_tc_no?: string | null;
  occupational_safety_specialist_phone?: string | null;
  occupational_safety_specialist_certificate_no?: string | null;
  workplace_doctor_name?: string | null;
  workplace_doctor_tc_no?: string | null;
  workplace_doctor_phone?: string | null;
  workplace_doctor_certificate_no?: string | null;
  employee_representative_name?: string | null;
  employee_representative_tc_no?: string | null;
  employee_representative_phone?: string | null;
  knowledgeable_employee_name?: string | null;
  fire_support_person_name?: string | null;
  first_aid_support_person_name?: string | null;
  evacuation_support_person_name?: string | null;
  emergency_team_info?: unknown | null;
};

const clean = (value?: string | null) => (value || "").trim();

const readEmergencyTeamPerson = (value: unknown): ProfileEmergencyTeamPerson => {
  const source = value && typeof value === "object" ? value as { employee_id?: unknown; full_name?: unknown; tc_no?: unknown } : {};
  return {
    employeeId: typeof source.employee_id === "string" ? source.employee_id : "",
    fullName: typeof source.full_name === "string" ? source.full_name.trim() : "",
    tcNo: typeof source.tc_no === "string" ? source.tc_no.trim() : "",
  };
};

const readEmergencyTeam = (info: unknown, key: string, fallbackName?: string | null): ProfileEmergencyTeamPerson[] => {
  const root = info && typeof info === "object" ? info as Record<string, unknown> : {};
  const source = root[key] && typeof root[key] === "object" ? root[key] as { members?: unknown } : null;
  const chief = readEmergencyTeamPerson(source);
  const members = Array.isArray(source?.members) ? source.members.map(readEmergencyTeamPerson) : [];
  const rows = [chief, ...members].filter((person) => person.fullName || person.tcNo);
  if (rows.length > 0) return rows;
  const fallback = clean(fallbackName);
  return fallback ? [{ employeeId: "", fullName: fallback, tcNo: "" }] : [];
};

export const getProfileCompanyEmergencyTeams = (company?: Partial<Company & ProfileCompanyDocumentFields> | null): ProfileEmergencyTeamFields => ({
  fire: readEmergencyTeam(company?.emergency_team_info, "fire_chief", company?.fire_support_person_name),
  rescue: readEmergencyTeam(company?.emergency_team_info, "rescue_chief", company?.evacuation_support_person_name),
  protection: readEmergencyTeam(company?.emergency_team_info, "protection_chief", company?.knowledgeable_employee_name),
  firstAid: readEmergencyTeam(company?.emergency_team_info, "first_aid_chief", company?.first_aid_support_person_name),
});

export const getProfileCompanyDocumentFields = (company?: Partial<Company & ProfileCompanyDocumentFields> | null) => {
  const emergencyTeams = getProfileCompanyEmergencyTeams(company);

  return {
    employerRepresentativeName: clean(company?.employer_representative_name),
    employerRepresentativeTcNo: clean(company?.employer_representative_tc_no),
    employerRepresentativePhone: clean(company?.employer_representative_phone),
    occupationalSafetySpecialistName: clean(company?.occupational_safety_specialist_name),
    occupationalSafetySpecialistTcNo: clean(company?.occupational_safety_specialist_tc_no),
    occupationalSafetySpecialistPhone: clean(company?.occupational_safety_specialist_phone),
    occupationalSafetySpecialistCertificateNo: clean(company?.occupational_safety_specialist_certificate_no),
    workplaceDoctorName: clean(company?.workplace_doctor_name),
    workplaceDoctorTcNo: clean(company?.workplace_doctor_tc_no),
    workplaceDoctorPhone: clean(company?.workplace_doctor_phone),
    workplaceDoctorCertificateNo: clean(company?.workplace_doctor_certificate_no),
    employeeRepresentativeName: clean(company?.employee_representative_name),
    employeeRepresentativeTcNo: clean(company?.employee_representative_tc_no),
    employeeRepresentativePhone: clean(company?.employee_representative_phone),
    knowledgeableEmployeeName: clean(company?.knowledgeable_employee_name),
    fireSupportPersonName: clean(company?.fire_support_person_name) || emergencyTeams.fire[0]?.fullName || "",
    firstAidSupportPersonName: clean(company?.first_aid_support_person_name) || emergencyTeams.firstAid[0]?.fullName || "",
    evacuationSupportPersonName: clean(company?.evacuation_support_person_name) || emergencyTeams.rescue[0]?.fullName || "",
    emergencyTeams,
  };
};

export const getProfileCompanyRegistryNo = (company?: Partial<Company> | null) =>
  clean(company?.sgk_workplace_number) ||
  clean(company?.workplace_registration_number) ||
  clean((company as any)?.sgk_number);

export const getProfileCompanyDisplayName = (company?: Partial<Company> | null) =>
  clean(company?.company_name) || clean((company as any)?.name);
