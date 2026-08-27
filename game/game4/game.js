const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElem = document.getElementById("score");
const nextCanvases = document.querySelectorAll(".nextBlockCanvas");
const rotateButtons = document.querySelectorAll(".rotateBtn");

const rows = 10;
const cols = 10;
let tileSize;

let touchDragOffset; // 指より上にずらす量

/* =========================
   Canvasサイズ調整
========================= */

function resizeCanvases() {
  const gameRect = canvas.getBoundingClientRect();

  canvas.width = gameRect.width;
  canvas.height = gameRect.height;

  tileSize = Math.min(canvas.width / cols, canvas.height / rows);

  touchDragOffset = tileSize * 1.75;

  nextCanvases.forEach((nextCanvas) => {
    const rect = nextCanvas.getBoundingClientRect();

    nextCanvas.width = rect.width;
    nextCanvas.height = rect.height;
  });
}

/* =========================
   Overlay（完全最前面）
========================= */

const overlayCanvas = document.createElement("canvas");
const overlayCtx = overlayCanvas.getContext("2d");

overlayCanvas.width = window.innerWidth;
overlayCanvas.height = window.innerHeight;

overlayCanvas.style.position = "fixed";
overlayCanvas.style.left = "0px";
overlayCanvas.style.top = "0px";
overlayCanvas.style.pointerEvents = "none";
overlayCanvas.style.zIndex = "2147483647";

document.body.appendChild(overlayCanvas);

window.addEventListener("resize", () => {
  resizeCanvases();

  drawNextBlocks();
  drawGrid();
  syncOverlay();

  if (gameOver) {
    drawGameResult("GAME OVER");
  } else if (gameCleared) {
    drawGameResult("GAME CLEAR");
  }
});

/* ========================= */

let grid = [];
let score = 0;
let currentBlocks = [];
let draggingBlock = null;
let gameStarted = false;
let gameOver = false;
let gameCleared = false;

/* =========================
   ブロック定義
========================= */

const blockShapes = [
  // ===== 1マス（レア）
  { shape: [[1]], weight: 0.5 },

  // ===== 2マス（少なめ）
  { shape: [[1, 1]], weight: 1 },
  { shape: [[1], [1]], weight: 1 },

  // ===== 3マス（最多）
  { shape: [[1, 1, 1]], weight: 4 },
  { shape: [[1], [1], [1]], weight: 4 },
  {
    shape: [
      [1, 1],
      [1, 0],
    ],
    weight: 4,
  },

  // ===== 4マス（多い）
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    weight: 3.5,
  },

  {
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    weight: 3.5,
  },

  {
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    weight: 3.5,
  },

  {
    shape: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    weight: 3.5,
  },

  // ===== 5マス（普通）
  {
    shape: [
      [1, 1, 1],
      [1, 0, 1],
    ],
    weight: 2,
  },

  {
    shape: [
      [1, 0, 1],
      [1, 1, 1],
    ],
    weight: 2,
  },

  {
    shape: [
      [1, 1, 1],
      [1, 1, 0],
    ],
    weight: 2,
  },

  {
    shape: [
      [1, 1, 1],
      [0, 1, 1],
    ],
    weight: 2,
  },

  {
    shape: [
      [1, 0],
      [1, 1],
      [1, 1],
    ],
    weight: 2,
  },

  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    weight: 2,
  },

  // ===== 9マス（レア）
  {
    shape: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    weight: 0.5,
  },

  // ===== 爆弾
  { shape: [[1]], weight: 0.4, special: "rainbow" },
];

/* =========================
   回転ユーティリティ
========================= */

function rotateShape(shape) {
  const h = shape.length;
  const w = shape[0].length;

  const result = Array.from({ length: w }, () => Array(h).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      result[x][h - 1 - y] = shape[y][x];
    }
  }

  return result;
}

function rotateBlock(index) {
  if (!gameStarted) return;
  if (draggingBlock) return;

  const block = currentBlocks[index];

  if (!block) return;

  block.shape = rotateShape(block.shape);

  drawNextBlocks();

  // 回転後の形も含めてゲームオーバー判定
  checkGameOver();
}

function addRotations(baseShape, weight, special = null) {
  let shape = baseShape;

  for (let i = 0; i < 4; i++) {
    blockShapes.push({
      shape: shape,
      weight: weight,
      special: special,
    });

    shape = rotateShape(shape);
  }
}

/* =========================
   追加ブロック
========================= */

// L字 3マス
addRotations(
  [
    [1, 0],
    [1, 1],
  ],
  1.2,
);

// L字 4マス
addRotations(
  [
    [0, 1],
    [0, 1],
    [1, 1],
  ],
  1.2,
);

// T字 4マス
addRotations(
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  1.2,
);

