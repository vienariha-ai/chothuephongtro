// =====================
// CẤU HÌNH CHUNG
// =====================
const API_URL = (window.YT_HOME_API_URL || document.querySelector('meta[name=yt-home-api]')?.content ||
  "https://script.google.com/macros/s/AKfycbzoK0qFRv1cPfrglrp9NThC-YLXAx26ashfM7T3LnsPjKRY52HN3eMak_IhE9W8j7Uehg/exec");

const STORAGE_KEYS = {
  likes:   "ytHomeRoomLikes",
  ratings: "ytHomeRoomRatings",
  tenant:  "ytHomeTenant"
};

let CONTACT_INFO  = { zalo: "", email: "", messenger: "" };
let ALL_ROOMS     = [];
let SERVICES      = [];
let CURRENT_ROOM  = null;

let ROOM_LIKES    = {};
let ROOM_RATINGS  = {};
let CURRENT_FILTER = "all";

// =====================
// TIỆN ÍCH CHUNG
// =====================

function formatVND(amount) {
  if (amount === null || amount === undefined || amount === "") return "--";
  const num = Number(String(amount).replace(/[^\d.-]/g, ""));
  if (isNaN(num)) return String(amount);
  return num.toLocaleString("vi-VN") + " đ";
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildVideoEmbed(url) {
  if (!url) return "";
  const u = String(url).trim();

  if (u.includes("youtube.com") || u.includes("youtu.be")) {
    let videoId = "";
    const shortMatch = u.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) videoId = shortMatch[1];
    const longMatch = u.match(/[?&]v=([^&]+)/);
    if (longMatch) videoId = longMatch[1] || videoId;

    if (!videoId) return `<iframe src="${u}" allowfullscreen></iframe>`;
    const embedUrl = "https://www.youtube.com/embed/" + videoId;
    return `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
  }

  return `
    <video controls playsinline>
      <source src="${u}">
      Trình duyệt không hỗ trợ phát video.
    </video>`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// =====================
// LOCAL STORAGE CHUNG
// =====================

function loadLikesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.likes);
    ROOM_LIKES = raw ? JSON.parse(raw) : {};
  } catch (e) {
    ROOM_LIKES = {};
  }
}

function saveLikesToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.likes, JSON.stringify(ROOM_LIKES));
  } catch (e) {
    console.error("saveLikesToStorage error:", e);
  }
}

function loadRatingsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ratings);
    ROOM_RATINGS = raw ? JSON.parse(raw) : {};
  } catch (e) {
    ROOM_RATINGS = {};
  }
}

function saveRatingsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(ROOM_RATINGS));
  } catch (e) {
    console.error("saveRatingsToStorage error:", e);
  }
}

function getRoomRating(roomId) {
  if (!roomId) return 0;
  const data = ROOM_RATINGS[roomId] || { rating: 0 };
  return data.rating || 0;
}

// =====================
// TENANT / ĐĂNG NHẬP (index)
// =====================

function saveTenantToStorage(tenant) {
  try {
    if (tenant) {
      localStorage.setItem(STORAGE_KEYS.tenant, JSON.stringify(tenant));
    } else {
      localStorage.removeItem(STORAGE_KEYS.tenant);
    }
  } catch (e) {
    console.error("saveTenantToStorage error:", e);
  }
}

function openTenantPortal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.tenant);
    if (saved) {
      const tenant = JSON.parse(saved);
      if (tenant && tenant.maPhong) {
        window.location.href = "portal.html?room=" + encodeURIComponent(tenant.maPhong);
        return;
      }
    }
  } catch (e) {
    console.error("openTenantPortal error:", e);
  }
  window.location.href = "tenant.html";
}

function goTenantLogin(roomId) {
  if (!roomId) {
    window.location.href = "tenant.html";
    return;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.tenant);
    if (saved) {
      const tenant = JSON.parse(saved);
      if (tenant && tenant.maPhong === roomId) {
        window.location.href = "portal.html?room=" + encodeURIComponent(roomId);
        return;
      }
    }
  } catch (e) {
    console.error("goTenantLogin error:", e);
  }

  window.location.href = "tenant.html?room=" + encodeURIComponent(roomId);
}

function goRoomDetail(roomId) {
  if (!roomId) {
    window.location.href = "room.html";
    return;
  }
  window.location.href = "room.html?room=" + encodeURIComponent(roomId);
}

function copyRoomLink(encodedRoomId) {
  const id = decodeURIComponent(encodedRoomId || "");
  if (!id) return;
  const base = window.location.origin + window.location.pathname.replace(/index\.html$/i, "");
  const url = base + "tenant.html?room=" + encodeURIComponent(id);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(() => alert("Đã sao chép link đăng nhập cho phòng " + id + " vào clipboard."))
      .catch(() =>
        prompt("Không thể tự động sao chép, bạn copy link thủ công nhé:", url)
      );
  } else {
    prompt("Không thể tự động sao chép, bạn copy link thủ công nhé:", url);
  }
}

// =====================
// LIKE / RATING (index)
// =====================

function isRoomLiked(room) {
  const id = room.maPhong || "";
  const data = ROOM_LIKES[id];
  return !!(data && data.liked);
}

function toggleLike(roomId) {
  if (!roomId) return;
  const current = ROOM_LIKES[roomId] || { count: 0, liked: false };
  if (current.liked) {
    current.liked = false;
    current.count = Math.max(0, current.count - 1);
  } else {
    current.liked = true;
    current.count = (current.count || 0) + 1;
  }
  ROOM_LIKES[roomId] = current;
  saveLikesToStorage();
  renderRooms();
  renderHeroOverview();
}

// Rating gửi server (dùng cho index)
async function setRoomRating(roomId, rating) {
  if (!roomId) return;
  const r = Math.max(1, Math.min(5, rating));
  const old = getRoomRating(roomId);

  try {
    const body = new URLSearchParams({
      action: "rateRoom",
      roomId: roomId,
      rating: String(r),
      oldRating: String(old || 0)
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });

    const data = await res.json();
    if (!data || !data.success) {
      alert("Không thể gửi đánh giá. Vui lòng thử lại sau.");
      return;
    }

    ROOM_RATINGS[roomId] = { rating: r };
    saveRatingsToStorage();

    const found = ALL_ROOMS.find((rm) => (rm.maPhong || "") === roomId);
    if (found) {
      found.ratingAvg = data.ratingAvg || r;
      found.ratingCount =
        data.ratingCount != null ? data.ratingCount : found.ratingCount || 0;
    }

    renderRooms();
    renderHeroOverview();
  } catch (e) {
    console.error("setRoomRating error:", e);
    alert("Có lỗi khi gửi đánh giá. Vui lòng thử lại sau.");
  }
}

// Rating LOCAL cho trang room (chi tiết phòng)
function setRoomRatingLocal(roomId, rating) {
  if (!roomId) return;
  const r = Math.max(1, Math.min(5, rating));
  ROOM_RATINGS[roomId] = { rating: r };
  saveRatingsToStorage();
  renderRoomRating(roomId);
}

// =====================
// HELPER LỌC / SẮP XẾP PHÒNG (index)
// =====================

function getFloorNumber(room) {
  // Ưu tiên lấy từ cột "tầng" nếu có
  const raw = (room.tang || "").toString().toLowerCase().trim();
  if (raw) {
    if (raw.includes("trệt") || raw.includes("tret") || raw.includes("ground")) return 0;
    const m = raw.match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) return n;
    }
  }

  // Nếu sheet chưa có cột tầng: suy ra từ Mã phòng (P205 → tầng 2)
  const code = (room.maPhong || room.MaPhong || room.roomCode || "").toString().trim();
  // Hỗ trợ: P205, A301, 205, ... -> lấy chữ số đầu tiên trong phần số
  const mm = code.match(/\d+/);
  if (mm) {
    const digits = mm[0];
    if (digits.length >= 1) {
      const n = parseInt(digits[0], 10);
      if (!isNaN(n)) return n;
    }
  }

  return 999;
}

function getRoomPriceNumber(room) {
  const raw = room.giaThue;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(String(raw).replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
}

function getRoomAreaNumber(room) {
  const raw = room.dienTich || room.dientich;
  if (!raw) return null;
  const num = Number(String(raw).replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
}

function matchesFloor(room, value) {
  if (value === "all") return true;
  const n = getFloorNumber(room);
  const v = parseInt(value, 10);
  if (isNaN(v) || n === 999) return false;
  return n === v;
}

function matchesRating(room, value) {
  if (value === "all") return true;
  const avg = Number(room.ratingAvg || 0);
  if (value === "rated") return avg > 0;
  if (value === "3plus") return avg >= 3;
  if (value === "4plus") return avg >= 4;
  return true;
}

function matchesInterest(room, value) {
  if (value === "all") return true;
  if (value === "liked") return isRoomLiked(room);
  return true;
}

function matchesPrice(room, value) {
  if (value === "all") return true;
  const p = getRoomPriceNumber(room);
  if (p == null) return true;
  if (value === "lt3") return p < 3000000;
  if (value === "3-35") return p >= 3000000 && p <= 3500000;
  if (value === "35-4") return p > 3500000 && p <= 4000000;
  if (value === "gt4") return p > 4000000;
  return true;
}

function matchesArea(room, value) {
  if (value === "all") return true;
  const a = getRoomAreaNumber(room);
  if (a == null) return true;
  if (value === "lt18") return a < 18;
  if (value === "18-25") return a >= 18 && a <= 25;
  if (value === "gt25") return a > 25;
  return true;
}

function sortRooms(a, b) {
  const fa = getFloorNumber(a);
  const fb = getFloorNumber(b);
  if (fa !== fb) return fa - fb;

  const idA = (a.maPhong || "").toString();
  const idB = (b.maPhong || "").toString();
  return idA.localeCompare(idB, "vi", { numeric: true, sensitivity: "base" });
}

// =====================
// HERO OVERVIEW (index)
// =====================

function renderHeroOverview() {
  const box = document.getElementById("heroOverview");
  if (!box) return;

  if (!ALL_ROOMS.length) {
    box.innerHTML = `
      <div class="hero-chart-row">
        <div class="hero-chart-top">
          <span class="hero-chart-label">Dữ liệu phòng</span>
          <span class="hero-chart-value">Chưa có trên hệ thống</span>
        </div>
      </div>`;
    return;
  }

  const total = ALL_ROOMS.length;
  const availableRooms = ALL_ROOMS.filter((r) => r.trangThaiWebsite === "available");
  const likedRooms     = ALL_ROOMS.filter((r) => isRoomLiked(r));
  const highRatedRooms = ALL_ROOMS.filter(
    (r) => Number(r.ratingAvg || 0) >= 4 && Number(r.ratingCount || 0) > 0
  );

  function pct(count) {
    if (!total) return 0;
    return Math.max(4, Math.min(100, Math.round((count / total) * 100)));
  }

  box.innerHTML = `
    <div class="hero-chart-row">
      <div class="hero-chart-top">
        <span class="hero-chart-label">Còn trống</span>
        <span class="hero-chart-value">${availableRooms.length}/${total} phòng</span>
      </div>
      <div class="hero-chart-bar-bg">
        <div class="hero-chart-bar-fill hero-chart-bar-available" style="width:${pct(
          availableRooms.length
        )}%"></div>
      </div>
    </div>
    <div class="hero-chart-row">
      <div class="hero-chart-top">
        <span class="hero-chart-label">Được bạn quan tâm (♥)</span>
        <span class="hero-chart-value">${likedRooms.length}/${total} phòng</span>
      </div>
      <div class="hero-chart-bar-bg">
        <div class="hero-chart-bar-fill hero-chart-bar-liked" style="width:${pct(
          likedRooms.length
        )}%"></div>
      </div>
    </div>
    <div class="hero-chart-row">
      <div class="hero-chart-top">
        <span class="hero-chart-label">Đánh giá từ 4★ trở lên</span>
        <span class="hero-chart-value">${highRatedRooms.length}/${total} phòng</span>
      </div>
      <div class="hero-chart-bar-bg">
        <div class="hero-chart-bar-fill hero-chart-bar-highrated" style="width:${pct(
          highRatedRooms.length
        )}%"></div>
      </div>
    </div>`;
}

// Rating display trên card (index)
function buildStarsHtmlIndex(room) {
  const roomId     = room.maPhong || "";
  const userRating = getRoomRating(roomId);
  const avg   = Number(room.ratingAvg || 0);
  const count = Number(room.ratingCount || 0);

  let html = `<div class="rating" data-room="${roomId}">`;
  for (let i = 1; i <= 5; i++) {
    const active = i <= userRating ? "active" : "";
    html += `<span class="star ${active}" onclick="setRoomRating('${roomId}', ${i})">★</span>`;
  }
  html += `<span class="rating-text">${avg ? avg.toFixed(1) : "--"} (${count || 0} đánh giá)</span>`;
  html += "</div>";
  return html;
}

// =====================
// RENDER DANH SÁCH PHÒNG (index)
// =====================

function renderRooms(filter) {
  const grid    = document.getElementById("roomsGrid");
  const statusEl= document.getElementById("roomsStatus");
  if (!grid || !statusEl) return;
  grid.innerHTML = "";

  if (typeof filter === "string") {
    CURRENT_FILTER = filter;
  } else {
    filter = CURRENT_FILTER;
  }

  const floorVal    = document.getElementById("filterFloor")?.value    || "all";
  const ratingVal   = document.getElementById("filterRating")?.value   || "all";
  const interestVal = document.getElementById("filterInterest")?.value || "all";
  const priceVal    = document.getElementById("filterPrice")?.value    || "all";
  const areaVal     = document.getElementById("filterArea")?.value     || "all";

  let filtered = ALL_ROOMS.filter((room) => {
    if (filter === "all") return true;
    if (filter === "available") return room.trangThaiWebsite === "available";
    return room.loaiPhong === filter;
  });

  filtered = filtered
    .filter((room) => matchesFloor(room, floorVal))
    .filter((room) => matchesRating(room, ratingVal))
    .filter((room) => matchesInterest(room, interestVal))
    .filter((room) => matchesPrice(room, priceVal))
    .filter((room) => matchesArea(room, areaVal))
    .sort(sortRooms);

  statusEl.textContent = filtered.length
    ? "Hiển thị " + filtered.length + " phòng."
    : "Không có phòng phù hợp với bộ lọc hiện tại.";

  filtered.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room-card";

    const roomId   = room.maPhong || "";
    const encoded  = encodeURIComponent(roomId);
    const likeData = ROOM_LIKES[roomId] || { count: 0, liked: false };
    const likeBtnExtraClass = likeData.liked ? " like-btn-liked" : "";

    const isAvailable = room.trangThaiWebsite === "available";
    const statusLabel = isAvailable
      ? "Còn trống"
      : (room.trangThaiHienThi || room.trangThai || "Đang thuê");
    const statusClass = isAvailable ? "status-available" : "status-rented";

    const videoIconHtml = room.video
      ? `<button class="icon-btn" type="button" title="Xem video"
           onclick="openVideoModal('${encodeURIComponent(room.video)}')">▶</button>`
      : "";

    const giaText   = formatVND(room.giaThue);
    const areaText  = room.dienTich ? room.dienTich + " m²" : "";
    const floorText = room.tang || "";
    const likeCountText = likeData.count || 0;
    const starsHtml     = buildStarsHtmlIndex(room);

    card.innerHTML = `
      <div class="room-line" style="font-weight:600;">
        <span>${roomId || "Chưa đặt mã"}</span>
        <span class="room-status-chip ${statusClass}">${statusLabel}</span>
      </div>
      <div class="room-line">
        <span>${room.loaiPhong || ""}</span>
        <span>${areaText}</span>
      </div>
      <div class="room-line">
        <span>${giaText}</span>
        <span>${floorText ? "Tầng " + floorText : ""}</span>
      </div>
      ${starsHtml}
      <div class="room-footer">
        <div class="room-actions">
          <button class="icon-btn${likeBtnExtraClass}" type="button"
                  onclick="toggleLike('${roomId}')">♥</button>
          <button class="icon-btn" type="button"
                  onclick="copyRoomLink('${encoded}')">🔗</button>
          ${videoIconHtml}
          <span class="like-count">${likeCountText}</span>
        </div>
        <div class="room-footer-buttons">
          <button class="room-btn" type="button"
                  onclick="goRoomDetail('${roomId}')">
            Xem chi tiết
          </button>
          ${
            isAvailable
              ? `<button type="button"
                         class="room-btn-secondary room-btn-secondary-disabled"
                         disabled>Đăng nhập</button>`
              : `<button type="button"
                         class="room-btn-secondary"
                         onclick="goTenantLogin('${roomId}')">
                   Đăng nhập
                 </button>`
          }
        </div>
      </div>`;

    grid.appendChild(card);
  });
}

// =====================
// HERO STATS, FILTER, LOAD ROOMS (index)
// =====================

function updateStats() {
  const totalRoomsEl = document.getElementById("statTotalRooms");
  const availableEl  = document.getElementById("statAvailable");
  const heroStatus   = document.getElementById("heroStatus");

  if (!totalRoomsEl || !availableEl || !heroStatus) return;

  const total = ALL_ROOMS.length;
  const availableCount = ALL_ROOMS.filter(
    (r) => r.trangThaiWebsite === "available"
  ).length;

  totalRoomsEl.textContent = total || "--";
  availableEl.textContent  = availableCount + " phòng trống";
  heroStatus.textContent   = availableCount > 0 ? "Còn phòng trống" : "Tạm hết phòng";
}

function initFilters() {
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.dataset.filter;
      renderRooms(filter);
    });
  });

  ["filterFloor", "filterRating", "filterInterest", "filterPrice", "filterArea"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => renderRooms());
      }
    }
  );
}

async function loadRoomsFromServer() {
  const statusEl = document.getElementById("roomsStatus");
  if (!statusEl) return;
  statusEl.textContent = "Đang tải dữ liệu phòng từ server...";

  try {
    const res = await fetch(API_URL + "?action=rooms");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    ALL_ROOMS = (data && data.rooms) || [];

    statusEl.textContent = ALL_ROOMS.length
      ? "Đã tải " + ALL_ROOMS.length + " phòng từ hệ thống."
      : 'Chưa có dữ liệu phòng trong sheet "Phòng".';

    renderRooms("all");
    renderHeroOverview();
    updateStats();
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Lỗi khi tải dữ liệu phòng. Vui lòng kiểm tra API_URL hoặc Apps Script.";
  }
}

// =====================
// CONTACT & SOCIAL LINKS (dùng chung)
// =====================

async function loadContactInfo() {
  try {
    const res = await fetch(API_URL + "?action=contactInfo");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    CONTACT_INFO = (data && data.contact) || CONTACT_INFO;

    const phoneSpan = document.getElementById("contactPhoneText");
    const emailSpan = document.getElementById("contactEmailText");
    const zaloLink  = document.getElementById("zaloQuickLink");
    const mailLink  = document.getElementById("emailQuickLink");
    const msgLink   = document.getElementById("messengerQuickLink");

    if (emailSpan && CONTACT_INFO.email) {
      emailSpan.textContent = CONTACT_INFO.email;
    }
    if (phoneSpan && CONTACT_INFO.zalo) {
      phoneSpan.textContent = CONTACT_INFO.zalo;
    }

    if (zaloLink && CONTACT_INFO.zalo) zaloLink.href = CONTACT_INFO.zalo;
    if (mailLink && CONTACT_INFO.email) {
      const subject = encodeURIComponent("YT Home - Tư vấn thuê phòng");
      mailLink.href = `mailto:${CONTACT_INFO.email}?subject=${subject}`;
    }
    if (msgLink && CONTACT_INFO.messenger) {
      msgLink.href = CONTACT_INFO.messenger;
    }
  } catch (err) {
    console.error("loadContactInfo error:", err);
  }
}

// Submit form liên hệ trên INDEX
async function handleIndexContactSubmit(event) {
  event.preventDefault();
  const formStatus = document.getElementById("formStatus");
  if (!formStatus) return;
  formStatus.textContent = "Đang gửi...";

  const formData = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    roomType: document.getElementById("roomType").value,
    message: document.getElementById("message").value.trim()
  };

  try {
    const body = new URLSearchParams({
      action: "contact",
      name: formData.name,
      phone: formData.phone,
      roomType: formData.roomType,
      message: formData.message
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });

    const data = await res.json();
    formStatus.textContent =
      (data && data.message) || "Gửi thành công. Cảm ơn bạn đã liên hệ YT Home.";
    document.getElementById("contactForm").reset();
  } catch (err) {
    console.error(err);
    formStatus.textContent =
      "Có lỗi khi gửi thông tin. Vui lòng thử lại sau.";
  }
}

// =====================
// ROOM DETAIL (page room.html)
// =====================

function buildStarsHtmlDetail(roomId) {
  const current = getRoomRating(roomId);
  let html = `<div class="rating" data-room="${roomId}">`;
  for (let i = 1; i <= 5; i++) {
    const active = i <= current ? "active" : "";
    html += `<span class="star ${active}" onclick="setRoomRatingLocal('${roomId}', ${i})">★</span>`;
  }
  html += `<span style="margin-left:6px; font-size:0.8rem;">Đánh giá của bạn</span></div>`;
  return html;
}

function renderRoomRating(roomId) {
  const box = document.getElementById("roomRatingContainer");
  if (!box) return;
  box.innerHTML = buildStarsHtmlDetail(roomId);
}

function collectImages(room) {
  const keys = [
    "anh1", "anh2", "anh3",
    "hinhAnh1", "hinhAnh2", "hinhAnh3",
    "image1", "image2", "image3"
  ];
  const imgs = [];
  keys.forEach((k) => {
    const v = room[k];
    if (v) imgs.push(v);
  });
  return imgs;
}

function getPetAllowFlag(room) {
  if (typeof room.thuCungAllowed === "boolean") return room.thuCungAllowed;
  const raw = String(room.thuCung || room.pet || room.allowPet || "").trim().toLowerCase();
  if (!raw) return null;

  const yes = ["có", "yes", "y", "1", "true", "cho phép", "được"];
  const no  = ["không", "ko", "no", "0", "false", "k cho", "không cho phép"];
  if (yes.some((k) => raw.includes(k))) return true;
  if (no.some((k) => raw.includes(k))) return false;
  return null;
}

function renderRoomDetail(room) {
  const loadingText      = document.getElementById("loadingText");
  const layout           = document.getElementById("detailLayout");
  const breadcrumbRoom   = document.getElementById("breadcrumbRoom");
  const roomInfoCard     = document.getElementById("roomInfoCard");
  const galleryContainer = document.getElementById("galleryContainer");
  const videoContainer   = document.getElementById("videoContainer");
  const roomIdShort      = document.getElementById("roomIdShort");
  const tenantLink       = document.getElementById("tenantPortalLink");

  if (loadingText) loadingText.style.display = "none";
  if (layout) layout.style.display = "grid";

  const maPhong   = room.maPhong || "Phòng";
  const loaiPhong = room.loaiPhong || "Phòng cho thuê";
  const gia       = room.giaThue ? formatVND(room.giaThue) + "/tháng" : "Giá liên hệ";
  const tang      = room.tang || "–";
  const coc       = room.coc ? formatVND(room.coc) : "–";
  const dienTich  = room.dienTich || room.dientich || "Đang cập nhật";
  const note      = room.thongTinPhong || room.ghiChu || "";

  const available   = room.trangThaiWebsite === "available";
  const statusClass = available ? "status-available" : "status-rented";
  const statusText  = available ? "Còn trống" : "Đang thuê";

  const assets    = Array.isArray(room.assets) ? room.assets : [];
  const allowFlag = getPetAllowFlag(room);

  let petPolicyHTML = "";
  if (allowFlag === true) {
    petPolicyHTML = `
      <div class="section-title">Chính sách thú cưng</div>
      <ul class="asset-list"><li>✅ Cho phép nuôi thú cưng</li></ul>`;
  } else if (allowFlag === false) {
    petPolicyHTML = `
      <div class="section-title">Chính sách thú cưng</div>
      <ul class="asset-list"><li>❌ Không cho phép nuôi thú cưng</li></ul>`;
  } else {
    petPolicyHTML = `
      <div class="section-title">Chính sách thú cưng</div>
      <div class="room-desc" style="font-size:0.85rem;">
        Vui lòng liên hệ để được tư vấn chi tiết về chính sách thú cưng cho phòng này.
      </div>`;
  }

  if (breadcrumbRoom) breadcrumbRoom.textContent = maPhong;
  if (roomIdShort) roomIdShort.textContent = maPhong;
  document.title = maPhong + " – YT Home";

  if (tenantLink) {
    tenantLink.href = "tenant.html?room=" + encodeURIComponent(maPhong);
  }

  if (roomInfoCard) {
    roomInfoCard.innerHTML = `
      <div class="room-title-line">
        <div class="room-title">${maPhong}</div>
        <div id="roomRatingContainer"></div>
      </div>
      <div class="room-sub">${loaiPhong}</div>
      <div class="price-row">
        <div class="price">${gia}</div>
        <span class="status-chip ${statusClass}">${statusText}</span>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Tầng</span>
          <span class="meta-value">${tang}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Diện tích</span>
          <span class="meta-value">${dienTich}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Tiền cọc</span>
          <span class="meta-value">${coc}</span>
        </div>
      </div>

      <div class="section-title">Mô tả phòng</div>
      <div class="room-desc">
        ${note || "Chủ nhà đang cập nhật mô tả chi tiết cho phòng này."}
      </div>

      <div class="section-title">Nội thất & tiện nghi trong phòng</div>
      ${
        assets.length
          ? `<ul class="asset-list">
              ${assets.map((a) => `<li>✅ ${a.tenTaiSan || a.ten || ""}</li>`).join("")}
             </ul>`
          : `<div class="room-desc" style="font-size:0.85rem;">
              Chủ nhà đang cập nhật danh sách nội thất chi tiết. Bạn có thể liên hệ để hỏi thêm.
             </div>`
      }

      ${petPolicyHTML}
    `;
  }

  renderRoomRating(maPhong);

  // Hình ảnh
  if (galleryContainer) {
    const images = collectImages(room);
    if (images.length) {
      if (images.length === 1) {
        galleryContainer.innerHTML = `
          <div class="gallery">
            <div class="gallery-main">
              <img src="${images[0]}" alt="Hình phòng ${maPhong}">
            </div>
            <div class="gallery-thumb-grid"></div>
          </div>`;
      } else {
        const [main, ...rest] = images;
        const thumbs = rest.slice(0, 2);
        galleryContainer.innerHTML = `
          <div class="gallery">
            <div class="gallery-main">
              <img src="${main}" alt="Hình phòng ${maPhong}">
            </div>
            <div class="gallery-thumb-grid">
              ${thumbs
                .map(
                  (src) => `
                <div class="gallery-thumb">
                  <img src="${src}" alt="Hình phòng ${maPhong}">
                </div>`
                )
                .join("")}
            </div>
          </div>`;
      }
    } else {
      galleryContainer.innerHTML = `
        <div class="gallery-placeholder">
          Hình ảnh chi tiết của phòng sẽ được cập nhật sớm. Bạn có thể xem video hoặc đặt lịch xem trực tiếp.
        </div>`;
    }
  }

  // Video
  if (videoContainer) {
    videoContainer.innerHTML = room.video ? buildVideoEmbed(room.video) : "";
  }

  const msgInput = document.getElementById("message");
  if (msgInput) {
    msgInput.value =
      `Em quan tâm phòng ${maPhong} (${loaiPhong}), xin tư vấn thêm và đặt lịch xem phòng.`;
  }

  CURRENT_ROOM = room;
}

// Bảng dịch vụ phòng (room)
function renderFeeCard() {
  const feeCard = document.getElementById("feeCard");
  if (!feeCard) return;

  if (!SERVICES.length) {
    feeCard.innerHTML = `
      <div class="section-title">Chi phí dịch vụ tham khảo</div>
      <p style="font-size:0.85rem;">
        Đang cập nhật danh sách dịch vụ. Vui lòng liên hệ để biết chi tiết.
      </p>`;
    return;
  }

  const rowsHtml = SERVICES.map((s) => {
    const ten = s.nhomDichVu || s.maDV || "Dịch vụ";
    const giaText = s.donGia ? formatVND(s.donGia) : "--";
    let ghiChu = s.thongTinDichVu || "";
    if (s.loai) ghiChu = ghiChu ? `${ghiChu} – ${s.loai}` : s.loai;

    let icon = "💼";
    const keyword = ten.toLowerCase();
    if (keyword.includes("nước")) icon = "💧";
    else if (keyword.includes("điện")) icon = "⚡";
    else if (keyword.includes("wifi") || keyword.includes("internet")) icon = "📶";
    else if (keyword.includes("xe")) icon = "🛵";
    else if (keyword.includes("rác") || keyword.includes("vệ sinh")) icon = "🗑️";
    else if (keyword.includes("giặt")) icon = "🧺";
    else if (keyword.includes("dịch vụ")) icon = "🔧";
    else if (keyword.includes("cọc")) icon = "💰";

    return `
      <tr>
        <td><span class="service-icon">${icon}</span>${ten}</td>
        <td>${giaText}</td>
        <td>${ghiChu}</td>
      </tr>`;
  }).join("");

  feeCard.innerHTML = `
    <div class="section-title">Chi phí dịch vụ tham khảo</div>
    <table class="fee-table">
      <tr>
        <th>Dịch vụ</th>
        <th style="text-align:right;">Giá</th>
        <th>Ghi chú</th>
      </tr>
      ${rowsHtml}
    </table>
    <div class="badge-row">
      <div class="badge">Hợp đồng rõ ràng</div>
      <div class="badge">Không phí môi giới</div>
      <div class="badge">Ưu tiên ở lâu dài</div>
    </div>`;
}

async function loadRoomDetailFromServer() {
  const roomId = getQueryParam("room");
  const loadingText = document.getElementById("loadingText");

  if (!roomId) {
    if (loadingText) {
      loadingText.textContent = "Không tìm thấy mã phòng trên đường dẫn.";
    }
    return;
  }

  if (loadingText) {
    loadingText.textContent = "Đang tải thông tin phòng " + roomId + "...";
  }

  try {
    const res = await fetch(
      `${API_URL}?action=roomDetail&room=${encodeURIComponent(roomId)}`
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const room = data && data.room;
    if (!room) {
      if (loadingText) {
        loadingText.textContent =
          "Không tìm thấy thông tin phòng " + roomId + " trong hệ thống.";
      }
      return;
    }
    renderRoomDetail(room);
    if (SERVICES.length) renderFeeCard();
  } catch (err) {
    console.error(err);
    if (loadingText) {
      loadingText.textContent =
        "Có lỗi khi tải thông tin phòng. Vui lòng thử lại sau.";
    }
  }
}

async function loadServicesFromServer() {
  try {
    const res = await fetch(API_URL + "?action=services");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    SERVICES = (data && data.services) || [];
    if (CURRENT_ROOM) renderFeeCard();
  } catch (err) {
    console.error("loadServicesFromServer error:", err);
    renderFeeCard();
  }
}

// Submit form trong trang room
async function handleRoomContactSubmit(event) {
  event.preventDefault();
  const formStatus = document.getElementById("formStatus");
  if (!formStatus) return;
  formStatus.textContent = "Đang gửi...";

  const roomId = getQueryParam("room") || "";
  const name   = document.getElementById("name").value.trim();
  const phone  = document.getElementById("phone").value.trim();
  const message= document.getElementById("message").value.trim();

  try {
    const body = new URLSearchParams({
      action : "contact",
      name,
      phone,
      roomType: roomId ? "Quan tâm phòng " + roomId : "",
      message
    });

    const res = await fetch(API_URL, {
      method :"POST",
      headers: { "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });

    const data = await res.json();
    formStatus.textContent =
      (data && data.message) || "Gửi thành công. Cảm ơn bạn đã liên hệ YT Home.";
    document.getElementById("contactForm").reset();
  } catch (err) {
    console.error(err);
    formStatus.textContent =
      "Có lỗi khi gửi thông tin. Vui lòng thử lại sau.";
  }
}

// =====================
// VIDEO MODAL (index)
// =====================

function openVideoModal(encodedUrl) {
  const url = decodeURIComponent(encodedUrl || "");
  const modal     = document.getElementById("videoModal");
  const container = document.getElementById("videoContainer");
  if (!modal || !container) return;

  if (!url) {
    alert("Chưa có video cho phòng này.");
    return;
  }
  container.innerHTML = buildVideoEmbed(url);
  modal.classList.add("show");
}

function closeVideoModal() {
  const modal     = document.getElementById("videoModal");
  const container = document.getElementById("videoContainer");
  if (!modal || !container) return;

  container.innerHTML = "";
  modal.classList.remove("show");
}

// =====================
// INIT THEO TRANG
// =====================

function initIndexPageIfNeeded() {
  const roomsGrid = document.getElementById("roomsGrid");
  if (!roomsGrid) return;

  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  initFilters();
  loadRoomsFromServer();
  loadContactInfo();

  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", handleIndexContactSubmit);
  }
}

function initRoomPageIfNeeded() {
  const detailLayout = document.getElementById("detailLayout");
  if (!detailLayout) return;

  loadRoomDetailFromServer();
  loadServicesFromServer();
  loadContactInfo();

  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", handleRoomContactSubmit);
  }
}

// =====================
// DOMContentLoaded
// =====================

document.addEventListener("DOMContentLoaded", () => {
  loadLikesFromStorage();
  loadRatingsFromStorage();

  initIndexPageIfNeeded();
  initRoomPageIfNeeded();
});

