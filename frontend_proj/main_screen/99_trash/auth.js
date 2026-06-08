(() => {
  // 유저정보 불러오기
  const getUser = () => {
    // 로그인한 유저
    const raw = sessionStorage.getItem("loginUser");
    // 비어있으면 로그인x
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("loginUser");
      return null;
    }
  };
  
  const REPO = "acon_front_project";
  const goLogin = () =>
    (location.href = `/${REPO}/main_screen/html/login.html`);
  const goMypage = () =>
    (location.href = `/${REPO}/main_screen/html/mypage.html`);
  // const goLogin = () => {
  //   location.href = "../../main_screen/html/login.html";
  // };

  // const goMypage = () => {
  //   location.href = "../../main_screen/html/mypage.html";
  // };

  // 버튼 찾기
  const mypageLink = document.querySelector("[data-auth-mypage]");
  const loginLink = document.querySelector("[data-auth-login]");

  // MY PAGE 클릭: 로그인 안 했으면 로그인 페이지로
  mypageLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const user = getUser();
    if (!user) {
      alert("로그인이 필요합니다.");
      goLogin();
      return;
    }
    goMypage();
  });

  // LOGIN 클릭:
  // - 로그인 되어 있으면 "이미 로그인 했습니다" + 뒤로가기
  // - 아니면 로그인 페이지로
  loginLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const user = getUser();
    if (user) {
      alert("이미 로그인 했습니다.");
      if (history.length > 1) history.back();
      else location.href = "../../index.html";
      return;
    }
    goLogin();
  });

  // 로그인 상태면 LOGIN 텍스트를 LOGOUT으로 바꾸고, 클릭 시 로그아웃 처리
  // >> 로그아웃 시 마이페이지에 못 머무르게 함
  const user = getUser();
  if (user && loginLink) {
    const text = loginLink.querySelector(".icon_text");
    if (text) text.textContent = "LOGOUT";

    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("loginUser");
      alert("로그아웃 되었습니다.");
      location.href = "../../index.html";
    });
  }
})();
