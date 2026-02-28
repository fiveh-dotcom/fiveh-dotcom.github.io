const cards = document.querySelectorAll(".service-card");
const indicators = document.querySelectorAll(".indicator");
const details = document.querySelectorAll(".service-detail");

let currentIndex = 0;
let autoSlideInterval;
const intervalTime = 12000; // 12秒

// 初期表示
details[currentIndex].classList.add("active");
cards[currentIndex].classList.add("active");
indicators[currentIndex].classList.add("active");

function showDetail(index, direction = "next") {
  if (index === currentIndex) return;

  const current = details[currentIndex];
  const next = details[index];
  const isNext = direction === "next";

  // next の初期位置を確定
  next.classList.remove("active", "exit-left", "exit-right");

  next.style.transition = "none";
  next.style.transform = isNext
    ? "translateY(-50%) translateX(100%)"
    : "translateY(-50%) translateX(-100%)";

  next.offsetHeight; // 再描画

  next.style.transition = ""; // transition復活

  // current を退場
  current.classList.remove("active");
  current.classList.add(isNext ? "exit-left" : "exit-right");

  // next を中央へ
  next.classList.add("active");
  next.style.transform = "";

  currentIndex = index;

  // UI更新
  cards.forEach((c) => c.classList.remove("active"));
  cards[index].classList.add("active");

  indicators.forEach((i) => i.classList.remove("active"));
  indicators[index].classList.add("active");
}

// 自動切替
function startAutoSlide() {
  autoSlideInterval = setInterval(() => {
    let nextIndex = (currentIndex + 1) % cards.length;
    showDetail(nextIndex);
  }, intervalTime);
}

startAutoSlide();

function getDirection(index) {
  const total = details.length;

  const forwardDistance = (index - currentIndex + total) % total;
  const backwardDistance = (currentIndex - index + total) % total;

  return forwardDistance <= backwardDistance ? "next" : "prev";
}

// カードクリックで切替＋タイマーリセット
cards.forEach((c, i) => {
  c.addEventListener("click", () => {
    showDetail(i, getDirection(i));
    clearInterval(autoSlideInterval);
    startAutoSlide();
  });
});

let startX = 0;
let startY = 0;
const detailsWrapper = document.getElementById("details-wrapper");

// --- スワイプ処理 ---
detailsWrapper.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
});

detailsWrapper.addEventListener("touchend", (e) => {
  const endX = e.changedTouches[0].clientX;
  const endY = e.changedTouches[0].clientY;

  const diffX = endX - startX;
  const diffY = endY - startY;

  // 横移動が縦移動より大きい場合のみ反応（斜め対策）
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
    if (diffX < 0) {
      // 左スワイプ → 次へ
      let nextIndex = (currentIndex + 1) % details.length;
      showDetail(nextIndex, "next");
    } else {
      // 右スワイプ → 前へ
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) prevIndex = details.length - 1;
      showDetail(prevIndex, "prev");
    }

    resetAutoSlide();
  }
});

// タイマーリセット関数
function resetAutoSlide() {
  clearInterval(autoSlideInterval);
  startAutoSlide();
}

// インジケータークリックで切替＋タイマーリセット
indicators.forEach((i, idx) => {
  i.addEventListener("click", () => {
    showDetail(idx, getDirection(idx));
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
