// 헤더 가져오기
const header = document.querySelector(".header");

function syncBodyPaddingTop() {
  document.body.style.paddingTop = header.offsetHeight + "px";
}

function onScroll() {
    // 스크롤 기준(이때부터 변경)
  header.classList.toggle("is_compact", window.scrollY > 80);
  syncBodyPaddingTop();
}

window.addEventListener("load", () => {
  syncBodyPaddingTop();
  onScroll();
});
window.addEventListener("resize", syncBodyPaddingTop);
window.addEventListener("scroll", onScroll, { passive: true });
