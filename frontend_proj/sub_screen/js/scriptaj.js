
document.addEventListener("DOMContentLoaded", function() {
    

    const hiddenElements = document.querySelectorAll('.hidden-element');

 
    const observer = new IntersectionObserver((entries) => { 
        entries.forEach((entry) => {
            
          
            if (entry.isIntersecting) {
               
                entry.target.classList.add('show-element');
            } 
            
            
            else {
                
                entry.target.classList.remove('show-element');
            }
        });
    }, {
       
        threshold: 0.25 
    });

 
    hiddenElements.forEach((element) => {
        observer.observe(element);
    });

});


