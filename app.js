// === إعدادات Supabase API ===
const SUPABASE_URL = 'https://mbuxmpwqhikfetjorolu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_URg0qnqfTP2lteDOe9lSHQ_lIFRQXjW';

const STORE_CONFIG = {
  name: 'كاف للمنتجات الطبيعية',
  tagline: 'تكفيك وزيادة • عسل نحل، ألبان، عناية طبيعية، مكسرات، بن، توابل وزيوت بكر 100%',
  currency: 'ج.م',
  whatsappNumber: '201000053046',
  defaultImage: 'https://mbuxmpwqhikfetjorolu.supabase.co/storage/v1/object/public/images/rated_Image.jpeg'
};

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let categoriesData = [];
let activeCategory = 'all';
let cart = [];
let productsMap = {};
let categorySwiper = null;
let productSwipers = [];
let expandedCategories = {};

async function loadMenuData() {
  try {
    const [catsRes, prodsRes] = await Promise.all([
      db.from('categories').select('*').order('sort', { ascending: true }),
      db.from('products').select('*').order('id', { ascending: true })
    ]);

    if (catsRes.error) throw catsRes.error;
    if (prodsRes.error) throw prodsRes.error;

    const cats = catsRes.data || [];
    const prods = prodsRes.data || [];

    categoriesData = cats.map(cat => ({
      id: String(cat.id),
      title: cat.name,
      icon: cat.icon || '🌿',
      note: cat.note || '',
      products: prods
        .filter(p => String(p.category_id) === String(cat.id))
        .map(p => ({
          _id: `p_${p.id}`,
          name: p.name,
          unit: p.weight || '',
          price: p.price,
          oldPrice: p.old_price,
          priceText: p.price_text || 'تواصل للسعر',
          image: p.image || STORE_CONFIG.defaultImage
        }))
    }));

    // تجميع المنتجات التي عليها خصم في قسم العروض بأعلى الصفحة
    const offerProducts = [];
    categoriesData.forEach(cat => {
      cat.products.forEach(p => {
        if (p.price !== null && p.oldPrice && Number(p.oldPrice) > Number(p.price)) {
          offerProducts.push(p);
        }
      });
    });

    if (offerProducts.length > 0) {
      categoriesData.unshift({
        id: 'offers',
        isOffers: true,
        title: 'عروض وخصومات كاف',
        icon: '🔥',
        note: 'وفّر أكثر • عروض متجددة لفترة محدودة',
        products: offerProducts
      });
    }

    initStore();
  } catch (error) {
    document.getElementById('menuContainer').innerHTML = `
      <div class="error-box">
        <strong>تعذر تحميل المنتجات من Supabase!</strong><br>
        تأكد من وضع مفتاح API الصحيح، وأن سياسة القراءة (Public Read) مفعلة في Supabase.<br>
        <small>${error.message || ''}</small>
      </div>
    `;
    console.error(error);
  }
}

function initStore() {
  document.title = `${STORE_CONFIG.name} | تكفيك وزيادة`;
  document.getElementById('storeName').textContent = STORE_CONFIG.name;
  document.getElementById('navStoreName').textContent = STORE_CONFIG.name;
  document.getElementById('footerName').textContent = STORE_CONFIG.name;
  document.getElementById('storeTagline').textContent = STORE_CONFIG.tagline;

  productsMap = {};
  const tabsWrapper = document.getElementById('filterTabs');

  categoriesData.forEach(cat => {
    if (cat.products.length === 0) return;

    cat.products.forEach(prod => {
      productsMap[prod._id] = prod;
    });

    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    slide.innerHTML = `
      <button class="cat-pill" data-category="${cat.id}">
        <span>${cat.icon} ${cat.title}</span>
        <span class="cat-count">${cat.products.length}</span>
      </button>
    `;
    tabsWrapper.appendChild(slide);
  });

  categorySwiper = new Swiper('.categories-swiper', {
    slidesPerView: 'auto',
    spaceBetween: 10,
    freeMode: true,
    grabCursor: true
  });

  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderCategories();
    });
  });

  document.getElementById('searchInput').addEventListener('input', renderCategories);
  renderCategories();
}

