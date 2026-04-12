create table if not exists public.library_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  icon_name text,
  color_token text,
  collection_type text not null default 'general'
    check (collection_type in ('topics', 'official_publications', 'internal_archive', 'regulations', 'links')),
  sort_order integer not null default 0,
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.library_collections(id) on delete set null,
  title text not null,
  summary text,
  body text,
  item_type text not null default 'guide'
    check (
      item_type in (
        'topic',
        'official_publication',
        'poster',
        'guide',
        'magazine',
        'book',
        'brochure',
        'procedure',
        'form',
        'policy',
        'regulation',
        'link',
        'archive_document'
      )
    ),
  audience text,
  sector text,
  source_name text,
  source_url text,
  file_url text,
  thumbnail_url text,
  published_year integer,
  language_code text not null default 'tr',
  is_official boolean not null default false,
  is_featured boolean not null default false,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_library_collections_type_sort
  on public.library_collections(collection_type, sort_order);

create index if not exists idx_library_items_collection_id
  on public.library_items(collection_id);

create index if not exists idx_library_items_item_type
  on public.library_items(item_type);

create index if not exists idx_library_items_official
  on public.library_items(is_official, published_year desc nulls last);

create index if not exists idx_library_items_tags
  on public.library_items using gin (tags);

alter table public.library_collections enable row level security;
alter table public.library_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'library_collections'
      and policyname = 'Authenticated users can view library collections'
  ) then
    create policy "Authenticated users can view library collections"
      on public.library_collections
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'library_items'
      and policyname = 'Authenticated users can view library items'
  ) then
    create policy "Authenticated users can view library items"
      on public.library_items
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'library_items'
      and policyname = 'Authenticated users can create library items'
  ) then
    create policy "Authenticated users can create library items"
      on public.library_items
      for insert
      to authenticated
      with check (created_by = auth.uid() or created_by is null);
  end if;
end
$$;

do $$
declare
  v_topics uuid;
  v_publications uuid;
  v_archive uuid;
  v_regulations uuid;
