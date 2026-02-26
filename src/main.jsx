import { gsap } from "gsap";
import Chart from "chart.js/auto";

/* =========================================================
   SAN RAMON - MVP SPA (LocalStorage) - Vite
   Público: promos -> productos -> carrito -> checkout -> WhatsApp
   Admin: login + roles + CRUD + reportes + gráficos
========================================================= */

const SR = {
  storeKey: "SR_BODEGA_APP_V1",
  defaultPhone: "+595976586543",
  defaultLocation: "https://share.google/RFfqaO2F2W5DPbLPO",
};

const fmtGs = (n)=> {
  const x = Math.round(Number(n || 0));
  return "₲ " + x.toLocaleString("es-PY");
};

const uid = ()=> Math.random().toString(16).slice(2) + Date.now().toString(16);

function nowISO(){
  return new Date().toISOString();
}
function todayYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function toast(msg, type="info"){
  const zone = document.getElementById("toastZone");
  if(!zone) return;

  const el = document.createElement("div");
  el.className = "glass rounded-2xl px-4 py-3 text-sm flex items-start gap-3";

  const icon = type === "ok" ? "fa-circle-check text-green-600" :
               type === "warn" ? "fa-triangle-exclamation text-amber-600" :
               type === "err" ? "fa-circle-xmark text-red-600" :
               "fa-circle-info text-slate-600";

  el.innerHTML = `
    <i class="fa-solid ${icon} mt-0.5"></i>
    <div class="flex-1">${msg}</div>
    <button class="h-7 w-7 grid place-items-center rounded-lg hover:bg-red-50"><i class="fa-solid fa-xmark"></i></button>
  `;

  el.querySelector("button").onclick = ()=> el.remove();
  zone.appendChild(el);

  setTimeout(()=> { if(el.isConnected) el.remove(); }, 4200);
}

// Normaliza teléfono paraguayo: 0984... -> 595984...
function normalizePYPhone(input){
  let digits = String(input || "").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.startsWith("595")) return digits;
  if(digits.startsWith("0")) digits = digits.slice(1);
  return "595" + digits;
}

function mapsLink(lat, lng){
  if(lat == null || lng == null) return "";
  return `https://maps.google.com/?q=${encodeURIComponent(lat + "," + lng)}`;
}

/* =========================
   DATA STORE (localStorage)
========================= */
function loadStore(){
  const raw = localStorage.getItem(SR.storeKey);
  if(raw){
    try { return JSON.parse(raw); } catch(e){}
  }
  // Seed
  const seed = {
    version: 1,
    settings: {
      storeName: "SAN RAMON",
      phone: SR.defaultPhone,
      locationUrl: SR.defaultLocation,
      theme: { primary: "#b91c1c", secondary: "#ef4444" },
      stockAlertDefault: 5
    },
    branches: [
      { id: "main", name: "Sucursal Central", address: "SAN RAMON - Principal", phone: SR.defaultPhone, locationUrl: SR.defaultLocation }
    ],
    users: [
      { id: "u_admin", username: "admin", pin: "0000", role: "admin", active: true, createdAt: nowISO() },
      { id: "u_stock", username: "stock", pin: "1111", role: "stock", active: true, createdAt: nowISO() },
      { id: "u_ventas", username: "ventas", pin: "2222", role: "ventas", active: true, createdAt: nowISO() },
    ],
    categories: ["Bebidas", "Lácteos", "Panadería", "Snacks", "Limpieza", "Hogar", "Congelados"],
    products: [
      { id:"p1", name:"Coca Cola 2L", category:"Bebidas", price: 12000, stock: 24, minStock: 6, discountPct: 0, active:true, imageData:"", updatedAt: nowISO() },
      { id:"p2", name:"Agua 1.5L", category:"Bebidas", price: 5000, stock: 40, minStock: 10, discountPct: 0, active:true, imageData:"", updatedAt: nowISO() },
      { id:"p3", name:"Pan lactal", category:"Panadería", price: 9000, stock: 12, minStock: 4, discountPct: 10, active:true, imageData:"", updatedAt: nowISO() },
      { id:"p4", name:"Leche 1L", category:"Lácteos", price: 8500, stock: 18, minStock: 6, discountPct: 0, active:true, imageData:"", updatedAt: nowISO() },
      { id:"p5", name:"Detergente", category:"Limpieza", price: 15000, stock: 8, minStock: 3, discountPct: 5, active:true, imageData:"", updatedAt: nowISO() },
    ],
    promotions: [
      { id:"pr1", title:"🔥 Super Promo del Día", subtitle:"Combos y descuentos limitados", discountPct: 12, featured:true, active:true, startDate: todayYMD(), endDate: todayYMD(), imageData:"" },
      { id:"pr2", title:"🎯 2x1 en Snacks", subtitle:"Hasta agotar stock", discountPct: 0, featured:false, active:true, startDate: todayYMD(), endDate: todayYMD(), imageData:"" }
    ],
    sales: [],
    stockMovements: [],
    auditLog: [],
    webOrdersInbox: []
  };
  saveStore(seed);
  return seed;
}
function saveStore(s){
  localStorage.setItem(SR.storeKey, JSON.stringify(s));
}
let DB = loadStore();

function audit(action, meta={}){
  DB.auditLog.unshift({ id: uid(), at: nowISO(), action, meta });
  DB.auditLog = DB.auditLog.slice(0, 5000);
  saveStore(DB);
}

/* =========================
   SESSION
========================= */
let SESSION = { user: null }; // {id, username, role}

/* =========================
   CART
========================= */
let CART = { items: [] }; // {productId, qty}

function cartCount(){
  return CART.items.reduce((a,i)=> a + i.qty, 0);
}
function cartAdd(productId, qty=1){
  const p = DB.products.find(x=>x.id===productId && x.active);
  if(!p) return;
  const it = CART.items.find(x=>x.productId===productId);
  if(it) it.qty += qty;
  else CART.items.push({productId, qty});

  const curr = CART.items.find(x=>x.productId===productId);
  if(curr && curr.qty <= 0){
    CART.items = CART.items.filter(x=>x.productId!==productId);
  }
  renderCart();
  pulseCart();
}
function cartSet(productId, qty){
  const it = CART.items.find(x=>x.productId===productId);
  if(!it) return;
  it.qty = Math.max(0, Number(qty||0));
  if(it.qty === 0){
    CART.items = CART.items.filter(x=>x.productId!==productId);
  }
  renderCart();
}
function cartRemove(productId){
  CART.items = CART.items.filter(x=>x.productId!==productId);
  renderCart();
}
function cartCalc(){
  let subtotal=0, discount=0;
  for(const it of CART.items){
    const p = DB.products.find(x=>x.id===it.productId);
    if(!p) continue;
    const line = p.price * it.qty;
    subtotal += line;
    const d = (p.discountPct||0)/100 * line;
    discount += d;
  }
  const total = Math.max(0, subtotal - discount);
  return {subtotal, discount, total};
}

/* =========================
   ROUTER
========================= */
function route(){
  const hash = (location.hash || "#home").toLowerCase();
  const home = document.getElementById("routeHome");
  const admin = document.getElementById("routeAdmin");
  if(!home || !admin) return;

  if(hash.startsWith("#admin")){
    home.classList.add("hidden");
    admin.classList.remove("hidden");
    renderAdmin();
  } else {
    admin.classList.add("hidden");
    home.classList.remove("hidden");
    renderHome(hash);
  }
  window.scrollTo({top:0, behavior:"smooth"});
}
window.addEventListener("hashchange", route);

