-- اللامع | شغّل هذا الملف كاملاً من Supabase: SQL Editor > New query > Run
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin','products','orders','staff')),
  created_at timestamptz default now()
);
create table if not exists public.categories (id uuid primary key default uuid_generate_v4(), name text not null, slug text unique not null, created_at timestamptz default now());
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(), name text not null, slug text unique not null,
  description text default '', short_description text default '', name_en text default '',
  price numeric(10,2) not null check(price >= 0), sale_price numeric(10,2),
  sale_start timestamptz, sale_end timestamptz, currency text not null default 'SAR', tax_rate numeric(5,2) not null default 0,
  stock integer not null default 0 check(stock >= 0), low_stock_threshold integer not null default 3, status text not null default 'active',
  category_id uuid references public.categories(id) on delete set null,
  image_url text, gallery jsonb not null default '[]', image_360 text, studio_asset text,
  sizes text[] default '{}', size_stock jsonb not null default '{}', colors jsonb not null default '[]', tags text[] default '{}',
  is_active boolean default true, is_featured boolean default false,
  is_new boolean not null default false, is_best_seller boolean not null default false, is_limited boolean not null default false,
  show_home boolean not null default false, show_offers boolean not null default false, allow_reviews boolean not null default true,
  virtual_tryon boolean not null default false, wear_category text, layer_order integer not null default 0,
  sku text, barcode text, sold_count integer not null default 0,
  meta_title text, meta_description text, og_image text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.orders (id uuid primary key default uuid_generate_v4(), customer_name text, customer_phone text, customer_email text, total numeric(10,2) not null default 0, status text default 'new' check(status in ('new','confirmed','processing','shipped','delivered','cancelled')), created_at timestamptz default now());

alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security;
create or replace function public.my_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;

