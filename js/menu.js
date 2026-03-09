document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.querySelector(".hamburger");
  const mainNav = document.querySelector(".main-nav");
  const overlay = document.querySelector(".menu-overlay");

  if (hamburger && mainNav && overlay) {
    function closeMenu() {
      hamburger.classList.remove("active");
      mainNav.classList.remove("active");
      overlay.classList.remove("active");
      document.body.classList.remove("menu-open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "メニューを開く");
    }

    hamburger.addEventListener("click", () => {
      const isActive = hamburger.classList.toggle("active");
      mainNav.classList.toggle("active");
      overlay.classList.toggle("active");
      document.body.classList.toggle("menu-open");

      hamburger.setAttribute("aria-expanded", isActive ? "true" : "false");
      hamburger.setAttribute("aria-label", isActive ? "メニューを閉じる" : "メニューを開く");
    });

    overlay.addEventListener("click", closeMenu);

    document.querySelectorAll(".main-nav a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 864) closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }
});
