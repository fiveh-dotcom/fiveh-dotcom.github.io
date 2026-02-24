const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextBlocksCanvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreElem = document.getElementById("score");

const rows = 10;
const cols = 5;
const blockSize = canvas.width / cols;

let grid = [];
let score = 0;
let gameStarted = false;

let currentBlock = null;
let nextBlocks = [];
let availableNumbers = [2, 4, 8];
let highestUnlockedNumber = 8;
let mergeLock = false; // 合体中フラグ

const colors = {
  2: "#ff6666",
  4: "#ffcc66",
  8: "#66ff66",
  16: "#66ccff",
  32: "#cc66ff",
  64: "#ff66ff",
  128: "#ff9966",
  256: "#66ffff",
  512: "#ffff66",
  1024: "#ff66ff",
  2048: "#00ffff",
  4096: "#0011ff",
};

// 数字省略表示
function formatNumber(n) {
  if (n >= 1e6) return Math.floor(n / 1e6) + "M";
  if (n >= 1e3) return Math.floor(n / 1e3) + "K";
  return n.toString();
}

// 重み付きランダム
function weightedRandom(nums, weights) {
  let sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < nums.length; i++) {
    if (r < weights[i]) return nums[i];
    r -= weights[i];
  }
  return nums[0];
}

// 次ブロック生成
function getNextBlock() {
  const weights = availableNumbers.map((n) => {
    if (n === highestUnlockedNumber) return 0.2;
    if (n === highestUnlockedNumber / 2) return 0.5;
    return 1;
  });
  return weightedRandom(availableNumbers, weights);
}

function initGrid() {
  grid = Array.from({ length: rows }, () => Array(cols).fill(null));
}

function generateNextBlocks() {
  while (nextBlocks.length < 3) nextBlocks.push(getNextBlock());
}

function newBlock() {
  generateNextBlocks();
  currentBlock = {
    value: nextBlocks.shift(),
    x: Math.floor(cols / 2),
    y: 0, // 最上段から開始
  };
  generateNextBlocks();
}

// 描画
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) if (grid[y][x]) drawCell(x, y, grid[y][x]);

  if (currentBlock) drawCell(currentBlock.x, currentBlock.y, currentBlock.value);
  drawNext();
}