function buildProductCardHTML(product, currency) {
  const hasPrice = product.price !== null && product.price !== undefined;
  const hasDiscount = hasPrice && product.oldPrice && Number(product.oldPrice) > Number(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const priceHTML = hasPrice
    ? `
      <div class="price-box">
        ${hasDiscount ? `<span class="old-price">${product.oldPrice} ${currency}</span>` : ''}
        <span class="product-price">${product.price} ${currency}</span>
      </div>
    `
    : `<span class="product-price no-price">${product.priceText || 'تواصل للسعر'}</span>`;

  const inCart = cart.find(item => item.id === product._id);

  const actionHTML = inCart
    ? `
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty('${product._id}', 1)">+</button>
        <span class="qty-val">${inCart.qty}</span>
        <button class="qty-btn" onclick="changeQty('${product._id}', -1)">−</button>
      </div>
    `
    : `<button class="add-btn" onclick="addToCart('${product._id}')">+ أضف</button>`;

  return `
    <div class="product-card" data-pid="${product._id}">
      <div class="product-img-wrap">
        ${hasDiscount && discountPercent > 0 ? `<span class="discount-badge">خصم ${discountPercent}% 🔥</span>` : ''}
        <img
          src="${product.image}"
          alt="${product.name}"
          loading="lazy"
          onerror="this.src='${STORE_CONFIG.defaultImage}'"
        />
      </div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        ${product.unit ? `<span class="product-unit">${product.unit}</span>` : ''}
      </div>
      <div class="product-footer">
        ${priceHTML}
        <div class="card-action" id="action-${product._id}">${actionHTML}</div>
      </div>
    </div>
  `;
}

function refreshProductButtons(pid) {
  const inCart = cart.find(item => item.id === pid);
  const html = inCart
    ? `
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty('${pid}', 1)">+</button>
        <span class="qty-val">${inCart.qty}</span>
        <button class="qty-btn" onclick="changeQty('${pid}', -1)">−</button>
      </div>
    `
    : `<button class="add-btn" onclick="addToCart('${pid}')">+ أضف</button>`;

  document.querySelectorAll(`#action-${pid}`).forEach(el => {
    el.innerHTML = html;
  });
}

function toggleCategoryView(catId) {
  expandedCategories[catId] = !expandedCategories[catId];
  renderCategories();
}

function renderCategories() {
  productSwipers.forEach(s => s.destroy(true, true));
  productSwipers = [];

  const container = document.getElementById('menuContainer');
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const currency = STORE_CONFIG.currency;

  container.innerHTML = '';
  let hasResults = false;

  categoriesData.forEach(cat => {
    if (activeCategory !== 'all' && activeCategory !== cat.id) return;

    const filteredProducts = cat.products.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.unit && p.unit.toLowerCase().includes(searchTerm))
    );

    if (filteredProducts.length === 0) return;
    hasResults = true;

    const isGridMode = searchTerm.length > 0 || expandedCategories[cat.id] || activeCategory !== 'all';

    const section = document.createElement('section');
    section.className = cat.isOffers ? 'category-section offers-section' : 'category-section';

    section.innerHTML = `
      <div class="category-header">
        <div class="category-title-group">
          <h2 class="category-title">${cat.icon} ${cat.title}</h2>
          ${cat.note ? `<span class="category-note">${cat.note}</span>` : ''}
        </div>
        ${(searchTerm.length === 0 && activeCategory === 'all') ? `
          <button class="view-toggle-btn" onclick="toggleCategoryView('${cat.id}')">
            ${isGridMode ? 'عرض كسلايدر متحرك ◀' : `عرض الكل (${filteredProducts.length})`}
          </button>
        ` : ''}
      </div>
      ${isGridMode ? `
        <div class="products-grid">
          ${filteredProducts.map(p => buildProductCardHTML(p, currency)).join('')}
        </div>
      ` : `
        <div class="swiper products-swiper" id="swiper-${cat.id}">
          <div class="swiper-wrapper">
            ${filteredProducts.map(p => `
              <div class="swiper-slide">${buildProductCardHTML(p, currency)}</div>
            `).join('')}
          </div>
          <div class="swiper-button-next"></div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-pagination"></div>
        </div>
      `}
    `;

    container.appendChild(section);

    if (!isGridMode) {
      const swiperInstance = new Swiper(`#swiper-${cat.id}`, {
        slidesPerView: 1.15,
        spaceBetween: 14,
        grabCursor: true,
        autoplay: {
          delay: 3500,
          disableOnInteraction: true,
          pauseOnMouseEnter: true
        },
        pagination: {
          el: `#swiper-${cat.id} .swiper-pagination`,
          clickable: true,
          dynamicBullets: true
        },
        navigation: {
          nextEl: `#swiper-${cat.id} .swiper-button-next`,
          prevEl: `#swiper-${cat.id} .swiper-button-prev`
        },
        breakpoints: {
          540: { slidesPerView: 2.2, spaceBetween: 14 },
          820: { slidesPerView: 3.2, spaceBetween: 16 },
          1100: { slidesPerView: 4, spaceBetween: 16 }
        }
      });
      productSwipers.push(swiperInstance);
    }
  });

  if (!hasResults) {
    container.innerHTML = '<div class="status-msg">لا توجد منتجات مطابقة لبحثك 🔎</div>';
  }
}

