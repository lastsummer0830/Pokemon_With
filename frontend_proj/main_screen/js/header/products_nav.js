// sub_screen/js/products.js에서 상품목록 가져오기
import { products } from "../../../sub_screen/js/products.js";

(() => {
  // nav_bottom 안의 category ul 선택
  const menuBottom = document.querySelector(".nav_bottom .menu_bottom");
  if (!menuBottom) return;

  // type을 "대분류/소분류"로 분리
  // 예) "수납가구/수납장" -> { main: "수납가구", sub: "수납장" }
  const splitType = (type = "") => {
    const [main, sub] = String(type)
      .split("/")
      .map((v) => v?.trim());
    return {
      main: main || "기타",
      sub: sub || "기타",
    };
  };

  // 드롭다운에서 보여줄 상품 텍스트(우선순위: title -> content -> 상품id)
  const pickItemText = (p) => p.title || p.content || `상품 ${p.id}`;

  // products를 "대분류 -> 소분류 -> 상품들" 구조로 그룹핑
  // 구조 예시:
  // {
  //   "수납가구": Map( "수납장" -> [..], "서랍장" -> [..] ),
  //   "거실가구": Map( "소파" -> [..], "테이블" -> [..] )
  // }
  const mainMap = new Map();

  for (const p of products) {
    const { main, sub } = splitType(p.type);

    if (!mainMap.has(main)) mainMap.set(main, new Map());
    const subMap = mainMap.get(main);

    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub).push(p);
  }

  // BEST li만 남기고 나머지 카테고리 메뉴는 전부 재생성
  const bestLi = menuBottom.querySelector("li:first-child");
  menuBottom.innerHTML = "";
  if (bestLi) menuBottom.appendChild(bestLi);

  // 대분류별로 li.has_drop + dropdown(.drop) 구조를 동적으로 생성
  for (const [main, subMap] of mainMap.entries()) {
    const li = document.createElement("li");
    li.className = "has_drop";

    // 상단 메뉴명: 대분류(main)
    const a = document.createElement("a");
    a.className = "nav_link small";
    a.href = "#"; // 나중에 type.html 연결할 때 JS로 이동 처리
    a.textContent = main;
    a.dataset.category = main; // type.html?category=... 만들 때 쓸 값

    // hover 시 나오는 드롭다운 패널(.drop)
    const drop = document.createElement("div");
    drop.className = "drop";

    //  드롭다운 내부 컨테이너 (.drop_inner)
    const inner = document.createElement("div");
    inner.className = "drop_inner";

    //  소분류별 컬럼 생성
    for (const [sub, items] of subMap.entries()) {
      //  하나의 컬럼(예: "수납장" 컬럼 / "서랍장" 컬럼)
      const col = document.createElement("div");
      col.className = "drop_col";

      //  컬럼 제목: 소분류(sub)
      const pTitle = document.createElement("p");
      pTitle.className = "drop_title";
      pTitle.textContent = sub;
      pTitle.dataset.category = main; //  나중에 type.html 이동용
      pTitle.dataset.sub = sub; //  소분류 필터링용

      col.appendChild(pTitle);

      //  소분류 안의 상품 링크들(추후 상세페이지 연결)
      for (const it of items) {
        const link = document.createElement("a");
        link.href = "#"; //  나중에 detailPage1.html 연결할 때 JS로 이동 처리
        link.dataset.id = it.id; //  detailPage1.html?id=...
        link.dataset.category = main; //  필요하면 같이 넘길 수 있음
        link.dataset.sub = sub;
        link.textContent = pickItemText(it);

        col.appendChild(link);
      }

      //  만들어진 컬럼을 inner에 추가
      inner.appendChild(col);
    }

    //  최종 삽입
    drop.appendChild(inner);
    li.appendChild(a);
    li.appendChild(drop);
    menuBottom.appendChild(li);
  }
})();