/* =========================
   HOME UI
========================= */
function renderHome(){
  const s = DB.settings;
  const promos = DB.promotions.filter(p=>p.active).sort((a,b)=> (b.featured?1:0)-(a.featured?1:0));
  const productsActive = DB.products.filter(p=>p.active);

  const home = document.getElementById("routeHome");
  home.innerHTML = `
    <!-- HERO -->
    <section class="mt-2" id="home">
      <div class="glass rounded-3xl p-5 sm:p-7 relative overflow-hidden">
        <div class="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-200/60 blur-2xl"></div>
        <div class="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-red-300/40 blur-2xl"></div>

        <div class="grid lg:grid-cols-2 gap-6 items-center">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-800 text-xs font-black">
              <span class="sparkle">✨</span> Promos primero • App interactiva • Delivery rápido
            </div>

            <h1 class="mt-3 text-3xl sm:text-4xl font-black leading-tight">
              Bienvenido a <span class="text-red-700">${escapeHtml(s.storeName)}</span>
            </h1>
            <p class="mt-2 text-slate-600">
              Encontrá promos, armá tu carrito y enviá tu pedido con ubicación exacta.
            </p>

            <div class="mt-4 flex flex-wrap gap-2">
              <a href="#promos" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black shadow-lg hover:brightness-110 transition">
                Ver promociones
              </a>
              <a href="#productos" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50 transition">
                Ver productos
              </a>
              <a target="_blank" class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110 transition"
                 href="${escapeHtml(s.locationUrl)}">
                <i class="fa-solid fa-map-location-dot mr-2"></i>Ubicación
              </a>
            </div>

            <div class="mt-4 grid sm:grid-cols-2 gap-3">
              <div class="p-3 rounded-2xl bg-white/60 border border-red-100">
                <div class="text-xs text-slate-500 font-bold">Contacto</div>
                <div class="font-black mt-1">${escapeHtml(s.phone)}</div>
                <button class="mt-2 text-sm font-bold text-red-700 hover:underline" id="btnWAContact">
                  <i class="fa-brands fa-whatsapp mr-2"></i>Escribir por WhatsApp
                </button>
              </div>
              <div class="p-3 rounded-2xl bg-white/60 border border-red-100">
                <div class="text-xs text-slate-500 font-bold">Tip</div>
                <div class="font-black mt-1">Promos del día</div>
                <div class="text-sm text-slate-600 mt-1">Mirá primero las promos destacadas 👇</div>
              </div>
            </div>
          </div>

          <!-- Promo Carousel -->
          <div>
            <div class="flex items-center justify-between">
              <div class="font-black text-lg">Promociones destacadas</div>
              <div class="text-xs text-slate-500">Cambiar</div>
            </div>
            <div class="mt-3 relative">
              <div id="promoStage" class="rounded-3xl overflow-hidden border border-red-100 bg-white/70"></div>
              <div class="mt-3 flex gap-2 justify-end">
                <button id="promoPrev" class="h-11 w-11 rounded-2xl border border-red-200 hover:bg-red-50 grid place-items-center">
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button id="promoNext" class="h-11 w-11 rounded-2xl bg-red-700 text-white hover:brightness-110 grid place-items-center">
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- PROMOS -->
    <section id="promos" class="mt-6">
      <div class="flex items-end justify-between gap-3">
        <div>
          <h2 class="text-2xl font-black">Promociones</h2>
          <p class="text-slate-600 text-sm">Primero lo importante: promos y súper promos.</p>
        </div>
        <button class="px-4 py-2 rounded-2xl bg-red-700 text-white font-bold shadow hover:brightness-110" id="btnPromoTip">
          <i class="fa-solid fa-bolt mr-2"></i>Tip de promos
        </button>
      </div>

      <div class="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4" id="promoGrid">
        ${promos.map(p=> promoCard(p)).join("") || emptyState("Sin promos activas por ahora.")}
      </div>
    </section>

    <!-- PRODUCTOS -->
    <section id="productos" class="mt-8">
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 class="text-2xl font-black">Productos</h2>
          <p class="text-slate-600 text-sm">Buscá, filtrá y agregá al carrito.</p>
        </div>

        <div class="glass rounded-3xl p-3 w-full lg:w-[680px]">
          <div class="grid sm:grid-cols-3 gap-2">
            <input id="q" placeholder="Buscar producto..." class="px-4 py-3 rounded-2xl border border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"/>
            <select id="cat" class="px-4 py-3 rounded-2xl border border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200">
              <option value="">Todas las categorías</option>
              ${DB.categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
            </select>
            <select id="sort" class="px-4 py-3 rounded-2xl border border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200">
              <option value="featured">Recomendados</option>
              <option value="priceAsc">Precio: menor a mayor</option>
              <option value="priceDesc">Precio: mayor a menor</option>
              <option value="stockDesc">Stock: mayor a menor</option>
              <option value="discountDesc">Descuento: mayor a menor</option>
            </select>
          </div>
        </div>
      </div>

      <div id="productGrid" class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>
    </section>

    <!-- FOOTER -->
    <section class="mt-10">
      <div class="glass rounded-3xl p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <div class="font-black text-lg">SAN RAMON</div>
          <div class="text-sm text-slate-600">Ubicación y contacto directo para delivery.</div>
          <div class="mt-2 text-sm font-bold text-red-700">
            <i class="fa-solid fa-phone mr-2"></i>${escapeHtml(s.phone)}
          </div>
        </div>
        <div class="flex gap-2">
          <a target="_blank" href="${escapeHtml(s.locationUrl)}" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110 transition">
            <i class="fa-solid fa-location-dot mr-2"></i>Ver mapa
          </a>
          <a href="#admin" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50 transition">
            <i class="fa-solid fa-lock mr-2"></i>Ir a Admin
          </a>
        </div>
      </div>
    </section>
  `;

  // WhatsApp contact
  document.getElementById("btnWAContact")?.addEventListener("click", ()=>{
    openWhatsApp("Hola SAN RAMON, quiero consultar precios/stock 🙌");
  });
  document.getElementById("btnPromoTip")?.addEventListener("click", ()=>{
    toast("Tip: Entrá a Admin → Promos para crear “Super Promos”.","info");
  });

  // Promo carousel
  const stage = document.getElementById("promoStage");
  let idx = 0;

  function paintPromo(){
    const p = promos[idx] || promos[0];
    if(!p){
      stage.innerHTML = `<div class="p-6 text-slate-600">Sin promociones activas.</div>`;
      return;
    }
    stage.innerHTML = `
      <div class="p-6 sm:p-7 relative overflow-hidden">
        <div class="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-red-200/70 blur-2xl"></div>
        <div class="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-red-300/40 blur-2xl"></div>

        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-red-100 text-xs font-black text-red-800">
          ${p.featured ? "⭐ Destacada" : "Promo"} • ${p.discountPct ? (p.discountPct + "% OFF") : "Oferta"}
        </div>

        <div class="mt-3 text-2xl font-black">${escapeHtml(p.title)}</div>
        <div class="mt-1 text-slate-600">${escapeHtml(p.subtitle||"")}</div>

        <div class="mt-4 flex flex-wrap gap-2">
          <a href="#productos" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110 transition">
            Ver productos
          </a>
          <button class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110 transition" id="btnPromoWA">
            <i class="fa-brands fa-whatsapp mr-2"></i>Consultar promo
          </button>
        </div>
      </div>
    `;
    document.getElementById("btnPromoWA")?.addEventListener("click", ()=>{
      openWhatsApp(`Hola SAN RAMON, me interesa la promo: ${p.title}`);
    });
    gsap.fromTo("#promoStage", {opacity:0, y:10}, {opacity:1, y:0, duration:.35, ease:"power2.out"});
  }

  document.getElementById("promoPrev").onclick = ()=> { idx = (idx - 1 + promos.length) % promos.length; paintPromo(); };
  document.getElementById("promoNext").onclick = ()=> { idx = (idx + 1) % promos.length; paintPromo(); };
  paintPromo();

  // Products filter
  const grid = document.getElementById("productGrid");
  const q = document.getElementById("q");
  const cat = document.getElementById("cat");
  const sort = document.getElementById("sort");

  function apply(){
    const qq = (q.value||"").trim().toLowerCase();
    const cc = cat.value;
    const ss = sort.value;

    let list = productsActive
      .filter(p=> !qq || p.name.toLowerCase().includes(qq))
      .filter(p=> !cc || p.category === cc);

    // “Recomendados” = más descuento y buen stock
    const score = (p)=> (p.discountPct||0)*3 + Math.min(20, p.stock||0);

    if(ss==="priceAsc") list.sort((a,b)=> a.price-b.price);
    if(ss==="priceDesc") list.sort((a,b)=> b.price-a.price);
    if(ss==="stockDesc") list.sort((a,b)=> (b.stock||0)-(a.stock||0));
    if(ss==="discountDesc") list.sort((a,b)=> (b.discountPct||0)-(a.discountPct||0));
    if(ss==="featured") list.sort((a,b)=> score(b)-score(a));

    grid.innerHTML = list.map(p=> productCard(p)).join("") || emptyState("No hay productos con esos filtros.");
    gsap.fromTo(".pCard", {opacity:0, y:8}, {opacity:1, y:0, duration:.25, stagger:.02, ease:"power2.out"});
  }

  q.oninput = apply;
  cat.onchange = apply;
  sort.onchange = apply;
  apply();

  gsap.fromTo("header nav", {y:-10, opacity:0}, {y:0, opacity:1, duration:.35, ease:"power2.out"});
  gsap.fromTo("h1", {y:10, opacity:0}, {y:0, opacity:1, duration:.45, delay:.08, ease:"power2.out"});

  ensureFloatingWA();
}

function promoCard(p){
  const badge = p.featured ? `<span class="px-2 py-1 rounded-full bg-red-700 text-white text-xs font-black">Destacada</span>` : "";
  const off = p.discountPct ? `<span class="px-2 py-1 rounded-full bg-red-50 border border-red-100 text-red-800 text-xs font-black">${p.discountPct}% OFF</span>` : "";
  return `
    <div class="glass rounded-3xl p-5 card-tilt">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">${badge}${off}</div>
        <button class="h-10 w-10 rounded-2xl hover:bg-red-50 grid place-items-center" data-wa-promo="${escapeHtml(p.title)}">
          <i class="fa-brands fa-whatsapp text-green-600"></i>
        </button>
      </div>
      <div class="mt-3 text-xl font-black">${escapeHtml(p.title)}</div>
      <div class="mt-1 text-sm text-slate-600">${escapeHtml(p.subtitle||"")}</div>
      <div class="mt-4 flex gap-2">
        <a href="#productos" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110 transition">Ver productos</a>
        <button class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50 transition" data-promo-tip="1">Detalles</button>
      </div>
    </div>
  `;
}

function productCard(p){
  const img = p.imageData
    ? `<img src="${p.imageData}" class="h-40 w-full object-cover rounded-2xl border border-red-100"/>`
    : `<div class="h-40 w-full rounded-2xl border border-red-100 bg-white/70 grid place-items-center text-red-700">
         <i class="fa-solid fa-boxes-stacked text-3xl"></i>
       </div>`;
  const disc = p.discountPct ? `<span class="text-xs font-black text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">${p.discountPct}% OFF</span>` : "";
  const stockBadge = (p.stock<=0)
    ? `<span class="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-full">Sin stock</span>`
    : (p.stock <= (p.minStock||5))
      ? `<span class="text-xs font-black text-amber-800 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">Stock bajo</span>`
      : `<span class="text-xs font-black text-green-800 bg-green-50 border border-green-100 px-2 py-1 rounded-full">Disponible</span>`;

  const priceLine = p.discountPct
    ? `<div class="text-sm text-slate-500 line-through">${fmtGs(p.price)}</div>
       <div class="font-black text-xl text-red-700">${fmtGs(p.price * (1 - p.discountPct/100))}</div>`
    : `<div class="font-black text-xl text-red-700">${fmtGs(p.price)}</div>`;

  const disabled = p.stock<=0 ? "opacity-60 pointer-events-none" : "";
  return `
    <div class="pCard glass rounded-3xl p-4 card-tilt">
      ${img}
      <div class="mt-3 flex items-center justify-between gap-2">
        <div class="text-xs font-bold text-slate-600">${escapeHtml(p.category)}</div>
        <div class="flex items-center gap-2">${disc}${stockBadge}</div>
      </div>
      <div class="mt-1 font-black text-lg">${escapeHtml(p.name)}</div>
      <div class="mt-2">${priceLine}</div>

      <div class="mt-3 flex items-center gap-2">
        <button class="h-11 w-11 rounded-2xl border border-red-200 hover:bg-red-50 font-black" data-cart-minus="${p.id}">-</button>
        <button class="flex-1 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110 transition ${disabled}" data-cart-add="${p.id}">
          <i class="fa-solid fa-cart-plus mr-2"></i>Agregar
        </button>
        <button class="h-11 w-11 rounded-2xl bg-slate-900 text-white hover:brightness-110" data-wa-product="${escapeHtml(p.name)}">
          <i class="fa-brands fa-whatsapp"></i>
        </button>
      </div>

      <div class="mt-2 text-xs text-slate-500">
        Stock: <span class="font-bold">${p.stock}</span> • Mínimo: <span class="font-bold">${p.minStock||DB.settings.stockAlertDefault}</span>
      </div>
    </div>
  `;
}

