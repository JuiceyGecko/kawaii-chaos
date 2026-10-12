# Kawaii Chaos — anime · beauty · merch

A small static shop site: HTML, CSS and JavaScript. There is no build step and nothing to install.

```
AnimeHub-v2/              (folder name kept; the shop is Kawaii Chaos)
  index.html              the page
  css/style.css           all styling (colours and fonts at the top)
  admin.html              password-protected admin page (add/edit/hide products)
  js/config.js            Supabase URL/key, ADMIN_PASSWORD (local mode), categories
  js/products.js          the built-in product list (PRODUCTS) — fallback + seed
  js/catalog.js           local mode: merges admin changes saved in this browser
  js/store.js             data layer: Supabase shared catalog, or local mode
  js/vendor/supabase.js   Supabase client library (admin page only)
  supabase/setup.sql      one-time database setup (table, rules, photo bucket, 8 products)
  SETUP.md                5-minute guide to switch on the shared catalog
  js/admin.js             admin page logic
  js/shop.js              basket, checkout, SETTINGS at the top
  css/admin.css           admin styling
  images/                 logo + product photos
    kawaii-chaos-logo.jpeg   brand logo (header, hero, about, footer, favicon). NOT for sale.
    bunny-ears-figure.jpeg   nier-2b-figure.jpeg   hello-kitty-necklace.jpeg
    nekopara-pouch.jpeg      kuromi-hairbrush.jpeg
    acrylic-keychains.jpeg   nyan-cat-keychain.jpeg   adventure-time-socks.jpeg
  preview/                screenshots (desktop + mobile), safe to delete
```

## Shared catalog (client edits go live for everyone)
See **SETUP.md**. With a Supabase URL + key in `js/config.js`, admin.html logs in with email + password,
writes to the shared database, uploads photos to Supabase Storage, and the shop reads from it.
Without keys the site runs in local test mode (admin changes stay in that browser).

## Open it
Double-click `index.html`. You can also right-click it in VS Code and choose **Open with Live Server**.
Fonts load from Google Fonts when you're online. Offline, the site falls back to system fonts and still works.

## What's for sale right now
| Item | Category | Price | Stock |
|---|---|---|---|
| Teal Bunny-Ears Figure | Figures | R250 | 1 |
| 2B — NieR: Automata figure | Figures | R280 | 1 |
| Hello Kitty Silver Necklace | Jewellery | R80 | 3 |
| Nekopara Cat-Girl Pouch | Bags | R70 | 2 |
| Kuromi Hairbrush | Beauty | R200 | 2 |
| Jujutsu Kaisen Acrylics (Megumi & Gojo) | Keychains | R100 for both (R70 each singly — on request) | 1 pair |
| Nyan Cat Keychain | Keychains | R80 | 2 |
| Adventure Time Socks | Socks | R50 a pair | 5 (shared across designs) |

Socks have a **Character** dropdown: Lumpy Space Princess, Princess Bubblegum, Jake, BMO, Finn. The customer must pick one before adding to the basket, and the choice shows in the basket, the order email and the Stripe reference.


Stock numbers are guesses. Set your real counts in `js/products.js` (or in the admin page).

