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

  touchDragOffset = tileSize * 2;

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
  { shape: [[1]], weight: 0.4, special: "bomb" },
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
  const colors = [
    "#ff5555", // 赤
    "#55ff55", // 緑
    "#5555ff", // 青
    "#ffff55", // 黄
    "#55ffff", // シアン
    "#ff55ff", // マゼンタ
  ];

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
      color: data.special === "bomb" ? "bomb" : randomColor(),
      special: data.special || null,
    });
  }

  drawNextBlocks();
}

/* =========================
   立体ブロック描画
   ・中央の面
   ・上面 / 左面を明るく
   ・右面 / 下面を暗く
   ・宝石風の立体感
========================= */

function drawBlock(ctxRef, x, y, size, color, alpha = 1) {
  const gap = 0;
  const s = size;

  const px = x + gap;
  const py = y + gap;

  // 立体部分の幅
  const bevel = Math.max(3, s * 0.16);

  // ----------------------------------------------------------
  // 色を明るく / 暗くする
  // ----------------------------------------------------------

  function adjustColor(hex, amount) {
    const value = hex.replace("#", "");

    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);

    const nr = Math.max(0, Math.min(255, r + amount));
    const ng = Math.max(0, Math.min(255, g + amount));
    const nb = Math.max(0, Math.min(255, b + amount));

    return "#" + nr.toString(16).padStart(2, "0") + ng.toString(16).padStart(2, "0") + nb.toString(16).padStart(2, "0");
  }

  const topColor = adjustColor(color, 45);
  const leftColor = adjustColor(color, 25);
  const rightColor = adjustColor(color, -45);
  const bottomColor = adjustColor(color, -65);

  ctxRef.save();

  ctxRef.globalAlpha = alpha;

  // ----------------------------------------------------------
  // 外周
  // ----------------------------------------------------------

  ctxRef.fillStyle = adjustColor(color, -80);
  ctxRef.fillRect(px, py, s, s);

  // ----------------------------------------------------------
  // 上面
  // ----------------------------------------------------------

  ctxRef.fillStyle = topColor;

  ctxRef.beginPath();
  ctxRef.moveTo(px, py);
  ctxRef.lineTo(px + s, py);
  ctxRef.lineTo(px + s - bevel, py + bevel);
  ctxRef.lineTo(px + bevel, py + bevel);
  ctxRef.closePath();
  ctxRef.fill();

  // ----------------------------------------------------------
  // 左面
  // ----------------------------------------------------------

  ctxRef.fillStyle = leftColor;

  ctxRef.beginPath();
  ctxRef.moveTo(px, py);
  ctxRef.lineTo(px + bevel, py + bevel);
  ctxRef.lineTo(px + bevel, py + s - bevel);
  ctxRef.lineTo(px, py + s);
  ctxRef.closePath();
  ctxRef.fill();

  // ----------------------------------------------------------
  // 右面
  // ----------------------------------------------------------

  ctxRef.fillStyle = rightColor;

  ctxRef.beginPath();
  ctxRef.moveTo(px + s, py);
  ctxRef.lineTo(px + s, py + s);
  ctxRef.lineTo(px + s - bevel, py + s - bevel);
  ctxRef.lineTo(px + s - bevel, py + bevel);
  ctxRef.closePath();
  ctxRef.fill();

  // ----------------------------------------------------------
  // 下面
  // ----------------------------------------------------------

  ctxRef.fillStyle = bottomColor;

  ctxRef.beginPath();
  ctxRef.moveTo(px, py + s);
  ctxRef.lineTo(px + s, py + s);
  ctxRef.lineTo(px + s - bevel, py + s - bevel);
  ctxRef.lineTo(px + bevel, py + s - bevel);
  ctxRef.closePath();
  ctxRef.fill();

  // ----------------------------------------------------------
  // 中央の面
  // ----------------------------------------------------------

  ctxRef.fillStyle = color;

  ctxRef.fillRect(px + bevel, py + bevel, s - bevel * 2, s - bevel * 2);

  ctxRef.restore();
}

/* =========================
   ゴーストブロック描画
   ・置く予定の位置を表示
   ・マス間の隙間なし
   ・外周を暗くせず、色を均一に表示
========================= */

function drawGhostBlock(ctxRef, x, y, size, color, alpha = 1) {
  ctxRef.save();

  ctxRef.globalAlpha = alpha;
  ctxRef.fillStyle = color;

  // 隙間なしで全面を塗る
  ctxRef.fillRect(x, y, size, size);

  ctxRef.restore();
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

        if (block.special === "bomb") {
          drawBombTile(ctx2, x * size + 10, y * size + 10, size);
        } else {
          drawBlock(ctx2, x * size + 10, y * size + 10, size, block.color);
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

      drawGhostBlock(ctx, px * tileSize, py * tileSize, tileSize, ok ? "#0f0" : "#f00", 0.4);
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

      ctx.fillRect(px, py, tileSize, tileSize);
    });

    ctx.restore();
  }

  if (block.special === "bomb" && ok) {
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
  ctx.lineWidth = 0.5;

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

      if (grid[y][x] === "bomb") {
        drawBombTile(ctx, x * tileSize, y * tileSize, tileSize);
      } else {
        drawBlock(ctx, x * tileSize, y * tileSize, tileSize, grid[y][x]);
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

      if (b.special === "bomb") {
        drawBombTile(overlayCtx, px, py, tileSize);
      } else {
        drawBlock(overlayCtx, px, py, tileSize, b.color);
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

      testGrid[py][px] = block.special === "bomb" ? "bomb" : block.color;
    }
  }

  const clearing = [];

  // 揃った行
  for (let y = 0; y < rows; y++) {
    if (testGrid[y].every((cell) => cell && cell !== "bomb")) {
      for (let x = 0; x < cols; x++) {
        clearing.push({ x, y });
      }
    }
  }

  // 揃った列
  for (let x = 0; x < cols; x++) {
    let full = true;

    for (let y = 0; y < rows; y++) {
      if (!testGrid[y][x] || testGrid[y][x] === "bomb") {
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
    if (grid[y].every((c) => c && c !== "bomb")) {
      grid[y].fill(0);
      cleared++;
    }
  }

  for (let x = 0; x < cols; x++) {
    let full = true;

    for (let y = 0; y < rows; y++) {
      if (!grid[y][x] || grid[y][x] === "bomb") {
        full = false;
        break;
      }
    }

    if (full) {
      for (let y = 0; y < rows; y++) {
        grid[y][x] = 0;
      }
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

    if (block.special === "bomb") {
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

// リセット確認ダイアログ
const resetDialog = createResetDialog({
  // 「リセット」が押された
  onConfirm: () => {
    startGame();
  },

  // 「キャンセル」が押された
  onCancel: () => {
    // 何もしない
  },
});

// スタートボタン
document.getElementById("startBtn").addEventListener("click", () => {
  // ゲーム中なら確認ダイアログを表示
  if (gameStarted && !gameOver && !gameCleared) {
    resetDialog.show();
    return;
  }

  startGame();
});

// ゲーム開始・リセット処理
function startGame() {
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
}

/* ========================= */

initGrid();
resizeCanvases();
drawGrid();
syncOverlay();