function emptyState(text){
  return `<div class="glass rounded-3xl p-6 text-slate-600">${escapeHtml(text)}</div>`;
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   WhatsApp helper
========================= */
function openWhatsApp(message){
  const phoneDigits = normalizePYPhone(DB.settings.phone || SR.defaultPhone);
  const text = encodeURIComponent(message || "");
  const url = `https://wa.me/${phoneDigits}?text=${text}`;
  window.open(url, "_blank");
}

/* =========================
   CART UI (Drawer)
========================= */
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");

document.getElementById("btnCart")?.addEventListener("click", openCart);
document.getElementById("btnCloseCart")?.addEventListener("click", closeCart);
backdrop?.addEventListener("click", closeCart);

function openCart(){
  drawer?.classList.add("open");
  backdrop?.classList.add("show");
  renderCart();
}
function closeCart(){
  drawer?.classList.remove("open");
  backdrop?.classList.remove("show");
}
function pulseCart(){
  const btn = document.getElementById("btnCart");
  if(!btn) return;
  gsap.fromTo(btn, {scale:1}, {scale:1.04, duration:.12, yoyo:true, repeat:1, ease:"power2.out"});
}
function renderCart(){
  document.getElementById("cartCount").textContent = String(cartCount());
  const box = document.getElementById("cartItems");

  if(CART.items.length === 0){
    box.innerHTML = `<div class="p-4 rounded-2xl bg-white/60 border border-red-100 text-slate-600">
      Tu carrito está vacío. Agregá productos y confirmá tu pedido.
    </div>`;
  } else {
    box.innerHTML = CART.items.map(it=>{
      const p = DB.products.find(x=>x.id===it.productId);
      if(!p) return "";
      const unit = p.discountPct ? p.price*(1-p.discountPct/100) : p.price;
      return `
        <div class="p-3 rounded-2xl bg-white/70 border border-red-100">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-black">${escapeHtml(p.name)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(p.category)} • Unit: <span class="font-bold">${fmtGs(unit)}</span></div>
            </div>
            <button class="h-10 w-10 rounded-xl hover:bg-red-50 grid place-items-center" data-cart-remove="${p.id}">
              <i class="fa-solid fa-trash text-red-700"></i>
            </button>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <button class="h-11 w-11 rounded-2xl border border-red-200 hover:bg-red-50 font-black" data-cart-minus="${p.id}">-</button>
            <input type="number" min="1" value="${it.qty}"
              class="w-20 px-3 py-3 rounded-2xl border border-red-100 text-center font-black"
              data-cart-set="${p.id}">
            <button class="h-11 w-11 rounded-2xl border border-red-200 hover:bg-red-50 font-black" data-cart-add="${p.id}">+</button>

            <div class="ml-auto font-black text-red-700">${fmtGs(unit * it.qty)}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  const {subtotal, discount, total} = cartCalc();
  document.getElementById("cartSubtotal").textContent = fmtGs(subtotal);
  document.getElementById("cartDiscount").textContent = "- " + fmtGs(discount);
  document.getElementById("cartTotal").textContent = fmtGs(total);

  wireCartButtons();
}
function wireCartButtons(){
  // Product grid actions + Cart items actions
  document.querySelectorAll("[data-cart-add]").forEach(btn=>{
    btn.addEventListener("click", ()=> cartAdd(btn.getAttribute("data-cart-add"), 1), { once: true });
  });
  document.querySelectorAll("[data-cart-minus]").forEach(btn=>{
    btn.addEventListener("click", ()=> cartAdd(btn.getAttribute("data-cart-minus"), -1), { once: true });
  });
  document.querySelectorAll("[data-cart-remove]").forEach(btn=>{
    btn.addEventListener("click", ()=> cartRemove(btn.getAttribute("data-cart-remove")), { once: true });
  });
  document.querySelectorAll("input[data-cart-set]").forEach(inp=>{
    inp.addEventListener("change", ()=> cartSet(inp.getAttribute("data-cart-set"), inp.value), { once: true });
  });

  document.querySelectorAll("[data-wa-product]").forEach(btn=>{
    btn.addEventListener("click", ()=> openWhatsApp(`Hola SAN RAMON, consulto por: ${btn.getAttribute("data-wa-product")}`), { once: true });
  });
  document.querySelectorAll("[data-wa-promo]").forEach(btn=>{
    btn.addEventListener("click", ()=> openWhatsApp(`Hola SAN RAMON, me interesa la promo: ${btn.getAttribute("data-wa-promo")}`), { once: true });
  });
  document.querySelectorAll("[data-promo-tip]").forEach(btn=>{
    btn.addEventListener("click", ()=> toast("Tip: Podés crear Super Promos en Admin → Promos","info"), { once: true });
  });
}

/* =========================
   CHECKOUT
========================= */
const checkoutModal = document.getElementById("checkoutModal");
const btnCheckout = document.getElementById("btnCheckout");
const btnCloseCheckout = document.getElementById("btnCloseCheckout");
const btnSendOrder = document.getElementById("btnSendOrder");
const btnGeo = document.getElementById("btnGeo");
const btnClearGeo = document.getElementById("btnClearGeo");
const inpPhone = document.getElementById("inpPhone");
const phoneHint = document.getElementById("phoneHint");
const selPay = document.getElementById("selPay");
const inpAddress = document.getElementById("inpAddress");
const geoStatus = document.getElementById("geoStatus");
const checkoutTotal = document.getElementById("checkoutTotal");

let CHECKOUT = { lat:null, lng:null };

btnCheckout?.addEventListener("click", ()=>{
  if(CART.items.length === 0){
    toast("Tu carrito está vacío.", "warn");
    return;
  }
  const {total} = cartCalc();
  checkoutTotal.textContent = fmtGs(total);
  checkoutModal.classList.remove("hidden");
  gsap.fromTo("#checkoutModal > div:last-child", {y:10, opacity:0}, {y:0, opacity:1, duration:.2, ease:"power2.out"});
});
btnCloseCheckout?.addEventListener("click", ()=> checkoutModal.classList.add("hidden"));

inpPhone?.addEventListener("input", ()=>{
  const norm = normalizePYPhone(inpPhone.value);
  phoneHint.textContent = norm ? `Formato: ${norm}` : "Se convertirá automáticamente a formato 595…";
});

btnClearGeo?.addEventListener("click", ()=>{
  CHECKOUT.lat = null; CHECKOUT.lng = null;
  geoStatus.textContent = "Aún sin coordenadas.";
  toast("Ubicación limpiada.", "info");
});

btnGeo?.addEventListener("click", ()=>{
  if(!navigator.geolocation){
    toast("Tu navegador no soporta geolocalización.", "err");
    return;
  }
  geoStatus.textContent = "Obteniendo ubicación...";
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      CHECKOUT.lat = pos.coords.latitude;
      CHECKOUT.lng = pos.coords.longitude;
      const link = mapsLink(CHECKOUT.lat, CHECKOUT.lng);
      geoStatus.innerHTML = `Coordenadas listas ✅ <a class="text-red-700 font-bold hover:underline" target="_blank" href="${link}">Ver en Maps</a>`;
      toast("Ubicación capturada correctamente ✅", "ok");
    },
    ()=>{
      geoStatus.textContent = "No se pudo obtener ubicación. Revisa permisos GPS.";
      toast("Permiso GPS denegado o error al obtener ubicación.", "warn");
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:0 }
  );
});

btnSendOrder?.addEventListener("click", ()=>{
  const phone = normalizePYPhone(inpPhone.value);
  if(!phone || phone.length < 11){
    toast("Ingresá un teléfono válido (ej: 0984… o 595…).", "warn");
    return;
  }
  const {subtotal, discount, total} = cartCalc();
  const pay = selPay.value;
  const link = (CHECKOUT.lat!=null && CHECKOUT.lng!=null) ? mapsLink(CHECKOUT.lat, CHECKOUT.lng) : "";
  const addr = (inpAddress.value||"").trim();

  const lines = CART.items.map(it=>{
    const p = DB.products.find(x=>x.id===it.productId);
    if(!p) return "";
    const unit = p.discountPct ? p.price*(1-p.discountPct/100) : p.price;
    return `- ${it.qty} x ${p.name} (${fmtGs(unit)}) = ${fmtGs(unit*it.qty)}`;
  }).filter(Boolean);

  const msg =
`🛒 *PEDIDO SAN RAMON*
📞 Cliente: ${phone}
💳 Pago: ${pay}
📍 Ubicación: ${link || "No enviada (pedir referencia)"}
📝 Referencia: ${addr || "—"}

📦 Productos:
${lines.join("\n")}

🧾 Subtotal: ${fmtGs(subtotal)}
🏷️ Descuentos: -${fmtGs(discount)}
💰 *TOTAL: ${fmtGs(total)}*`;

  const sale = createSaleFromCart({
    source: "web",
    paymentMethod: pay,
    customerPhone: phone,
    customerLocationLink: link,
    customerAddress: addr,
    status: "pendiente"
  });

  DB.webOrdersInbox.unshift({
    id: sale.id,
    at: sale.at,
    status: sale.status,
    phone,
    total: sale.total,
    link,
    addr
  });
  saveStore(DB);

  const storePhoneDigits = normalizePYPhone(DB.settings.phone || SR.defaultPhone);
  const waUrl = `https://wa.me/${storePhoneDigits}?text=${encodeURIComponent(msg)}`;

  toast("Pedido guardado y listo para enviar por WhatsApp ✅", "ok");
  checkoutModal.classList.add("hidden");
  closeCart();

  CART.items = [];
  renderCart();

  window.open(waUrl, "_blank");
});

/* =========================
   SALES & STOCK
========================= */
function createSaleFromCart(meta){
  const id = uid();
  const at = nowISO();
  const branchId = DB.branches[0]?.id || "main";

  const items = CART.items.map(it=>{
    const p = DB.products.find(x=>x.id===it.productId);
    const unitPrice = p?.price || 0;
    const discountPct = p?.discountPct || 0;
    return { productId: it.productId, qty: it.qty, unitPrice, discountPct };
  });

  let subtotal=0, discountTotal=0;
  for(const it of items){
    const line = it.unitPrice * it.qty;
    subtotal += line;
    discountTotal += (it.discountPct/100) * line;
  }
  const total = Math.max(0, subtotal - discountTotal);

  const sale = {
    id, at, branchId,
    items, subtotal, discountTotal, total,
    paymentMethod: meta.paymentMethod || "Efectivo",
    customerPhone: meta.customerPhone || "",
    customerLocationLink: meta.customerLocationLink || "",
    customerAddress: meta.customerAddress || "",
    source: meta.source || "admin",
    status: meta.status || "completada",
    canceledAt: null,
    canceledBy: null
  };

  DB.sales.unshift(sale);

  // Descuenta stock
  for(const it of items){
    const p = DB.products.find(x=>x.id===it.productId);
    if(p){
      p.stock = Math.max(0, (p.stock||0) - it.qty);
      p.updatedAt = nowISO();
      DB.stockMovements.unshift({
        id: uid(), at, productId: p.id, type:"out", qty: it.qty,
        note: `Venta (${sale.source})`, userId: SESSION.user?.id || "web"
      });
    }
  }

  audit("SALE_CREATED", { saleId: id, source: sale.source, total });
  saveStore(DB);

  checkLowStockToasts();

  return sale;
}

function checkLowStockToasts(){
  const critical = DB.products.filter(p=>p.active && (p.stock||0) <= (p.minStock || DB.settings.stockAlertDefault));
  if(critical.length){
    toast(`Alerta: ${critical.length} producto(s) en stock bajo. (Admin → Stock/Reportes)`, "warn");
  }
}

/* =========================
   ADMIN UI
========================= */
let ADMIN_TAB = "overview";
let REPORT_CHARTS = [];

function renderAdmin(){
  const admin = document.getElementById("routeAdmin");
  admin.innerHTML = `
    <section class="mt-2">
      <div class="glass rounded-3xl p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-black text-red-700">PANEL ADMINISTRATIVO</div>
            <h2 class="text-2xl font-black mt-1">Control total • Usuarios • Stock • Ventas • Reportes</h2>
            <p class="text-sm text-slate-600 mt-1">Acceso por usuario y código. Roles: admin / stock / ventas.</p>
          </div>
          <div class="flex gap-2">
            <a href="#home" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50 transition">
              <i class="fa-solid fa-store mr-2"></i>Volver a tienda
            </a>
            ${SESSION.user ? `
              <button id="btnLogout" class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110 transition">
                <i class="fa-solid fa-right-from-bracket mr-2"></i>Salir
              </button>` : ``}
          </div>
        </div>
      </div>
    </section>

    ${SESSION.user ? adminShell() : adminLogin()}
  `;

  document.getElementById("btnLogout")?.addEventListener("click", logout);

  gsap.fromTo("#routeAdmin .glass", {opacity:0, y:10}, {opacity:1, y:0, duration:.25, ease:"power2.out"});

  // post-render hooks
  if(SESSION.user){
    if(ADMIN_TAB === "overview") drawMiniChart();
    if(ADMIN_TAB === "reports") {
      document.getElementById("btnGenReports")?.addEventListener("click", paintReports);
      setTimeout(paintReports, 50);
    }
  }
}

function adminLogin(){
  return `
    <section class="mt-4 max-w-xl">
      <div class="glass rounded-3xl p-5">
        <div class="font-black text-lg">Ingresar</div>
        <div class="text-sm text-slate-600 mt-1">Por defecto: <span class="font-bold">admin</span> / <span class="font-bold">0000</span></div>

        <div class="mt-4 grid gap-3">
          <div>
            <label class="text-xs font-bold text-slate-600">Usuario</label>
            <input id="loginUser" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="admin"/>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-600">Código / PIN</label>
            <input id="loginPin" type="password" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="0000"/>
          </div>

          <button id="btnLogin" class="mt-2 w-full py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110 transition">
            <i class="fa-solid fa-lock mr-2"></i>Entrar
          </button>

          <div class="text-xs text-slate-500">
            Nota: Este MVP usa localStorage. En producción se debe usar backend con seguridad real.
          </div>
        </div>
      </div>
    </section>
  `;
}

function login(){
  const u = (document.getElementById("loginUser").value||"").trim();
  const p = (document.getElementById("loginPin").value||"").trim();
  const user = DB.users.find(x=>x.active && x.username===u && x.pin===p);
  if(!user){
    toast("Usuario o PIN incorrecto.", "err");
    return;
  }
  SESSION.user = { id:user.id, username:user.username, role:user.role };
  audit("LOGIN", { user:user.username, role:user.role });
  toast(`Bienvenido ${user.username} (${user.role})`, "ok");
  renderAdmin();
}
function logout(){
  audit("LOGOUT", { user: SESSION.user?.username });
  SESSION.user = null;
  toast("Sesión cerrada.", "info");
  renderAdmin();
}

function adminShell(){
  return `
    <section class="mt-4 admin-shell grid lg:grid-cols-[280px_1fr] gap-4">
      <aside class="sidebar glass rounded-3xl p-3">
        <div class="p-3 rounded-2xl bg-white/70 border border-red-100">
          <div class="text-xs text-slate-500 font-bold">Sesión</div>
          <div class="font-black mt-1">${escapeHtml(SESSION.user.username)}</div>
          <div class="text-xs text-red-700 font-black">${escapeHtml(SESSION.user.role)}</div>
        </div>

        <div class="mt-3 space-y-2">
          ${adminNavBtn("overview","Resumen","fa-gauge")}
          ${adminNavBtn("orders","Órdenes Web","fa-bag-shopping")}
          ${adminNavBtn("sales","Ventas (POS)","fa-cash-register")}
          ${adminNavBtn("products","Productos / Stock","fa-boxes-stacked")}
          ${adminNavBtn("promos","Promociones","fa-bolt")}
          ${adminNavBtn("stockMoves","Movimientos","fa-arrows-rotate")}
          ${adminNavBtn("reports","Reportes & Gráficos","fa-chart-line")}
          ${adminNavBtn("users","Usuarios & Permisos","fa-users-gear")}
          ${adminNavBtn("branches","Sucursales","fa-store")}
          ${adminNavBtn("settings","Configuración","fa-sliders")}
          ${adminNavBtn("audit","Bitácora","fa-clipboard-list")}
        </div>

        <div class="mt-3 p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-slate-600">
          <span class="font-black text-red-700">Tip:</span> Admin puede cancelar ventas y gestionar permisos.
        </div>
      </aside>

      <section class="glass rounded-3xl p-4">
        ${adminContent()}
      </section>
    </section>
  `;
}

function adminNavBtn(tab, label, icon){
  const active = ADMIN_TAB===tab ? "bg-red-700 text-white" : "hover:bg-red-50";
  return `
    <button class="w-full px-3 py-3 rounded-2xl font-black text-left flex items-center gap-3 ${active}" data-tab="${tab}">
      <i class="fa-solid ${icon}"></i>
      <span>${label}</span>
    </button>
  `;
}

function adminContent(){
  const view = (()=> {
    switch(ADMIN_TAB){
      case "overview": return adminOverview();
      case "orders": return adminOrders();
      case "sales": return adminSalesPOS();
      case "products": return adminProducts();
      case "promos": return adminPromos();
      case "stockMoves": return adminStockMoves();
      case "reports": return adminReports();
      case "users": return adminUsers();
      case "branches": return adminBranches();
      case "settings": return adminSettings();
      case "audit": return adminAudit();
      default: return adminOverview();
    }
  })();

  return view;
}

/* ===== Overview ===== */
function adminOverview(){
  const salesToday = DB.sales.filter(s=> (s.at||"").slice(0,10) === todayYMD() && !s.canceledAt);
  const totalToday = salesToday.reduce((a,s)=>a+(s.total||0),0);
  const lowStock = DB.products.filter(p=>p.active && (p.stock||0) <= (p.minStock || DB.settings.stockAlertDefault)).length;
  const pendingOrders = DB.sales.filter(s=> s.source==="web" && s.status==="pendiente").length;

  return `
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">RESUMEN</div>
        <div class="text-2xl font-black mt-1">Control ultra total</div>
        <div class="text-sm text-slate-600 mt-1">Ventas, stock, pedidos web y alertas en un solo lugar.</div>
      </div>
      <div class="flex gap-2">
        <button id="btnCheckAlerts" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
          <i class="fa-solid fa-bell mr-2"></i>Chequear alertas
        </button>
        <button id="btnGoReports" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
          <i class="fa-solid fa-chart-line mr-2"></i>Ver reportes
        </button>
      </div>
    </div>

    <div class="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      ${kpiCard("Ventas hoy", fmtGs(totalToday), "fa-sack-dollar")}
      ${kpiCard("Órdenes web pendientes", pendingOrders, "fa-bag-shopping")}
      ${kpiCard("Productos activos", DB.products.filter(p=>p.active).length, "fa-boxes-stacked")}
      ${kpiCard("Stock bajo", lowStock, "fa-triangle-exclamation")}
    </div>

    <div class="mt-4 grid lg:grid-cols-2 gap-3">
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Acciones rápidas</div>
        <div class="mt-3 grid sm:grid-cols-2 gap-2">
          <button id="btnQuickPOS" class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110">
            <i class="fa-solid fa-cash-register mr-2"></i>Nueva venta (POS)
          </button>
          <button id="btnQuickStock" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
            <i class="fa-solid fa-box mr-2"></i>Gestionar stock
          </button>
          <button id="btnQuickPromo" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
            <i class="fa-solid fa-bolt mr-2"></i>Crear super promo
          </button>
          <button id="btnQuickUsers" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
            <i class="fa-solid fa-users-gear mr-2"></i>Usuarios / roles
          </button>
        </div>
      </div>

      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Mini-dashboard (hoy)</div>
        <canvas id="miniChart" height="130"></canvas>
        <div class="text-xs text-slate-500 mt-2">*Gráfico rápido de ventas por hora (aprox).</div>
      </div>
    </div>
  `;
}

function drawMiniChart(){
  // Wire buttons
  document.getElementById("btnCheckAlerts")?.addEventListener("click", checkLowStockToasts);
  document.getElementById("btnGoReports")?.addEventListener("click", ()=> { ADMIN_TAB="reports"; renderAdmin(); });
  document.getElementById("btnQuickPOS")?.addEventListener("click", ()=> { ADMIN_TAB="sales"; renderAdmin(); });
  document.getElementById("btnQuickStock")?.addEventListener("click", ()=> { ADMIN_TAB="products"; renderAdmin(); });
  document.getElementById("btnQuickPromo")?.addEventListener("click", ()=> { ADMIN_TAB="promos"; renderAdmin(); });
  document.getElementById("btnQuickUsers")?.addEventListener("click", ()=> { ADMIN_TAB="users"; renderAdmin(); });

  const salesToday = DB.sales.filter(s=> (s.at||"").slice(0,10) === todayYMD() && !s.canceledAt);
  const buckets = Array.from({length:24}, ()=>0);
  salesToday.forEach(s=>{
    const d = new Date(s.at);
    const h = d.getHours();
    buckets[h] += (s.total||0);
  });

  const ctx = document.getElementById("miniChart");
  if(!ctx) return;

  // destroy previous if any
  REPORT_CHARTS.forEach(ch=> { try{ ch.destroy(); }catch{} });
  REPORT_CHARTS = [];

  const ch = new Chart(ctx, {
    type: "bar",
    data: {
      labels: buckets.map((_,i)=>String(i).padStart(2,"0")+":00"),
      datasets: [{ label: "₲", data: buckets }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: { x: { ticks:{ maxTicksLimit:8 } } }
    }
  });
  REPORT_CHARTS.push(ch);
}

function kpiCard(label, value, icon){
  return `
    <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
      <div class="text-xs text-slate-500 font-bold">${escapeHtml(label)}</div>
      <div class="mt-1 flex items-center justify-between">
        <div class="text-2xl font-black">${escapeHtml(String(value))}</div>
        <div class="h-11 w-11 rounded-2xl bg-red-50 border border-red-100 grid place-items-center text-red-700">
          <i class="fa-solid ${icon}"></i>
        </div>
      </div>
    </div>
  `;
}

/* ===== Orders (web) ===== */
function adminOrders(){
  const list = DB.sales.filter(s=> s.source==="web");
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">ÓRDENES WEB</div>
        <div class="text-2xl font-black mt-1">Pedidos enviados desde la tienda</div>
        <div class="text-sm text-slate-600 mt-1">Estados: pendiente / aceptada / entregada / cancelada</div>
      </div>
      <button id="btnOrdersReports" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
        <i class="fa-solid fa-chart-pie mr-2"></i>Ver métricas
      </button>
    </div>

    <div class="mt-4 space-y-3">
      ${list.length ? list.slice(0,60).map(orderRow).join("") : emptyState("Aún no hay pedidos web.")}
    </div>
  `;
}

function orderRow(s){
  const statusPill =
    s.status==="pendiente" ? pill("Pendiente","bg-amber-50 text-amber-900 border-amber-100") :
    s.status==="aceptada" ? pill("Aceptada","bg-blue-50 text-blue-900 border-blue-100") :
    s.status==="entregada" ? pill("Entregada","bg-green-50 text-green-900 border-green-100") :
    pill("Cancelada","bg-red-50 text-red-900 border-red-100");

  const link = s.customerLocationLink ? `<a target="_blank" class="text-red-700 font-bold hover:underline" href="${s.customerLocationLink}">Maps</a>` : "—";
  const canCancel = SESSION.user?.role==="admin" && !s.canceledAt;
  return `
    <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-black">Pedido #${s.id.slice(0,6).toUpperCase()} • ${fmtGs(s.total)}</div>
        <div class="flex items-center gap-2">
          ${statusPill}
          <button class="h-10 w-10 rounded-2xl hover:bg-red-50 grid place-items-center" data-wa-order="${escapeHtml(s.id)}" data-wa-phone="${escapeHtml(s.customerPhone||"")}">
            <i class="fa-brands fa-whatsapp text-green-600"></i>
          </button>
        </div>
      </div>

      <div class="mt-2 text-sm text-slate-600 grid sm:grid-cols-2 gap-2">
        <div>📞 <span class="font-bold">${escapeHtml(s.customerPhone||"—")}</span></div>
        <div>💳 <span class="font-bold">${escapeHtml(s.paymentMethod||"—")}</span></div>
        <div>📍 ${link}</div>
        <div>📝 ${escapeHtml(s.customerAddress||"—")}</div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110" data-order-status="${s.id}" data-status="aceptada">Aceptar</button>
        <button class="px-4 py-2.5 rounded-2xl bg-green-700 text-white font-black hover:brightness-110" data-order-status="${s.id}" data-status="entregada">Entregada</button>
        <button class="px-4 py-2.5 rounded-2xl border border-red-200 font-black hover:bg-red-50" data-order-status="${s.id}" data-status="pendiente">Volver a pendiente</button>

        ${canCancel ? `
          <button class="px-4 py-2.5 rounded-2xl bg-red-700 text-white font-black hover:brightness-110" data-sale-cancel="${s.id}">
            <i class="fa-solid fa-ban mr-2"></i>Cancelar (Admin)
          </button>` : ``}
      </div>
    </div>
  `;
}

function pill(text, cls){
  return `<span class="px-3 py-1.5 rounded-full text-xs font-black border ${cls}">${text}</span>`;
}

function setOrderStatus(id, status){
  const s = DB.sales.find(x=>x.id===id);
  if(!s) return;
  s.status = status;
  audit("ORDER_STATUS", { id, status, by: SESSION.user?.username });
  saveStore(DB);
  toast(`Pedido ${id.slice(0,6)} → ${status}`, "ok");
  renderAdmin();
}

/* ===== Sales POS ===== */
let POS = { lines: [] };

function adminSalesPOS(){
  if(!(SESSION.user?.role==="admin" || SESSION.user?.role==="ventas")){
    return emptyState("No tienes permisos para Ventas (POS).");
  }

  const products = DB.products.filter(p=>p.active);
  const payOptions = ["Efectivo","Transferencia","Tarjeta","Billetera"];

  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">VENTAS (POS)</div>
        <div class="text-2xl font-black mt-1">Registrar venta con cantidades</div>
        <div class="text-sm text-slate-600 mt-1">Solo Admin puede cancelar ventas.</div>
      </div>
      <button id="btnSalesTip" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
        <i class="fa-solid fa-lightbulb mr-2"></i>Tip
      </button>
    </div>

    <div class="mt-4 grid lg:grid-cols-2 gap-3">
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Nueva venta</div>

        <div class="mt-3 grid gap-2">
          <label class="text-xs font-bold text-slate-600">Producto</label>
          <select id="posProd" class="px-4 py-3 rounded-2xl border border-red-100">
            ${products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} • ${fmtGs(p.price)} • stock:${p.stock}</option>`).join("")}
          </select>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-bold text-slate-600">Cantidad</label>
              <input id="posQty" type="number" min="1" value="1" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100"/>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-600">Pago</label>
              <select id="posPay" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100">
                ${payOptions.map(x=>`<option value="${x}">${x}</option>`).join("")}
              </select>
            </div>
          </div>

          <button id="btnPosAdd" class="mt-2 px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
            <i class="fa-solid fa-plus mr-2"></i>Agregar a la venta
          </button>
        </div>

        <div class="mt-4">
          <div class="font-black">Detalle</div>
          <div id="posLines" class="mt-2 space-y-2"></div>

          <div class="mt-3 p-3 rounded-2xl bg-red-50 border border-red-100">
            <div class="flex justify-between"><span class="font-bold">Total</span> <span id="posTotal" class="font-black text-red-700">${fmtGs(0)}</span></div>
          </div>

          <button id="btnPosConfirm" class="mt-3 w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110">
            <i class="fa-solid fa-check mr-2"></i>Confirmar venta
          </button>
        </div>
      </div>

      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Ventas recientes</div>
        <div class="text-xs text-slate-500 mt-1">Incluye ventas admin y web (filtrá en Reportes).</div>
        <div class="mt-3 space-y-2">
          ${DB.sales.slice(0,20).map(saleRow).join("") || emptyState("Aún sin ventas.")}
        </div>
      </div>
    </div>
  `;
}

function posAddLine(){
  const pid = document.getElementById("posProd").value;
  const qty = Math.max(1, Number(document.getElementById("posQty").value||1));
  const p = DB.products.find(x=>x.id===pid);
  if(!p) return;

  if((p.stock||0) <= 0){
    toast("Producto sin stock.", "warn");
    return;
  }

  const currentQty = POS.lines.filter(x=>x.productId===pid).reduce((a,x)=>a+x.qty,0);
  if(currentQty + qty > (p.stock||0)){
    toast("Cantidad supera el stock disponible.", "warn");
    return;
  }

  const it = POS.lines.find(x=>x.productId===pid);
  if(it) it.qty += qty;
  else POS.lines.push({productId:pid, qty});
  renderPOS();
}

function posRemoveLine(pid){
  POS.lines = POS.lines.filter(x=>x.productId!==pid);
  renderPOS();
}

function renderPOS(){
  const box = document.getElementById("posLines");
  if(!box) return;

  if(POS.lines.length===0){
    box.innerHTML = `<div class="p-3 rounded-2xl bg-white/60 border border-red-100 text-slate-600">Agregá productos a la venta.</div>`;
  } else {
    box.innerHTML = POS.lines.map(l=>{
      const p = DB.products.find(x=>x.id===l.productId);
      const unit = p.discountPct ? p.price*(1-p.discountPct/100) : p.price;
      return `
        <div class="p-3 rounded-2xl border border-red-100 bg-white/70 flex items-center justify-between gap-2">
          <div>
            <div class="font-black">${escapeHtml(p.name)}</div>
            <div class="text-xs text-slate-500">${l.qty} x ${fmtGs(unit)} = <span class="font-bold">${fmtGs(unit*l.qty)}</span></div>
          </div>
          <button class="h-10 w-10 rounded-2xl hover:bg-red-50 grid place-items-center" data-pos-remove="${p.id}">
            <i class="fa-solid fa-trash text-red-700"></i>
          </button>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-pos-remove]").forEach(btn=>{
      btn.addEventListener("click", ()=> posRemoveLine(btn.getAttribute("data-pos-remove")), { once: true });
    });
  }

  let total=0;
  POS.lines.forEach(l=>{
    const p = DB.products.find(x=>x.id===l.productId);
    if(!p) return;
    const unit = p.discountPct ? p.price*(1-p.discountPct/100) : p.price;
    total += unit * l.qty;
  });

  document.getElementById("posTotal").textContent = fmtGs(total);
}