## Things you must edit before going live
1. **Email:** search the project for `REPLACE_ME@example.com`. It's in `index.html` (Ask panel) and in `SETTINGS.SHOP_EMAIL` in `js/shop.js`.
2. **Courier prices:** `SETTINGS.SHIPPING` in `js/shop.js`. R70 locker and R120 door are placeholders.
3. **Copy:** every `TODO (Joseph)` comment in `index.html` marks text that should be true for *you*: the hero blurb, drop note, about text and shipping promises (for example "3 working days").
4. **Product notes and stock:** check each `note` in `PRODUCTS` (`js/products.js`) is accurate (new or pre-owned, boxed or not, size) and set the real `stock`.
5. **Photos:** if any product photo is a supplier/online image rather than your own, a quick photo of the real item is more trustworthy (and avoids using someone else's picture).

## Products
Each item in `PRODUCTS` (in `js/products.js`) looks like this:

```js
{ id: "kuromi-hairbrush", name: "Kuromi Hairbrush", line: "Paddle brush · pink & black",
  cat: "beauty", grade: "", stock: 2, price: 200, img: "images/kuromi-hairbrush.jpeg", bg: "dark",
  alt: "describe the photo", note: "One or two honest sentences." }
```
- `cat` is one of `figures`, `jewellery`, `bags`, `beauty`, `keychains` or `socks` and drives the filter chips.
- `options` (optional) adds a dropdown to the card, e.g. sock designs:
  `optionLabel: "Character", options: [{ id: "jake", label: "Jake" }, …]`.
  Each choice is its own basket line; `stock` is shared across all choices.
- `grade` is optional (`A`, `B`, `C`); leave `""` to hide it. Handy for pre-owned boxed figures.
- `stock: 0` shows the card as **SOLD**. The basket also won't let anyone add more than `stock`.
- `price` is whole rand.
- `bg` is `"light"` or `"dark"`: match the photo's background so the card frame blends in.

## Adding a new product
1. Save the photo in `images/` (JPG, around 1000 px, under ~200 KB). Square works best. The whole photo is shown, nothing gets cropped.
2. Copy one product block in `js/products.js`, give it a new unique `id`, and update the other fields.
3. Need a new category? Add a chip in `index.html` (`data-filter="yourcat"`) and use that same word as `cat`. Add it to `CATEGORIES` in `js/config.js` too so the admin form offers it.

## Taking real payments
The shop runs in **demo mode** until you paste a payment link into `js/shop.js`:

```js
STRIPE_PAYMENT_LINK: "",   // https://buy.stripe.com/...
PAYSTACK_PAGE_LINK: "",    // https://paystack.com/pay/...
```
Leave both empty for demo mode. If you fill one in, **Place order** becomes **Continue to payment**. Clicking it opens that page in a new tab with the order code. The basket stays saved until the customer clicks "I've paid, clear my basket". The customer also gets a pre-written "email me your order list" link, so you know exactly what to pack.

> **Important for South Africa:** standard Stripe accounts aren't offered to South African businesses. Stripe's SA option is **Paystack**, which Stripe owns. If you don't have a Stripe account in another country, use Paystack.

### Option A: Paystack Payment Page (most likely for you)
1. Sign up at paystack.com and verify your business.
2. Go to **Payments → Payment Pages → New page**. Leave the amount for the customer to enter, and add a custom field called "Order code".
3. Copy the page URL (for example `https://paystack.com/pay/kawaiichaos`) into `PAYSTACK_PAGE_LINK`.
4. At checkout the site shows the exact total and order code and asks the customer to enter both.

### Option B: Stripe Payment Link (if you have a Stripe account)
1. In the Stripe Dashboard go to **Payment Links → New**. Choose **Customers choose what to pay** in ZAR.
2. Copy the `https://buy.stripe.com/...` link into `STRIPE_PAYMENT_LINK`.
3. The site adds `prefilled_email` and `client_reference_id` to the link automatically. The reference looks like `KC-2GS4D7_nier-2b-figurex1_hello-kitty-necklacex2`, which is the order code plus the items. You'll see it on the payment in Stripe.

A payment link can't pull the basket total in by itself, so the customer types it in. For a fully automatic total you'd later need a tiny server function (Stripe Checkout Sessions or Paystack's Initialize Transaction API). That's the next step when order volume justifies it.

## Newsletter (drop list)
Right now it only shows a thank-you message and saves nothing. To collect emails:
1. Make a free form at formspree.io.
2. In `index.html`, replace `REPLACE_WITH_FORMSPREE_ID` in the form's `action` and set `data-live="true"`.

## Design notes
- Palette comes from the logo: blush `#fbf3f7`, plum-black ink `#241a2c`, candy pink `#d2457e`, lavender `#ece4fb` / `#b9a0e6`. Change them at the top of `css/style.css`.
- Fonts: Zen Maru Gothic (rounded display), Nunito Sans (body), IBM Plex Mono (labels and prices).
- The Kawaii Chaos logo is branding only. It isn't in `PRODUCTS`.
- There are no review counts or "12k happy customers" type numbers on purpose. Only add proof that's true.


## Admin page (add products without code)
Open **`admin.html`** on the live site (e.g. `https://<your-link>/admin.html`). It isn't linked from the shop, so share the link only with people who should edit.

**Default password: `chaos2026`.** Change it in `js/config.js` → `ADMIN_PASSWORD` before sharing the admin link. You stay logged in until the tab is closed (sessionStorage).

What you can do:
- **Add a product:** name, price (R), category, stock, short line, description, optional dropdown (e.g. "Colour" with one choice per line, like the sock characters) and a photo. Photos are shrunk to ~800px JPEG automatically.
- **Change price / stock** right in the list and tap **Save**. Stock 0 = SOLD.
- **Edit** opens the full form (also works on the built-in products — you can even swap a photo).
- **Hide / Show** takes a product off the shop without losing it.
- **Delete** is a soft delete: it moves to the **Deleted** list and can be restored. Admin-added products can then be "Delete forever" to free up space.
- **Download changes (.json)** saves a backup; **Load a changes file** puts those changes into another browser.
- **Undo all admin changes** returns to the built-in list.

### Important: how far the changes reach (v1)
This is a no-server version. Admin changes are saved in **that browser's localStorage** (key `kawaiichaos-catalog-v1`) and merged over `PRODUCTS` when the shop loads.
- Changes show up **only in the same browser, on the same device, on the same web address** where they were made. Customers on their own phones still see the built-in list.
- A new deploy link (each temporary ship.place URL is a new address) starts empty — download your changes first and load them on the new link.
- To make changes **live for everyone**: tap **Download changes** and send the `.json` file to whoever maintains the site; they merge it into `js/products.js` (and save the photos into `images/`) and redeploy.
- Browsers give each site roughly 5 MB of storage; each photo is ~50–150 KB, so roughly 30–60 added photos. The admin shows a storage meter and warns if a save fails.
- The password lives in a public file (`js/config.js`), so it only keeps casual visitors out. That's fine for now because admin changes can't reach other people's browsers anyway — but it is **not** real security.

**Next step for a shared catalog:** a small backend (e.g. Supabase / Firebase / a headless shop like Shopify) so admin changes save to a database that every visitor reads, with a real login.
