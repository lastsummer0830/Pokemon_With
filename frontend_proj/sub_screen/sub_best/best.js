// 상품 데이터
// var products = [
//     { id : 0, price : 90000, title : '수납가구/수납장', content: '[29CM 단독] (uni)수납장', type: '수납가구/수납장', img: 'https://static.hyundailivart.co.kr/upload_mall/spec/SLC0063912_ImgPath.jpg?20250404150935'},
//     { id : 1, price : 50000, title : '인테리어/오브제', content: '[29CM 단독] (uni)오브제', type: '인테리어/오브제', img: 'https://godomall-storage.cdn-nhncommerce.com/40dd2938f55f17e7bb3e7edf96823ea1/goods/1000000317/image/detail/register_detail_013.jpg'},
//     { id : 2, price : 60000, title : '침실가구/침대', content: '[29CM 단독] (uni)침대', type: '침실가구/침대', img: 'https://item.elandrs.com/upload/prd/orgimg/781/1811146781_0000002.jpg?w=750&h=&q=100'},
//     { id : 3, price : 20000, title : '거실가구/테이블', content: '[29CM 단독] (uni)테이블', type: '거실가구/테이블', img: 'https://monkeywood.co.kr/web/product/big/202410/5b8aec979bd0a69b9d55e9570ec99f33.jpg'},
//     { id : 4, price : 70000, title : '수납가구/서랍장', content: '[29CM 단독] (uni)서랍장', type: '수납가구/서랍장', img: 'https://www.costco.co.kr/medias/sys_master/images/hd6/h8b/157010057527326.jpg'},
//     { id : 5, price : 100000, title : '인테리어/커튼', content: '[29CM 단독] (uni)커튼', type: '인테리어/커튼', img: 'https://www.costco.co.kr/medias/sys_master/images/h43/h97/344316658122782.jpg'},
//     { id : 6, price : 40000, title : '침실가구/침구', content: '[29CM 단독] (uni)침구', type: '침실가구/침구', img: 'https://mmshop.co.kr/web/product/big/202303/c1a8a5bc5f75d3c45a0fbe590d82757f.jpg'},
//     { id : 7, price : 60000, title : '거실가구/의자', content: '[29CM 단독] (uni)의자', type: '거실가구/의자', img: 'https://www.costco.co.kr/medias/sys_master/images/h02/hfb/228668837494814.jpg'},
//     { id : 8, price : 70000, title : '수납가구/오피스용품', content: '[29CM 단독] (uni)오피스용품', type: '수납가구/오피스용품', img: 'https://m.cnclib.com/web/product/medium/202304/a7c30ffe5296601cbaedc245b8b245da.jpg'},
//     { id : 9, price : 50000, title : '인테리어/러그', content: '[29CM 단독] (uni)러그', type: '인테리어/러그', img: 'https://immhome.co.kr/upfiles/product/3517309384.jpg'},
//     { id : 10, price : 40000, title : '침실가구/매트리스', content: '[29CM 단독] (uni)매트리스', type: '침실가구/매트리스', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpUKaeWEjjyujq25G2ZZQ836oqXL-NhrJesQ&s'},
//     { id : 11, price : 60000, title : '거실가구/소파', content: '[29CM 단독] (uni)소파', type: '거실가구/소파', img: 'https://static.hyundailivart.co.kr/upload_mall/goods/P200039535/GM43078955_img.jpg?RS=0X890'},
//     { id : 12, price : 70000, title : '수납가구/수납장', content: '[29CM 단독] (uni)수납장2', type: '수납가구/수납장', img: 'https://item.elandrs.com/r/image/item/2024-03-11/4bca2fe4-8d00-417b-8a67-3c65b97a54d2.jpg?w=750&h=&q=100'},
//     { id : 13, price : 80000, title : '인테리어/오브제', content: '[29CM 단독] (uni)오브제2', type: '인테리어/오브제', img: 'https://m.jinvas.co.kr/web/product/big/202601/a6c58881e6e7dd5c3b9b538365d7f3ab.jpg'},
//     { id : 14, price : 60000, title : '침실가구/침대', content: '[29CM 단독] (uni)침대2', type: '침실가구/침대', img: 'https://static.hyundailivart.co.kr/upload_mall/goods/P200083043/GM41734761_img.jpg?RS=0X890'},
//     { id : 15, price : 20000, title : '거실가구/테이블', content: '[29CM 단독] (uni)테이블2', type: '거실가구/테이블', img: 'https://m.dreamgagu.kr/web/product/big/202309/ce7291dfd8824d9249f7235bcc5191c6.jpg'}
// ]