function drawCell(x, y, value) {
  const px = Math.round(x * blockSize);
  const py = Math.round(y * blockSize);
  const size = blockSize - 2;
  ctx.fillStyle = getColor(value);
  ctx.fillRect(px, py, blockSize - 2, blockSize - 2);
  ctx.fillStyle = "#000";
  ctx.font = `bold ${Math.round(blockSize * 0.45)}px 'Poppins', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = formatNumber(value);
  drawCenteredText(ctx, text, px + size / 2, py + size / 2, size * 0.8, size * 0.5);

  // 1024以上はキラキラエフェクト
  if (value >= 1024) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x * blockSize + 2, y * blockSize + 2, blockSize - 6, blockSize - 6);
  }
}

function drawCenteredText(ctx, text, x, y, maxWidth, baseSize) {
  let fontSize = baseSize;

  do {
    ctx.font = `bold ${fontSize}px 'Poppins', sans-serif`;
    const width = ctx.measureText(text).width;
    if (width <= maxWidth) break;
    fontSize -= 2;
  } while (fontSize > 10);

  ctx.fillText(text, x, y);
}

function getColor(value) {
  if (colors[value]) return colors[value];
  // 4096超えは色相を変えて生成
  const hue = (Math.log2(value) * 40) % 360; // 2の累乗に応じて色を変える
  return `hsl(${hue}, 70%, 60%)`;
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const gap = 5; // ブロック間の余白
  const size = blockSize - 2; // ゲーム画面と同じサイズ

  nextBlocks.forEach((val, i) => {
    const x = (nextCanvas.width - size) / 2;
    const y = i * (size + gap);

    // ブロック本体
    nextCtx.fillStyle = colors[val] || "#333";
    nextCtx.fillRect(x, y, size, size);

    // 数字表示
    nextCtx.fillStyle = "#000";
    nextCtx.font = `bold ${Math.floor(size * 0.45)}px 'Poppins', sans-serif`;
    nextCtx.textAlign = "center";
    nextCtx.textBaseline = "middle";
    const text = formatNumber(val);
    drawCenteredText(nextCtx, text, x + size / 2, y + size / 2, size * 0.8, size * 0.5);

    // 1024以上はキラキラエフェクト
    if (val >= 1024) {
      nextCtx.strokeStyle = "rgba(255,255,255,0.6)";
      nextCtx.lineWidth = 2;
      nextCtx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    }
  });
}

// 移動判定
function canMove(x, y) {
  return x >= 0 && x < cols && y < rows && !grid[y][x];
}

// 落下
function drop() {
  if (!currentBlock || mergeLock) return;
  if (canMove(currentBlock.x, currentBlock.y + 1)) {
    currentBlock.y++;
  } else {
    placeBlock();
    mergeLock = true;
    mergeAndFall(currentBlock.x, currentBlock.y).then(() => {
      mergeLock = false;
      currentBlock = null;
      newBlock();
      if (!canMove(currentBlock.x, currentBlock.y)) {
        alert("ゲームオーバー！スコア: " + score);
        gameStarted = false;
      }
    });
  }
}

function placeBlock() {
  grid[currentBlock.y][currentBlock.x] = currentBlock.value;
}

// 複数合体 + 下まで落下（アニメーション）
async function mergeAndFall(x, y) {
  let changed;
  do {
    changed = false;
    // 複数合体
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        if (!grid[row][col]) continue;
        const val = grid[row][col];
        const dirs = [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ];
        for (let [dx, dy] of dirs) {
          const nx = col + dx,
            ny = row + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === val) {
            await animateMerge(col, row, nx, ny);
            grid[row][col] *= 2;
            score += grid[row][col];
            if (grid[row][col] > highestUnlockedNumber) {
              highestUnlockedNumber = grid[row][col];
              if (!availableNumbers.includes(grid[row][col])) availableNumbers.push(grid[row][col]);
            }
            grid[ny][nx] = null;
            changed = true;
          }
        }
      }
    }
    // 下まで落下
    for (let col = 0; col < cols; col++) {
      for (let row = rows - 2; row >= 0; row--) {
        if (grid[row][col] && !grid[row + 1][col]) {
          grid[row + 1][col] = grid[row][col];
          grid[row][col] = null;
          changed = true;
        }
      }
    }
    drawGrid();
    await sleep(50);
  } while (changed);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// アニメーション
async function animateMerge(fx, fy, tx, ty) {
  const steps = 10;
  const val = grid[fy][fx];
  for (let i = 1; i <= steps; i++) {
    drawGrid();
    const cx = fx + ((tx - fx) * i) / steps;
    const cy = fy + ((ty - fy) * i) / steps;
    drawCell(cx, cy, val);
    await sleep(20);
  }
}

// キー操作
document.addEventListener("keydown", (e) => {
  if (!gameStarted || !currentBlock) return;
  if (e.key === "ArrowLeft" && canMove(currentBlock.x - 1, currentBlock.y)) currentBlock.x--;
  if (e.key === "ArrowRight" && canMove(currentBlock.x + 1, currentBlock.y)) currentBlock.x++;
  if (e.key === "ArrowDown") drop();
  if (e.key === "ArrowUp") {
    while (canMove(currentBlock.x, currentBlock.y + 1)) currentBlock.y++;
    drop();
  }
});

// スマホ操作（スワイプで操作）
let isTouching = false;
let touchPrevX = 0;
let touchPrevY = 0;

canvas.addEventListener("touchstart", (e) => {
  if (!gameStarted || !currentBlock || mergeLock) return;

  const t = clampTouchToCanvas(e.touches[0]);
  touchPrevX = t.x;
  touchPrevY = t.y;

  isTouching = true;
});

function clampTouchToCanvas(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(rect.left, Math.min(touch.clientX, rect.right)),
    y: Math.max(rect.top, Math.min(touch.clientY, rect.bottom)),
  };
}

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault(); // スクロール防止
  if (!currentBlock) return;

  const t = clampTouchToCanvas(e.touches[0]);
  const dx = t.x - touchPrevX;
  const dy = t.y - touchPrevY;

  // 横移動（1マスずつブロックを追従）
  if (Math.abs(dx) > blockSize / 2) {
    if (dx > 0 && canMove(currentBlock.x + 1, currentBlock.y)) currentBlock.x++;
    else if (dx < 0 && canMove(currentBlock.x - 1, currentBlock.y)) currentBlock.x--;
    touchPrevX = t.x; // 移動量リセット
  }

  // 下方向は1段ずつ落下
  if (dy > blockSize / 2) {
    drop();
    touchPrevY = t.y;
  }
});

canvas.addEventListener("touchend", (e) => {
  isTouching = false;

  // 上方向スワイプで高速落下
  if (!currentBlock) return;

  const t = clampTouchToCanvas(e.changedTouches[0]);
  const dy = t.y - touchPrevY;

  // 落下タイマーリセット
  dropCounter = 0;

  if (dy < -20) {
    while (canMove(currentBlock.x, currentBlock.y + 1)) currentBlock.y++;
    drop();
  }
});

window.addEventListener("touchcancel", () => {
  isTouching = false;
  touchDropLock = false;
  dropCounter = 0;
});

// ゲームループ
let lastTime = 0,
  dropCounter = 0,
  dropInterval = 500;
function gameLoop(time = performance.now()) {
  if (!gameStarted) return;
  const delta = time - lastTime;
  lastTime = time;

  dropCounter += delta;
  if (!isTouching && dropCounter > dropInterval) {
    drop();
    dropCounter = 0;
  }

  drawGrid();
  scoreElem.innerText = "Score: " + score;
  requestAnimationFrame(gameLoop);
}

// スタート
document.getElementById("startBtn").addEventListener("click", () => {
  score = 0;

  availableNumbers = [2, 4, 8];
  highestUnlockedNumber = 8;

  initGrid();
  nextBlocks = [];
  newBlock(); // currentBlock.y = 0
  gameStarted = true;
  dropCounter = 0; // ここが重要：最初は落下カウンター0に
  lastTime = performance.now(); // ここもリセット
  gameLoop();
});
