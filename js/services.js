const cards = document.querySelectorAll(".service-card");
const indicators = document.querySelectorAll(".indicator");
const details = document.querySelectorAll(".service-detail");

let currentIndex = 0;
let autoSlideInterval;
const intervalTime = 10000; // 10秒

// 初期表示
details[currentIndex].classList.add("active");
cards[currentIndex].classList.add("active");
indicators[currentIndex].classList.add("active");

function showDetail(index) {
  if (index === currentIndex) return;

  const current = details[currentIndex];
  const next = details[index];

  // 現在を左へ退出
  current.classList.remove("active");
  current.classList.add("exit");

  // 次を準備
  next.classList.add("active");

  // exitクラス削除（アニメ後）
  setTimeout(() => {
    current.classList.remove("exit");
  }, 600); // CSSの transition 0.6s と timeout を合わせる

  // カード
  cards.forEach((c) => c.classList.remove("active"));
  cards[index].classList.add("active");

  // インジケーター
  indicators.forEach((i) => i.classList.remove("active"));
  indicators[index].classList.add("active");

  currentIndex = index;
}

// 自動切替
function startAutoSlide() {
  autoSlideInterval = setInterval(() => {
    let nextIndex = (currentIndex + 1) % cards.length;
    showDetail(nextIndex);
  }, intervalTime);
}

startAutoSlide();

// カードクリックで切替＋タイマーリセット
cards.forEach((c, i) => {
  c.addEventListener("click", () => {
    showDetail(i);
    clearInterval(autoSlideInterval);
    startAutoSlide();
  });
});

// インジケータークリックで切替＋タイマーリセット
indicators.forEach((i, idx) => {
  i.addEventListener("click", () => {
    showDetail(idx);
    clearInterval(autoSlideInterval);
    startAutoSlide();
  });
});

cards.forEach((card, index) => {
  // マウス乗ったら停止
  card.addEventListener("mouseenter", () => {
    if (index === currentIndex) {
      clearInterval(autoSlideInterval);
      autoSlideInterval = null;
    }
  });

  // マウス離れたら再開
  card.addEventListener("mouseleave", () => {
    if (index === currentIndex && !autoSlideInterval) {
      startAutoSlide();
    }
  });
});

const detailsWrapper = document.getElementById("details-wrapper");

// マウス乗ったら停止
detailsWrapper.addEventListener("mouseenter", () => {
  clearInterval(autoSlideInterval);
  autoSlideInterval = null;
});

// マウス離れたら再開
detailsWrapper.addEventListener("mouseleave", () => {
  if (!autoSlideInterval) {
    startAutoSlide();
  }
});
