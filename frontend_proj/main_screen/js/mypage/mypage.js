(() => {
  const raw = sessionStorage.getItem("loginUser");

  // 로그인 안 했으면 로그인 페이지로
  if (!raw) {
    alert("로그인이 필요합니다.");
    location.href = "./login.html";
    return;
  }

  let user;
  try {
    user = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem("loginUser");
    location.href = "./login.html";
    return;
  }

  // 화면에 출력
  const idEl = document.getElementById("mpUserId");
  const emailEl = document.getElementById("mpEmail");

  if (idEl) idEl.textContent = user.id ?? "-";
  if (emailEl) emailEl.textContent = user.email ?? "-";

  // 로그아웃
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("loginUser");
    alert("로그아웃 되었습니다.");

    if (history.length > 1) history.back();
    else location.href = "../../index.html";
  });
})();
