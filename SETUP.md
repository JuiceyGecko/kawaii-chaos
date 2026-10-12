# Kawaii Chaos — shared catalog setup (about 5 minutes, free)

Right now admin changes only live in the browser that made them. Do this once and
whatever the client adds/edits in **admin.html** shows for **every** customer.

You need a free Supabase account (sign in with Google or GitHub — no card).

## 1. Create the project (≈2 min)
1. Go to <https://supabase.com/dashboard> → sign in → **New project**.
2. Name: `kawaii-chaos`. Make up a database password (save it somewhere; the site doesn't need it).
3. Region: the closest one offered (e.g. a Europe region). Free plan. **Create new project**.
4. Wait for it to finish setting up (1–2 min).

## 2. Create the table, rules and photo bucket (≈1 min)
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/setup.sql` from this folder, copy everything, paste it in.
3. Find the line marked `<<< ADMIN EMAIL` and replace `client@example.com` with the
   email the client will log in with. (Add yours too: `('client@x.com'), ('you@x.com')`.)
4. Click **Run**. You should see "Success". This also loads the 8 current products.

## 3. Give the client a login (≈1 min)
1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the same email as step 2.3 and a password for her. Tick **Auto Confirm User**. Create.
3. (Recommended) **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up".
   Only emails on the admin list can edit anyway, but this keeps things tidy.

## 4. Connect the site (≈30 sec)
1. Click **Connect** at the top of the project (or **Project Settings → API Keys**).
2. Copy the **Project URL** (`https://xxxx.supabase.co`) and the **anon public** key
   (starts `eyJ…`) or **publishable** key (starts `sb_publishable_…`).
   **Do not** use the `service_role` / secret key.
3. Paste them into `js/config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
   …or just send both to Pip and it'll paste them and re-publish the site.

## 5. Hand over
- Shop: `https://<your-site>/`
- Admin: `https://<your-site>/admin.html` → she logs in with the email + password from step 3.
- The admin page shows a green **Live shop** banner when it's connected.

## How it works / good to know
- Customers' browsers read the `products` table directly (read-only, hidden/deleted items are never sent).
- Only logged-in users whose email is in `kc_admins` can add, edit, hide, delete or upload photos
  (enforced by the database, not the web page — so the public key in `config.js` is safe).
- Photos uploaded in admin go to the `product-images` storage bucket, sharpened to 1400px.
- The original 8 products use the photos in this site's `images/` folder.
- If Supabase can't be reached, the shop falls back to the last list it saw (or the built-in list).
- Add another admin later: SQL Editor → `insert into kc_admins (email) values ('new@x.com');`
  and create their user in Authentication → Users.
- Free plan note: Supabase pauses a free project after about a week with **no visits at all**;
  normal shop traffic keeps it awake. If it ever pauses, click **Restore** in the dashboard.
- Remove the keys from `config.js` to go back to local test mode.
