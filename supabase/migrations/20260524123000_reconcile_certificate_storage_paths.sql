-- Reconcile certificate DB rows whose pdf/zip paths point to missing Storage objects.
-- This does not delete any storage object. It only marks stale DB references so the UI
-- can ask the user to regenerate certificates instead of trying to sign missing files.

with orphan_items as (
  select
    item.id,
    item.participant_id,
    item.job_id
  from public.certificate_job_items item
  left join storage.objects object
    on object.bucket_id = 'certificate-files'
   and object.name = regexp_replace(coalesce(item.pdf_path, ''), '^/?certificate-files/', '')
  where item.pdf_path is not null
    and item.status = 'completed'
    and object.id is null
),
updated_items as (
  update public.certificate_job_items item
  set
    status = 'failed',
    pdf_path = null,
    error_message = 'PDF dosyası depolama alanında bulunamadı. Sertifika yeniden üretilmelidir.',
    completed_at = null
  from orphan_items orphan
  where item.id = orphan.id
  returning item.job_id
),
updated_participants as (
  update public.certificate_participants participant
  set pdf_path = null
  from orphan_items orphan
  where participant.id = orphan.participant_id
)
update public.certificate_jobs job
set
  completed_files = counts.completed_count,
  progress = case
    when job.total_files > 0 then round(((counts.completed_count + counts.failed_count)::numeric / job.total_files::numeric) * 100, 2)
    else 0
  end,
  status = case
    when counts.pending_count > 0 and counts.failed_count > 0 then 'processing_with_errors'
    when counts.pending_count > 0 then 'processing'
    when counts.completed_count = job.total_files and counts.failed_count = 0 then 'completed'
    when counts.completed_count > 0 and counts.failed_count > 0 then 'completed_with_errors'
    when counts.completed_count > 0 then 'completed'
    else 'failed'
  end,
  error_message = case
    when counts.failed_count > 0 then 'Bazı sertifika PDF dosyaları depolama alanında bulunamadı. Yeniden üretim gerekir.'
    else job.error_message
  end,
  zip_path = case
    when job.zip_path is null then null
    when exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'certificate-files'
        and object.name = regexp_replace(coalesce(job.zip_path, ''), '^/?certificate-files/', '')
    ) then job.zip_path
    else null
  end
from (
  select
    job_id,
    count(*) filter (where status = 'completed')::integer as completed_count,
    count(*) filter (where status = 'failed')::integer as failed_count,
    count(*) filter (where status in ('pending', 'processing'))::integer as pending_count
  from public.certificate_job_items
  group by job_id
) counts
where job.id = counts.job_id
  and exists (
    select 1
    from updated_items updated
    where updated.job_id = job.id
  );