do $$ begin
  create policy "public reads active products" on public.products for select using (is_active or public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public reads categories" on public.categories for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manages products" on public.products for all using (public.my_role() in ('admin','products')) with check (public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manages categories" on public.categories for all using (public.my_role()='admin') with check (public.my_role()='admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff reads orders" on public.orders for select using (public.my_role() in ('admin','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "order staff manages orders" on public.orders for update using (public.my_role() in ('admin','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "team reads profiles" on public.profiles for select using (auth.uid()=id or public.my_role()='admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manages profiles" on public.profiles for all using (public.my_role()='admin') with check (public.my_role()='admin');
exception when duplicate_object then null; end $$;

-- ═══ التصنيفات الرسمية الاثنا عشر (تُدار بعدها من لوحة التحكم) ═══
insert into public.categories(name,slug) values
  ('معاوز','maawaz'),('أثواب','thobe'),('شمزان','shamzan'),('صديري','vest'),
  ('جنابي','jambiya'),('أحزمة','belt'),('عمائم','turban'),('شماغ','shemagh'),
  ('أحذية','shoes'),('ساعات','watch'),('عطور','perfume'),('إكسسوارات','accessories'),
  ('الشالات','shawl'),('الصدريات','vest-legacy'),('الثياب','thobe-legacy'),('الإكسسوارات العامة','accessory')
on conflict(slug) do nothing;

-- ═══ نظام إدارة المنتجات المتكامل — أعمدة (آمنة للتكرار) ═══
alter table public.products add column if not exists name_en text default '';
alter table public.products add column if not exists short_description text default '';
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists gallery jsonb not null default '[]';
alter table public.products add column if not exists image_360 text;
alter table public.products add column if not exists studio_asset text;
alter table public.products add column if not exists size_stock jsonb not null default '{}';
alter table public.products add column if not exists sale_start timestamptz;
alter table public.products add column if not exists sale_end timestamptz;
alter table public.products add column if not exists currency text not null default 'SAR';
alter table public.products add column if not exists tax_rate numeric(5,2) not null default 0;
alter table public.products add column if not exists low_stock_threshold integer not null default 3;
alter table public.products add column if not exists status text not null default 'active';
alter table public.products add column if not exists is_new boolean not null default false;
alter table public.products add column if not exists is_best_seller boolean not null default false;
alter table public.products add column if not exists is_limited boolean not null default false;
alter table public.products add column if not exists show_home boolean not null default false;
alter table public.products add column if not exists show_offers boolean not null default false;
alter table public.products add column if not exists allow_reviews boolean not null default true;
alter table public.products add column if not exists sold_count integer not null default 0;
alter table public.products add column if not exists meta_title text;
alter table public.products add column if not exists meta_description text;
alter table public.products add column if not exists og_image text;
alter table public.products add column if not exists tags text[] default '{}';

-- ═══ AL LAMEA VIRTUAL STUDIO™ — أعمدة التجربة الافتراضية ═══
alter table public.products add column if not exists virtual_tryon boolean not null default false;
alter table public.products add column if not exists wear_category text;
alter table public.products add column if not exists layer_order integer not null default 0;
alter table public.products add column if not exists colors jsonb not null default '[]';
-- فئات اللبس: thobe / maawaz / shamzan / vest / belt / jambiya / turban / shemagh / shoes / watch / perfume / accessories

-- ═══ مخزن صور المنتجات (رفع Drag & Drop من لوحة التحكم) ═══
insert into storage.buckets (id,name,public) values ('products','products',true) on conflict (id) do nothing;
do $$ begin
  create policy "public reads product images" on storage.objects for select using (bucket_id='products');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff writes product images" on storage.objects for insert with check (bucket_id='products' and public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff updates product images" on storage.objects for update using (bucket_id='products' and public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff deletes product images" on storage.objects for delete using (bucket_id='products' and public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;

-- بعد إنشاء أول مستخدم من Authentication > Users، اجعله مديراً بهذا الأمر (استبدل البريد):
-- insert into public.profiles (id,full_name,role) select id,'اسمك','admin' from auth.users where email='you@example.com' on conflict(id) do update set role='admin';

-- ═══════════════════════════════════════════════════════════════
-- AL LAMEA ENTERPRISE BI — جداول التحليلات والبث المباشر (آمنة للتكرار)
-- ═══════════════════════════════════════════════════════════════

-- جلسات الزوار: جهاز، متصفح، نظام، لغة، مدينة/دولة، آخر تواجد (لمقياس "الآن Live")
create table if not exists public.sessions (
  id text primary key,
  visitor_id text not null,
  started_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  device text, browser text, os text, lang text,
  country text, city text, referrer text, app text default 'store',
  pages integer default 1
);

-- أحداث التحليلات: زيارة، مشاهدة منتج، تجربة، سلة، دفع، طلب، مفضلة، مشاركة، التقاط، حفظ إطلالة…
create table if not exists public.events (
  id bigint generated always as identity primary key,
  session_id text not null,
  visitor_id text not null,
  app text default 'store',
  type text not null,
  product_id text, product_name text,
  value numeric(10,2),
  meta jsonb default '{}',
  country text, city text,
  created_at timestamptz default now()
);
create index if not exists events_type_idx on public.events(type);
create index if not exists events_session_idx on public.events(session_id);
create index if not exists events_created_idx on public.events(created_at desc);
create index if not exists events_product_idx on public.events(product_id);
create index if not exists sessions_seen_idx on public.sessions(last_seen_at desc);

alter table public.sessions enable row level security;
alter table public.events enable row level security;

-- الزوار يسجلون أحداثهم وجلساتهم فقط (تحصين الإنتاج: قيّد بمجالك عبر WAF/RPC)
do $$ begin
  create policy "anyone tracks events" on public.events for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff reads events" on public.events for select using (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone starts session" on public.sessions for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone heartbeat session" on public.sessions for update using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff reads sessions" on public.sessions for select using (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;

-- الدفع من المتجر: الطلبات تُسجل فعلياً من الواجهة (ضيف بدون حساب)
do $$ begin
  create policy "public creates orders" on public.orders for insert with check (true);
exception when duplicate_object then null; end $$;

-- تفاصيل الطلب والمدينة (لتحليلات العملاء والخريطة)
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists items jsonb default '[]';
alter table public.orders add column if not exists payment text;

-- البث المباشر للوحة التحكم
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when duplicate_object then null; end $$;

-- ══════════════════ AL LAMEA AI™ — منصة ذكاء العملاء ══════════════════
-- تقييمات العملاء الحقيقية (يغذّيها مُلخّص AI Reviews)
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  product_id text not null,
  product_name text,
  customer_name text,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(coalesce(comment,'')) <= 800),
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews(product_id);
create index if not exists reviews_created_idx on public.reviews(created_at desc);
alter table public.reviews enable row level security;
do $$ begin
  create policy "anyone reads reviews" on public.reviews for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone writes review" on public.reviews for insert
    with check (rating between 1 and 5 and char_length(coalesce(comment,'')) <= 800);
exception when duplicate_object then null; end $$;

-- تتبع حالة الطلب برقم الجوال (حقول محدودة وآمنة — بلا بيانات شخصية)
create or replace function public.order_status(p_phone text)
returns table(order_ref text, status text, total numeric, items_count integer, city text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select left(o.id::text, 8), o.status, o.total,
         coalesce(jsonb_array_length(coalesce(o.items,'[]'::jsonb)), 0)::integer,
         left(coalesce(o.city,''), 40), o.created_at
  from public.orders o
  where regexp_replace(coalesce(o.customer_phone,''), '\D', '', 'g')
        like '%' || right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9)
  order by o.created_at desc limit 10;
$$;
revoke all on function public.order_status(text) from public;
grant execute on function public.order_status(text) to anon, authenticated;

-- ══════════════════ الأمان المؤسسي: سجل التدقيق Audit Log ══════════════════
-- يوثّق كل إجراء إداري (حفظ/حذف منتج، تغيير حالة طلب، إجراءات مركز الفرص)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor text,                 -- بريد الموظف المنفّذ
  action text not null,       -- product.save · product.delete · order.status · ai.restock · ai.discount ...
  entity text,                -- products · orders · ...
  entity_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log(created_at desc);
alter table public.audit_log enable row level security;
do $$ begin
  create policy "staff writes audit" on public.audit_log for insert
    with check (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin reads audit" on public.audit_log for select
    using (public.my_role() = 'admin');
exception when duplicate_object then null; end $$;

-- ══════════ PART 3 — AI Automation · Rewards · Localization ══════════
-- طابور موافقات الأتمتة: لا يُنفَّذ أي إجراء على الأسعار/المنتجات إلا بعد موافقة المسؤول
create table if not exists public.ai_tasks (
  id bigint generated always as identity primary key,
  key text unique not null,          -- بصمة الاقتراح: kind:entity
  kind text not null,                -- restock · discount · improve_desc · ...
  title text not null,
  why text default '',
  payload jsonb not null default '{}',
  priority numeric default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed','postponed')),
  proposed_by text default 'ai-suite',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ai_tasks_status_idx on public.ai_tasks(status, priority desc);
alter table public.ai_tasks enable row level security;
do $$ begin
  create policy "staff reads tasks" on public.ai_tasks for select using (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff upserts tasks" on public.ai_tasks for insert with check (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff updates tasks" on public.ai_tasks for update using (public.my_role() in ('admin','products','orders'));
exception when duplicate_object then null; end $$;

-- إعدادات المتجر العامة (شحن/ولاء/لغة/عملة) — قراءة عامة، كتابة للمدير فقط
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;
do $$ begin
  create policy "public reads settings" on public.store_settings for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin upserts settings" on public.store_settings for insert with check (public.my_role() = 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin updates settings" on public.store_settings for update using (public.my_role() = 'admin');
exception when duplicate_object then null; end $$;
insert into public.store_settings(key, value) values
  ('shipping', '{"fee":35,"free_from":350,"delivery_note":"3 – 7 أيام عمل داخل المملكة","countries":[{"name":"داخل المملكة","fee":35},{"name":"دول الخليج","fee":65}]}'),
  ('loyalty', '{"enabled":true,"pts_per_sar":1,"welcome_pts":100,"coupon_enabled":true,"tiers":[{"name":"فضي","min":0,"perk":"أولوية إشعار الإصدارات المحدودة"},{"name":"ذهبي","min":2000,"perk":"شحن مجاني لكل الطلبات"},{"name":"بلاتيني","min":6000,"perk":"مستشار مقاسات خاص وهدية موسمية"}]}'),
  ('locale', '{"lang":"ar","currency":"SAR","tax_rate":0}')
on conflict (key) do nothing;

-- كوبونات الولاء والحملات
create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text unique not null,
  pct numeric(5,2) not null check (pct between 1 and 90),
  active boolean not null default true,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  note text default '',
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
do $$ begin
  create policy "staff manages coupons" on public.coupons for all
    using (public.my_role() in ('admin','products')) with check (public.my_role() in ('admin','products'));
exception when duplicate_object then null; end $$;

-- استعلام كوبون بدون كشف القائمة العامة (peek: تحقق فقط)
create or replace function public.coupon_peek(p_code text)
returns numeric language sql security definer stable set search_path = public as $$
  select case when c.active and (c.expires_at is null or c.expires_at > now()) and (c.max_uses is null or c.uses < c.max_uses)
              then c.pct else null end
  from public.coupons c where upper(trim(c.code)) = upper(trim(coalesce(p_code,''))) limit 1;
$$;
revoke all on function public.coupon_peek(text) from public;
grant execute on function public.coupon_peek(text) to anon, authenticated;

-- استرداد الكوبون مع عدّ الاستخدام ذرياً (عند تأكيد الطلب فقط)
create or replace function public.coupon_redeem(p_code text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_pct numeric;
begin
  update public.coupons set uses = uses + 1
   where upper(trim(code)) = upper(trim(coalesce(p_code,''))) and active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses < max_uses)
  returning pct into v_pct;
  return v_pct;  -- null = غير صالح/منتهي
end;
$$;
revoke all on function public.coupon_redeem(text) from public;
grant execute on function public.coupon_redeem(text) to anon, authenticated;

-- حقول الشحن والكوبون على الطلبات (لذكاء الشحن)
alter table public.orders add column if not exists coupon text;
alter table public.orders add column if not exists discount numeric(10,2) default 0;
alter table public.orders add column if not exists carrier text;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
create index if not exists orders_phone_idx on public.orders(customer_phone);
create index if not exists orders_status_idx on public.orders(status);
