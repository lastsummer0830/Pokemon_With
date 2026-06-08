// js/detailPage1.js
import { products } from "./products.js";

/* ✅ 0) URL에서 id 읽기 (없으면 0) */
const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id") ?? 0);

/* ✅ 1) 상품 찾기 (하드코딩 X) */
const product = products.find((p) => p.id === id);

/* ✅ 2) product 없으면 중단 */
if (!product) {
  console.error("상품을 찾지 못했습니다. id 확인:", id);
} else {
  /* 1) 상품 데이터 바인딩 (section1) */
  document.querySelector(".section1__title").textContent = product.title;
  document.querySelector(".section1__price").textContent = `₩${product.price.toLocaleString()}`;
  document.querySelector(".section1__badge").textContent = product.type;
  document.querySelector(".section1__meta").textContent = product.content;

  document.querySelector(".section1__discount").textContent = product.discountText;
  document.querySelectorAll(".section1__sub")[0].textContent =
    `정가: ₩${product.originalPrice.toLocaleString()}`;
  document.querySelectorAll(".section1__sub")[1].textContent = product.period;

  /* ✅ 이미지 주입 */
  const thumbImgs = document.querySelectorAll(".galleryimg-list .detailimg img");
  const mainImgs = document.querySelectorAll("#sliderTrack img");

  product.img.forEach((src, i) => {
    if (thumbImgs[i]) thumbImgs[i].src = src;
    if (mainImgs[i]) mainImgs[i].src = src;
  });

  thumbImgs.forEach((img, i) => (img.alt = `${product.title} 썸네일 ${i + 1}`));
  mainImgs.forEach((img, i) => (img.alt = `${product.title} 메인 ${i + 1}`));

  // ----------------------------------------------------------------------
  // 💡 사진 안 넘어가서 추가로 수정함
  // ----------------------------------------------------------------------
  const prevBtn = document.querySelector(".prev"); // '<' 왼쪽 화살표 버튼
  const nextBtn = document.querySelector(".next"); // '>' 오른쪽 화살표 버튼
  const sliderTrack = document.getElementById("sliderTrack"); // 메인 사진 트랙
  const detailBtns = document.querySelectorAll(".detailimg"); // 왼쪽 썸네일 버튼들

  let currentIndex = 0; // 현재 보고 있는 사진의 순서 (0부터 시작)

  // 사진을 좌우로 스무스하게 넘겨주는 작동 함수
  function moveSlide(index) {
    // 사진이 끝을 넘어가면 다시 처음으로, 처음에서 이전으로 가면 마지막으로 순환
    if (index >= detailBtns.length) {
      currentIndex = 0;
    } else if (index < 0) {
      currentIndex = detailBtns.length - 1;
    } else {
      currentIndex = index;
    }

    
    if (sliderTrack) {
      sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    // 현재 보고 있는 사진 썸네일에 검은 테두리(active) 켜고 끄기
    detailBtns.forEach((btn, i) => {
      if (i === currentIndex) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
  // 오른쪽 화살표 버튼(next) 클릭 이벤트
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      moveSlide(currentIndex + 1);
    });
  }
  // 왼쪽 화살표 버튼(prev) 클릭 이벤트
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      moveSlide(currentIndex - 1);
    });
  }
  // 왼쪽 썸네일 사진 직접 클릭 이벤트
  detailBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      moveSlide(index);
    });
  });
// ----------------------------------------------------------------------
  // 💡 사진 안 넘어가서 추가로 수정함 끝
  // ----------------------------------------------------------------------

}

/* ===================== 아래는 그대로 (색상/수량) ===================== */

// ✅ 색상 데이터
const COLORS = [
  { name: "블랙", value: "#000000" },
  { name: "화이트", value: "#ffffff" },
  { name: "레드", value: "#ff0000" },
  { name: "브라움", value: "#6a5500" },
];

let selectedColor = COLORS[1];

// DOM
const openBtn = document.getElementById("openColor");
const modal = document.getElementById("colorModal");
const overlay = document.getElementById("closeColor");
const xBtn = document.getElementById("xColor");

const colorText = document.getElementById("colorText");
const colorSwatch = document.getElementById("colorSwatch");
const colorList = document.getElementById("colorList");

// 선택값 표시
function renderSelectedColor() {
  colorText.textContent = selectedColor.name;
  colorSwatch.style.background = selectedColor.value;
  colorSwatch.style.borderColor = selectedColor.value === "#ffffff" ? "#bbb" : "#ddd";
}

function openModal() {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

openBtn?.addEventListener("click", openModal);
overlay?.addEventListener("click", closeModal);
xBtn?.addEventListener("click", closeModal);

function renderColorOptions() {
  colorList.innerHTML = COLORS.map((c) => {
    const active = c.name === selectedColor.name ? "is-active" : "";
    const border = c.value === "#ffffff" ? "#bbb" : "#ddd";

    return `
      <button class="colorOption ${active}" type="button" data-name="${c.name}">
        <span class="colorOption__swatch" style="background:${c.value}; border-color:${border}"></span>
        <span class="colorOption__name">${c.name}</span>
      </button>
    `;
  }).join("");

  colorList.querySelectorAll(".colorOption").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      selectedColor = COLORS.find((c) => c.name === name);

      renderSelectedColor();
      renderColorOptions();
      closeModal();
    });
  });
}

renderSelectedColor();
renderColorOptions();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
});

// 수량버튼
const minus = document.getElementById("minus");
const plus = document.getElementById("plus");
const qtyNum = document.getElementById("qtyNum");

let qty = 1;

function renderQty() {
  qtyNum.textContent = qty;
  minus.disabled = qty <= 1;
}

minus?.addEventListener("click", () => {
  if (qty > 1) qty--;
  renderQty();
});

plus?.addEventListener("click", () => {
  qty++;
  renderQty();
});

renderQty();