function posConfirm(){
  if(POS.lines.length===0){
    toast("No hay líneas en la venta.", "warn");
    return;
  }

  const oldCart = JSON.parse(JSON.stringify(CART));
  CART.items = POS.lines.map(x=>({productId:x.productId, qty:x.qty}));

  const pay = document.getElementById("posPay").value;
  const sale = createSaleFromCart({
    source:"admin",
    paymentMethod: pay,
    status:"completada"
  });

  CART = oldCart;
  POS.lines = [];

  toast(`Venta confirmada: ${sale.id.slice(0,6).toUpperCase()} (${fmtGs(sale.total)})`, "ok");
  renderAdmin();
}

function saleRow(s){
  const canceled = s.canceledAt ? `<span class="px-2 py-1 rounded-full bg-red-50 border border-red-100 text-red-800 text-xs font-black">Cancelada</span>` : "";
  const canCancel = SESSION.user?.role==="admin" && !s.canceledAt;

  return `
    <div class="p-3 rounded-2xl border border-red-100 bg-white/70">
      <div class="flex items-center justify-between gap-2">
        <div class="font-black">#${s.id.slice(0,6).toUpperCase()} • ${fmtGs(s.total)}</div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-black">${escapeHtml(s.source)}</span>
          ${canceled}
        </div>
      </div>
      <div class="text-xs text-slate-500 mt-1">Pago: <span class="font-bold">${escapeHtml(s.paymentMethod||"—")}</span> • ${new Date(s.at).toLocaleString()}</div>
      ${canCancel ? `
        <div class="mt-2">
          <button class="px-3 py-2 rounded-2xl bg-red-700 text-white font-black hover:brightness-110" data-sale-cancel="${s.id}">
            <i class="fa-solid fa-ban mr-2"></i>Cancelar (Admin)
          </button>
        </div>` : ``}
    </div>
  `;
}

