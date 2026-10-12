/* =====================================================================
   Kawaii Chaos — catalog overrides (shared by index.html and admin.html)
   ---------------------------------------------------------------------
   Products added or edited in admin.html are saved in this browser's
   localStorage under "kawaiichaos-catalog-v1" and merged over the base
   PRODUCTS list from js/products.js.

   Stored shape:
   {
     v: 1,
     updatedAt: "ISO date",
     edits: { "<base product id>": { price, stock, name, line, note, cat, img, bg,
                                     optionLabel, options, hidden, deleted } },
     added: [ { id, name, line, cat, price, stock, img, bg, alt, note,
                optionLabel?, options?, hidden?, deleted?, addedAt } ]
   }
   hidden  = not shown in the shop, still listed in admin (easy to un-hide)
   deleted = soft delete: gone from the shop, parked under "Deleted" in admin, can be restored
   ===================================================================== */
(function () {
  "use strict";
  var KEY = "kawaiichaos-catalog-v1";

  function empty() { return { v: 1, updatedAt: null, edits: {}, added: [] }; }

  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d || typeof d !== "object") return empty();
      if (!d.edits || typeof d.edits !== "object") d.edits = {};
      if (!Array.isArray(d.added)) d.added = [];
      d.v = 1;
      return d;
    } catch (e) { return empty(); }
  }

  // Returns { ok: true } or { ok: false, quota: bool, error }
  function write(d) {
    d.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
      return { ok: true };
    } catch (e) {
      var quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
      return { ok: false, quota: !!quota, error: e };
    }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clean(p) {
    p.price = Math.max(0, Math.round(Number(p.price) || 0));
    p.stock = Math.max(0, Math.round(Number(p.stock) || 0));
    if (!p.line) p.line = "";
    if (!p.note) p.note = "";
    if (!p.alt) p.alt = p.name || "";
    if (p.grade == null) p.grade = "";
    if (p.bg !== "dark") p.bg = "light";
    if (!Array.isArray(p.options) || !p.options.length) { delete p.options; delete p.optionLabel; }
    return p;
  }

  // Every product with its flags — for admin. Each item gets _source: "base" | "added".
  function all(base) {
    var d = read(), out = [];
    (base || []).forEach(function (bp) {
      var p = clone(bp), e = d.edits[bp.id] || {};
      Object.keys(e).forEach(function (k) { p[k] = e[k]; });
      p._source = "base";
      out.push(clean(p));
    });
    d.added.forEach(function (ap) {
      if (!ap || !ap.id) return;
      var p = clone(ap);
      p._source = "added";
      out.push(clean(p));
    });
    return out;
  }

  // What the shop shows: everything not hidden or deleted.
  function merged(base) {
    return all(base).filter(function (p) { return !p.hidden && !p.deleted; })
      .map(function (p) { delete p._source; delete p.hidden; delete p.deleted; delete p.addedAt; return p; });
  }

  function bytesUsed() {
    try { return (localStorage.getItem(KEY) || "").length * 2; } catch (e) { return 0; }
  }

  window.KCCatalog = { KEY: KEY, read: read, write: write, all: all, merged: merged, empty: empty, bytesUsed: bytesUsed };
})();
