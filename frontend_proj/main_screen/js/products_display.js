import { products } from "../../sub_screen/js/products.js";

console.log(products);

const productPicture = document.getElementsByClassName("product_picture");
const productExplain = document.getElementsByClassName("product_explain");
const productList1 = document.getElementsByClassName("product_list1");
const productList2 = document.getElementsByClassName("product_list2");

const REPO = "acon_front_project";
const BASE = `/${REPO}/sub_screen/`; // "/acon_front_project/sub_screen/"
const getFileName = (p) => p.split("/").pop();

//  상품묶음(메인상품, 하위1 상품, 하위2 상품) 8개 생성
for (let i = 0; i < 8; i++) {
  //   let [a, b, imgLink] = products[i].img[0].split("/");
  //   console.log(imgLink);
  const imgLink = getFileName(products[i].img[0]);
  const detailHref = `${BASE}html/detailPage1.html?id=${products[i].id}`;
  const imgSrc = `${BASE}images/${imgLink}`;

  // 메인상품 이미지 출력
  //   productPicture[i].innerHTML = `
  //     <a href="../../sub_screen/html/detailPage1.html?id=${products[i].id}">
  //         <img
  //         src="../../sub_screen/images/${imgLink}"
  //         alt=""
  //         />
  //     </a>
  //     `;
  productPicture[i].innerHTML = `
    <a href="${detailHref}">
      <img src="${imgSrc}" alt="" />
    </a>
  `;

  // 메인상품 title 및 content 출력
  //   productExplain[i].innerHTML = `
  //     <a href="../../sub_screen/html/detailPage1.html?id=${products[i].id}">
  //         <h2>${products[i].title}</h2>
  //         <p>
  //         ${products[i].content}
  //         </p>
  //     </a>
  //     `;
  productExplain[i].innerHTML = `
    <a href="${detailHref}">
      <h2>${products[i].title}</h2>
      <p>${products[i].content}</p>
    </a>
  `;

  // 하위 상품1 출력
  //   productList1[i].innerHTML = `
  //     <a href="../../sub_screen/html/detailPage1.html?id=${products[i].id}" class="product_list_wrap">
  //         <img
  //             src="../../sub_screen/images/${imgLink}"
  //             alt=""
  //         />
  //         <div class="product_list_explain">
  //             <h4>${products[i].title}</h4>
  //             <p>${products[i].content}</p>
  //             <p class="price">${products[i].price}</p>
  //             <p class="info_box">조건부 무료배송</p>
  //         </div>
  //         </a>
  //         <!-- 로그인 팝업 -->
  //         <div class="wrap">
  //         <a href="#pop_info_1">
  //             <i class="btn_open fa-regular fa-heart"></i>
  //         </a>
  //         <div id="pop_info_1" class="pop_wrap">
  //             <div class="pop_inner">
  //             <p class="dsc">로그인이 필요해요.</p>
  //             <button type="button" class="btn_close">취소</button>
  //             <a href="#">로그인 하기</a>
  //             </div>
  //         </div>
  //     </div>
  //     `;
  productList1[i].innerHTML = `
    <a href="${detailHref}" class="product_list_wrap">
      <img src="${imgSrc}" alt="" />
      <div class="product_list_explain">
        <h4>${products[i].title}</h4>
        <p>${products[i].content}</p>
        <p class="price">${products[i].price}</p>
        <p class="info_box">조건부 무료배송</p>
      </div>
    </a>
    <!-- 로그인 팝업 -->
    <div class="wrap">
      <a href="#pop_info_1">
        <i class="btn_open fa-regular fa-heart"></i>
      </a>
      <div id="pop_info_1" class="pop_wrap">
        <div class="pop_inner">
          <p class="dsc">로그인이 필요해요.</p>
          <button type="button" class="btn_close">취소</button>
          <a href="#">로그인 하기</a>
        </div>
      </div>
    </div>
  `;

  // 하위 상품2 출력
  //   productList2[i].innerHTML = `
  //     <a href="../../sub_screen/html/detailPage1.html?id=${products[i].id}" class="product_list_wrap">
  //         <img
  //             src="../../sub_screen/images/${imgLink}"
  //             alt=""
  //         />
  //         <div class="product_list_explain">
  //             <h4>${products[i].title}</h4>
  //             <p>${products[i].content}</p>
  //             <p class="price">${products[i].price}</p>
  //             <p class="info_box">조건부 무료배송</p>
  //         </div>
  //         </a>
  //         <!-- 로그인 팝업 -->
  //         <div class="wrap">
  //         <a href="#pop_info_1">
  //             <i class="btn_open fa-regular fa-heart"></i>
  //         </a>
  //         <div id="pop_info_1" class="pop_wrap">
  //             <div class="pop_inner">
  //             <p class="dsc">로그인이 필요해요.</p>
  //             <button type="button" class="btn_close">취소</button>
  //             <a href="#">로그인 하기</a>
  //             </div>
  //         </div>
  //     </div>
  //     `;
  productList2[i].innerHTML = `
    <a href="${detailHref}" class="product_list_wrap">
      <img src="${imgSrc}" alt="" />
      <div class="product_list_explain">
        <h4>${products[i].title}</h4>
        <p>${products[i].content}</p>
        <p class="price">${products[i].price}</p>
        <p class="info_box">조건부 무료배송</p>
      </div>
    </a>
    <!-- 로그인 팝업 -->
    <div class="wrap">
      <a href="#pop_info_1">
        <i class="btn_open fa-regular fa-heart"></i>
      </a>
      <div id="pop_info_1" class="pop_wrap">
        <div class="pop_inner">
          <p class="dsc">로그인이 필요해요.</p>
          <button type="button" class="btn_close">취소</button>
          <a href="#">로그인 하기</a>
        </div>
      </div>
    </div>
  `;
}
