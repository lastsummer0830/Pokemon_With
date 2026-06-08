document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".animate-item");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        } else {
          entry.target.classList.remove("show");
        }
      });
    },
    { threshold: 0.2 },
  );

  items.forEach((item) => observer.observe(item));

 
  const header = document.querySelector(".header");

 
  const scrollContainer = document.querySelector(".scroll-container");

 
  if (scrollContainer && header) {
   
    scrollContainer.addEventListener("scroll", () => {
     
      if (scrollContainer.scrollTop > 50) {
       
        header.classList.add("is_compact");
      }
      
      else {
      
        header.classList.remove("is_compact");
      }
    });
  }
});
