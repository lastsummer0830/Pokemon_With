// section4 애니메이션 효과
const targets = document.querySelectorAll(".reveal-left, .reveal-right");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-show", entry.isIntersecting);
    });
  },
  { threshold: 0.25 }
);

targets.forEach((el) => observer.observe(el));

// header 투명 및 흰색 추가 js 코드
document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".header");
  const hero = document.querySelector(".hero");

  const thresholdBg = hero ? hero.offsetHeight * 0.25 : 80; // 배경 바뀌는 기준
  const thresholdCompact = 80; // 레이아웃 바뀌는 기준(원하는 값으로)

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > thresholdBg);
    header.classList.toggle("is_compact", window.scrollY > 80);
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
});