function cancelSale(id){
  if(SESSION.user?.role !== "admin"){
    toast("Solo Admin puede cancelar una venta.", "err");
    return;
  }
  const s = DB.sales.find(x=>x.id===id);
  if(!s || s.canceledAt){
    toast("Venta no encontrada o ya cancelada.", "warn");
    return;
  }
  for(const it of s.items){
    const p = DB.products.find(x=>x.id===it.productId);
    if(p){
      p.stock = (p.stock||0) + it.qty;
      p.updatedAt = nowISO();
      DB.stockMovements.unshift({
        id: uid(), at: nowISO(), productId: p.id, type:"in", qty: it.qty,
        note: `Cancelación venta ${s.id.slice(0,6)}`, userId: SESSION.user.id
      });
    }
  }
  s.canceledAt = nowISO();
  s.canceledBy = SESSION.user.id;
  s.status = "cancelada";
  audit("SALE_CANCELED", { saleId: id, by: SESSION.user.username });
  saveStore(DB);
  toast(`Venta ${id.slice(0,6)} cancelada y stock repuesto ✅`, "ok");
  renderAdmin();
}

/* ===== Products ===== */
function adminProducts(){
  if(!(SESSION.user?.role==="admin" || SESSION.user?.role==="stock")){
    return emptyState("No tienes permisos para Productos/Stock.");
  }
  const list = DB.products.slice().sort((a,b)=> (a.category||"").localeCompare(b.category||"") || (a.name||"").localeCompare(b.name||""));

  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">PRODUCTOS / STOCK</div>
        <div class="text-2xl font-black mt-1">Inventario completo</div>
        <div class="text-sm text-slate-600 mt-1">Stock, mínimos, descuentos, imágenes y alertas.</div>
      </div>
      <div class="flex gap-2">
        <button id="btnNewProduct" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
          <i class="fa-solid fa-plus mr-2"></i>Nuevo producto
        </button>
        <button id="btnExportProducts" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
          <i class="fa-solid fa-file-export mr-2"></i>Export CSV
        </button>
      </div>
    </div>

    <div class="mt-4 glass rounded-3xl p-3">
      <div class="grid sm:grid-cols-3 gap-2">
        <input id="pQ" placeholder="Buscar..." class="px-4 py-3 rounded-2xl border border-red-100"/>
        <select id="pCat" class="px-4 py-3 rounded-2xl border border-red-100">
          <option value="">Todas</option>
          ${DB.categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
        </select>
        <select id="pFilter" class="px-4 py-3 rounded-2xl border border-red-100">
          <option value="all">Todos</option>
          <option value="low">Stock bajo</option>
          <option value="nostock">Sin stock</option>
          <option value="discount">Con descuento</option>
        </select>
      </div>
    </div>

    <div id="pList" class="mt-4 space-y-3"></div>

    <input id="filePick" type="file" accept="image/*" class="hidden"/>
  `;
}

function wireAdminProducts(){
  document.getElementById("btnNewProduct")?.addEventListener("click", newProduct);
  document.getElementById("btnExportProducts")?.addEventListener("click", ()=> exportCSV("products"));

  const list = DB.products.slice().sort((a,b)=> (a.category||"").localeCompare(b.category||"") || (a.name||"").localeCompare(b.name||""));
  const pQ = document.getElementById("pQ");
  const pCat = document.getElementById("pCat");
  const pFilter = document.getElementById("pFilter");
  const pList = document.getElementById("pList");

  function paint(){
    const qq = (pQ.value||"").trim().toLowerCase();
    const cc = pCat.value;
    const ff = pFilter.value;

    let items = list
      .filter(p=> !qq || p.name.toLowerCase().includes(qq))
      .filter(p=> !cc || p.category===cc);

    if(ff==="low") items = items.filter(p=> (p.stock||0) <= (p.minStock || DB.settings.stockAlertDefault));
    if(ff==="nostock") items = items.filter(p=> (p.stock||0) <= 0);
    if(ff==="discount") items = items.filter(p=> (p.discountPct||0) > 0);

    pList.innerHTML = items.map(productRow).join("") || emptyState("Sin resultados.");

    // Wire row controls
    pList.querySelectorAll("[data-upd]").forEach(el=>{
      el.addEventListener("change", ()=>{
        const id = el.getAttribute("data-id");
        const field = el.getAttribute("data-field");
        updProduct(id, field, el.value);
      }, { once: true });
    });
    pList.querySelectorAll("[data-adjust-stock]").forEach(el=>{
      el.addEventListener("change", ()=>{
        adjustStock(el.getAttribute("data-adjust-stock"), el.value);
      }, { once: true });
    });
    pList.querySelectorAll("[data-pick-image]").forEach(el=>{
      el.addEventListener("click", ()=> pickImage(el.getAttribute("data-pick-image")), { once: true });
    });
    pList.querySelectorAll("[data-toggle-product]").forEach(el=>{
      el.addEventListener("click", ()=> toggleProduct(el.getAttribute("data-toggle-product")), { once: true });
    });
    pList.querySelectorAll("[data-del-product]").forEach(el=>{
      el.addEventListener("click", ()=> deleteProduct(el.getAttribute("data-del-product")), { once: true });
    });
  }

  pQ.oninput = paint;
  pCat.onchange = paint;
  pFilter.onchange = paint;
  paint();
}

function productRow(p){
  const img = p.imageData
    ? `<img src="${p.imageData}" class="h-16 w-16 rounded-2xl object-cover border border-red-100"/>`
    : `<div class="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 grid place-items-center text-red-700"><i class="fa-solid fa-image"></i></div>`;

  const low = (p.stock||0) <= (p.minStock || DB.settings.stockAlertDefault);
  const badge = low ? pill("Bajo","bg-amber-50 text-amber-900 border-amber-100") : pill("OK","bg-green-50 text-green-900 border-green-100");

  return `
    <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        ${img}
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <div class="font-black text-lg">${escapeHtml(p.name)}</div>
            <span class="text-xs font-black bg-slate-100 px-2 py-1 rounded-full">${escapeHtml(p.category)}</span>
            ${badge}
            ${(p.discountPct||0) ? pill(p.discountPct + "% OFF","bg-red-50 text-red-900 border-red-100") : ""}
          </div>
          <div class="text-sm text-slate-600 mt-1">
            Precio: <span class="font-black text-red-700">${fmtGs(p.price)}</span> • Stock: <span class="font-black">${p.stock}</span> • Mínimo: <span class="font-black">${p.minStock || DB.settings.stockAlertDefault}</span>
          </div>

          <div class="mt-3 grid sm:grid-cols-4 gap-2">
            <input type="number" class="px-3 py-2 rounded-2xl border border-red-100" value="${p.price}" data-upd="1" data-id="${p.id}" data-field="price">
            <input type="number" class="px-3 py-2 rounded-2xl border border-red-100" value="${p.stock}" data-adjust-stock="${p.id}">
            <input type="number" class="px-3 py-2 rounded-2xl border border-red-100" value="${p.minStock || DB.settings.stockAlertDefault}" data-upd="1" data-id="${p.id}" data-field="minStock">
            <input type="number" class="px-3 py-2 rounded-2xl border border-red-100" value="${p.discountPct||0}" data-upd="1" data-id="${p.id}" data-field="discountPct">
          </div>
          <div class="text-xs text-slate-500 mt-1">Campos: Precio • Stock (ajuste) • Stock mínimo • Descuento %</div>
        </div>

        <div class="flex md:flex-col gap-2">
          <button class="px-4 py-2.5 rounded-2xl bg-red-700 text-white font-black hover:brightness-110" data-pick-image="${p.id}">
            <i class="fa-solid fa-image mr-2"></i>Imagen
          </button>
          <button class="px-4 py-2.5 rounded-2xl border border-red-200 font-black hover:bg-red-50" data-toggle-product="${p.id}">
            <i class="fa-solid fa-eye-slash mr-2"></i>${p.active ? "Desactivar" : "Activar"}
          </button>
          ${SESSION.user?.role==="admin" ? `
            <button class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110" data-del-product="${p.id}">
              <i class="fa-solid fa-trash mr-2"></i>Borrar
            </button>` : ``}
        </div>
      </div>
    </div>
  `;
}

function updProduct(id, field, value){
  const p = DB.products.find(x=>x.id===id);
  if(!p) return;
  if(["price","stock","minStock","discountPct"].includes(field)){
    p[field] = Math.max(0, Number(value||0));
  } else {
    p[field] = value;
  }
  p.updatedAt = nowISO();
  audit("PRODUCT_UPDATE", { id, field });
  saveStore(DB);
  toast("Producto actualizado ✅", "ok");
  renderAdmin();
}
function adjustStock(id, newStock){
  const p = DB.products.find(x=>x.id===id);
  if(!p) return;
  const ns = Math.max(0, Number(newStock||0));
  const diff = ns - (p.stock||0);
  p.stock = ns;
  p.updatedAt = nowISO();
  DB.stockMovements.unshift({
    id: uid(), at: nowISO(), productId: id, type:"adjust", qty: Math.abs(diff),
    note: `Ajuste stock (${diff>=0?"+":"-"}${Math.abs(diff)})`, userId: SESSION.user?.id
  });
  audit("STOCK_ADJUST", { id, diff });
  saveStore(DB);
  toast("Stock ajustado ✅", "ok");
  renderAdmin();
}
function toggleProduct(id){
  const p = DB.products.find(x=>x.id===id);
  if(!p) return;
  p.active = !p.active;
  audit("PRODUCT_TOGGLE", { id, active:p.active });
  saveStore(DB);
  renderAdmin();
}
function deleteProduct(id){
  if(SESSION.user?.role!=="admin"){
    toast("Solo Admin puede borrar productos.", "err");
    return;
  }
  DB.products = DB.products.filter(x=>x.id!==id);
  audit("PRODUCT_DELETE", { id });
  saveStore(DB);
  toast("Producto eliminado.", "ok");
  renderAdmin();
}
function newProduct(){
  const n = prompt("Nombre del producto:");
  if(!n) return;
  const c = prompt("Categoría (ej: Bebidas, Snacks, etc.):", DB.categories[0]||"General") || "General";
  if(!DB.categories.includes(c)) DB.categories.push(c);
  DB.products.unshift({
    id: uid(), name:n, category:c, price:0, stock:0, minStock: DB.settings.stockAlertDefault, discountPct:0,
    active:true, imageData:"", updatedAt: nowISO()
  });
  audit("PRODUCT_NEW", { name:n });
  saveStore(DB);
  toast("Producto creado ✅", "ok");
  renderAdmin();
}

function pickImage(productId){
  const file = document.getElementById("filePick");
  if(!file) return;

  file.value = "";
  file.onchange = ()=>{
    const f = file.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const p = DB.products.find(x=>x.id===productId);
      if(p){
        p.imageData = String(reader.result||"");
        p.updatedAt = nowISO();
        audit("PRODUCT_IMAGE", { id:productId });
        saveStore(DB);
        toast("Imagen actualizada ✅", "ok");
        renderAdmin();
      }
    };
    reader.readAsDataURL(f);
  };
  file.click();
}

/* ===== Promos ===== */
function adminPromos(){
  if(!(SESSION.user?.role==="admin" || SESSION.user?.role==="ventas")){
    return emptyState("No tienes permisos para Promociones.");
  }
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">PROMOCIONES</div>
        <div class="text-2xl font-black mt-1">Super Promos y promos normales</div>
        <div class="text-sm text-slate-600 mt-1">Activa/desactiva y destacá.</div>
      </div>
      <button id="btnNewPromo" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
        <i class="fa-solid fa-plus mr-2"></i>Nueva promo
      </button>
    </div>

    <div class="mt-4 space-y-3" id="promoAdminList">
      ${DB.promotions.map(promoRow).join("") || emptyState("Sin promos.")}
    </div>
  `;
}

function wireAdminPromos(){
  document.getElementById("btnNewPromo")?.addEventListener("click", newPromo);

  const box = document.getElementById("promoAdminList");
  box?.querySelectorAll("[data-promo-upd]").forEach(el=>{
    el.addEventListener("change", ()=>{
      updPromo(el.getAttribute("data-id"), el.getAttribute("data-field"), el.value);
    }, { once: true });
  });
  box?.querySelectorAll("[data-promo-toggle]").forEach(el=>{
    el.addEventListener("click", ()=> togglePromo(el.getAttribute("data-promo-toggle")), { once: true });
  });
  box?.querySelectorAll("[data-promo-del]").forEach(el=>{
    el.addEventListener("click", ()=> deletePromo(el.getAttribute("data-promo-del")), { once: true });
  });
}

function promoRow(p){
  const canDelete = SESSION.user?.role==="admin";
  return `
    <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-black text-lg">${escapeHtml(p.title)}</div>
        <div class="flex items-center gap-2">
          ${p.featured ? pill("Destacada","bg-red-50 text-red-900 border-red-100") : ""}
          ${p.active ? pill("Activa","bg-green-50 text-green-900 border-green-100") : pill("Inactiva","bg-slate-100 text-slate-700 border-slate-200")}
        </div>
      </div>

      <div class="text-sm text-slate-600 mt-1">${escapeHtml(p.subtitle||"")}</div>

      <div class="mt-3 grid sm:grid-cols-4 gap-2">
        <input class="px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(p.title)}" data-promo-upd="1" data-id="${p.id}" data-field="title">
        <input class="px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(p.subtitle||"")}" data-promo-upd="1" data-id="${p.id}" data-field="subtitle">
        <input type="number" class="px-3 py-2 rounded-2xl border border-red-100" value="${p.discountPct||0}" data-promo-upd="1" data-id="${p.id}" data-field="discountPct">
        <select class="px-3 py-2 rounded-2xl border border-red-100" data-promo-upd="1" data-id="${p.id}" data-field="featured">
          <option value="false" ${!p.featured?"selected":""}>Normal</option>
          <option value="true" ${p.featured?"selected":""}>Destacada</option>
        </select>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button class="px-4 py-2.5 rounded-2xl border border-red-200 font-black hover:bg-red-50" data-promo-toggle="${p.id}">
          <i class="fa-solid fa-power-off mr-2"></i>${p.active?"Desactivar":"Activar"}
        </button>
        ${canDelete ? `
          <button class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110" data-promo-del="${p.id}">
            <i class="fa-solid fa-trash mr-2"></i>Borrar
          </button>` : ``}
      </div>
    </div>
  `;
}

function newPromo(){
  const title = prompt("Título de la promo:", "🔥 Super Promo");
  if(!title) return;
  DB.promotions.unshift({ id:uid(), title, subtitle:"", discountPct:0, featured:false, active:true, startDate:todayYMD(), endDate:todayYMD(), imageData:"" });
  audit("PROMO_NEW", { title });
  saveStore(DB);
  renderAdmin();
}
function updPromo(id, field, value){
  const p = DB.promotions.find(x=>x.id===id);
  if(!p) return;
  if(field==="discountPct") p.discountPct = Math.max(0, Number(value||0));
  else if(field==="featured") p.featured = (value==="true" || value===true);
  else p[field] = value;
  audit("PROMO_UPDATE", { id, field });
  saveStore(DB);
  toast("Promo actualizada ✅", "ok");
  renderAdmin();
}
function togglePromo(id){
  const p = DB.promotions.find(x=>x.id===id);
  if(!p) return;
  p.active = !p.active;
  audit("PROMO_TOGGLE", { id, active:p.active });
  saveStore(DB);
  renderAdmin();
}
function deletePromo(id){
  if(SESSION.user?.role!=="admin"){
    toast("Solo Admin puede borrar promos.", "err");
    return;
  }
  DB.promotions = DB.promotions.filter(x=>x.id!==id);
  audit("PROMO_DELETE", { id });
  saveStore(DB);
  renderAdmin();
}

/* ===== Stock Movements ===== */
function adminStockMoves(){
  if(!(SESSION.user?.role==="admin" || SESSION.user?.role==="stock")){
    return emptyState("No tienes permisos para Movimientos.");
  }
  const moves = DB.stockMovements.slice(0,120);
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">MOVIMIENTOS DE STOCK</div>
        <div class="text-2xl font-black mt-1">Entradas / salidas / ajustes</div>
        <div class="text-sm text-slate-600 mt-1">Trazabilidad para control ultra total.</div>
      </div>
      <button id="btnExportMoves" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
        <i class="fa-solid fa-file-export mr-2"></i>Export CSV
      </button>
    </div>

    <div class="mt-4 space-y-2">
      ${moves.map(m=>{
        const p = DB.products.find(x=>x.id===m.productId);
        const t = m.type==="out" ? pill("Salida","bg-red-50 text-red-900 border-red-100")
              : m.type==="in" ? pill("Entrada","bg-green-50 text-green-900 border-green-100")
              : pill("Ajuste","bg-slate-100 text-slate-700 border-slate-200");
        return `
          <div class="p-3 rounded-2xl border border-red-100 bg-white/70">
            <div class="flex items-center justify-between gap-2">
              <div class="font-black">${escapeHtml(p?.name||m.productId)}</div>
              ${t}
            </div>
            <div class="text-xs text-slate-500 mt-1">
              Cantidad: <span class="font-black">${m.qty}</span> • ${new Date(m.at).toLocaleString()} • Nota: ${escapeHtml(m.note||"—")}
            </div>
          </div>
        `;
      }).join("") || emptyState("Sin movimientos aún.")}
    </div>
  `;
}

/* ===== Reports ===== */
function adminReports(){
  const from = todayYMD();
  const to = todayYMD();
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">REPORTES & GRÁFICOS</div>
        <div class="text-2xl font-black mt-1">Control ultra total</div>
        <div class="text-sm text-slate-600 mt-1">Ventas, pagos, top productos, descuentos, cancelaciones y stock crítico.</div>
      </div>
      <button id="btnExportSales" class="px-4 py-3 rounded-2xl border border-red-200 font-black hover:bg-red-50">
        <i class="fa-solid fa-file-export mr-2"></i>Export CSV (ventas)
      </button>
    </div>

    <div class="mt-4 glass rounded-3xl p-3">
      <div class="grid sm:grid-cols-3 gap-2">
        <div>
          <label class="text-xs font-bold text-slate-600">Desde</label>
          <input id="rFrom" type="date" value="${from}" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100"/>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-600">Hasta</label>
          <input id="rTo" type="date" value="${to}" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100"/>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-600">Fuente</label>
          <select id="rSource" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100">
            <option value="">Todas</option>
            <option value="admin">Admin</option>
            <option value="web">Web</option>
          </select>
        </div>
      </div>
      <button id="btnGenReports" class="mt-3 w-full py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
        <i class="fa-solid fa-chart-line mr-2"></i>Generar reportes
      </button>
    </div>

    <div class="mt-4 grid xl:grid-cols-2 gap-3">
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Ventas por día</div>
        <canvas id="chSalesDay" height="140"></canvas>
      </div>
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Distribución por método de pago</div>
        <canvas id="chPay" height="140"></canvas>
      </div>
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Top productos (monto)</div>
        <canvas id="chTop" height="140"></canvas>
      </div>
      <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
        <div class="font-black">Descuentos y cancelaciones</div>
        <canvas id="chDiscCancel" height="140"></canvas>
      </div>
    </div>

    <div class="mt-4 p-4 rounded-3xl bg-white/70 border border-red-100">
      <div class="font-black">Stock crítico / indicadores</div>
      <div id="stockInsights" class="mt-2 grid md:grid-cols-2 gap-2"></div>
    </div>
  `;
}

function paintReports(){
  // destroy previous charts
  REPORT_CHARTS.forEach(ch=> { try{ ch.destroy(); }catch{} });
  REPORT_CHARTS = [];

  const from = document.getElementById("rFrom").value;
  const to = document.getElementById("rTo").value;
  const source = document.getElementById("rSource").value;

  const inRange = (iso)=>{
    const d = (iso||"").slice(0,10);
    return (!from || d>=from) && (!to || d<=to);
  };

  let sales = DB.sales.filter(s=> inRange(s.at));
  if(source) sales = sales.filter(s=> s.source===source);

  const validSales = sales.filter(s=> !s.canceledAt);

  // by day
  const byDay = {};
  validSales.forEach(s=>{
    const d = s.at.slice(0,10);
    byDay[d] = (byDay[d]||0) + (s.total||0);
  });
  const days = Object.keys(byDay).sort();
  const dayVals = days.map(d=> byDay[d]);

  // by payment
  const byPay = {};
  validSales.forEach(s=>{
    const k = s.paymentMethod || "—";
    byPay[k] = (byPay[k]||0) + (s.total||0);
  });
  const payKeys = Object.keys(byPay);
  const payVals = payKeys.map(k=> byPay[k]);

  // top products
  const byProd = {};
  validSales.forEach(s=>{
    s.items.forEach(it=>{
      const p = DB.products.find(x=>x.id===it.productId);
      const name = p?.name || it.productId;
      const unit = it.discountPct ? it.unitPrice*(1-it.discountPct/100) : it.unitPrice;
      byProd[name] = (byProd[name]||0) + unit*it.qty;
    });
  });
  const top = Object.entries(byProd).sort((a,b)=> b[1]-a[1]).slice(0,8);
  const topLabels = top.map(x=>x[0]);
  const topVals = top.map(x=>x[1]);

  // discounts and cancellations
  const discTotal = validSales.reduce((a,s)=> a+(s.discountTotal||0),0);
  const canceled = sales.filter(s=> s.canceledAt).length;

  // Charts
  const ctx1 = document.getElementById("chSalesDay");
  if(ctx1){
    REPORT_CHARTS.push(new Chart(ctx1, {
      type:"line",
      data:{ labels: days, datasets:[{ label:"₲", data: dayVals }]},
      options:{ responsive:true, plugins:{ legend:{ display:false } } }
    }));
  }

  const ctx2 = document.getElementById("chPay");
  if(ctx2){
    REPORT_CHARTS.push(new Chart(ctx2, {
      type:"doughnut",
      data:{ labels: payKeys, datasets:[{ label:"₲", data: payVals }]},
      options:{ responsive:true }
    }));
  }

  const ctx3 = document.getElementById("chTop");
  if(ctx3){
    REPORT_CHARTS.push(new Chart(ctx3, {
      type:"bar",
      data:{ labels: topLabels, datasets:[{ label:"₲", data: topVals }]},
      options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ maxRotation:0, autoSkip:true } } } }
    }));
  }

  const ctx4 = document.getElementById("chDiscCancel");
  if(ctx4){
    REPORT_CHARTS.push(new Chart(ctx4, {
      type:"bar",
      data:{ labels:["Descuentos (₲)","Cancelaciones (#)"], datasets:[{ label:"Valor", data:[discTotal, canceled] }]},
      options:{ responsive:true, plugins:{ legend:{ display:false } } }
    }));
  }

  // stock insights
  const critical = DB.products
    .filter(p=>p.active && (p.stock||0) <= (p.minStock || DB.settings.stockAlertDefault))
    .sort((a,b)=> (a.stock||0)-(b.stock||0))
    .slice(0,10);

  const stockBox = document.getElementById("stockInsights");
  const salesSum = validSales.reduce((a,s)=>a+(s.total||0),0);
  const avgTicket = validSales.length ? (salesSum / validSales.length) : 0;

  if(stockBox){
    stockBox.innerHTML = `
      <div class="p-3 rounded-2xl border border-red-100 bg-red-50">
        <div class="font-black text-red-800">Stock crítico</div>
        <div class="text-sm text-slate-700 mt-2">
          ${critical.length ? critical.map(p=>`• <span class="font-bold">${escapeHtml(p.name)}</span> (stock: ${p.stock}, mín: ${p.minStock||DB.settings.stockAlertDefault})`).join("<br/>") : "No hay productos críticos ✅"}
        </div>
      </div>

      <div class="p-3 rounded-2xl border border-red-100 bg-white/70">
        <div class="font-black">Indicadores</div>
        <div class="text-sm text-slate-700 mt-2">
          • Ventas (rango): <span class="font-bold">${fmtGs(salesSum)}</span><br/>
          • Ticket promedio: <span class="font-bold">${fmtGs(avgTicket)}</span><br/>
          • % descuentos vs ventas: <span class="font-bold">${Math.round((discTotal / (salesSum || 1))*100)}%</span><br/>
          • Cancelaciones: <span class="font-bold">${canceled}</span>
        </div>
      </div>
    `;
  }

  toast("Reportes actualizados ✅", "ok");
}

