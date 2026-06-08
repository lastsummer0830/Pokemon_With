let pick = document.querySelector(".pick");
let moved = false;

window.addEventListener("scroll", function(){
    let value = this.window.scrollY;
    console.log("scrollY", value); //🌸콘솔창 확인

    if(value > 750){
        pick.style.animation = 'unPick 1s ease-out forwards';
    } else {
        pick.style.animation = 'pick 1s ease-out';
        //🌸forwards 상태 유지 0.5s 딜레이
    }
})