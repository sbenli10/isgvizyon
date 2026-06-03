-- Toplu çalışan yükleme ve manuel çalışan kayıtlarında işe başlama tarihi opsiyonel olabilsin.
-- Uygulama boş tarih gönderdiğinde employees.start_date artık NULL kabul eder.
alter table if exists public.employees
  alter column start_date drop not null;