// S型 4マス
addRotations(
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  0.9,
);

// 直線4
addRotations([[1, 1, 1, 1]], 1.5);

/* ========================= */

function randomColor() {
  const colors = ["#f55", "#5f5", "#55f", "#ff5", "#5ff", "#f5f"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomShape() {
  const total = blockShapes.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;

  for (const b of blockShapes) {
    if (r < b.weight) {
      return {
        shape: b.shape,
        special: b.special || null,
      };
    }
    r -= b.weight;
  }
}

/* ========================= */

function initGrid() {
  grid = Array.from({ length: rows }, () => Array(cols).fill(0));
}

/* ========================= */

// ============================================================
// ゲーム結果表示
// ============================================================

function drawGameResult(title) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  ctx.font = "bold 36px sans-serif";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = "20px sans-serif";
  ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 25);

  ctx.textAlign = "left";

  nextCanvases.forEach((nextCanvas, i) => {
    const nextCtx = nextCanvas.getContext("2d");
    nextCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  });
}

// ============================================================
// ゲーム終了処理
// ============================================================

function endGame(result) {
  gameStarted = false;
  paused = false;

  if (result === "clear") {
    gameOver = false;
    gameCleared = true;
    drawGameResult("GAME CLEAR");
  } else {
    gameOver = true;
    gameCleared = false;
    drawGameResult("GAME OVER");
  }

  document.getElementById("startBtn").textContent = "もう一度プレイ";
}

function generateBlocks() {
  currentBlocks = [];

  for (let i = 0; i < 3; i++) {
    const data = getRandomShape();

    currentBlocks.push({
      shape: JSON.parse(JSON.stringify(data.shape)),
      color: data.special === "rainbow" ? "rainbow" : randomColor(),
      special: data.special || null,
    });
  }

  drawNextBlocks();
}

/* =========================
   爆弾描画
========================= */

function drawBombTile(ctxRef, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.32;

  ctxRef.save();

  // =========================
  // 爆弾本体
  // =========================

  const grad = ctxRef.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);

  grad.addColorStop(0, "#777");
  grad.addColorStop(0.35, "#333");
  grad.addColorStop(1, "#080808");

  ctxRef.fillStyle = grad;

  ctxRef.beginPath();
  ctxRef.arc(cx, cy + size * 0.05, r, 0, Math.PI * 2);
  ctxRef.fill();

  // =========================
  // 爆弾の光
  // =========================

  ctxRef.fillStyle = "rgba(255,255,255,0.5)";

  ctxRef.beginPath();
  ctxRef.arc(cx - r * 0.35, cy - r * 0.35, r * 0.15, 0, Math.PI * 2);
  ctxRef.fill();

  // =========================
  // 導火線
  // =========================

  ctxRef.strokeStyle = "#222";
  ctxRef.lineWidth = Math.max(2, size * 0.08);
  ctxRef.lineCap = "round";

  ctxRef.beginPath();
  ctxRef.moveTo(cx + r * 0.55, cy - r * 0.65);
  ctxRef.quadraticCurveTo(cx + r * 0.9, cy - r * 1.15, cx + r * 0.75, cy - r * 1.35);
  ctxRef.stroke();

  // =========================
  // 導火線の先の火
  // =========================

  ctxRef.fillStyle = "#ff8c00";

  ctxRef.beginPath();
  ctxRef.arc(cx + r * 0.75, cy - r * 1.35, Math.max(2, size * 0.1), 0, Math.PI * 2);
  ctxRef.fill();

  ctxRef.fillStyle = "#fff";

  ctxRef.beginPath();
  ctxRef.arc(cx + r * 0.75, cy - r * 1.35, Math.max(1, size * 0.045), 0, Math.PI * 2);
  ctxRef.fill();

  ctxRef.restore();
}

/* ========================= */

function drawNextBlocks() {
  nextCanvases.forEach((nextCanvas, i) => {
    const ctx2 = nextCanvas.getContext("2d");
    ctx2.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!gameStarted && !gameOver && !gameCleared) return;

    const block = currentBlocks[i];
    if (!block) return;

    const size = 20;

    for (let y = 0; y < block.shape.length; y++) {
      for (let x = 0; x < block.shape[y].length; x++) {
        if (!block.shape[y][x]) continue;

        if (block.special === "rainbow") {
          drawBombTile(ctx2, x * size + 10, y * size + 10, size);
        } else {
          ctx2.fillStyle = block.color;
          ctx2.fillRect(x * size + 10, y * size + 10, size - 2, size - 2);
        }
      }
    }
  });
}

/* =========================
   ゴースト
========================= */

