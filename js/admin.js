/* =====================================================================
   Kawaii Chaos — admin page logic (admin.html)
   Supabase mode: writes go to the shared products table + Storage (js/store.js).
   Local mode (no keys in js/config.js): saves to this browser via js/catalog.js.
   ===================================================================== */
(function () {
  "use strict";

  var SESSION_KEY = "kawaiichaos-admin-session";
  var CFG = window.KC_CONFIG || {};
  var BASE = window.PRODUCTS || [];
  var Cat = window.KCCatalog;
  var QUOTA_GUESS = 5 * 1024 * 1024; // most browsers give ~5 MB per site

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return "R" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item"; }
  function catLabel(id) {
    var c = (CFG.CATEGORIES || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }

  var toastTimer;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (bad ? " bad" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 2600);
  }

  var Store = window.KCStore;
  var REMOTE = Store.mode === "supabase";
  var DB = Store.admin;
  var cache = [];           // last loaded product list (with flags)
  var who = "";             // logged-in email (Supabase mode)

  /* ---------- Login ---------- */
  function loggedIn() { try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; } }
  function showAdmin() {
    $("#login-view").hidden = true;
    $("#admin-view").hidden = false;
    init();
  }
  $("#email-wrap").hidden = !REMOTE;
  $("#email").required = REMOTE;
  $("#mode-pill").textContent = REMOTE ? "● shared catalog — changes go live for everyone" : "local test mode — changes stay in this browser";
  setTimeout(function () { (REMOTE ? $("#email") : $("#pw")).focus(); }, 0);

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("#pw").value, errEl = $("#login-err");
    errEl.hidden = true;
    if (REMOTE) {
      var btn = $("#login-btn"); btn.classList.add("busy"); btn.textContent = "Logging in…";
      DB.signIn($("#email").value.trim(), pw).then(function (session) {
        who = session && session.user ? session.user.email : "";
        return DB.isAdmin();
      }).then(function (ok) {
        if (!ok) { DB.signOut(); throw new Error("This login works, but it isn't on the shop's admin list yet (SETUP.md step 3)."); }
        $("#pw").value = "";
        showAdmin();
      }).catch(function (err) {
        errEl.textContent = err.message || "Couldn't log in.";
        errEl.hidden = false;
      }).then(function () { btn.classList.remove("busy"); btn.textContent = "Log in"; });
      return;
    }
    if (CFG.ADMIN_PASSWORD && pw === CFG.ADMIN_PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (err) { /* private mode: still let them in for this page */ }
      $("#pw").value = "";
      showAdmin();
    } else {
      errEl.textContent = "That's not it — try again.";
      errEl.hidden = false;
      $("#pw").select();
    }
  });
  $("#logout").addEventListener("click", function () {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    (REMOTE ? DB.signOut() : Promise.resolve()).then(function () { location.reload(); }, function () { location.reload(); });
  });

  /* ---------- Saving ---------- */
  var working = false;
  function run(promise, okMsg) {
    working = true;
    document.body.classList.add("busy");
    return promise.then(function () {
      if (okMsg) toast(okMsg);
      return render();
    }).then(function () { return true; }, function (err) {
      toast(err && err.message ? err.message : "Couldn't save — check your connection and try again.", true);
      return render().then(function () { return false; }, function () { return false; });
    }).then(function (ok) {
      working = false;
      document.body.classList.remove("busy");
      return ok;
    });
  }
  function find(id) { return cache.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- Photo: shrink to ~800px JPEG data URL ---------- */
  var pendingPhoto = null;
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error("Please choose an image file.")); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = REMOTE ? (CFG.PHOTO_MAX_PX || 1400) : (CFG.LOCAL_PHOTO_MAX_PX || 800), w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); // transparent PNGs → white, not black
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var q = REMOTE ? (CFG.PHOTO_QUALITY || 0.86) : (CFG.LOCAL_PHOTO_QUALITY || 0.82);
        var dataUrl = c.toDataURL("image/jpeg", q);
        if (!REMOTE || !c.toBlob) { resolve({ dataUrl: dataUrl, blob: null }); return; }
        c.toBlob(function (blob) { resolve({ dataUrl: dataUrl, blob: blob }); }, "image/jpeg", q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be read. Try a JPG or PNG.")); };
      img.src = url;
    });
  }
  $("#f-photo").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    shrink(f).then(function (data) {
      pendingPhoto = data;
      $("#photo-img").src = data.dataUrl;
      $("#photo-size").textContent = "≈ " + Math.round((data.blob ? data.blob.size : data.dataUrl.length * 0.75) / 1024) + " KB after shrinking";
      $("#photo-preview").hidden = false;
    }).catch(function (err) {
      pendingPhoto = null;
      $("#f-photo").value = "";
      toast(err.message, true);
    });
  });

  /* ---------- Add / edit form ---------- */
  function fillCats() {
    $("#f-cat").innerHTML = '<option value="">Choose…</option>' + (CFG.CATEGORIES || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.label) + "</option>";
    }).join("");
  }
  function resetForm() {
    $("#product-form").reset();
    $("#f-id").value = "";
    pendingPhoto = null;
    $("#photo-preview").hidden = true;
    $("#photo-img").removeAttribute("src");
    $("#form-title").textContent = "Add a product";
    $("#save-btn").textContent = "Add to shop";
    $("#cancel-edit").hidden = true;
    $("#photo-req").hidden = false;
    $("#form-err").hidden = true;
  }
  function startEdit(id) {
    var p = find(id);
    if (!p) return;
    resetForm();
    $("#f-id").value = p.id;
    $("#f-name").value = p.name || "";
    $("#f-price").value = p.price;
    $("#f-stock").value = p.stock;
    $("#f-cat").value = p.cat || "";
    $("#f-line").value = p.line || "";
    $("#f-note").value = p.note || "";
    $("#f-optlabel").value = p.optionLabel || "";
    $("#f-options").value = (p.options || []).map(function (o) { return o.label; }).join("\n");
    var bg = document.querySelector('input[name="f-bg"][value="' + (p.bg === "dark" ? "dark" : "light") + '"]');
    if (bg) bg.checked = true;
    $("#photo-img").src = p.img;
    $("#photo-size").textContent = "current photo — choose a file to replace it";
    $("#photo-preview").hidden = false;
    $("#photo-req").hidden = true;
    $("#form-title").textContent = "Edit: " + p.name;
    $("#save-btn").textContent = "Save changes";
    $("#cancel-edit").hidden = false;
    $("#f-name").focus();
    if (window.innerWidth <= 820) $("#product-form").scrollIntoView({ behavior: "smooth" });
  }
  $("#cancel-edit").addEventListener("click", resetForm);

  function parseOptions(text) {
    var seen = {};
    return text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (label) {
      var id = slug(label), n = 2;
      while (seen[id]) id = slug(label) + "-" + n++;
      seen[id] = true;
      return { id: id, label: label.slice(0, 40) };
    });
  }

  $("#product-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#form-err");
    var editing = $("#f-id").value;
    var name = $("#f-name").value.trim();
    var price = $("#f-price").value, stock = $("#f-stock").value, cat = $("#f-cat").value;
    var problems = [];
    if (!name) problems.push("a name");
    if (price === "" || Number(price) < 0) problems.push("a price");
    if (stock === "" || Number(stock) < 0) problems.push("stock (0 is fine)");
    if (!cat) problems.push("a category");
    if (!editing && !pendingPhoto) problems.push("a photo");
    if (problems.length) { err.textContent = "Please add " + problems.join(", ") + "."; err.hidden = false; return; }
    err.hidden = true;

    var options = parseOptions($("#f-options").value);
    var fields = {
      name: name,
      price: Math.round(Number(price)),
      stock: Math.round(Number(stock)),
      cat: cat,
      line: $("#f-line").value.trim(),
      note: $("#f-note").value.trim(),
      alt: name,
      bg: (document.querySelector('input[name="f-bg"]:checked') || {}).value === "dark" ? "dark" : "light",
      options: options.length ? options : null,
      optionLabel: options.length ? ($("#f-optlabel").value.trim() || "Option") : null
    };
    if (working) return;

    var id = editing;
    if (!editing) {
      var taken = {};
      cache.forEach(function (p) { taken[p.id] = 1; });
      BASE.forEach(function (p) { taken[p.id] = 1; });
      id = slug(name); var n = 2;
      while (taken[id]) id = slug(name) + "-" + n++;
    }
    var photo = pendingPhoto;
    var btn = $("#save-btn"), label = btn.textContent;
    btn.textContent = photo && REMOTE ? "Uploading photo…" : "Saving…";

    var job = Promise.resolve().then(function () {
      if (!photo) return null;
      if (REMOTE && photo.blob) return Store.remote.uploadPhoto(photo.blob, id);
      return photo.dataUrl;
    }).then(function (imgUrl) {
      if (imgUrl) fields.img = imgUrl;
      if (editing) return DB.patch(editing, fields);
      fields.id = id;
      fields.grade = "";
      fields.hidden = false;
      fields.deleted = false;
      fields.sort = cache.reduce(function (m, p) { return Math.max(m, p.sort || 0); }, 0) + 10;
      return DB.insert(fields);
    });
    run(job, editing ? "Saved ✓ " + name : "Added ✓ " + name + " is in the shop").then(function (ok) {
      btn.textContent = label;
      if (ok) resetForm();
    });
  });

  /* ---------- Product list ---------- */
  function rowHTML(p, deletedView) {
    var edited = !REMOTE && p._source === "base" && Cat.read().edits[p.id] && Object.keys(Cat.read().edits[p.id]).some(function (k) { return k !== "hidden"; });
    var tags =
      (!REMOTE && p._source === "added" ? '<span class="tag new">added</span>' : "") +
      (edited ? '<span class="tag edited">edited</span>' : "") +
      (p.hidden ? '<span class="tag hidden">hidden</span>' : "") +
      (p.stock <= 0 ? '<span class="tag sold">sold</span>' : "");
    var sub = esc(catLabel(p.cat)) + (p.line ? " · " + esc(p.line) : "") +
      (p.options ? " · " + p.options.length + " " + esc((p.optionLabel || "option").toLowerCase()) + " choices" : "");
    var acts = deletedView
      ? '<button class="btn xs" type="button" data-act="restore" data-id="' + esc(p.id) + '">Restore</button>' +
        (REMOTE || p._source === "added" ? '<button class="btn xs ghost danger" type="button" data-act="purge" data-id="' + esc(p.id) + '">Delete forever</button>' : "")
      : '<button class="btn xs" type="button" data-act="quick" data-id="' + esc(p.id) + '">Save</button>' +
        '<button class="btn xs ghost" type="button" data-act="edit" data-id="' + esc(p.id) + '">Edit</button>' +
        '<button class="btn xs ghost" type="button" data-act="' + (p.hidden ? "show" : "hide") + '" data-id="' + esc(p.id) + '">' + (p.hidden ? "Show" : "Hide") + "</button>" +
        '<button class="btn xs ghost danger" type="button" data-act="delete" data-id="' + esc(p.id) + '">Delete</button>';
    return (
      '<div class="item' + (p.hidden ? " is-hidden" : "") + '">' +
        '<img class="thumb' + (p.bg === "dark" ? " dark" : "") + '" src="' + esc(p.img) + '" alt="" loading="lazy" />' +
        "<div>" +
          "<h4>" + esc(p.name) + tags + "</h4>" +
          '<div class="sub">' + sub + "</div>" +
          (deletedView
            ? '<div class="quick"><span class="mono">' + money(p.price) + " · stock " + p.stock + '</span><div class="acts">' + acts + "</div></div>"
            : '<div class="quick">' +
                '<div><label for="qp-' + esc(p.id) + '">Price (R)</label><input id="qp-' + esc(p.id) + '" type="number" inputmode="numeric" min="0" step="1" value="' + p.price + '" /></div>' +
                '<div><label for="qs-' + esc(p.id) + '">Stock</label><input id="qs-' + esc(p.id) + '" type="number" inputmode="numeric" min="0" step="1" value="' + p.stock + '" /></div>' +
                '<div class="acts">' + acts + "</div>" +
              "</div>") +
        "</div>" +
      "</div>"
    );
  }

  function paint() {
    var all = cache;
    var live = all.filter(function (p) { return !p.deleted; });
    var gone = all.filter(function (p) { return p.deleted; });
    var showing = live.filter(function (p) { return !p.hidden; }).length;
    $("#count").textContent = showing + " in shop" + (live.length - showing ? " · " + (live.length - showing) + " hidden" : "");
    $("#list").innerHTML = live.map(function (p) { return rowHTML(p, false); }).join("") ||
      '<p class="empty">No products yet — add one on the left' + (REMOTE ? ', or tap <strong>Add the built-in products</strong> below.' : '.') + '</p>';
    $("#deleted-wrap").hidden = !gone.length;
    $("#deleted-count").textContent = "(" + gone.length + ")";
    $("#deleted-list").innerHTML = gone.map(function (p) { return rowHTML(p, true); }).join("");

    var st = $("#storage");
    if (REMOTE) {
      st.textContent = who ? "logged in as " + who : "";
      st.classList.remove("warn");
      var missing = BASE.filter(function (b) { return !find(b.id); }).length;
      $("#seed").hidden = !missing;
      $("#seed").textContent = "Add the built-in products (" + missing + ")";
    } else {
      var used = Cat.bytesUsed(), pct = Math.round(used / QUOTA_GUESS * 100);
      st.textContent = "storage ≈ " + (used / 1024 / 1024).toFixed(2) + " MB of ~5 MB";
      st.classList.toggle("warn", pct >= 75);
      st.title = pct >= 75 ? "Getting full — use smaller photos or delete forever old added products." : "";
    }
  }
  function render() {
    return DB.all().then(function (list) { cache = list; paint(); }, function (err) {
      toast("Couldn't load products: " + (err && err.message ? err.message : "check your connection"), true);
      paint();
    });
  }

  $("#list").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.matches("input")) {
      var btn = e.target.closest(".item").querySelector('[data-act="quick"]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || working) return;
    var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
    var p = find(id);
    if (!p) return;
    if (act === "quick") {
      var price = document.getElementById("qp-" + id).value, stock = document.getElementById("qs-" + id).value;
      if (price === "" || stock === "" || Number(price) < 0 || Number(stock) < 0) { toast("Price and stock need a number (0 or more).", true); return; }
      run(DB.patch(id, { price: Math.round(Number(price)), stock: Math.round(Number(stock)) }),
        "Saved ✓ " + p.name + " — " + money(price) + ", stock " + Math.round(Number(stock)));
    } else if (act === "edit") {
      startEdit(id);
    } else if (act === "hide" || act === "show") {
      run(DB.patch(id, { hidden: act === "hide" }), act === "hide" ? p.name + " is hidden from the shop" : p.name + " is back in the shop");
    } else if (act === "delete") {
      if (!confirm("Delete \"" + p.name + "\" from the shop?\n\nYou can restore it later from the Deleted list.")) return;
      if ($("#f-id").value === id) resetForm();
      run(DB.patch(id, { deleted: true }), p.name + " deleted (restore it under Deleted)");
    } else if (act === "restore") {
      run(DB.patch(id, { deleted: false }), p.name + " restored");
    } else if (act === "purge") {
      if (!confirm("Delete \"" + p.name + "\" forever? This can't be undone.")) return;
      run(DB.purge(id), p.name + " removed for good");
    }
  });

  /* ---------- Backup / restore / seed / reset ---------- */
  function download(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  $("#export").addEventListener("click", function () {
    var day = new Date().toISOString().slice(0, 10);
    if (REMOTE) {
      download({ kind: "kawaii-chaos-products", v: 2, exportedAt: new Date().toISOString(), products: cache.map(function (p) {
        var c = JSON.parse(JSON.stringify(p)); delete c.updatedAt; return c;
      }) }, "kawaii-chaos-backup-" + day + ".json");
    } else {
      var d = Cat.read();
      d.exportedAt = new Date().toISOString();
      d.note = "Kawaii Chaos admin changes (local mode).";
      download(d, "kawaii-chaos-changes-" + day + ".json");
    }
    toast("Downloaded — keep it safe");
  });

  // Turn a backup file (v2 list) or an old local-mode changes file (v1) into a product list.
  function productsFromFile(d) {
    if (d && Array.isArray(d.products)) return d.products.filter(function (p) { return p && p.id && p.name; });
    if (d && (d.edits || d.added)) {
      var list = BASE.map(function (bp) {
        var p = JSON.parse(JSON.stringify(bp)), e = (d.edits || {})[bp.id] || {};
        Object.keys(e).forEach(function (k) { p[k] = e[k]; });
        return p;
      });
      return list.concat((d.added || []).filter(function (p) { return p && p.id && p.name; }));
    }
    throw new Error("bad");
  }
  function sortFor(list) {
    return list.map(function (p, i) { var c = JSON.parse(JSON.stringify(p)); if (c.sort == null) c.sort = (i + 1) * 10; return c; });
  }

  $("#import").addEventListener("change", function () {
    var f = this.files && this.files[0], input = this;
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (REMOTE) {
          var list = sortFor(productsFromFile(d));
          if (!confirm("Load " + list.length + " product(s) from this file into the live shop?\n\nProducts with the same id are overwritten; others are left alone.")) return;
          run(Store.remote.upsertMany(list.map(function (p) {
            return { id: p.id, name: p.name, price: p.price, cat: p.cat, stock: p.stock, line: p.line, note: p.note, img: p.img,
              bg: p.bg, alt: p.alt, grade: p.grade, options: p.options || null, optionLabel: p.optionLabel || null,
              hidden: !!p.hidden, deleted: !!p.deleted, sort: p.sort };
          })), "Loaded ✓ " + list.length + " product(s) — live now");
          return;
        }
        if (!d || typeof d !== "object" || (!d.edits && !d.added)) throw new Error("bad");
        var clean = Cat.empty();
        clean.edits = d.edits && typeof d.edits === "object" ? d.edits : {};
        clean.added = Array.isArray(d.added) ? d.added.filter(function (p) { return p && p.id && p.name; }) : [];
        if (!confirm("Replace the changes in this browser with this file?\n\n" + clean.added.length + " added product(s), " + Object.keys(clean.edits).length + " edited.")) return;
        var w = Cat.write(clean);
        if (!w.ok) { toast("Couldn't save in this browser.", true); return; }
        toast("Loaded ✓"); render();
      } catch (e) { toast("That file isn't a Kawaii Chaos backup.", true); }
      finally { input.value = ""; }
    };
    r.readAsText(f);
  });

  $("#seed").addEventListener("click", function () {
    var missing = BASE.filter(function (b) { return !find(b.id); });
    if (!missing.length) return;
    var top = cache.reduce(function (m, p) { return Math.max(m, p.sort || 0); }, 0);
    run(Store.remote.upsertMany(missing.map(function (p, i) {
      var img = p.img; // relative "images/…" paths work wherever the site is hosted
      return { id: p.id, name: p.name, price: p.price, cat: p.cat, stock: p.stock, line: p.line, note: p.note, img: img,
        bg: p.bg, alt: p.alt, grade: p.grade || "", options: p.options || null, optionLabel: p.optionLabel || null,
        hidden: false, deleted: false, sort: top + (i + 1) * 10 };
    })), "Added " + missing.length + " built-in product(s) ✓");
  });

  $("#reset").addEventListener("click", function () {
    if (REMOTE) return;
    if (!confirm("Undo ALL admin changes in this browser?\n\nAdded products are removed and the shop goes back to the built-in list. Tip: Download a backup first if you might want them back.")) return;
    try { localStorage.removeItem(Cat.KEY); } catch (e) { /* ignore */ }
    resetForm(); render();
    toast("Back to the built-in list");
  });

  if (!REMOTE) window.addEventListener("storage", function (e) { if (e.key === Cat.KEY && loggedIn()) render(); });

  function setupChrome() {
    var n = $("#notice");
    if (REMOTE) {
      n.className = "notice live";
      n.innerHTML = '<span class="dot"></span><strong>Live shop:</strong> every change you save here shows for all customers straight away (they may need to refresh the page).';
      $("#reset").hidden = true;
      $("#import-wrap").firstChild.textContent = "Load a backup file";
      $("#tools-hint").textContent = "Download a backup now and then. Loading a backup puts those products back into the live shop.";
    } else {
      n.className = "notice";
      n.innerHTML = "<strong>Test mode:</strong> changes save in <em>this browser on this device</em> only — customers won't see them. " +
        "Connect the shared database (see SETUP.md) so changes go live for everyone.";
      $("#tools-hint").textContent = "Loading a file replaces the changes in this browser. Use it to move your edits to another phone or laptop.";
    }
  }

  var started = false;
  function init() {
    if (started) return;
    started = true;
    fillCats();
    setupChrome();
    render();
  }

  if (REMOTE) {
    DB.session().then(function (session) {
      if (!session) return;
      who = session.user ? session.user.email : "";
      return DB.isAdmin().then(function (ok) { if (ok) showAdmin(); });
    }).catch(function () { /* stay on login */ });
  } else if (loggedIn()) showAdmin();
})();
