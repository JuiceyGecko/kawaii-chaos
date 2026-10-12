/* =====================================================================
   Kawaii Chaos — site settings
   ---------------------------------------------------------------------
   SHARED CATALOG (Supabase)
   Paste your Supabase Project URL + anon/publishable key below and the
   shop + admin switch to the shared database: whatever the client adds
   or edits in admin.html is what EVERY customer sees.
   Both values are safe to be public — the database only lets logged-in
   admins write (see supabase/setup.sql). Never paste the service_role /
   secret key here.

   Leave them empty and the site runs in "local" mode: admin changes are
   saved in that one browser only (handy for testing).
   ===================================================================== */
var KC_CONFIG = {
  SUPABASE_URL: "https://kpudfaohuqxthzrnnocw.supabase.co",        // e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdWRmYW9odXF4dGh6cm5ub2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDgzMjQsImV4cCI6MjEwNzMyNDMyNH0.4dMzMgsiGl7WaJTvdBmZGZhopqNe32o32_pV3L-ooFU",   // the "anon public" key (eyJ...) or "publishable" key (sb_publishable_...)
  SUPABASE_BUCKET: "product-images",

  // Local mode only: password for admin.html when Supabase isn't set up.
  // (In Supabase mode the client logs in with her own email + password instead.)
  ADMIN_PASSWORD: "chaos2026",

  // Categories offered in the admin form. Must match the filter chips in index.html.
  CATEGORIES: [
    { id: "figures",   label: "Figures" },
    { id: "jewellery", label: "Jewellery" },
    { id: "bags",      label: "Bags" },
    { id: "beauty",    label: "Beauty" },
    { id: "keychains", label: "Keychains" },
    { id: "socks",     label: "Socks" }
  ],

  // Uploaded photos are shrunk to this many pixels on the longest side and saved as JPEG.
  // Supabase mode stores real files, so it can afford sharper photos than local mode.
  PHOTO_MAX_PX: 1400,
  PHOTO_QUALITY: 0.86,
  LOCAL_PHOTO_MAX_PX: 800,
  LOCAL_PHOTO_QUALITY: 0.82
};