function drawGhost() {
  if (!draggingBlock) return;

  const block = draggingBlock.block;

  const rect = canvas.getBoundingClientRect();

  const gx = Math.floor((draggingBlock.x - rect.left) / tileSize);
  const gy = Math.floor((draggingBlock.y - rect.top) / tileSize);

  const ok = canPlace(block, gx, gy);

  // ここに置いたら消えるマス
  const clearingCells = ok ? getClearingCells(block, gx, gy) : [];

  ctx.globalAlpha = 0.4;

  // ゴースト本体
  for (let y = 0; y < block.shape.length; y++) {
    for (let x = 0; x < block.shape[y].length; x++) {
      if (!block.shape[y][x]) continue;

      const px = gx + x;
      const py = gy + y;

      if (px < 0 || py < 0 || px >= cols || py >= rows) {
        continue;
      }

      ctx.fillStyle = ok ? "#0f0" : "red";

      ctx.fillRect(px * tileSize, py * tileSize, tileSize - 2, tileSize - 2);
    }
  }

  ctx.globalAlpha = 1;

  // 消えるマスをハイライト
  if (clearingCells.length > 0) {
    ctx.save();

    clearingCells.forEach(({ x, y }) => {
      const px = x * tileSize;
      const py = y * tileSize;

      ctx.shadowColor = "rgba(255, 200, 0, 0.45)";
      ctx.shadowBlur = 15;

      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";

      ctx.fillRect(px, py, tileSize - 2, tileSize - 2);
    });

    ctx.restore();
  }

  if (block.special === "rainbow" && ok) {
    drawExplosionPreview(gx, gy);
  }
}

/* =========================
   爆風プレビュー
========================= */

function drawExplosionPreview(gx, gy) {
  const range = 2;

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "white";

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const px = gx + dx;
      const py = gy + dy;

      if (px < 0 || py < 0 || px >= cols || py >= rows) continue;

      ctx.fillRect(px * tileSize, py * tileSize, tileSize - 2, tileSize - 2);
    }
  }

  ctx.globalAlpha = 1;
}

/* ========================= */

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#555";

  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * tileSize, 0);
    ctx.lineTo(x * tileSize, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * tileSize);
    ctx.lineTo(canvas.width, y * tileSize);
    ctx.stroke();
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y][x]) continue;

      if (grid[y][x] === "rainbow") {
        drawBombTile(ctx, x * tileSize, y * tileSize, tileSize);
      } else {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x * tileSize, y * tileSize, tileSize - 2, tileSize - 2);
      }
    }
  }

  drawGhost();
}

/* =========================
   Overlay描画
========================= */

function drawOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!draggingBlock) return;

  const baseX = draggingBlock.x - tileSize / 2;
  const baseY = draggingBlock.y - tileSize / 2;

  const b = draggingBlock.block;

  for (let y = 0; y < b.shape.length; y++) {
    for (let x = 0; x < b.shape[y].length; x++) {
      if (!b.shape[y][x]) continue;

      const px = baseX + x * tileSize;
      const py = baseY + y * tileSize;

      if (b.special === "rainbow") {
        drawBombTile(overlayCtx, px, py, tileSize);
      } else {
        overlayCtx.fillStyle = b.color;
        overlayCtx.fillRect(px, py, tileSize - 2, tileSize - 2);
      }
    }
  }
}

/* ========================= */

function canPlace(block, gx, gy) {
  for (let y = 0; y < block.shape.length; y++) {
    for (let x = 0; x < block.shape[y].length; x++) {
      if (!block.shape[y][x]) continue;

      const px = gx + x;
      const py = gy + y;

      if (px < 0 || py < 0 || px >= cols || py >= rows || grid[py][px]) return false;
    }
  }
  return true;
}

/* ========================= */

function getClearingCells(block, gx, gy) {
  // まず現在のgridをコピー
  const testGrid = grid.map((row) => [...row]);

  // ブロックを仮配置
  for (let y = 0; y < block.shape.length; y++) {
    for (let x = 0; x < block.shape[y].length; x++) {
      if (!block.shape[y][x]) continue;

      const px = gx + x;
      const py = gy + y;

      if (px < 0 || py < 0 || px >= cols || py >= rows) {
        return [];
      }

      testGrid[py][px] = block.special === "rainbow" ? "rainbow" : block.color;
    }
  }

  const clearing = [];

  // 揃った行
  for (let y = 0; y < rows; y++) {
    if (testGrid[y].every((cell) => cell)) {
      for (let x = 0; x < cols; x++) {
        clearing.push({ x, y });
      }
    }
  }

  // 揃った列
  for (let x = 0; x < cols; x++) {
    let full = true;

    for (let y = 0; y < rows; y++) {
      if (!testGrid[y][x]) {
        full = false;
        break;
      }
    }

    if (full) {
      for (let y = 0; y < rows; y++) {
        clearing.push({ x, y });
      }
    }
  }

  // 重複削除
  return clearing.filter((cell, index, self) => index === self.findIndex((c) => c.x === cell.x && c.y === cell.y));
}