import { products } from "../js/products.js";

// products의 속성인 type을 mainType과 subType으로 구분해서 저장한 객체
const mainType = [
    { mainType: '수납가구', subType1: '수납장', subType2: '서랍장', subType3: '오피스용품'},
    { mainType: '인테리어', subType1: '오브제', subType2: '커튼', subType3: '러그'},
    { mainType: '침실가구', subType1: '침대', subType2: '침구', subType3: '매트리스'},
    { mainType: '거실가구', subType1: '테이블', subType2: '의자', subType3: '소파'},
]


// products의 type을 mainType과 subType을 분리해서 저장하는 함수
function productTypeFilter(){
    for(let i=0; i<products.length; i++){
        let [mainType, subType] = products[i].type.split("/");
        products[i].mainType = mainType;
        products[i].subType = subType;
        console.log(mainType);
        console.log(subType);
    }
    console.log(products);
}

//이제 products는 mainType과 subType도 가짐
productTypeFilter(products);
console.log(products);



// 상품 생성
products.forEach(item => {
    let template = `
    <div class="card">
        <a class="card_link" href="../html/detailPage1.html?id=${item.id}">
            <img src=${item.img[0]}>
            <div class="card-body">
                <h5 class="title">${item.title}</h5>
                <p>${item.content}</p>
                <b class="price">${item.price}</b><br>
                <div class="benefit">조건부 무료배송</div><div class="benefit">쿠폰</div>
            </div>
        </a>
    </div>
    `
    $('#items').append(template);
});


// 상품 생성 함수 
function layout(items){
    items.forEach(item => {
        let template = `
        <div class="card">
            <a class="card_link" href="../html/detailPage1.html?id=${item.id}">
                <img src=${item.img[0]}>
                <div class="card-body">
                    <h5 class="title">${item.title}</h5>
                    <p>${item.content}</p>
                    <b class="price">${item.price}</b><br>
                    <div class="benefit">조건부 무료배송</div><div class="benefit">쿠폰</div>
                </div>
            </a>
        </div>
        `
        $('#items').append(template);
    });
}


// abc정렬
$('#sortAbc').click(function(){
    // 배열.slice(): 배열 복사해서 새 배열 만듬
    let productsAbc = products.slice();

    productsAbc.sort(function(item1, item2){
        // return이 음수면 item1이 왼쪽, item2가 오른쪽
        if (item1.title < item2.title) return -1;
        // return이 0이면 정렬 x
        else if (item1.title == item2.title) return 0;
        // return이 양수면 item1이 오른쪽, item2가 왼쪽
        else return 1;
    });

    // 상품 전시 컨테이너 비우기
    $('#items').html('');

    // 상품 생성
    layout(productsAbc);

})


// 가격순 정렬
$('#sortPrice').click(function(){
    let productsPrice = products.slice();
    productsPrice.sort(function(item1, item2){
        return item1.price - item2.price;
    });

    $('#items').html('');

    layout(productsPrice);
    // $('.price').css('background','#FFFF9A');
})


// 일정 가격만 출력
$('#filterPrice').click(function(){
let productsFilter = products.filter(function(item){
    return item.price <= 60000;
    });

    $('#items').html('');

    layout(productsFilter);
    // $('.price').css('background','#FFFF9A');
})


// 수납가구만 출력
$('#수납가구').click(function(){
let productsFilter = products.filter(function(item){
        return item.mainType == "수납가구";
    });

    $('#items').html('');

    layout(productsFilter);
    // $('.price').css('background','#FFFF9A');
})


// 인테리어 소품만 출력
$('#인테리어').click(function(){
let productsFilter = products.filter(function(item){
        return item.mainType == "인테리어";
    });

    $('#items').html('');

    layout(productsFilter);
    // $('.price').css('background','#FFFF9A');
})


// 침실 가구만 출력
$('#침실가구').click(function(){
let productsFilter = products.filter(function(item){
        return item.mainType == "침실가구";
    });

    $('#items').html('');

    layout(productsFilter);
    // $('.price').css('background','#FFFF9A');
})


// 거실 가구만 출력
$('#거실가구').click(function(){
let productsFilter = products.filter(function(item){
        return item.mainType == "거실가구";
    });

    $('#items').html('');

    layout(productsFilter);
    // $('.price').css('background','#FFFF9A');
})


// 전체 버튼
$('#revert').click(function(){

    $('#items').html('');
    
    layout(products);
})