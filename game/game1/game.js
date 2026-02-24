const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const rows = 15;
const cols = 10;
const colors = ["#f00", "#0f0", "#00f", "#ff0"];
let grid = [];
let score = 0;
let time = 120;
let timerInterval = null;
let gameStarted = false;
let fallingTiles = [];

// 丸角描画
function drawRoundedRect(x, y, w, h, radius, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function initGrid() {
  grid = [];
  const totalCells = rows * cols;

  // タイルを偶数枚ずつ作る
  let tileList = [];
  colors.forEach((color) => {
    for (let i = 0; i < 24; i++) tileList.push(color);
  });

  // 残りは空白に
  const remaining = totalCells - tileList.length;
  for (let i = 0; i < remaining; i++) tileList.push(null);

  // シャッフル
  for (let i = tileList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tileList[i], tileList[j]] = [tileList[j], tileList[i]];
  }

  // grid に割り当て
  for (let y = 0; y < rows; y++) {
    let row = [];
    for (let x = 0; x < cols; x++) {
      row.push(tileList[y * cols + x] || null);
    }
    grid.push(row);
  }
}

function updateFallingTiles() {
  for (let i = fallingTiles.length - 1; i >= 0; i--) {
    const t = fallingTiles[i];
    t.x += t.vx;
    t.y += t.vy;
    t.vy += 0.3; // 重力
    t.alpha -= 0.015;
    if (t.alpha <= 0 || t.y > canvas.height) fallingTiles.splice(i, 1);
  }
}

function getTileSize() {
  return canvas.clientWidth / cols;
}

function drawGrid() {
  const tileSize = getTileSize();

  // 表示サイズに合わせて内部解像度を同期
  canvas.width = canvas.clientWidth;
  canvas.height = tileSize * rows;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景にモノクロマス目を描画
  ctx.strokeStyle = "#dfdfdf"; // 薄いグレー
  ctx.lineWidth = 0.3;
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

  // タイルを描画
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const color = grid[y][x];
      if (color) {
        drawRoundedRect(x * tileSize, y * tileSize, tileSize - 0.5, tileSize - 0.5, 6, color);
      }
    }
  }

  fallingTiles.forEach((t) => {
    drawRoundedRect(t.x, t.y, tileSize - 2, tileSize - 2, 6, t.color, t.alpha);
  });
}

function updateUI() {
  const timeBar = document.getElementById("timeBar");
  if (timeBar) timeBar.style.width = (time / 120) * 100 + "%";
  document.getElementById("score").innerText = "Score: " + score;
}

// タイルを消す関数
function handleTileInteraction(clientX, clientY) {
  if (!gameStarted) return;
  const tileSize = getTileSize();
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left) / tileSize);
  const y = Math.floor((clientY - rect.top) / tileSize);
  if (x < 0 || x >= cols || y < 0 || y >= rows) return;
  if (grid[y][x] !== null) return;

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  let foundTiles = [];
  directions.forEach((dir) => {
    let nx = x,
      ny = y;
    while (true) {
      nx += dir.dx;
      ny += dir.dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) break;
      if (grid[ny][nx] !== null) {
        foundTiles.push({ x: nx, y: ny, color: grid[ny][nx] });
        break;
      }
    }
  });

  if (foundTiles.length === 0) {
    time -= 10;
    if (time < 0) time = 0;
    updateUI();
    return;
  }

  let colorCount = {};
  foundTiles.forEach((t) => {
    colorCount[t.color] = (colorCount[t.color] || 0) + 1;
  });

  let anyRemoved = false;
  foundTiles.forEach((t) => {
    if (colorCount[t.color] >= 2) {
      fallingTiles.push({
        x: t.x * tileSize,
        y: t.y * tileSize,
        vx: (Math.random() - 0.5) * 8,
        vy: -3 - Math.random() * 4,
        alpha: 1,
        color: t.color,
      });
      grid[t.y][t.x] = null;
      score += 1;
      anyRemoved = true;
    }
  });

  if (!anyRemoved) {
    time -= 10;
    if (time < 0) time = 0;
  }

  updateUI();
}

// クリック対応
canvas.addEventListener("click", (e) => {
  handleTileInteraction(e.clientX, e.clientY);
});

function startTimer() {
  timerInterval = setInterval(() => {
    time--;
    if (time < 0) time = 0;
    updateUI();
    if (time <= 0) {
      time = 0;
      clearInterval(timerInterval);
      alert("ゲームオーバー！スコア: " + score);
      gameStarted = false;
    }
  }, 1000);
}

function gameLoop() {
  if (gameStarted) {
    updateFallingTiles();
    drawGrid();
    updateUI();

    // ここでクリア判定
    const tilesLeft = grid.flat().filter((c) => c !== null).length;
    if (tilesLeft === 0 && fallingTiles.length === 0) {
      alert("クリア！スコア: " + score);
      gameStarted = false;
      clearInterval(timerInterval);
    }
  }
  requestAnimationFrame(gameLoop);
}

document.getElementById("startBtn").addEventListener("click", () => {
  score = 0;
  time = 120;
  initGrid();
  fallingTiles = [];
  gameStarted = true;
  clearInterval(timerInterval);
  startTimer();
});

gameLoop();