function clearLines() {
  let cleared = 0;

  for (let y = 0; y < rows; y++) {
    if (grid[y].every((c) => c)) {
      grid[y].fill(0);
      cleared++;
    }
  }

  for (let x = 0; x < cols; x++) {
    let full = true;

    for (let y = 0; y < rows; y++) {
      if (!grid[y][x]) full = false;
    }

    if (full) {
      for (let y = 0; y < rows; y++) grid[y][x] = 0;
      cleared++;
    }
  }

  score += cleared * 10;
  scoreElem.innerText = "Score: " + score;
}

/* =========================
   ドラッグ
========================= */

function startDrag(e, index) {
  if (!gameStarted) return;

  e.preventDefault();

  const block = currentBlocks[index];
  if (!block) return;

  let clientX, clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const isTouch = e.touches && e.touches.length > 0;
  const offsetY = isTouch ? touchDragOffset : 0;

  draggingBlock = {
    block: JSON.parse(JSON.stringify(block)),
    original: block,
    index,
    x: clientX,
    y: clientY - offsetY,
  };

  currentBlocks[index] = null;
  drawNextBlocks();
}

function drag(e) {
  if (!draggingBlock) return;

  e.preventDefault();

  let clientX, clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const isTouch = e.touches && e.touches.length > 0;

  if (isTouch) {
    const offsetY = touchDragOffset; // 指から上にずらす量
    draggingBlock.x = clientX;
    draggingBlock.y = clientY - offsetY;
  } else {
    // PCはそのまま
    draggingBlock.x = clientX;
    draggingBlock.y = clientY;
  }

  drawGrid(); // ゴースト
  syncOverlay(); // 最前面ブロック
}

function endDrag() {
  if (!draggingBlock) return;

  const rect = canvas.getBoundingClientRect();

  const gx = Math.floor((draggingBlock.x - rect.left) / tileSize);
  const gy = Math.floor((draggingBlock.y - rect.top) / tileSize);

  const block = draggingBlock.block;

  if (canPlace(block, gx, gy)) {
    for (let y = 0; y < block.shape.length; y++) {
      for (let x = 0; x < block.shape[y].length; x++) {
        if (!block.shape[y][x]) continue;
        grid[gy + y][gx + x] = block.color;
      }
    }

    if (block.special === "rainbow") {
      const range = 2;

      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const px = gx + dx;
          const py = gy + dy;

          if (px < 0 || py < 0 || px >= cols || py >= rows) continue;

          grid[py][px] = 0;
        }
      }

      score += 50;
    }

    clearLines();
  } else {
    currentBlocks[draggingBlock.index] = draggingBlock.original;
  }

  draggingBlock = null;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (currentBlocks.filter((b) => b !== null).length === 0) {
    generateBlocks();
  } else {
    drawNextBlocks();
  }

  drawGrid();
  checkGameOver();
}

/* ========================= */

function checkGameOver() {
  for (const block of currentBlocks) {
    if (!block) continue;

    let shape = block.shape;

    // 4方向を確認
    for (let rotation = 0; rotation < 4; rotation++) {
      const testBlock = {
        ...block,
        shape,
      };

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (canPlace(testBlock, x, y)) {
            return;
          }
        }
      }

      shape = rotateShape(shape);
    }
  }

  // どのブロックも置けない
  endGame("over");
}

function syncOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!draggingBlock) return;

  drawOverlay();
}

/* =========================
   イベント
========================= */

document.addEventListener("mousemove", drag);
document.addEventListener("touchmove", drag, { passive: false });

document.addEventListener("mouseup", endDrag);
document.addEventListener("touchend", endDrag);

nextCanvases.forEach((nextCanvas, index) => {
  nextCanvas.addEventListener("mousedown", (e) => startDrag(e, index));
  nextCanvas.addEventListener("touchstart", (e) => startDrag(e, index));
});

rotateButtons.forEach((button, index) => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    rotateBlock(index);
  });

  button.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      rotateBlock(index);
    },
    { passive: false },
  );
});

// スタートボタン
document.getElementById("startBtn").addEventListener("click", () => {
  score = 0;
  scoreElem.innerText = "Score: 0";

  gameStarted = true;
  document.getElementById("startBtn").textContent = "ゲームリセット";
  gameOver = false;
  gameCleared = false;

  initGrid();
  generateBlocks();
  drawGrid();
  syncOverlay();
});

/* ========================= */

initGrid();
resizeCanvases();
drawGrid();
syncOverlay();
