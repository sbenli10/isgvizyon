import type { Company } from "@/types/companies";

export type ProfileCompanyDocumentFields = {
  employer_representative_name?: string | null;
  occupational_safety_specialist_name?: string | null;
  workplace_doctor_name?: string | null;
  employee_representative_name?: string | null;
  knowledgeable_employee_name?: string | null;
  fire_support_person_name?: string | null;
  first_aid_support_person_name?: string | null;
  evacuation_support_person_name?: string | null;
};

const clean = (value?: string | null) => (value || "").trim();

export const getProfileCompanyDocumentFields = (company?: Partial<Company & ProfileCompanyDocumentFields> | null) => ({
  employerRepresentativeName: clean(company?.employer_representative_name),
  occupationalSafetySpecialistName: clean(company?.occupational_safety_specialist_name),
  workplaceDoctorName: clean(company?.workplace_doctor_name),
  employeeRepresentativeName: clean(company?.employee_representative_name),
  knowledgeableEmployeeName: clean(company?.knowledgeable_employee_name),
  fireSupportPersonName: clean(company?.fire_support_person_name),
  firstAidSupportPersonName: clean(company?.first_aid_support_person_name),
  evacuationSupportPersonName: clean(company?.evacuation_support_person_name),
});

export const getProfileCompanyRegistryNo = (company?: Partial<Company> | null) =>
  clean(company?.sgk_workplace_number) || clean(company?.workplace_registration_number);

export const getProfileCompanyDisplayName = (company?: Partial<Company> | null) =>
  clean(company?.company_name) || clean((company as any)?.name);
