// 열기버튼
var target = document.querySelectorAll('.btn_open');
// 닫기버튼
var btnPopClose = document.querySelectorAll('.pop_wrap .btn_close');

const popWrap = document.querySelector("#pop_info_1");

// 팝업 열기
for(var i = 0; i < target.length; i++){
  target[i].addEventListener('click', function(){
    popWrap.style.display = 'block';
  });
}

// 팝업 닫기
for(var j = 0; j < target.length; j++){
  btnPopClose[j].addEventListener('click', function(){
    popWrap.style.display = 'none';
  });
}