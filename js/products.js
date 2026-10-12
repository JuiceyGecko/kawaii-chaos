/* Kawaii Chaos — base product list (the 'built-in' shelf).
   Products added/edited in admin.html are stored in the browser and merged over this list
   by js/catalog.js. To make admin changes permanent for everyone, merge them in here. */

/* ---------------------------------------------------------------------
   PRODUCTS — edit freely. One object per item on the shelf.
   id:     short unique slug (used in the basket)          img: file in images/
   cat:    figures | jewellery | bags | beauty | keychains | socks  (drives the filter chips)
   grade:  "A" | "B" | "C" | ""  (optional box grade; "" hides it)
   stock:  how many you have. 0 = shows as SOLD and can't be added.
   price:  whole rand, no "R"
   bg:     "light" or "dark" — matches the photo's background so it sits nicely in the card
   options (optional): list of { id, label } — shows a dropdown on the card (e.g. which sock design).
           The customer must pick one before adding; the basket shows the choice. Stock is shared
           across all options of that product.
   optionLabel (optional): the dropdown's label, e.g. "Design".
   TODO (Joseph): check the notes are true (new / boxed / size) and set your real stock.
   --------------------------------------------------------------------- */
var PRODUCTS = [
  { id: "bunny-ears-figure", name: "Teal Bunny-Ears Figure", line: "Sitting figure · pink bunny hoodie", cat: "figures", grade: "", stock: 1, price: 250,
    img: "images/bunny-ears-figure.jpeg", bg: "light",
    alt: "Seated anime figure with long teal and pink twin-tails, wearing a pink bunny-ear hoodie and striped socks",
    note: "Long teal twin-tails, pink bunny-ear hood and little bow details. Sits on the edge of a shelf or desk." },
  { id: "nier-2b-figure", name: "2B — NieR: Automata", line: "Figure · white dress, katana", cat: "figures", grade: "", stock: 1, price: 280,
    img: "images/nier-2b-figure.jpeg", bg: "dark",
    alt: "Figure of 2B from NieR: Automata in an all-white outfit, drawing a katana, on a round black base",
    note: "2B in her white outfit, mid-draw with the katana, on a round black display base." },
  { id: "hello-kitty-necklace", name: "Hello Kitty Silver Necklace", line: "Necklace · pink gift box + bag", cat: "jewellery", grade: "", stock: 3, price: 80,
    img: "images/hello-kitty-necklace.jpeg", bg: "light",
    alt: "Silver Hello Kitty outline pendant on a fine chain, in a pink velvet box next to a pink Hello Kitty gift bag",
    note: "Sparkly Hello Kitty pendant on a fine chain. Comes in a pink box with a gift bag, so it's ready to give." },
  { id: "nekopara-pouch", name: "Nekopara Cat-Girl Pouch", line: "Zip pouch · Chocola & Vanilla", cat: "bags", grade: "", stock: 2, price: 70,
    img: "images/nekopara-pouch.jpeg", bg: "dark",
    alt: "White zip pouch printed with Nekopara cat-girls Chocola and Vanilla in maid outfits on a pink floral background",
    note: "Chocola & Vanilla printed edge to edge, black zip. Good for makeup, pens or cables." },
  { id: "kuromi-hairbrush", name: "Kuromi Hairbrush", line: "Paddle brush · pink & black", cat: "beauty", grade: "", stock: 2, price: 200,
    img: "images/kuromi-hairbrush.jpeg", bg: "dark",
    alt: "Pink paddle hairbrush printed with Kuromi, black bows, hearts and moons, shown with the white bristle side",
    note: "Kuromi with bows, hearts and moons on the back, cushioned paddle bristles on the front." },
  { id: "acrylic-keychains", name: "Jujutsu Kaisen Acrylics (Megumi & Gojo)", line: "Acrylic keychains · set of 2", cat: "keychains", grade: "", stock: 1, price: 100,
    img: "images/acrylic-keychains.jpeg", bg: "dark",
    alt: "Two clear acrylic Jujutsu Kaisen keychains with gold clasps: Megumi Fushiguro and Satoru Gojo chibi charms",
    note: "Megumi & Gojo chibi acrylics on gold clasps — R100 for the pair. Also available singly at R70 each, just ask." },
  { id: "nyan-cat-keychain", name: "Nyan Cat Keychain", line: "Acrylic keychain · rainbow pixel art", cat: "keychains", grade: "", stock: 2, price: 80,
    img: "images/nyan-cat-keychain.jpeg", bg: "light",
    alt: "Clear acrylic Nyan Cat keychain with a rainbow trail and Pop-Tart body, on a silver clasp",
    note: "Pixel-art Nyan Cat with the full rainbow trail, on a silver lobster clasp. Bag, keys or pencil case." },
  { id: "adventure-time-socks", name: "Adventure Time Socks", line: "Ankle socks · price per pair", cat: "socks", grade: "", stock: 5, price: 50,
    img: "images/adventure-time-socks.jpeg", bg: "dark",
    alt: "Five Adventure Time socks: lilac Lumpy Space Princess, pink Princess Bubblegum, yellow Jake, teal BMO and blue Finn",
    note: "Bright character ankle socks, one design per pair. Pick yours below.",
    optionLabel: "Character",
    options: [
      { id: "lsp",       label: "Lumpy Space Princess" },
      { id: "bubblegum", label: "Princess Bubblegum" },
      { id: "jake",      label: "Jake" },
      { id: "bmo",       label: "BMO" },
      { id: "finn",      label: "Finn" }
    ] }
];

