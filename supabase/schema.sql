-- أصالة اليمن | شغّل هذا الملف كاملاً من Supabase: SQL Editor > New query > Run
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
  description text default '', price numeric(10,2) not null check(price >= 0), sale_price numeric(10,2),
  stock integer not null default 0 check(stock >= 0), category_id uuid references public.categories(id) on delete set null,
  image_url text, sizes text[] default '{}', is_active boolean default true, is_featured boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.orders (id uuid primary key default uuid_generate_v4(), customer_name text, customer_phone text, customer_email text, total numeric(10,2) not null default 0, status text default 'new' check(status in ('new','confirmed','processing','shipped','delivered','cancelled')), created_at timestamptz default now());

alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security;
create or replace function public.my_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create policy "public reads active products" on public.products for select using (is_active or public.my_role() in ('admin','products'));
create policy "public reads categories" on public.categories for select using (true);
create policy "staff manages products" on public.products for all using (public.my_role() in ('admin','products')) with check (public.my_role() in ('admin','products'));
create policy "admin manages categories" on public.categories for all using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "staff reads orders" on public.orders for select using (public.my_role() in ('admin','orders'));
create policy "order staff manages orders" on public.orders for update using (public.my_role() in ('admin','orders'));
create policy "team reads profiles" on public.profiles for select using (auth.uid()=id or public.my_role()='admin');
create policy "admin manages profiles" on public.profiles for all using (public.my_role()='admin') with check (public.my_role()='admin');

insert into public.categories(name,slug) values ('الثياب','thobe'),('الصدريات','vest'),('الشالات','shawl'),('الإكسسوارات','accessory') on conflict(slug) do nothing;
-- بعد إنشاء أول مستخدم من Authentication > Users، اجعله مديراً بهذا الأمر (استبدل البريد):
-- insert into public.profiles (id,full_name,role) select id,'اسمك','admin' from auth.users where email='you@example.com' on conflict(id) do update set role='admin';
