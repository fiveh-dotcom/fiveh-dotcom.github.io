const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

let ballRadius = 6;
let ballX = canvasWidth / 2;
let ballY = canvasHeight - 30;
let ballSpeedX = 4;
let ballSpeedY = -4;

const paddleHeight = 10;
const paddleWidth = 100;
let paddleX = (canvasWidth - paddleWidth) / 2;

const paddleSpeed = 8;
let rightPressed = false;
let leftPressed = false;
let isDragging = false;

const rows = 5;
const cols = 10;
const blockPadding = 2;
const blockHeight = 20;
let blockWidth = (canvasWidth - blockPadding * (cols + 1)) / cols;

const blockColors = ["#f00", "#0f0", "#00f", "#ff0", "#0ff", "#f0f", "#ffa500"];
let blocks = [];

let score = 0;
let gameStarted = false;

function createBlocks() {
  blocks = [];
  for (let r = 0; r < rows; r++) {
    let row = [];
    for (let c = 0; c < cols; c++) {
      const color = blockColors[Math.floor(Math.random() * blockColors.length)];
      row.push({
        x: blockPadding + c * (blockWidth + blockPadding),
        y: blockPadding + r * (blockHeight + blockPadding),
        width: blockWidth,
        height: blockHeight,
        color: color,
        destroyed: false,
      });
    }
    blocks.push(row);
  }
}

function drawBlocks() {
  blocks.forEach((row) => {
    row.forEach((b) => {
      if (!b.destroyed) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }
    });
  });
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(paddleX, canvasHeight - paddleHeight - 10, paddleWidth, paddleHeight);
}

function collisionDetection() {
  let allDestroyed = true; // 全ブロック破壊チェック用

  blocks.forEach((row) => {
    row.forEach((b) => {
      if (!b.destroyed) {
        allDestroyed = false; // まだ残っているブロックがある
        if (
          ballX > b.x &&
          ballX < b.x + b.width &&
          ballY - ballRadius > b.y &&
          ballY - ballRadius < b.y + b.height
        ) {
          ballSpeedY = -ballSpeedY;
          b.destroyed = true;
          score += 1;
          document.getElementById("score").innerText = "Score: " + score;
        }
      }
    });
  });

  if (allDestroyed) {
    alert("クリア！スコア: " + score);
    gameStarted = false;
    cancelAnimationFrame(animationId);
  }
}

let animationId; // requestAnimationFrame の ID を保持

function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawBlocks();
  drawBall();
  drawPaddle();
  collisionDetection();

  // 壁反射
  if (ballX + ballSpeedX > canvasWidth - ballRadius || ballX + ballSpeedX < ballRadius) {
    ballSpeedX = -ballSpeedX;
  }
  if (ballY + ballSpeedY < ballRadius) {
    ballSpeedY = -ballSpeedY;
  } else if (ballY + ballSpeedY > canvasHeight - ballRadius - 10) {
    if (ballX > paddleX && ballX < paddleX + paddleWidth) {
      ballSpeedY = -ballSpeedY;
    } else if (ballY + ballSpeedY > canvasHeight - ballRadius) {
      alert("ゲームオーバー！スコア: " + score);
      gameStarted = false;
      cancelAnimationFrame(animationId); // ループ停止
      return;
    }
  }

  ballX += ballSpeedX;
  ballY += ballSpeedY;

  if (rightPressed && paddleX < canvasWidth - paddleWidth) paddleX += paddleSpeed;
  if (leftPressed && paddleX > 0) paddleX -= paddleSpeed;

  if (gameStarted) animationId = requestAnimationFrame(draw);
}

// キーボード操作
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "d") rightPressed = true;
  if (e.key === "ArrowLeft" || e.key === "a") leftPressed = true;
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowRight" || e.key === "d") rightPressed = false;
  if (e.key === "ArrowLeft" || e.key === "a") leftPressed = false;
});

// マウス操作
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  if (e.clientY > canvasHeight - paddleHeight - 10) {
    isDragging = true;
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const rect = canvas.getBoundingClientRect();
    paddleX = e.clientX - rect.left - paddleWidth / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
  }
});
canvas.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mouseleave", () => (isDragging = false));

canvas.addEventListener("touchstart", (e) => {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  if (touch.clientY - rect.top > canvasHeight - paddleHeight - 10) {
    isDragging = true;
  }
});

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (isDragging) {
      e.preventDefault(); // スクロール防止
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      paddleX = touch.clientX - rect.left - paddleWidth / 2;
      if (paddleX < 0) paddleX = 0;
      if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
    }
  },
  { passive: false },
);

canvas.addEventListener("touchend", () => {
  isDragging = false;
});
canvas.addEventListener("touchcancel", () => {
  isDragging = false;
});

// スタートボタン
document.getElementById("startBtn").addEventListener("click", () => {
  // 前回のアニメーションが残っていたらキャンセル
  if (animationId) cancelAnimationFrame(animationId);

  // 初期化
  ballX = canvasWidth / 2;
  ballY = canvasHeight - 30;
  ballSpeedX = 3;
  ballSpeedY = -3;
  paddleX = (canvasWidth - paddleWidth) / 2;
  score = 0;
  rightPressed = false;
  leftPressed = false;
  gameStarted = true;
  createBlocks();
  document.getElementById("score").innerText = "Score: 0";
  draw();
});