/* ===== Users ===== */
function adminUsers(){
  if(SESSION.user?.role !== "admin"){
    return emptyState("Solo Admin puede gestionar usuarios y permisos.");
  }
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">USUARIOS & PERMISOS</div>
        <div class="text-2xl font-black mt-1">Crear, desactivar, roles</div>
        <div class="text-sm text-slate-600 mt-1">Roles: admin / stock / ventas</div>
      </div>
      <button id="btnNewUser" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
        <i class="fa-solid fa-user-plus mr-2"></i>Nuevo usuario
      </button>
    </div>

    <div class="mt-4 space-y-3" id="userList">
      ${DB.users.map(u=>`
        <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-black text-lg">${escapeHtml(u.username)}</div>
              <div class="text-xs text-slate-500">Rol: <span class="font-black text-red-700">${escapeHtml(u.role)}</span> • Estado: <span class="font-black">${u.active?"Activo":"Inactivo"}</span></div>
            </div>
            <div class="flex gap-2">
              <select class="px-3 py-2 rounded-2xl border border-red-100 font-black" data-user-role="${u.id}">
                <option value="admin" ${u.role==="admin"?"selected":""}>admin</option>
                <option value="stock" ${u.role==="stock"?"selected":""}>stock</option>
                <option value="ventas" ${u.role==="ventas"?"selected":""}>ventas</option>
              </select>
              <button class="px-4 py-2.5 rounded-2xl border border-red-200 font-black hover:bg-red-50" data-user-toggle="${u.id}">
                ${u.active ? "Desactivar" : "Activar"}
              </button>
              <button class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110" data-user-pin="${u.id}">
                Reset PIN
              </button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function wireAdminUsers(){
  document.getElementById("btnNewUser")?.addEventListener("click", newUser);

  const box = document.getElementById("userList");
  box?.querySelectorAll("[data-user-role]").forEach(sel=>{
    sel.addEventListener("change", ()=> setUserRole(sel.getAttribute("data-user-role"), sel.value), { once:true });
  });
  box?.querySelectorAll("[data-user-toggle]").forEach(btn=>{
    btn.addEventListener("click", ()=> toggleUser(btn.getAttribute("data-user-toggle")), { once:true });
  });
  box?.querySelectorAll("[data-user-pin]").forEach(btn=>{
    btn.addEventListener("click", ()=> resetPin(btn.getAttribute("data-user-pin")), { once:true });
  });
}

function newUser(){
  const username = prompt("Usuario (sin espacios):");
  if(!username) return;
  const pin = prompt("PIN numérico (ej 1234):", "1234") || "1234";
  const role = prompt("Rol (admin/stock/ventas):", "ventas") || "ventas";
  DB.users.unshift({ id:uid(), username:username.trim(), pin:pin.trim(), role:role.trim(), active:true, createdAt: nowISO() });
  audit("USER_NEW", { username });
  saveStore(DB);
  renderAdmin();
}
function setUserRole(id, role){
  const u = DB.users.find(x=>x.id===id);
  if(!u) return;
  u.role = role;
  audit("USER_ROLE", { id, role });
  saveStore(DB);
  toast("Rol actualizado ✅", "ok");
  renderAdmin();
}
function toggleUser(id){
  const u = DB.users.find(x=>x.id===id);
  if(!u) return;
  u.active = !u.active;
  audit("USER_TOGGLE", { id, active:u.active });
  saveStore(DB);
  renderAdmin();
}
function resetPin(id){
  const u = DB.users.find(x=>x.id===id);
  if(!u) return;
  const pin = prompt("Nuevo PIN:", "0000");
  if(!pin) return;
  u.pin = pin.trim();
  audit("USER_PIN_RESET", { id });
  saveStore(DB);
  toast("PIN actualizado ✅", "ok");
  renderAdmin();
}

/* ===== Branches ===== */
function adminBranches(){
  if(SESSION.user?.role !== "admin"){
    return emptyState("Solo Admin puede gestionar sucursales.");
  }
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">SUCURSALES</div>
        <div class="text-2xl font-black mt-1">Locales / ubicaciones</div>
        <div class="text-sm text-slate-600 mt-1">Agrega nuevas sucursales y edita datos.</div>
      </div>
      <button id="btnNewBranch" class="px-4 py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
        <i class="fa-solid fa-plus mr-2"></i>Nueva sucursal
      </button>
    </div>

    <div class="mt-4 space-y-3" id="branchList">
      ${DB.branches.map(b=>`
        <div class="p-4 rounded-3xl bg-white/70 border border-red-100">
          <div class="font-black text-lg">${escapeHtml(b.name)}</div>
          <div class="mt-2 grid sm:grid-cols-3 gap-2">
            <input class="px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(b.name)}" data-branch-upd="1" data-id="${b.id}" data-field="name">
            <input class="px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(b.phone)}" data-branch-upd="1" data-id="${b.id}" data-field="phone">
            <input class="px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(b.locationUrl)}" data-branch-upd="1" data-id="${b.id}" data-field="locationUrl">
          </div>
          <input class="mt-2 w-full px-3 py-2 rounded-2xl border border-red-100" value="${escapeHtml(b.address||"")}" data-branch-upd="1" data-id="${b.id}" data-field="address">
          <div class="mt-3 flex gap-2">
            <a class="px-4 py-2.5 rounded-2xl border border-red-200 font-black hover:bg-red-50" target="_blank" href="${escapeHtml(b.locationUrl)}">
              <i class="fa-solid fa-map mr-2"></i>Ver mapa
            </a>
            ${DB.branches.length>1 ? `
              <button class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black hover:brightness-110" data-branch-del="${b.id}">
                <i class="fa-solid fa-trash mr-2"></i>Borrar
              </button>` : ``}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function wireAdminBranches(){
  document.getElementById("btnNewBranch")?.addEventListener("click", newBranch);

  const box = document.getElementById("branchList");
  box?.querySelectorAll("[data-branch-upd]").forEach(inp=>{
    inp.addEventListener("change", ()=> updBranch(inp.getAttribute("data-id"), inp.getAttribute("data-field"), inp.value), { once:true });
  });
  box?.querySelectorAll("[data-branch-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> delBranch(btn.getAttribute("data-branch-del")), { once:true });
  });
}

function newBranch(){
  const name = prompt("Nombre sucursal:", "Nueva sucursal");
  if(!name) return;
  DB.branches.push({ id:uid(), name, address:"", phone: DB.settings.phone, locationUrl: DB.settings.locationUrl });
  audit("BRANCH_NEW", { name });
  saveStore(DB);
  renderAdmin();
}
function updBranch(id, field, value){
  const b = DB.branches.find(x=>x.id===id);
  if(!b) return;
  b[field] = value;
  audit("BRANCH_UPDATE", { id, field });
  saveStore(DB);
  toast("Sucursal actualizada ✅", "ok");
  renderAdmin();
}
function delBranch(id){
  DB.branches = DB.branches.filter(x=>x.id!==id);
  audit("BRANCH_DELETE", { id });
  saveStore(DB);
  renderAdmin();
}

/* ===== Settings ===== */
function adminSettings(){
  if(SESSION.user?.role !== "admin"){
    return emptyState("Solo Admin puede configurar la bodega.");
  }
  const s = DB.settings;
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">CONFIGURACIÓN</div>
        <div class="text-2xl font-black mt-1">Datos del local</div>
        <div class="text-sm text-slate-600 mt-1">Nombre, número, ubicación, alertas.</div>
      </div>
    </div>

    <div class="mt-4 p-4 rounded-3xl bg-white/70 border border-red-100" id="settingsBox">
      <div class="grid sm:grid-cols-2 gap-2">
        <div>
          <label class="text-xs font-bold text-slate-600">Nombre</label>
          <input id="setName" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100" value="${escapeHtml(s.storeName)}"/>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-600">Teléfono (WhatsApp)</label>
          <input id="setPhone" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100" value="${escapeHtml(s.phone)}"/>
          <div class="text-xs text-slate-500 mt-1">Se usa para pedidos y consultas.</div>
        </div>
        <div class="sm:col-span-2">
          <label class="text-xs font-bold text-slate-600">Ubicación (link)</label>
          <input id="setLoc" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100" value="${escapeHtml(s.locationUrl)}"/>
        </div>
        <div>
          <label class="text-xs font-bold text-slate-600">Alerta stock por defecto</label>
          <input id="setAlert" type="number" class="mt-1 w-full px-4 py-3 rounded-2xl border border-red-100" value="${s.stockAlertDefault}"/>
        </div>
        <div class="p-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-slate-700">
          <div class="font-black text-red-800">Tema</div>
          Rojo & blanco ya aplicado.
        </div>
      </div>

      <button id="btnSaveSettings" class="mt-3 w-full py-3 rounded-2xl bg-red-700 text-white font-black hover:brightness-110">
        Guardar cambios
      </button>
    </div>
  `;
}

function wireAdminSettings(){
  document.getElementById("btnSaveSettings")?.addEventListener("click", ()=>{
    updSetting("storeName", document.getElementById("setName").value);
    updSetting("phone", document.getElementById("setPhone").value);
    updSetting("locationUrl", document.getElementById("setLoc").value);
    updSetting("stockAlertDefault", document.getElementById("setAlert").value);
    toast("Configuración guardada ✅", "ok");
    renderAdmin();
  });
}
function updSetting(field, value){
  if(field==="stockAlertDefault"){
    DB.settings[field] = Math.max(0, Number(value||0));
  } else {
    DB.settings[field] = value;
  }
  audit("SETTINGS_UPDATE", { field });
  saveStore(DB);
}

/* ===== Audit ===== */
function adminAudit(){
  if(SESSION.user?.role !== "admin"){
    return emptyState("Solo Admin puede ver la bitácora completa.");
  }
  const logs = DB.auditLog.slice(0,120);
  return `
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-xs font-black text-red-700">BITÁCORA</div>
        <div class="text-2xl font-black mt-1">Registro de acciones</div>
        <div class="text-sm text-slate-600 mt-1">Útil para auditoría interna y control.</div>
      </div>
    </div>

    <div class="mt-4 space-y-2">
      ${logs.map(l=>`
        <div class="p-3 rounded-2xl border border-red-100 bg-white/70">
          <div class="font-black">${escapeHtml(l.action)}</div>
          <div class="text-xs text-slate-500 mt-1">${new Date(l.at).toLocaleString()} • ${escapeHtml(JSON.stringify(l.meta||{}))}</div>
        </div>
      `).join("") || emptyState("Sin registros aún.")}
    </div>
  `;
}

/* ===== CSV Export ===== */
function exportCSV(type){
  let rows = [];
  if(type==="products"){
    rows = [["id","name","category","price","stock","minStock","discountPct","active","updatedAt"]];
    DB.products.forEach(p=> rows.push([p.id,p.name,p.category,p.price,p.stock,p.minStock,p.discountPct,p.active,p.updatedAt]));
  }
  if(type==="sales"){
    rows = [["id","at","source","status","paymentMethod","total","discountTotal","canceledAt","customerPhone"]];
    DB.sales.forEach(s=> rows.push([s.id,s.at,s.source,s.status,s.paymentMethod,s.total,s.discountTotal,s.canceledAt||"",s.customerPhone||""]));
  }
  if(type==="moves"){
    rows = [["id","at","productId","type","qty","note","userId"]];
    DB.stockMovements.forEach(m=> rows.push([m.id,m.at,m.productId,m.type,m.qty,m.note,m.userId]));
  }

  const csv = rows.map(r=> r.map(x=>{
    const v = String(x ?? "");
    return `"${v.replaceAll('"','""')}"`;
  }).join(",")).join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `san-ramon_${type}_${todayYMD()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSV exportado ✅", "ok");
}

/* =========================
   Wiring Admin Tabs & Actions
========================= */
function wireAdmin(){
  // login
  document.getElementById("btnLogin")?.addEventListener("click", login);

  // sidebar tabs
  document.querySelectorAll("[data-tab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      ADMIN_TAB = btn.getAttribute("data-tab");
      renderAdmin();
    }, { once:true });
  });

  // orders actions
  document.getElementById("btnOrdersReports")?.addEventListener("click", ()=> { ADMIN_TAB="reports"; renderAdmin(); });

  document.querySelectorAll("[data-order-status]").forEach(btn=>{
    btn.addEventListener("click", ()=> setOrderStatus(btn.getAttribute("data-order-status"), btn.getAttribute("data-status")), { once:true });
  });

  document.querySelectorAll("[data-sale-cancel]").forEach(btn=>{
    btn.addEventListener("click", ()=> cancelSale(btn.getAttribute("data-sale-cancel")), { once:true });
  });

  document.querySelectorAll("[data-wa-order]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      openWhatsApp(`Pedido ${btn.getAttribute("data-wa-order")} - Cliente ${btn.getAttribute("data-wa-phone")}`);
    }, { once:true });
  });

  // sales pos wiring
  document.getElementById("btnSalesTip")?.addEventListener("click", ()=>{
    toast("Tip: Usá Reportes para ver ventas por método, top productos, descuentos y cancelaciones.", "info");
  });
  document.getElementById("btnPosAdd")?.addEventListener("click", ()=>{
    posAddLine();
    renderPOS();
  });
  document.getElementById("btnPosConfirm")?.addEventListener("click", posConfirm);
  renderPOS();

  // stock moves export
  document.getElementById("btnExportMoves")?.addEventListener("click", ()=> exportCSV("moves"));

  // reports export
  document.getElementById("btnExportSales")?.addEventListener("click", ()=> exportCSV("sales"));

  // tab-specific extra wiring
  if(ADMIN_TAB === "products") wireAdminProducts();
  if(ADMIN_TAB === "promos") wireAdminPromos();
  if(ADMIN_TAB === "users") wireAdminUsers();
  if(ADMIN_TAB === "branches") wireAdminBranches();
  if(ADMIN_TAB === "settings") wireAdminSettings();
}

/* =========================
   Global UI extras
========================= */
let FLOAT_WA_BTN = null;
function ensureFloatingWA(){
  if(FLOAT_WA_BTN) return;
  const btn = document.createElement("button");
  btn.className = "fixed right-4 bottom-4 z-[60] h-14 w-14 rounded-2xl bg-green-600 text-white shadow-xl hover:brightness-110 transition grid place-items-center";
  btn.innerHTML = `<i class="fa-brands fa-whatsapp text-2xl"></i>`;
  btn.title = "WhatsApp SAN RAMON";
  btn.onclick = ()=> openWhatsApp("Hola SAN RAMON, quiero consultar 🙌");
  document.body.appendChild(btn);
  FLOAT_WA_BTN = btn;
}

/* =========================
   INIT
========================= */
function init(){
  // Initial router render
  route();
  renderCart();

  // Observe route changes to wire admin after render
  const adminEl = document.getElementById("routeAdmin");
  const obs = new MutationObserver(()=>{
    // When admin DOM changes, rewire
    wireAdmin();
  });
  obs.observe(adminEl, { childList:true, subtree:true });

  // Wire product cards/cart once home renders
  const homeEl = document.getElementById("routeHome");
  const obs2 = new MutationObserver(()=> wireCartButtons());
  obs2.observe(homeEl, { childList:true, subtree:true });
}
init();

// Expose a few functions for console debugging (optional)
window.__SR = {
  reset(){
    localStorage.removeItem(SR.storeKey);
    location.reload();
  }
};
