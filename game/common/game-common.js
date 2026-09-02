// ============================================================
// リセット確認ダイアログ
// ============================================================

function createResetDialog({ onConfirm, onCancel }) {
  const overlay = document.createElement("div");

  overlay.id = "resetOverlay";

  overlay.innerHTML = `
    <div id="resetDialog">
      <div id="resetMessage">ゲームをリセットしますか？</div>

      <div id="resetButtons">
        <button id="resetCancelBtn">キャンセル</button>
        <button id="resetConfirmBtn">リセット</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cancelBtn = overlay.querySelector("#resetCancelBtn");
  const confirmBtn = overlay.querySelector("#resetConfirmBtn");

  function show() {
    overlay.classList.add("active");
  }

  function hide() {
    overlay.classList.remove("active");
  }

  cancelBtn.addEventListener("click", () => {
    hide();

    if (onCancel) {
      onCancel();
    }
  });

  confirmBtn.addEventListener("click", () => {
    hide();

    if (onConfirm) {
      onConfirm();
    }
  });

  return {
    show,
    hide,
  };
}

// ============================================================
// 一時停止ボタン
// ============================================================

function createPauseButton({ canToggle, isPaused, onPause, onResume }) {
  const pauseBtn = document.createElement("button");

  pauseBtn.id = "pauseBtn";
  pauseBtn.setAttribute("aria-label", "一時停止");
  pauseBtn.textContent = "⏸";

  document.body.appendChild(pauseBtn);

  const pauseOverlay = document.createElement("div");

  pauseOverlay.id = "pauseOverlay";

  pauseOverlay.innerHTML = `
    <div id="pauseMessage">一時停止中</div>
  `;

  document.body.appendChild(pauseOverlay);

  function update() {
    if (isPaused()) {
      pauseBtn.textContent = "▶";
      pauseBtn.classList.add("small-icon");
      pauseOverlay.classList.add("active");
    } else {
      pauseBtn.textContent = "⏸";
      pauseBtn.classList.remove("small-icon");
      pauseOverlay.classList.remove("active");
    }
  }

  pauseBtn.addEventListener("click", () => {
    if (!canToggle()) return;

    if (isPaused()) {
      onResume();
    } else {
      onPause();
    }

    update();
  });

  return {
    update,
  };
}
