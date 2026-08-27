const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const canvasWidth = 400;
const canvasHeight = 600;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

const paddleHeight = 10;
const paddleWidth = 100;
const paddleBottom = 30; // 下端から30px上

let ballRadius = 6;
let ballX = canvasWidth / 2;
let ballY = canvasHeight - paddleBottom - paddleHeight - ballRadius - 2;
let ballSpeedX = 7;
let ballSpeedY = -7;

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
let gameOver = false;
let gameCleared = false;
let paused = false;

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

function drawBalls() {
  balls.forEach((ball) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.penetrate ? "#800080" : "#fff"; // ← 貫通中は紫
    ctx.fill();
    ctx.closePath();
  });
}

function drawPaddle() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(paddleX, canvasHeight - paddleHeight - paddleBottom, paddleWidth, paddleHeight);
}

// ================= アイテム設定 =================
const items = [];
const itemTypes = ["extraBall", "speedUp", "penetrate"];
const itemSize = 12;
const itemSpeed = 3;

function createItem(x, y) {
  // ランダムでアイテムを作る
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  items.push({ x, y, type, width: itemSize, height: itemSize });
}

function drawItems() {
  items.forEach((item) => {
    // 色をタイプで分ける
    if (item.type === "extraBall")
      ctx.fillStyle = "#0f0"; // 緑
    else if (item.type === "speedUp")
      ctx.fillStyle = "#ff0"; // 黄色
    else if (item.type === "penetrate")
      ctx.fillStyle = "#800080"; // 紫
    else ctx.fillStyle = "#fff"; // 念のためのデフォルト

    ctx.fillRect(item.x, item.y, item.width, item.height);
  });
}

function moveItems() {
  items.forEach((item, index) => {
    item.y += itemSpeed;

    // パドルとの当たり判定
    if (
      item.y + item.height >= canvasHeight - paddleHeight - paddleBottom &&
      item.x + item.width >= paddleX &&
      item.x <= paddleX + paddleWidth
    ) {
      applyItemEffect(item.type);
      items.splice(index, 1); // アイテム消す
    }

    // 画面下に到達したら消す
    if (item.y > canvasHeight) {
      items.splice(index, 1);
    }
  });
}

function applyItemEffect(type) {
  if (type === "extraBall") {
    const baseBall = balls[Math.floor(Math.random() * balls.length)];
    balls.push({
      x: baseBall.x,
      y: baseBall.y,
      speedX: baseBall.speedX,
      speedY: -baseBall.speedY,
      radius: baseBall.radius,
      penetrate: false, // 通常はfalse
    });
  } else if (type === "speedUp") {
    balls.forEach((ball) => {
      ball.speedX *= 1.5;
      ball.speedY *= 1.5;
    });
  } else if (type === "penetrate") {
    balls.forEach((ball) => {
      ball.penetrate = true; // 通過可能に
    });
    // 5秒後に解除
    setTimeout(() => {
      balls.forEach((ball) => (ball.penetrate = false));
    }, 5000);
  }
}

// 複数ボール用の配列
let balls = [{ x: ballX, y: ballY, speedX: ballSpeedX, speedY: ballSpeedY, radius: ballRadius }];

function collisionDetection() {
  blocks.forEach((row) => {
    row.forEach((b) => {
      if (!b.destroyed) {
        balls.forEach((ball) => {
          if (
            ball.x + ball.radius > b.x &&
            ball.x - ball.radius < b.x + b.width &&
            ball.y + ball.radius > b.y &&
            ball.y - ball.radius < b.y + b.height
          ) {
            if (!ball.penetrate) ball.speedY = -ball.speedY;
            b.destroyed = true;
            score += 1;
            document.getElementById("score").innerText = "Score: " + score;

            // ここでランダムにアイテムを生成（例: 30%の確率）
            if (Math.random() < 0.3) {
              createItem(b.x + b.width / 2 - itemSize / 2, b.y + b.height / 2 - itemSize / 2);
            }
          }
        });
      }
    });
  });
}

// ============================================================
// ゲーム結果表示
// ============================================================

