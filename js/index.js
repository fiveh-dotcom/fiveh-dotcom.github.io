window.addEventListener("load", () => {
  const hero = document.querySelector(".hero");
  const logo = document.querySelector(".hero-logo");
  const company = document.querySelector(".hero-company-name");
  const texts = document.querySelectorAll(".hero-text");

  // 背景フェードイン
  hero.classList.add("show");

  // ロゴを軽くフェードイン
  setTimeout(() => logo.classList.add("show"), 500);

  // 会社名フェードイン
  setTimeout(() => company.classList.add("show"), 1000);

  // h2 スライドイン
  setTimeout(() => texts[0].classList.add("show"), 1500);

  // p スライドイン
  setTimeout(() => texts[1].classList.add("show"), 1800);
});

(function () {
  const logo = document.getElementById("secretLogo");
  const menu = document.getElementById("gameMenu");
  const container = document.getElementById("gameContainer");
  const frame = document.getElementById("gameFrame");

  const closeMenu = document.getElementById("closeMenu");
  const closeGame = document.getElementById("closeGame");
  const backToMenu = document.getElementById("backToMenu");

  let clickCount = 0;
  let timer = null;
  const limitTime = 1000; // 1秒

  // ロゴ5回クリック
  logo.addEventListener("click", () => {
    // 最初のクリック時だけタイマー開始
    if (clickCount === 0) {
      timer = setTimeout(() => {
        clickCount = 0; // 時間切れでリセット
      }, limitTime);
    }

    clickCount++;

    if (clickCount >= 5) {
      menu.style.display = "block";

      // 成功したらリセット
      clearTimeout(timer);
      clickCount = 0;
    }
  });

  // ゲーム選択
  document.querySelectorAll(".gameBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const game = btn.dataset.game;

      frame.src = game;
      menu.style.display = "none";
      container.style.display = "block";
    });
  });

  // 閉じる
  closeMenu.addEventListener("click", () => {
    menu.style.display = "none";
  });

  closeGame.addEventListener("click", () => {
    container.style.display = "none";
    frame.src = "";
  });

  // ゲーム画面からメニューに戻る
  backToMenu.addEventListener("click", () => {
    container.style.display = "none"; // ゲーム画面を隠す
    menu.style.display = "block"; // メニューを表示
    frame.src = ""; // iframe をリセット
  });
})();