begin
  insert into public.library_collections (
    slug,
    title,
    description,
    icon_name,
    color_token,
    collection_type,
    sort_order,
    is_official
  )
  values
    (
      'topic-guides',
      'Konu rehberleri',
      'Sahada hızlı başvuru için konu bazlı kısa İSG özetleri ve kontrol kartları.',
      'BookOpen',
      'emerald',
      'topics',
      1,
      false
    ),
    (
      'official-publications',
      'Resmi yayınlar',
      'Bakanlık, kamu ve resmi kurum kaynaklı dergi, broşür, kitap ve afiş arşivi.',
      'ShieldCheck',
      'blue',
      'official_publications',
      2,
      true
    ),
    (
      'internal-archive',
      'Kurum içi dokümanlar',
      'Prosedür, talimat, form, toplantı tutanağı ve eğitim dokümanları için merkezi arşiv.',
      'FolderArchive',
      'amber',
      'internal_archive',
      3,
      false
    ),
    (
      'regulation-links',
      'Mevzuat ve bağlantılar',
      'Yönetmelik, tebliğ ve resmi sayfa bağlantılarının toplandığı referans alanı.',
      'Scale',
      'violet',
      'regulations',
      4,
      true
    )
  on conflict (slug) do update
  set
    title = excluded.title,
    description = excluded.description,
    icon_name = excluded.icon_name,
    color_token = excluded.color_token,
    collection_type = excluded.collection_type,
    sort_order = excluded.sort_order,
    is_official = excluded.is_official,
    updated_at = now();

  select id into v_topics from public.library_collections where slug = 'topic-guides';
  select id into v_publications from public.library_collections where slug = 'official-publications';
  select id into v_archive from public.library_collections where slug = 'internal-archive';
  select id into v_regulations from public.library_collections where slug = 'regulation-links';

  insert into public.library_items (
    collection_id,
    title,
    summary,
    body,
    item_type,
    audience,
    sector,
    source_name,
    source_url,
    published_year,
    is_official,
    is_featured,
    tags,
    metadata
  )
  values
    (
      v_topics,
      'Yüksekte çalışma için hızlı kontrol kartı',
      'İskele, korkuluk, yaşam hattı, erişim ve düşmeye karşı koruma kontrollerini özetler.',
      'Saha öncesi hazırlık, alan çevreleme, düşmeye karşı toplu koruma, kişisel koruyucu donanım ve günlük kontrol başlıklarını içerir.',
      'topic',
      'İş güvenliği uzmanı ve saha sorumlusu',
      'İnşaat',
      'Kurum içi bilgi merkezi',
      null,
      2026,
      false,
      true,
      array['yüksekte çalışma', 'inşaat', 'iskele', 'düşme'],
      jsonb_build_object('recommended_use', 'inspection_preparation')
    ),
    (
      v_topics,
      'Kimyasal maruziyet kontrol özeti',
      'Etiket, güvenlik bilgi formu, havalandırma, depolama ve acil durum başlıklarını tek kartta toplar.',
      'Kimyasal depolama alanları, maruziyet kaynakları, etiketleme, kişisel koruyucu donanım, dökülme müdahalesi ve acil duş gerekliliklerini içerir.',
      'topic',
      'İSG uzmanı, depo sorumlusu ve üretim ekibi',
      'Üretim',
      'Kurum içi bilgi merkezi',
      null,
      2026,
      false,
      true,
      array['kimyasal', 'maruziyet', 'depolama', 'etiket'],
      jsonb_build_object('recommended_use', 'training')
    ),
    (
      v_publications,
      'İş Sağlığı ve Güvenliği Genel Müdürlüğü yayınlar ve afişler arşivi',
      'Resmi afiş, broşür, dergi, kitap ve diğer yayınların elektronik arşiv sayfası.',
      'Bu kayıt, resmi yayınların toplu olarak erişildiği ana sayfayı temsil eder. Dosyaları resmi kaynaktan açmayı tercih edin.',
      'link',
      'Tüm kullanıcılar',
      'Genel',
      'T.C. Çalışma ve Sosyal Güvenlik Bakanlığı İş Sağlığı ve Güvenliği Genel Müdürlüğü',
      'https://www.csgb.gov.tr/isggm/yayinlar-ve-afisler/',
      2026,
      true,
      true,
      array['resmi yayın', 'afiş', 'broşür', 'dergi'],
      jsonb_build_object('import_source', 'official_catalog')
    ),
    (
      v_publications,
      'İnşaatta korkuluk kullanmak hayat kurtarır',
      'Yüksekte çalışma ve düşmeye karşı toplu koruma için resmi afiş kaydı.',
      'Resmi afiş kaydı. İndir butonunu kullanarak orijinal kaynağa yönlendirme yapılması önerilir.',
      'poster',
      'Saha çalışanları ve taşeron ekipler',
      'İnşaat',
      'T.C. Çalışma ve Sosyal Güvenlik Bakanlığı İş Sağlığı ve Güvenliği Genel Müdürlüğü',
      'https://www.csgb.gov.tr/isggm/yayinlar-ve-afisler/',
      2026,
      true,
      false,
      array['afiş', 'inşaat', 'korkuluk', 'yüksekte çalışma'],
      jsonb_build_object('official_title', 'İnşaatta Korkuluk Kullanmak Hayat Kurtarır')
    ),
    (
      v_regulations,
      'İş Sağlığı ve Güvenliği Genel Müdürlüğü yayın ve afiş açıklaması',
      'Resmi yayında içeriklerin aslına uygun kullanılabileceğini belirten açıklama kaydı.',
      '01.04.2019 itibarıyla yayınların basımının yapılmadığı, ihtiyaç halinde tasarım ve içerik değiştirilmeden aslına uygun basım yapılabileceği belirtilmiştir.',
      'regulation',
      'Yönetici ve doküman sorumluları',
      'Genel',
      'T.C. Çalışma ve Sosyal Güvenlik Bakanlığı İş Sağlığı ve Güvenliği Genel Müdürlüğü',
      'https://www.csgb.gov.tr/isggm/yayinlar-ve-afisler/',
      2026,
      true,
      false,
      array['kullanım koşulu', 'resmi kaynak', 'yayın politikası'],
      jsonb_build_object('note', 'Referans ve kaynak gösterimi için tutulur')
    )
  on conflict do nothing;
end
$$;