function addToCart(pid) {
  const prod = productsMap[pid];
  if (!prod) return;
  const existing = cart.find(item => item.id === pid);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: pid,
      name: prod.name,
      unit: prod.unit || '',
      price: prod.price || 0,
      qty: 1
    });
  }
  refreshProductButtons(pid);
  updateCartUI();
}

function changeQty(pid, delta) {
  const idx = cart.findIndex(item => item.id === pid);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) {
    cart.splice(idx, 1);
  }
  refreshProductButtons(pid);
  updateCartUI();
  if (document.getElementById('drawerOverlay').classList.contains('open')) {
    renderCartDrawer();
  }
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalPrice = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const currency = STORE_CONFIG.currency;

  document.getElementById('navCartCount').textContent = totalQty;
  document.getElementById('drawerTotal').textContent = `${totalPrice} ${currency}`;

  const floatingCart = document.getElementById('floatingCart');
  if (totalQty > 0) {
    document.getElementById('floatingCartInfo').textContent = `${totalQty} منتج • ${totalPrice} ${currency}`;
    floatingCart.classList.add('visible');
  } else {
    floatingCart.classList.remove('visible');
  }
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('drawerOverlay').classList.add('open');
}

function closeCartDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
}

function renderCartDrawer() {
  const body = document.getElementById('drawerBody');
  const currency = STORE_CONFIG.currency;

  if (cart.length === 0) {
    body.innerHTML = '<div class="status-msg">سلة الطلبات فارغة حالياً 🛒</div>';
    return;
  }

  body.innerHTML = `
    ${cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${item.name}</strong>
          <span>${item.unit} • ${item.price > 0 ? (item.price * item.qty) + ' ' + currency : 'تواصل للسعر'}</span>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
        </div>
      </div>
    `).join('')}

    <div class="customer-fields">
      <strong style="font-size:0.9rem;color:var(--olive-dark);">بيانات التوصيل (اختياري):</strong>
      <input type="text" id="custName" placeholder="الاسم بالكامل" />
      <input type="text" id="custAddress" placeholder="العنوان بالتفصيل" />
    </div>
  `;
}

function sendOrderWhatsApp() {
  if (cart.length === 0) {
    alert('أضف منتجاً واحداً على الأقل قبل الإرسال.');
    return;
  }
  const phone = STORE_CONFIG.whatsappNumber;
  const currency = STORE_CONFIG.currency;
  const custName = document.getElementById('custName')?.value.trim();
  const custAddress = document.getElementById('custAddress')?.value.trim();

  let message = `السلام عليكم، طلب جديد من *${STORE_CONFIG.name}*:\n\n`;
  let total = 0;

  cart.forEach((item, index) => {
    const linePrice = item.price > 0 ? `${item.price * item.qty} ${currency}` : 'تواصل للسعر';
    total += item.price * item.qty;
    message += `${index + 1}. ${item.name} (${item.unit}) × ${item.qty} = ${linePrice}\n`;
  });

  message += `\n*الإجمالي التقديري:* ${total} ${currency}`;
  if (custName) message += `\n*الاسم:* ${custName}`;
  if (custAddress) message += `\n*العنوان:* ${custAddress}`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}
// ========================
// مشاركة المنتج وعرض الرابط المباشر
// ========================
function getProductShareData(pid) {
  const prod = productsMap[pid];
  if (!prod) return null;

  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?product=${prod.dbId}`;
  const priceText = prod.price !== null && prod.price !== undefined
    ? `${prod.price} ${STORE_CONFIG.currency}`
    : (prod.priceText || 'تواصل للسعر');

  const shareText = `🌿 *${prod.name}*${prod.unit ? ` (${prod.unit})` : ''}\n💰 السعر: ${priceText}\nمن متجر *${STORE_CONFIG.name}* - تكفيك وزيادة ✨`;

  return { prod, shareUrl, shareText, priceText };
}

