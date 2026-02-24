const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElem = document.getElementById("score");
const nextCanvases = document.querySelectorAll(".nextBlockCanvas");

const rows = 10;
const cols = 10;
const tileSize = Math.min(canvas.width / cols, canvas.height / rows);

const TOUCH_DRAG_OFFSET = tileSize * 2.2; // 指より上にずらす量

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
  overlayCanvas.width = window.innerWidth;
  overlayCanvas.height = window.innerHeight;
});

/* ========================= */

let grid = [];
let score = 0;
let currentBlocks = [];
let draggingBlock = null;
let gameStarted = false;

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
  const grad = ctxRef.createRadialGradient(
    x + size / 2,
    y + size / 2,
    2,
    x + size / 2,
    y + size / 2,
    size,
  );

  grad.addColorStop(0, "white");
  grad.addColorStop(0.3, "yellow");
  grad.addColorStop(0.6, "orange");
  grad.addColorStop(1, "red");

  ctxRef.fillStyle = grad;
  ctxRef.fillRect(x, y, size - 2, size - 2);
}

/* ========================= */

function drawNextBlocks() {
  nextCanvases.forEach((canvas, i) => {
    const ctx2 = canvas.getContext("2d");
    ctx2.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameStarted) return;

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

  const gx = Math.round((draggingBlock.x - rect.left) / tileSize);
  const gy = Math.round((draggingBlock.y - rect.top) / tileSize);

  const ok = canPlace(block, gx, gy);

  ctx.globalAlpha = 0.4;

  for (let y = 0; y < block.shape.length; y++) {
    for (let x = 0; x < block.shape[y].length; x++) {
      if (!block.shape[y][x]) continue;

      const px = gx + x;
      const py = gy + y;

      if (px < 0 || py < 0 || px >= cols || py >= rows) continue;

      ctx.fillStyle = ok ? "#0f0" : "red";
      ctx.fillRect(px * tileSize, py * tileSize, tileSize - 2, tileSize - 2);
    }
  }

  ctx.globalAlpha = 1;

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
  const offsetY = isTouch ? TOUCH_DRAG_OFFSET : 0;

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
    const offsetY = TOUCH_DRAG_OFFSET; // 指から上にずらす量
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

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (canPlace(block, x, y)) return;
      }
    }
  }

  setTimeout(() => {
    alert("ゲームオーバー！ スコア: " + score);
  }, 100);
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

nextCanvases.forEach((canvas, index) => {
  canvas.addEventListener("mousedown", (e) => startDrag(e, index));
  canvas.addEventListener("touchstart", (e) => startDrag(e, index));
});

document.getElementById("startBtn").addEventListener("click", () => {
  score = 0;
  scoreElem.innerText = "Score: 0";

  gameStarted = true;

  initGrid();
  generateBlocks();
  drawGrid();
  syncOverlay();
});

/* ========================= */

initGrid();
drawGrid();
syncOverlay();
