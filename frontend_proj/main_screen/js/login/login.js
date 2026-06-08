(() => {
  // 이미 로그인 되어 있으면 로그인 페이지 접근 막기
  const already = sessionStorage.getItem("loginUser");
  if (already) {
    alert("이미 로그인 했습니다.");

    if (history.length > 1) {
      history.back(); // 이전 화면으로
    } else {
      location.href = "../index.html";
    }
    return; // 아래 코드 실행 막기
  }

  const form = document.getElementById("loginForm");
  if (!form) return;

  //   id, pw, email 가져오기
  const userId = document.getElementById("userId");
  const userPw = document.getElementById("userPw");
  const userEmail = document.getElementById("userEmail");
  //   에러메시지, 숨기기/보이기 버튼
  const errorEl = document.getElementById("loginError");
  const toggleBtn = document.querySelector("[data-toggle-password]");

  // 에러메시지
  const setError = (msg, target) => {
    if (errorEl) errorEl.textContent = msg;
    if (target && typeof target.focus === "function") target.focus();
  };

  //   에러 지워지면 빈 텍스트를 넣어서 가리기
  const clearError = () => {
    if (errorEl) errorEl.textContent = "";
  };

  // 이메일 검사
  const isValidEmail = (email) => {
    // @, .com 지켰는지
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // 비밀번호 숨기기 보이기
  if (toggleBtn && userPw) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = userPw.type === "password";
      userPw.type = isHidden ? "text" : "password";
      toggleBtn.setAttribute("aria-pressed", String(isHidden));
    });
  }

  // 입력 시 에러 지우기
  [userId, userPw, userEmail].forEach((el) => {
    el?.addEventListener("input", clearError);
  });

  // submit 하고 파악
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();

    // 공백제거
    const idVal = userId.value.trim();
    const pwVal = userPw.value.trim();
    const emailVal = userEmail.value.trim();

    if (!idVal) return setError("ID를 입력해 주세요.", userId);
    if (!pwVal) return setError("PASSWORD를 입력해 주세요.", userPw);
    if (!emailVal) return setError("EMAIL을 입력해 주세요.", userEmail);
    if (!isValidEmail(emailVal))
      return setError("EMAIL 형식이 올바르지 않습니다.", userEmail);

    // 로그인 성공 처리(세션 저장)
    const loginUser = {
      id: idVal,
      email: emailVal,
      loginAt: Date.now(),
    };

    // 로그인 정보 저장(비번 저장 X)
    const payload = { id: idVal, email: emailVal };
    sessionStorage.setItem("loginUser", JSON.stringify(payload));

    // 이전 화면으로(없으면 메인)
    if (history.length > 1) history.back();
    else location.href = "../index.html";
  });
})();
