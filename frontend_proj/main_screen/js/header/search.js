// 검색버튼(일반), 검색 오버레이, 검색 닫기, 검색 영역
const openBtn = document.querySelector("[data-open-search]");
const overlay = document.querySelector("[data-search-overlay]");
const closeBtn = document.querySelector("[data-close-search]");
const input = overlay.querySelector(".search_input");
// 검색 오버레이 열기
function openSearch() {
  overlay.classList.add("is_open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is_search_open");
  setTimeout(() => input.focus(), 0);
}
// 검색 오버레이 닫기
function closeSearch() {
  overlay.classList.remove("is_open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is_search_open");
}
// 클릭되면 동작
openBtn?.addEventListener("click", openSearch);
closeBtn?.addEventListener("click", closeSearch);

// 영역 외 클릭하면 닫기
overlay.addEventListener("click", (e) => {
  // 패널 바깥 클릭만
  if (e.target === overlay) closeSearch();
});

// ESC로 닫기
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("is_open")) {
    closeSearch();
  }
});