async function shareProduct(pid, event) {
  if (event) event.stopPropagation();
  const data = getProductShareData(pid);
  if (!data) return;

  // على الموبايل: يفتح قائمة المشاركة الأصلية (واتساب، فيسبوك، إلخ)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${data.prod.name} - ${STORE_CONFIG.name}`,
        text: data.shareText,
        url: data.shareUrl
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // ألغى المستخدم المشاركة
    }
  }

  // على الكمبيوتر: يفتح نافذة المشاركة الجاهزة
  const encodedUrl = encodeURIComponent(data.shareUrl);
  const encodedFull = encodeURIComponent(`${data.shareText}\n\nاطلبه الآن من هنا:\n${data.shareUrl}`);

  document.getElementById('shareModalBody').innerHTML = `
    <p style="font-weight:800;color:var(--olive-dark);text-align:center;">${data.prod.name}</p>
    <a class="share-social-btn sh-wa" target="_blank" href="https://wa.me/?text=${encodedFull}">مشاركة عبر واتساب 💬</a>
    <a class="share-social-btn sh-fb" target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}">مشاركة على فيسبوك 📘</a>
    <a class="share-social-btn sh-tg" target="_blank" href="https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(data.shareText)}">مشاركة على تيليجرام ✈️</a>
    <button type="button" class="share-social-btn sh-copy" onclick="copyShareLink('${data.shareUrl}', this)">نسخ رابط المنتج 📋</button>
  `;
  document.getElementById('shareModalOverlay').classList.add('open');
}

function copyShareLink(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✅ تم نسخ الرابط!';
    setTimeout(() => { btn.textContent = 'نسخ رابط المنتج 📋'; }, 2000);
  });
}

function closeShareModal() {
  document.getElementById('shareModalOverlay').classList.remove('open');
}

function openProductDetails(pid) {
  const prod = productsMap[pid];
  if (!prod) return;

  const currency = STORE_CONFIG.currency;
  const hasPrice = prod.price !== null && prod.price !== undefined;
  const hasDiscount = hasPrice && prod.oldPrice && Number(prod.oldPrice) > Number(prod.price);

  document.getElementById('productModalContent').innerHTML = `
    <img src="${prod.image}" alt="${prod.name}" class="pm-img" onerror="this.src='${STORE_CONFIG.defaultImage}'" />
    <div class="pm-body">
      <div class="pm-title">${prod.name}</div>
      ${prod.unit ? `<span class="product-unit">${prod.unit}</span>` : ''}
      <div style="margin-top:12px;">
        ${hasPrice
          ? `${hasDiscount ? `<span class="old-price" style="margin-left:8px;">${prod.oldPrice} ${currency}</span>` : ''}
             <span class="product-price" style="font-size:1.35rem;">${prod.price} ${currency}</span>`
          : `<span class="product-price no-price">${prod.priceText}</span>`
        }
      </div>
      <div class="pm-actions">
        <button class="add-btn" onclick="addToCart('${prod._id}'); closeProductModal();">+ أضف للسلة 🛒</button>
        <button class="share-full-btn" onclick="shareProduct('${prod._id}', event)">مشاركة 🔗</button>
      </div>
    </div>
  `;
  document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
}

function checkSharedProduct() {
  const params = new URLSearchParams(window.location.search);
  const sharedId = params.get('product');
  if (sharedId) {
    const pid = `p_${sharedId}`;
    if (productsMap[pid]) {
      openProductDetails(pid);
    }
  }
}
loadMenuData();
