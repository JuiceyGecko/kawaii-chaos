/* =====================================================================
   Kawaii Chaos shop script — plain JavaScript, no build step.
   ---------------------------------------------------------------------
   SETTINGS — the only part most people need to touch.
   ===================================================================== */
var SETTINGS = {
  // 1) Payments. Leave BOTH empty = demo mode (no money moves).
  //    Paste ONE link and the "Place order" button sends customers there.
  //    See README.md → "Taking real payments".
  STRIPE_PAYMENT_LINK: "",   // e.g. "https://buy.stripe.com/abc123"  (Stripe Payment Link)
  PAYSTACK_PAGE_LINK: "",    // e.g. "https://paystack.com/pay/kawaiichaos" (Paystack Payment Page — Stripe's SA arm)

  // 2) Your shop email. TODO: replace — also replace it in index.html (search for REPLACE_ME).
  SHOP_EMAIL: "REPLACE_ME@example.com",

  // 3) Courier options shown at checkout, in rand. TODO: set your real prices.
  SHIPPING: [
    { id: "locker", label: "Courier to a locker / pickup point", price: 70 },
    { id: "door",   label: "Courier to your door",               price: 120 }
  ],

  CURRENCY_NOTE: "Prices in South African rand (ZAR)."
};

/* PRODUCTS now live in js/products.js (loaded before this file). */

/* The live product list comes from KCStore (js/store.js):
   Supabase shared catalog when configured in js/config.js, otherwise the built-in list
   plus any admin edits saved in this browser. See the loader at the bottom of this file. */

/* =====================================================================
   Nothing below here needs editing for day-to-day use.
   ===================================================================== */