function drawGameResult(title) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  ctx.font = "bold 36px sans-serif";
  ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 20);

  ctx.font = "20px sans-serif";
  ctx.fillText("Score: " + score, canvasWidth / 2, canvasHeight / 2 + 25);

  ctx.textAlign = "left";
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

  cancelAnimationFrame(animationId);
}

let animationId; // requestAnimationFrame の ID を保持

function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  drawBlocks();
  drawItems();
  drawBalls();
  drawPaddle();

  // ポーズ中はゲームの更新を行わない
  if (paused) {
    return;
  }

  // まずボール移動前に衝突判定
  collisionDetection();
  moveItems();

  // ボール移動と壁・パドル反射
  balls.forEach((ball) => {
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    if (ball.x + ball.radius > canvasWidth || ball.x - ball.radius < 0) ball.speedX = -ball.speedX;
    if (ball.y - ball.radius < 0) ball.speedY = -ball.speedY;

    const paddleY = canvasHeight - paddleHeight - paddleBottom;

    if (
      ball.speedY > 0 &&
      ball.y + ball.radius >= paddleY &&
      ball.y - ball.radius <= paddleY + paddleHeight &&
      ball.x + ball.radius >= paddleX &&
      ball.x - ball.radius <= paddleX + paddleWidth
    ) {
      // ボールをパドルの真上に戻す
      ball.y = paddleY - ball.radius;

      // 必ず上方向へ反射
      ball.speedY = -Math.abs(ball.speedY);
    } else if (ball.y - ball.radius > canvasHeight) {
      // 下に落ちたボールを消す
      balls = balls.filter((b) => b !== ball);
    }
  });

  // クリア判定
  const allDestroyed = blocks.every((row) => row.every((b) => b.destroyed));
  if (allDestroyed) {
    endGame("clear");
    return;
  }

  // ゲームオーバー判定
  if (balls.length === 0 && gameStarted) {
    endGame("over");
    return;
  }

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

  const scaleY = canvasHeight / rect.height;
  const mouseY = (e.clientY - rect.top) * scaleY;

  if (mouseY > canvasHeight - paddleHeight - paddleBottom) {
    isDragging = true;
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    paddleX = (e.clientX - rect.left) * scaleX - paddleWidth / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
  }
});
canvas.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mouseleave", () => (isDragging = false));

canvas.addEventListener("touchstart", (e) => {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];

  const scaleY = canvasHeight / rect.height;

  const touchY = (touch.clientY - rect.top) * scaleY;

  if (touchY > canvasHeight - paddleHeight - paddleBottom) {
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
      const scaleX = canvasWidth / rect.width;
      paddleX = (touch.clientX - rect.left) * scaleX - paddleWidth / 2;
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
  if (animationId) cancelAnimationFrame(animationId);

  // 複数ボール初期化
  balls = [
    {
      x: canvasWidth / 2,
      y: canvasHeight - paddleBottom - paddleHeight - ballRadius - 2,
      speedX: 7,
      speedY: -7,
      radius: ballRadius,
    },
  ];

  paddleX = (canvasWidth - paddleWidth) / 2;
  score = 0;
  rightPressed = false;
  leftPressed = false;
  gameStarted = true;
  document.getElementById("startBtn").textContent = "ゲームリセット";
  gameOver = false;
  gameCleared = false;
  paused = false;
  document.getElementById("pauseBtn").textContent = "⏸";
  createBlocks();
  items.length = 0; // アイテムもリセット
  document.getElementById("score").innerText = "Score: 0";
  draw();
});

// 一時停止ボタン
document.getElementById("pauseBtn").addEventListener("click", () => {
  if (!gameStarted || gameOver) return;

  paused = !paused;

  if (paused) {
    pauseBtn.textContent = "▶";
    pauseBtn.classList.add("small-icon");
    document.getElementById("pauseOverlay").classList.add("active");

    // 現在のアニメーションを停止
    cancelAnimationFrame(animationId);
  } else {
    pauseBtn.textContent = "⏸";
    pauseBtn.classList.remove("small-icon");
    document.getElementById("pauseOverlay").classList.remove("active");

    // アニメーションを再開
    draw();
  }
});
