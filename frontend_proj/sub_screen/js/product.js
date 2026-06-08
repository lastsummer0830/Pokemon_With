

let currentIndex = 0;


window.onload = function() {
  const descContent = document.getElementById('productContent');
  const descId = document.getElementById('productId');
  
 
  if (descContent) {
    descContent.innerText = productData.content; 
  }
  if (descId) {
    descId.innerText = productData.id; 
  }


  const thumbnailImgs = document.querySelectorAll('.detailimg img');
  const mainImgs = document.querySelectorAll('#sliderTrack img');

 
  productData.img.forEach((imagePath, index) => {
    if (thumbnailImgs[index]) {
      thumbnailImgs[index].src = imagePath; 
    }
    if (mainImgs[index]) {
      mainImgs[index].src = imagePath; 
    }
  });
};


function changeImage(index) {
  currentIndex = index;
  const sliderTrack = document.getElementById('sliderTrack');
  if (sliderTrack) {
    sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
  }
  const detailImgs = document.querySelectorAll('.detailimg'); 
  detailImgs.forEach((img, i) => {
    if (i === currentIndex) {
      img.classList.add('active'); 
    } else {
      img.classList.remove('active'); 
    }
  });
}


function moveSlide(direction) {
  currentIndex += direction;
  const totalImages = productData.img.length;
  if (currentIndex < 0) {
    currentIndex = totalImages - 1; 
  } else if (currentIndex >= totalImages) {
    currentIndex = 0; 
  }
  changeImage(currentIndex); 
}