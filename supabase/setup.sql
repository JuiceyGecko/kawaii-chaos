-- =====================================================================
-- Kawaii Chaos — Supabase setup (run once in Supabase → SQL Editor → Run)
-- Safe to run again: it won't duplicate anything.
--
-- BEFORE YOU RUN: change the email on the line marked  <<< ADMIN EMAIL
-- to the email the client (and/or you) will log into admin.html with.
-- =====================================================================

-- 1) Products table -----------------------------------------------------
create table if not exists public.products (
  id           text primary key,
  name         text not null,
  price        integer not null default 0 check (price >= 0),
  category     text not null default 'figures',
  stock        integer not null default 0 check (stock >= 0),
  note         text not null default '',        -- short line under the photo
  description  text not null default '',
  image_url    text not null default '',
  bg           text not null default 'light' check (bg in ('light','dark')),
  alt          text not null default '',
  grade        text not null default '',
  option_label text,
  options      jsonb,                            -- e.g. [{"id":"jake","label":"Jake"}]
  hidden       boolean not null default false,
  deleted      boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.kc_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.kc_touch_updated_at();

-- 2) Who is allowed to edit (admin allow-list) -----------------------------
create table if not exists public.kc_admins (
  email text primary key
);
alter table public.kc_admins enable row level security;   -- nobody can read/edit this list from the website

insert into public.kc_admins (email) values
  ('client@example.com')                                   -- <<< ADMIN EMAIL (add more rows like this: ,('you@example.com'))
on conflict do nothing;

create or replace function public.kc_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.kc_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.kc_is_admin() to anon, authenticated;

-- 3) Row-level security: everyone can READ the shop, only admins can WRITE --
alter table public.products enable row level security;

drop policy if exists "kc public read"   on public.products;
drop policy if exists "kc admin read"    on public.products;
drop policy if exists "kc admin insert"  on public.products;
drop policy if exists "kc admin update"  on public.products;
drop policy if exists "kc admin delete"  on public.products;

create policy "kc public read"  on public.products for select to anon, authenticated
  using (hidden = false and deleted = false);
create policy "kc admin read"   on public.products for select to authenticated using (public.kc_is_admin());
create policy "kc admin insert" on public.products for insert to authenticated with check (public.kc_is_admin());
create policy "kc admin update" on public.products for update to authenticated using (public.kc_is_admin()) with check (public.kc_is_admin());
create policy "kc admin delete" on public.products for delete to authenticated using (public.kc_is_admin());

grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;

-- 4) Photo storage bucket (public read, admin upload) ----------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "kc images read"   on storage.objects;
drop policy if exists "kc images insert" on storage.objects;
drop policy if exists "kc images update" on storage.objects;
drop policy if exists "kc images delete" on storage.objects;

create policy "kc images read"   on storage.objects for select using (bucket_id = 'product-images');
create policy "kc images insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.kc_is_admin());
create policy "kc images update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.kc_is_admin());
create policy "kc images delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.kc_is_admin());

-- 5) Starter stock: the 8 products already on the site ----------------------
--    (photos use the site's own images/ folder, so they work wherever the site is hosted)
insert into public.products
  (id, name, price, category, stock, note, description, image_url, bg, alt, option_label, options, sort_order)
values
  ('bunny-ears-figure', 'Teal Bunny-Ears Figure', 250, 'figures', 1, 'Sitting figure · pink bunny hoodie', 'Long teal twin-tails, pink bunny-ear hood and little bow details. Sits on the edge of a shelf or desk.', 'images/bunny-ears-figure.jpeg', 'light', 'Seated anime figure with long teal and pink twin-tails, wearing a pink bunny-ear hoodie and striped socks', null, null, 10),
  ('nier-2b-figure', '2B — NieR: Automata', 280, 'figures', 1, 'Figure · white dress, katana', '2B in her white outfit, mid-draw with the katana, on a round black display base.', 'images/nier-2b-figure.jpeg', 'dark', 'Figure of 2B from NieR: Automata in an all-white outfit, drawing a katana, on a round black base', null, null, 20),
  ('hello-kitty-necklace', 'Hello Kitty Silver Necklace', 80, 'jewellery', 3, 'Necklace · pink gift box + bag', 'Sparkly Hello Kitty pendant on a fine chain. Comes in a pink box with a gift bag, so it''s ready to give.', 'images/hello-kitty-necklace.jpeg', 'light', 'Silver Hello Kitty outline pendant on a fine chain, in a pink velvet box next to a pink Hello Kitty gift bag', null, null, 30),
  ('nekopara-pouch', 'Nekopara Cat-Girl Pouch', 70, 'bags', 2, 'Zip pouch · Chocola & Vanilla', 'Chocola & Vanilla printed edge to edge, black zip. Good for makeup, pens or cables.', 'images/nekopara-pouch.jpeg', 'dark', 'White zip pouch printed with Nekopara cat-girls Chocola and Vanilla in maid outfits on a pink floral background', null, null, 40),
  ('kuromi-hairbrush', 'Kuromi Hairbrush', 200, 'beauty', 2, 'Paddle brush · pink & black', 'Kuromi with bows, hearts and moons on the back, cushioned paddle bristles on the front.', 'images/kuromi-hairbrush.jpeg', 'dark', 'Pink paddle hairbrush printed with Kuromi, black bows, hearts and moons, shown with the white bristle side', null, null, 50),
  ('acrylic-keychains', 'Jujutsu Kaisen Acrylics (Megumi & Gojo)', 100, 'keychains', 1, 'Acrylic keychains · set of 2', 'Megumi & Gojo chibi acrylics on gold clasps — R100 for the pair. Also available singly at R70 each, just ask.', 'images/acrylic-keychains.jpeg', 'dark', 'Two clear acrylic Jujutsu Kaisen keychains with gold clasps: Megumi Fushiguro and Satoru Gojo chibi charms', null, null, 60),
  ('nyan-cat-keychain', 'Nyan Cat Keychain', 80, 'keychains', 2, 'Acrylic keychain · rainbow pixel art', 'Pixel-art Nyan Cat with the full rainbow trail, on a silver lobster clasp. Bag, keys or pencil case.', 'images/nyan-cat-keychain.jpeg', 'light', 'Clear acrylic Nyan Cat keychain with a rainbow trail and Pop-Tart body, on a silver clasp', null, null, 70),
  ('adventure-time-socks', 'Adventure Time Socks', 50, 'socks', 5, 'Ankle socks · price per pair', 'Bright character ankle socks, one design per pair. Pick yours below.', 'images/adventure-time-socks.jpeg', 'dark', 'Five Adventure Time socks: lilac Lumpy Space Princess, pink Princess Bubblegum, yellow Jake, teal BMO and blue Finn', 'Character', '[{"id":"lsp","label":"Lumpy Space Princess"},{"id":"bubblegum","label":"Princess Bubblegum"},{"id":"jake","label":"Jake"},{"id":"bmo","label":"BMO"},{"id":"finn","label":"Finn"}]'::jsonb, 80)
on conflict (id) do nothing;

-- Done. Check: select id, name, price, stock from public.products order by sort_order;
