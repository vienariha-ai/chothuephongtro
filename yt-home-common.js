// ==== CẤU HÌNH API DÙNG CHUNG ====
const API_URL =
  "https://script.google.com/macros/s/AKfycbwyqskjnUjwkn95TqRmcFjLem2eSMfKBuh23PHDD0QcL0gCwEnqNLYxd6vmi7xqDzUoow/exec";

// Thông tin liên hệ (sẽ được cập nhật từ Apps Script)
let CONTACT_INFO = { zalo: "", email: "", messenger: "" };

// ==== RATING LOCALSTORAGE DÙNG CHUNG ====
const RATING_STORAGE_KEY = "ytHomeRoomRatings";
let ROOM_RATINGS = {};

function loadRatingsFromStorage() {
  try {
    const raw = localStorage.getItem(RATING_STORAGE_KEY);
    ROOM_RATINGS = raw ? JSON.parse(raw) : {};
  } catch (e) {
    ROOM_RATINGS = {};
  }
}

function saveRatingsToStorage() {
  try {
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(ROOM_RATINGS));
  } catch (e) {
    console.error("saveRatingsToStorage error:", e);
  }
}

function getRoomRating(roomId) {
  if (!roomId) return 0;
  const data = ROOM_RATINGS[roomId] || { rating: 0 };
  return data.rating || 0;
}

// ==== HÀM TIỆN ÍCH DÙNG CHUNG ====
function formatVND(amount) {
  if (amount === null || amount === undefined || amount === "") return "--";
  const num = Number(String(amount).replace(/[^\d.-]/g, ""));
  if (isNaN(num)) return String(amount);
  return num.toLocaleString("vi-VN") + " đ";
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
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

    if (!videoId) {
      return `<iframe src="${u}" allowfullscreen></iframe>`;
    }
    const embedUrl = "https://www.youtube.com/embed/" + videoId;
    return `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
  }

  return `
    <video controls playsinline>
      <source src="${u}">
      Trình duyệt không hỗ trợ phát video.
    </video>`;
}

// ==== LOAD CONTACT INFO DÙNG CHUNG ====
async function loadContactInfo() {
  try {
    const res = await fetch(API_URL + "?action=contactInfo");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    CONTACT_INFO = (data && data.contact) || CONTACT_INFO;

    // Các phần tử có thể xuất hiện ở index.html
    const phoneSpan = document.getElementById("contactPhoneText");
    const emailSpan = document.getElementById("contactEmailText");

    if (emailSpan && CONTACT_INFO.email) {
      emailSpan.textContent = CONTACT_INFO.email;
    }
    if (phoneSpan && CONTACT_INFO.zalo) {
      phoneSpan.textContent = CONTACT_INFO.zalo;
    }

    // Các nút liên hệ nhanh (có ở cả index và room)
    const zaloLink = document.getElementById("zaloQuickLink");
    const mailLink = document.getElementById("emailQuickLink");
    const msgLink  = document.getElementById("messengerQuickLink");

    if (zaloLink && CONTACT_INFO.zalo) {
      zaloLink.href = CONTACT_INFO.zalo;
    }
    if (mailLink && CONTACT_INFO.email) {
      const subject =
        document.title.includes("Chi tiết phòng")
          ? "Đặt lịch xem phòng tại YT Home"
          : "YT Home - Tư vấn thuê phòng";
      mailLink.href = `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}`;
    }
    if (msgLink && CONTACT_INFO.messenger) {
      msgLink.href = CONTACT_INFO.messenger;
    }
  } catch (err) {
    console.error("loadContactInfo error:", err);
  }
}
