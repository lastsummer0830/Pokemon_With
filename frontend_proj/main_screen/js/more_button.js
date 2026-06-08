const moreBtn = document.getElementById("more");
const container = document.getElementById("container");
let cnt = 0;
let moreDisplay = ["2000px", "3000px", "4000px", "5000px"];

moreBtn.addEventListener("click", function () {
    container.style.height = moreDisplay[cnt];
    cnt++;
});