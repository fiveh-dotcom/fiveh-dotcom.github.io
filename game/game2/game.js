const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextBlocksCanvas");
const nextCtx = nextCanvas.getContext("2d");

const rows = 20;
const cols = 10;
const blockSize = canvas.width / cols;

let grid = Array.from({ length: rows }, () => Array(cols).fill(null));
let score = 0;
let gameStarted = false;

const shapes = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};
const colors = {
  I: "rgb(0, 200, 200)",
  O: "rgb(200, 200, 0)",
  T: "rgb(200, 0, 200)",
  S: "rgb(0, 200, 0)",
  Z: "rgb(200, 0, 0)",
  J: "rgb(0, 0, 200)",
  L: "rgb(200, 150, 0)",
};

let currentPiece = null;
let pieceX = 0,
  pieceY = 0;
let nextPieces = [];

function generateNextPieces() {
  while (nextPieces.length < 3) {
    const keys = Object.keys(shapes);
    const type = keys[Math.floor(Math.random() * keys.length)];
    nextPieces.push({ shape: shapes[type], color: colors[type] });
  }
}

function newPiece() {
  generateNextPieces();
  currentPiece = nextPieces.shift();
  generateNextPieces();
  pieceX = Math.floor(cols / 2 - currentPiece.shape[0].length / 2);
  pieceY = 0;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = grid[y][x] || "#111";
      ctx.fillRect(x * blockSize, y * blockSize, blockSize - 2, blockSize - 2);
    }
  }
  if (currentPiece) {
    currentPiece.shape.forEach((row, dy) => {
      row.forEach((val, dx) => {
        if (val) {
          const px = pieceX + dx;
          const py = pieceY + dy;
          if (py >= 0) {
            ctx.fillStyle = currentPiece.color;
            ctx.fillRect(px * blockSize, py * blockSize, blockSize - 2, blockSize - 2);
          }
        }
      });
    });
  }
}

function drawNextBlocks() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const gap = 10; // ブロック間の縦隙間

  nextPieces.forEach((p, i) => {
    const shape = p.shape;
    const shapeWidth = shape[0].length * blockSize; // ブロックの幅
    const offsetX = (nextCanvas.width - shapeWidth) / 2; // 中央寄せ
    const offsetY = i * 60 + i * gap; // 縦位置

    shape.forEach((row, dy) => {
      row.forEach((val, dx) => {
        if (val) {
          nextCtx.fillStyle = p.color;
          nextCtx.fillRect(
            offsetX + dx * blockSize,
            offsetY + dy * blockSize,
            blockSize - 2,
            blockSize - 2,
          );
        }
      });
    });
  });
}

function canMove(dx, dy, shape = currentPiece.shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const nx = pieceX + x + dx;
        const ny = pieceY + y + dy;
        if (nx < 0 || nx >= cols || ny >= rows) return false;
        if (ny >= 0 && grid[ny][nx]) return false;
      }
    }
  }
  return true;
}

function lockPiece() {
  // ブロックをグリッドに固定
  currentPiece.shape.forEach((row, dy) => {
    row.forEach((val, dx) => {
      if (val) {
        const nx = pieceX + dx;
        const ny = pieceY + dy;
        if (ny >= 0) grid[ny][nx] = currentPiece.color;
      }
    });
  });

  clearLines();

  // 固定中は操作できないようにする
  currentPiece = null;

  // 次のブロックを生成
  newPiece();
  drawNextBlocks();
}

function clearLines() {
  for (let y = rows - 1; y >= 0; y--) {
    if (grid[y].every((c) => c !== null)) {
      grid.splice(y, 1);
      grid.unshift(Array(cols).fill(null));
      score += 100;
      y++;
    }
  }
  document.getElementById("score").innerText = "Score: " + score;
}

function rotatePiece() {
  const shape = currentPiece.shape;
  const rotated = shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
  if (canMove(0, 0, rotated)) currentPiece.shape = rotated;
}

// キーボード操作
document.addEventListener("keydown", (e) => {
  if (!gameStarted) return;
  if (e.key === "ArrowLeft" && canMove(-1, 0)) pieceX--;
  if (e.key === "ArrowRight" && canMove(1, 0)) pieceX++;
  if (e.key === "ArrowDown" && canMove(0, 1)) pieceY++;
  if (e.key === "ArrowUp") rotatePiece();
});

// スマホ操作
let touchPrevX = 0;
let touchPrevY = 0;

canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchPrevX = t.clientX;
  touchPrevY = t.clientY;
});

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (!currentPiece) return; // ← ブロック固定中は動かせない

    const t = e.touches[0];
    const dx = t.clientX - touchPrevX;
    const dy = t.clientY - touchPrevY;

    // 横移動
    if (Math.abs(dx) > blockSize / 2) {
      if (dx > 0 && canMove(1, 0)) pieceX++;
      else if (dx < 0 && canMove(-1, 0)) pieceX--;
      touchPrevX = t.clientX; // 移動量リセット
    }

    // 下方向は即落下
    if (dy > blockSize / 2 && canMove(0, 1)) {
      pieceY++;
      touchPrevY = t.clientY;
    }
  },
  { passive: false },
);

canvas.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dy = t.clientY - touchPrevY;

  // 上方向は回転
  if (dy < -20) rotatePiece();
});

let dropCounter = 0;
let dropInterval = 500;
let lastTime = 0;

function gameLoop(timeStamp) {
  if (!gameStarted) return;
  const deltaTime = timeStamp - lastTime;
  lastTime = timeStamp;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    dropCounter = 0;
    if (canMove(0, 1)) {
      pieceY++;
    } else {
      lockPiece();
      if (!canMove(0, 0)) {
        alert("ゲームオーバー！スコア: " + score);
        gameStarted = false;
      }
    }
  }
  drawGrid();
  requestAnimationFrame(gameLoop);
}

document.getElementById("startBtn").addEventListener("click", () => {
  grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  score = 0;
  gameStarted = true;

  nextPieces = [];
  generateNextPieces();
  newPiece();
  drawNextBlocks();

  dropCounter = 0;

  // ゲームループ開始前に lastTime を現在時刻に設定
  // これをやらないと最初の frame で落下判定が成立して
  // ブロックが二段目から落ちるように見える
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
});
