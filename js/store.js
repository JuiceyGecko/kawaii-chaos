/* =====================================================================
   Kawaii Chaos — data layer (shared by index.html and admin.html)
   ---------------------------------------------------------------------
   KCStore.mode is "supabase" when KC_CONFIG has a URL + key, else "local".
   Supabase table: public.products (see supabase/setup.sql)
     id, name, price, category, stock, note (short line), description,
     image_url, bg, alt, grade, option_label, options (jsonb),
     hidden, deleted, sort_order, updated_at
   In JS we keep the shop's existing product shape:
     { id, name, price, cat, stock, line, note, img, bg, alt, grade,
       optionLabel, options, hidden, deleted, sort }
   ===================================================================== */
(function () {
  "use strict";
  var CFG = window.KC_CONFIG || {};
  var URL_ = String(CFG.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  var KEY = String(CFG.SUPABASE_ANON_KEY || "").trim();
  var BUCKET = CFG.SUPABASE_BUCKET || "product-images";
  var MODE = URL_ && KEY ? "supabase" : "local";
  var Cat = window.KCCatalog;

  function fromRow(r) {
    var p = {
      id: r.id, name: r.name || "", price: Number(r.price) || 0, cat: r.category || "",
      stock: Number(r.stock) || 0, line: r.note || "", note: r.description || "",
      img: r.image_url || "images/kawaii-chaos-logo.jpeg", bg: r.bg === "dark" ? "dark" : "light",
      alt: r.alt || r.name || "", grade: r.grade || "",
      hidden: !!r.hidden, deleted: !!r.deleted, sort: Number(r.sort_order) || 0,
      updatedAt: r.updated_at || null
    };
    if (Array.isArray(r.options) && r.options.length) { p.options = r.options; p.optionLabel = r.option_label || "Option"; }
    return p;
  }
  function toRow(p) {
    var r = {};
    if ("id" in p) r.id = p.id;
    if ("name" in p) r.name = p.name;
    if ("price" in p) r.price = Math.max(0, Math.round(Number(p.price) || 0));
    if ("cat" in p) r.category = p.cat;
    if ("stock" in p) r.stock = Math.max(0, Math.round(Number(p.stock) || 0));
    if ("line" in p) r.note = p.line || "";
    if ("note" in p) r.description = p.note || "";
    if ("img" in p) r.image_url = p.img;
    if ("bg" in p) r.bg = p.bg === "dark" ? "dark" : "light";
    if ("alt" in p) r.alt = p.alt || "";
    if ("grade" in p) r.grade = p.grade || "";
    if ("options" in p) r.options = Array.isArray(p.options) && p.options.length ? p.options : null;
    if ("optionLabel" in p) r.option_label = p.optionLabel || null;
    if ("hidden" in p) r.hidden = !!p.hidden;
    if ("deleted" in p) r.deleted = !!p.deleted;
    if ("sort" in p) r.sort_order = Math.round(Number(p.sort) || 0);
    return r;
  }
  function forShop(list) {
    return list.filter(function (p) { return !p.hidden && !p.deleted; }).map(function (p) {
      var c = JSON.parse(JSON.stringify(p));
      delete c.hidden; delete c.deleted; delete c.sort; delete c.updatedAt; delete c._source; delete c.addedAt;
      return c;
    });
  }
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  /* ---------- Shop read (plain fetch — no library needed on the shop page) ---------- */
  var CACHE_KEY = "kawaiichaos-remote-cache-v1";
  function loadShop(base) {
    if (MODE === "local") return Promise.resolve(Cat ? Cat.merged(base) : base);
    var url = URL_ + "/rest/v1/products?select=*&hidden=eq.false&deleted=eq.false&order=sort_order.asc,name.asc";
    var headers = { apikey: KEY, Accept: "application/json" };
    if (/^eyJ/.test(KEY)) headers.Authorization = "Bearer " + KEY; // legacy anon JWT; new sb_publishable keys go in apikey only
    return withTimeout(fetch(url, { headers: headers, cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Supabase " + res.status);
      return res.json();
    }), 9000).then(function (rows) {
      var list = forShop(rows.map(fromRow));
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
      return list;
    }).catch(function (err) {
      if (window.console) console.warn("Kawaii Chaos: couldn't load the live catalog, using fallback.", err);
      try {
        var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (Array.isArray(cached) && cached.length) return cached;
      } catch (e) { /* ignore */ }
      return base;
    });
  }

  /* ---------- Admin (Supabase) ---------- */
  var sb = null;
  function client() {
    if (MODE !== "supabase") return null;
    if (!sb) {
      if (!window.supabase || !window.supabase.createClient) throw new Error("Supabase library didn't load (js/vendor/supabase.js).");
      sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "kawaiichaos-admin-auth" } });
    }
    return sb;
  }
  function check(res) {
    if (res.error) {
      var m = res.error.message || String(res.error);
      if (/row-level security|permission denied|not allowed|42501/i.test(m + (res.error.code || ""))) {
        m = "Not allowed — this login isn't on the shop's admin list (see SETUP.md step 3).";
      }
      throw new Error(m);
    }
    return res.data;
  }

  var remote = {
    session: function () {
      return client().auth.getSession().then(function (r) { return r.data && r.data.session ? r.data.session : null; });
    },
    signIn: function (email, password) {
      return client().auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        if (r.error) throw new Error(/invalid/i.test(r.error.message) ? "Wrong email or password." : r.error.message);
        return r.data.session;
      });
    },
    signOut: function () { return client().auth.signOut(); },
    isAdmin: function () {
      return client().rpc("kc_is_admin").then(function (r) {
        if (r.error) throw new Error("Couldn't check admin access (" + (r.error.message || "network error") + "). Was supabase/setup.sql run?");
        return r.data === true;
      });
    },
    all: function () {
      return client().from("products").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true })
        .then(check).then(function (rows) { return rows.map(fromRow); });
    },
    insert: function (p) { return client().from("products").insert(toRow(p)).select().then(check); },
    patch: function (id, fields) {
      return client().from("products").update(toRow(fields)).eq("id", id).select().then(check).then(function (rows) {
        if (!rows || !rows.length) throw new Error("Not saved — product missing or this login isn't an admin.");
        return rows;
      });
    },
    purge: function (id) { return client().from("products").delete().eq("id", id).then(check); },
    upsertMany: function (list) {
      return client().from("products").upsert(list.map(toRow), { onConflict: "id" }).select().then(check);
    },
    uploadPhoto: function (blob, id) {
      var path = String(id || "item").replace(/[^a-z0-9-]/gi, "") + "-" + Date.now().toString(36) + ".jpg";
      var bucket = client().storage.from(BUCKET);
      return bucket.upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }).then(function (r) {
        if (r.error) throw new Error("Photo upload failed: " + r.error.message);
        return bucket.getPublicUrl(path).data.publicUrl;
      });
    }
  };

  /* ---------- Admin (local, wraps js/catalog.js) ---------- */
  var BASE = function () { return window.PRODUCTS || []; };
  function localSave(d) {
    var r = Cat.write(d);
    if (!r.ok) throw new Error(r.quota
      ? "Browser storage is full — not saved. Delete forever some old products, or use smaller photos."
      : "Couldn't save (is this a private/incognito window?).");
  }
  function localFind(d, id) { for (var i = 0; i < d.added.length; i++) if (d.added[i].id === id) return i; return -1; }
  function isBase(id) { return BASE().some(function (p) { return p.id === id; }); }
  var local = {
    all: function () { return Promise.resolve(Cat.all(BASE())); },
    insert: function (p) {
      return Promise.resolve().then(function () {
        var d = Cat.read(); p.addedAt = new Date().toISOString(); d.added.push(p); localSave(d);
      });
    },
    patch: function (id, fields) {
      return Promise.resolve().then(function () {
        var d = Cat.read();
        if (isBase(id)) {
          var e = d.edits[id] || {};
          Object.keys(fields).forEach(function (k) { e[k] = fields[k]; });
          d.edits[id] = e;
        } else {
          var i = localFind(d, id);
          if (i < 0) throw new Error("That product no longer exists.");
          Object.keys(fields).forEach(function (k) { d.added[i][k] = fields[k]; });
        }
        localSave(d);
      });
    },
    purge: function (id) {
      return Promise.resolve().then(function () {
        var d = Cat.read(), i = localFind(d, id);
        if (i >= 0) d.added.splice(i, 1);
        else if (isBase(id)) { var e = d.edits[id] || {}; e.deleted = true; d.edits[id] = e; }
        localSave(d);
      });
    }
  };

  window.KCStore = {
    mode: MODE,
    bucket: BUCKET,
    loadShop: loadShop,
    remote: remote,
    local: local,
    fromRow: fromRow,
    toRow: toRow,
    admin: MODE === "supabase" ? remote : local
  };
})();
