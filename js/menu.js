document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.querySelector(".hamburger");
  const mainNav = document.querySelector(".main-nav");

  if (hamburger && mainNav) {
    hamburger.addEventListener("click", () => {
      mainNav.classList.toggle("active");
    });
  }
});