function kcStartShop() {
  "use strict";

  var STORAGE_KEY = "kawaiichaos-cart-v1";
  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  // Basket keys are "productId" or "productId|optionId" (e.g. "adventure-time-socks|jake").
  function keyOf(id, opt) { return opt ? id + "|" + opt : id; }
  function parseKey(key) {
    var parts = String(key).split("|"), p = byId[parts[0]], opt = parts[1] || "";
    var o = null;
    if (p && p.options) o = p.options.filter(function (x) { return x.id === opt; })[0] || null;
    return { id: parts[0], p: p, opt: opt, option: o };
  }
  function validKey(key) {
    var k = parseKey(key);
    if (!k.p) return false;
    return k.p.options ? !!k.option : !k.opt;
  }
  function lineName(key) {
    var k = parseKey(key);
    return k.p.name + (k.option ? " — " + k.option.label : "");
  }

  function $(sel) { return document.querySelector(sel); }
  function money(n) {
    // South African style: R2 650 (space as thousands separator)
    return "R" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function liveProvider() {
    if (SETTINGS.STRIPE_PAYMENT_LINK) return "stripe";
    if (SETTINGS.PAYSTACK_PAGE_LINK) return "paystack";
    return "demo";
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = $("#menu-btn"), nav = $("#site-nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  window.addEventListener("resize", function () { if (window.innerWidth > 720) setMenu(false); });

  /* ---------- Product grid ---------- */
  var currentFilter = "all";
  function cardHTML(p) {
    var sold = p.stock <= 0;
    var flag = sold ? '<span class="stock">SOLD</span>' : (p.stock === 1 ? '<span class="stock">1 LEFT</span>' : "");
    var grade = p.grade ? ' · box <span class="grade" title="Box grade ' + p.grade + '">' + p.grade + "</span>" : "";
    return (
      '<article class="card' + (sold ? " sold" : "") + '">' +
        '<div class="photo' + (p.bg === "dark" ? " dark" : "") + '" role="button" tabindex="0" data-zoom="' + esc(p.img) + '" data-zoom-alt="' + esc(p.alt) + '" data-zoom-cap="' + esc(p.name) + '" aria-label="Enlarge photo of ' + esc(p.name) + '">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.alt) + '" width="960" height="960" loading="lazy" />' +
          flag +
          (sold ? "" : '<span class="price-sticker">' + money(p.price) + "</span>") +
        "</div>" +
        '<div class="meta mono"><span>' + esc(p.line) + grade + "</span></div>" +
        "<h3>" + esc(p.name) + "</h3>" +
        "<p>" + esc(p.note) + "</p>" +
        (!sold && p.options
          ? '<label class="opt mono" for="opt-' + p.id + '">' + esc(p.optionLabel || "Option") + "</label>" +
            '<select class="opt-select" id="opt-' + p.id + '" data-opt-for="' + p.id + '">' +
              '<option value="">Choose ' + esc((p.optionLabel || "an option").toLowerCase()) + "…</option>" +
              p.options.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + "</option>"; }).join("") +
            "</select>"
          : "") +
        (sold
          ? '<button class="add" type="button" disabled>Sold</button>'
          : '<button class="add" type="button" data-add="' + p.id + '">Add to basket — ' + money(p.price) + "</button>") +
      "</article>"
    );
  }
  function renderGrid() {
    var list = PRODUCTS.filter(function (p) { return currentFilter === "all" || p.cat === currentFilter; });
    $("#grid").innerHTML = list.map(cardHTML).join("") || '<p class="empty">Nothing here right now — check back soon ♡</p>';
  }
  document.querySelectorAll("[data-filter]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      currentFilter = chip.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (c) {
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      });
      renderGrid();
    });
  });

  /* ---------- Basket state (saved in this browser) ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"), clean = {};
      var used = {};
      Object.keys(raw).forEach(function (key) {
        if (!validKey(key)) return;
        var p = parseKey(key).p, q = parseInt(raw[key], 10), left = p.stock - (used[p.id] || 0);
        if (p.stock > 0 && q > 0 && left > 0) {
          clean[key] = Math.min(q, left);
          used[p.id] = (used[p.id] || 0) + clean[key];
        }
      });
      return clean;
    } catch (e) { return {}; }
  }
  var cart = load();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ } }
  function count() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function subtotal() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k] * parseKey(k).p.price; }, 0); }
  // How many of a product are in the basket across all its options (stock is shared).
  function inBasket(id, exceptKey) {
    return Object.keys(cart).reduce(function (s, k) {
      return s + (k !== exceptKey && parseKey(k).id === id ? cart[k] : 0);
    }, 0);
  }

  function setQty(key, q) {
    if (!validKey(key)) return;
    var p = parseKey(key).p;
    if (q <= 0) delete cart[key];
    else cart[key] = Math.min(q, Math.max(0, p.stock - inBasket(p.id, key)));
    if (cart[key] === 0) delete cart[key];
    save(); renderCart();
  }
  function add(id, opt) {
    var p = byId[id], key = keyOf(id, opt);
    if (!p || p.stock <= 0 || !validKey(key)) return false;
    if (inBasket(id) >= p.stock) return false;
    setQty(key, (cart[key] || 0) + 1);
    var b = $("#cart-count"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    return true;
  }

  function renderCart() {
    $("#cart-count").textContent = count();
    var ids = Object.keys(cart);
    if (!ids.length) {
      $("#lines").innerHTML = '<div class="empty">Nothing in here yet.<br />Have a look at <a href="#drop" data-close>the shop</a>.</div>';
    } else {
      $("#lines").innerHTML = ids.map(function (id) {
        var k = parseKey(id), p = k.p, q = cart[id], atMax = inBasket(p.id) >= p.stock;
        return (
          '<div class="line">' +
            '<img src="' + esc(p.img) + '" alt="" />' +
            "<div>" +
              "<h4>" + esc(p.name) + "</h4>" +
              (k.option ? '<div class="unit mono line-opt">' + esc(p.optionLabel || "Option") + ": <strong>" + esc(k.option.label) + "</strong></div>" : "") +
              '<div class="unit mono">' + esc(p.line) + " · " + money(p.price) + "</div>" +
              '<div class="qty">' +
                '<button type="button" data-dec="' + esc(id) + '" aria-label="One less ' + esc(lineName(id)) + '">−</button>' +
                "<span>" + q + "</span>" +
                '<button type="button" data-inc="' + esc(id) + '" aria-label="One more ' + esc(lineName(id)) + '"' + (atMax ? " disabled title=\"That's all I have\"" : "") + ">+</button>" +
              "</div>" +
            "</div>" +
            '<div class="line-total">' + money(p.price * q) +
              '<button type="button" class="remove" data-remove="' + esc(id) + '">Remove</button>' +
            "</div>" +
          "</div>"
        );
      }).join("");
    }
    $("#subtotal").textContent = money(subtotal());
    $("#to-checkout").disabled = !ids.length;
  }

  /* ---------- Drawer ---------- */
  var drawer = $("#drawer"), overlay = $("#overlay"), cartBtn = $("#cart-btn");
  function view(name) {
    $("#view-cart").hidden = name !== "cart";
    $("#foot-cart").hidden = name !== "cart";
    $("#view-checkout").hidden = name !== "checkout";
    $("#view-done").hidden = name !== "done";
    $("#drawer-title").textContent = name === "checkout" ? "Checkout" : name === "done" ? "Thank you" : "Your basket";
  }
  function isOpen() { return drawer.classList.contains("open"); }
  function openDrawer() {
    setMenu(false);
    view("cart");
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add("open"); });
    drawer.classList.add("open");
    drawer.inert = false;
    cartBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("locked");
    $("#drawer-close").focus();
  }
  function closeDrawer() {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
    drawer.inert = true;
    cartBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("locked");
    setTimeout(function () { if (!isOpen()) overlay.hidden = true; }, 260);
    cartBtn.focus();
  }
  cartBtn.addEventListener("click", function () { isOpen() ? closeDrawer() : openDrawer(); });
  $("#drawer-close").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      var z = e.target.closest && e.target.closest("[data-zoom]");
      if (z && e.target === z) {
        e.preventDefault();
        openLightbox(z.getAttribute("data-zoom"), z.getAttribute("data-zoom-alt"), z.getAttribute("data-zoom-cap"));
        return;
      }
    }
    if (e.key !== "Escape") return;
    if (isLightboxOpen()) { closeLightbox(); return; }
    if (isOpen()) closeDrawer();
    else if (nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });

  /* ---------- Click handling ---------- */
  document.addEventListener("click", function (e) {
    var zoom = e.target.closest("[data-zoom]");
    if (zoom && !e.target.closest("[data-add],[data-inc],[data-dec],[data-remove]")) {
      e.preventDefault();
      openLightbox(zoom.getAttribute("data-zoom"), zoom.getAttribute("data-zoom-alt"), zoom.getAttribute("data-zoom-cap"));
      return;
    }
    var t = e.target.closest("[data-add],[data-inc],[data-dec],[data-remove],[data-close]");
    if (!t) return;
    if (t.hasAttribute("data-add")) {
      var id = t.getAttribute("data-add"), label = "Add to basket — " + money(byId[id].price);
      var sel = byId[id].options ? document.getElementById("opt-" + id) : null;
      if (sel && !sel.value) {
        sel.classList.add("need");
        sel.focus();
        t.textContent = "Pick a " + (byId[id].optionLabel || "option").toLowerCase() + " first";
        clearTimeout(t._timer);
        t._timer = setTimeout(function () { t.textContent = label; }, 1600);
        return;
      }
      var ok = add(id, sel ? sel.value : "");
      t.classList.toggle("added", ok);
      t.textContent = ok ? "In your basket ✓" : "That's all I have";
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.classList.remove("added"); t.textContent = label; }, 1300);
    } else if (t.hasAttribute("data-inc")) {
      var i = t.getAttribute("data-inc"); setQty(i, (cart[i] || 0) + 1);
    } else if (t.hasAttribute("data-dec")) {
      var d = t.getAttribute("data-dec"); setQty(d, (cart[d] || 0) - 1);
    } else if (t.hasAttribute("data-remove")) {
      setQty(t.getAttribute("data-remove"), 0);
    } else if (t.hasAttribute("data-close")) {
      closeDrawer();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.matches && e.target.matches("[data-opt-for]")) e.target.classList.remove("need");
  });

  /* ---------- Checkout ---------- */
  function shipping() {
    var chosen = document.querySelector('input[name="ship"]:checked');
    var opt = SETTINGS.SHIPPING.filter(function (o) { return chosen && o.id === chosen.value; })[0];
    return opt || SETTINGS.SHIPPING[0];
  }
  function total() { return subtotal() + shipping().price; }
  function renderShipOptions() {
    $("#ship-options").innerHTML = SETTINGS.SHIPPING.map(function (o, i) {
      return '<label class="radio"><input type="radio" name="ship" value="' + esc(o.id) + '"' + (i === 0 ? " checked" : "") + " />" +
        "<span>" + esc(o.label) + '</span><span class="amt">' + money(o.price) + "</span></label>";
    }).join("");
  }
  function renderSummary() {
    var n = count();
    $("#summary").innerHTML =
      '<div class="row"><span>' + n + " item" + (n === 1 ? "" : "s") + '</span><span class="amt">' + money(subtotal()) + "</span></div>" +
      '<div class="row"><span>Courier</span><span class="amt">' + money(shipping().price) + "</span></div>" +
      '<div class="row total"><span>To pay</span><span class="amt">' + money(total()) + "</span></div>";
  }
  $("#ship-options").addEventListener("change", renderSummary);

  function orderCode() {
    // Short code you can match against the payment, e.g. KC-K9F2QX
    return "KC-" + Date.now().toString(36).toUpperCase().slice(-6);
  }
  function orderLines() {
    return Object.keys(cart).map(function (k) {
      return cart[k] + " x " + lineName(k) + " (" + money(parseKey(k).p.price * cart[k]) + ")";
    });
  }
  function paymentUrl(code, email) {
    var p = liveProvider();
    if (p === "stripe") {
      var base = SETTINGS.STRIPE_PAYMENT_LINK;
      // Stripe Payment Links accept these two URL parameters.
      // client_reference_id: letters, numbers, - and _ only (max 200) → order code + item ids/qty
      var ref = (code + "_" + Object.keys(cart).map(function (k) { return k.replace("|", "-") + "x" + cart[k]; }).join("_"))
        .replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
      return base + (base.indexOf("?") === -1 ? "?" : "&") +
        "prefilled_email=" + encodeURIComponent(email) + "&client_reference_id=" + encodeURIComponent(ref);
    }
    if (p === "paystack") return SETTINGS.PAYSTACK_PAGE_LINK;
    return "";
  }
  function orderMailto(code, f) {
    var body = [
      "Order " + code, "",
      orderLines().join("\n"),
      "Courier: " + shipping().label + " (" + money(shipping().price) + ")",
      "Total: " + money(total()), "",
      "Name: " + f.name, "Email: " + f.email, "Phone: " + (f.phone || "-"),
      "Deliver to: " + f.address
    ].join("\n");
    return "mailto:" + SETTINGS.SHOP_EMAIL + "?subject=" + encodeURIComponent("Kawaii Chaos order " + code) +
      "&body=" + encodeURIComponent(body);
  }

  $("#to-checkout").addEventListener("click", function () {
    if (!count()) return;
    var p = liveProvider(), banner = $("#mode-banner");
    if (p === "demo") {
      banner.className = "banner";
      banner.textContent = "Demo mode: no payment is taken and nothing is sent. (Shop owner: add a payment link in js/shop.js to go live.)";
      $("#pay-btn").textContent = "Place order (demo)";
    } else {
      banner.className = "banner live";
      banner.textContent = "You'll pay securely on " + (p === "stripe" ? "Stripe" : "Paystack") +
        " in a new tab. Card details never touch this site.";
      $("#pay-btn").textContent = "Continue to payment";
    }
    renderShipOptions();
    renderSummary();
    view("checkout");
    $("#co-name").focus();
  });
  $("#back-to-cart").addEventListener("click", function () { view("cart"); });

  $("#checkout-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = {
      name: $("#co-name").value.trim(), email: $("#co-email").value.trim(),
      phone: $("#co-phone").value.trim(), address: $("#co-address").value.trim()
    };
    var code = orderCode(), p = liveProvider(), amount = money(total());
    var payAgain = $("#pay-again");

    if (p === "demo") {
      $("#done-title").textContent = "Order placed (demo)";
      $("#done-msg").innerHTML = "Thanks, " + esc(f.name || "friend") + ". In the live shop you'd now pay " + amount +
        " and get a confirmation at " + esc(f.email) + ".<br /><br />Order code: <span class=\"code\">" + code + "</span><br /><small>Demo only — no payment was taken.</small>";
      payAgain.hidden = true;
      $("#paid-clear").hidden = true;
      cart = {}; save(); renderCart();
      this.reset();
      view("done");
      return;
    }

    var url = paymentUrl(code, f.email);
    try {
      localStorage.setItem("kawaiichaos-last-order", JSON.stringify({ code: code, total: total(), lines: orderLines(), at: new Date().toISOString() }));
    } catch (err) { /* ignore */ }
    window.open(url, "_blank", "noopener");

    $("#done-title").textContent = "Almost there";
    $("#done-msg").innerHTML =
      "The payment page opened in a new tab. Total: <strong>" + amount + "</strong>" +
      (p === "paystack" ? " — please enter exactly this amount and put <span class=\"code\">" + code + "</span> in the reference/notes." : ".") +
      "<br /><br />Your order code: <span class=\"code\">" + code + "</span><br /><br />" +
      'So I know exactly what to pack, please also <a href="' + esc(orderMailto(code, f)) + '">email me your order list</a> (it\'s pre-written).' +
      "<br /><br /><small>Your basket stays saved until you clear it.</small>";
    payAgain.href = url;
    payAgain.hidden = false;
    $("#paid-clear").hidden = false;
    view("done");
  });

  $("#paid-clear").addEventListener("click", function () {
    cart = {}; save(); renderCart();
    $("#checkout-form").reset();
    this.hidden = true;
    $("#done-msg").insertAdjacentHTML("beforeend", "<br /><br /><strong>Basket cleared. Thank you!</strong>");
  });

  $("#keep-shopping").addEventListener("click", function () {
    closeDrawer();
    document.getElementById("drop").scrollIntoView({ behavior: "smooth" });
  });


  /* ---------- Product image lightbox ---------- */
  var lightbox = $("#lightbox"), lbImg = $("#lightbox-img"), lbCap = $("#lightbox-cap");
  var lbClose = $("#lightbox-close"), lbBack = $("#lightbox-backdrop");
  var lbLastFocus = null;
  function isLightboxOpen() { return lightbox && !lightbox.hidden; }
  function openLightbox(src, alt, cap) {
    if (!lightbox || !src) return;
    lbLastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = alt || "";
    lbCap.textContent = cap || "";
    lightbox.hidden = false;
    document.body.classList.add("locked");
    lbClose.focus();
  }
  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lbImg.removeAttribute("src");
    lbImg.alt = "";
    lbCap.textContent = "";
    if (!isOpen()) document.body.classList.remove("locked");
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
    lbLastFocus = null;
  }
  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lbBack) lbBack.addEventListener("click", closeLightbox);

  /* ---------- Newsletter ---------- */
  var signup = $("#signup");
  if (signup && signup.getAttribute("data-live") !== "true") {
    signup.addEventListener("submit", function (e) {
      e.preventDefault();
      $("#signup-note").textContent = "Thanks — noted on this page only. (Shop owner: connect Formspree to save sign-ups.)";
      signup.reset();
    });
  }

  /* ---------- Email links from SETTINGS ---------- */
  var ask = $("#ask-link");
  if (ask && SETTINGS.SHOP_EMAIL) ask.href = "mailto:" + SETTINGS.SHOP_EMAIL + "?subject=Kawaii%20Chaos%20question";

  /* ---------- Keep tabs in sync ---------- */
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) { cart = load(); renderCart(); }
    // Catalog changed in admin.html (another tab) — reload so prices/stock are fresh.
    if (window.KCStore && window.KCStore.mode === "local" && window.KCCatalog && e.key === window.KCCatalog.KEY) location.reload();
  });

  $("#year").textContent = new Date().getFullYear();
  renderGrid();
  renderCart();
}

/* ---------- Load the catalog, then start the shop ---------- */
(function () {
  var grid = document.getElementById("grid");
  if (grid) grid.innerHTML = '<p class="empty">Loading the shelf…</p>';
  var load = window.KCStore ? window.KCStore.loadShop(PRODUCTS) : Promise.resolve(PRODUCTS);
  load.then(function (list) { PRODUCTS = list; }, function () { /* keep built-in list */ })
    .then(kcStartShop);
})();
