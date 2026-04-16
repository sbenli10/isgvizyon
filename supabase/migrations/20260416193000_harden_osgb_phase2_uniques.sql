create unique index if not exists uq_osgb_required_documents_org_obligation_type
  on public.osgb_required_documents(organization_id, obligation_id, document_type)
  where obligation_id is not null;

create unique index if not exists uq_osgb_financial_entries_monthly_invoice
  on public.osgb_financial_entries(organization_id, company_id, contract_id, service_month, entry_type)
  where entry_type = 'invoice' and service_month is not null and contract_id is not null;
