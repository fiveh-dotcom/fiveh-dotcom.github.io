const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextBlocksCanvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreElem = document.getElementById("score");

const rows = 10;
const cols = 5;
let blockSize = 0;

let grid = [];
let score = 0;
let gameStarted = false;
let gameOver = false;
let gameCleared = false;
let paused = false;
let pausedBeforeReset = false;

let currentBlock = null;
let nextBlocks = [];
let availableNumbers = [2, 4, 8];
let highestUnlockedNumber = 8;
let mergeLock = false; // 合体中フラグ
let isMergeAnimating = false; // マージアニメーション中フラグ

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

function resizeCanvases() {
  const gameWrapper = document.getElementById("gameWrapper");

  const wrapperWidth = Math.min(gameWrapper.clientWidth, 400);

  const gap = 10;
  const nextWidth = wrapperWidth * 0.22;
  const gameWidth = wrapperWidth - nextWidth - gap;

  canvas.width = Math.floor(gameWidth);
  canvas.height = canvas.width * 2;

  blockSize = canvas.width / cols;

  nextCanvas.width = Math.floor(nextWidth);
  nextCanvas.height = Math.floor((nextWidth * 3) / 2);

  // ゲーム終了後のリサイズでも盤面を再描画
  if (gameOver || gameCleared) {
    drawGrid();

    if (gameOver) {
      drawGameResult("GAME OVER");
    } else if (gameCleared) {
      drawGameResult("GAME CLEAR");
    }
  }
}

resizeCanvases();
window.addEventListener("resize", resizeCanvases);

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

  nextCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
}

// ============================================================
// ゲーム終了処理
// ============================================================

function endGame(result) {
  gameStarted = false;
  paused = false;

  if (gameLoopId !== null) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

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

// 描画
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x]) drawCell(x, y, grid[y][x]);

  if (currentBlock) drawCell(currentBlock.x, currentBlock.y, currentBlock.value);
  drawNext();
}

function drawCell(x, y, value, scale = 1) {
  const centerX = (x + 0.5) * blockSize;
  const centerY = (y + 0.5) * blockSize;

  const size = (blockSize - 2) * scale;
  const px = centerX - size / 2;
  const py = centerY - size / 2;

  ctx.fillStyle = getColor(value);
  ctx.fillRect(px, py, size, size);

  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = formatNumber(value);

  drawCenteredText(ctx, text, centerX, centerY, size * 0.8, size * 0.5);

  // 1024以上はキラキラエフェクト
  if (value >= 1024) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;

    ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
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

  // Next用のタイルサイズ
  const size = Math.min(nextCanvas.width - 4, (nextCanvas.height - gap * 2) / 3);

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
  return x >= 0 && x < cols && y >= 0 && y < rows && !grid[y][x];
}

// ============================================================
// 落下
// ============================================================

function drop() {
  if (!currentBlock || mergeLock || paused) return;

  const nextX = currentBlock.x;
  const nextY = currentBlock.y + 1;

  // ----------------------------------------------------------
  // 下に進める
  // ----------------------------------------------------------

  if (canMove(nextX, nextY)) {
    currentBlock.y++;
    return;
  }

  // ----------------------------------------------------------
  // 下のタイルと合体できる場合
  // ----------------------------------------------------------

  if (nextY < rows && grid[nextY][nextX] === currentBlock.value) {
    const movingValue = currentBlock.value;

    // 落下中ブロックの位置
    const fromX = currentBlock.x;
    const fromY = currentBlock.y;

    // 衝突する既存タイルの位置
    const toX = nextX;
    const toY = nextY;

    currentBlock = null;
    mergeLock = true;

    // まだgridには落下中ブロックを入れない。
    // 2つのタイルをアニメーションさせてから実際にマージする。
    animateMerge(fromX, fromY, toX, toY, movingValue).then(() => {
      // 実際にマージ
      const mergedValue = movingValue * 2;

      grid[toY][toX] = mergedValue;

      score += mergedValue;

      // 新しい数字を解禁
      if (mergedValue > highestUnlockedNumber) {
        highestUnlockedNumber = mergedValue;

        if (!availableNumbers.includes(mergedValue)) {
          availableNumbers.push(mergedValue);
        }
      }

      // できたタイルを起点に連鎖処理
      mergeAndFall(toX, toY).then(() => {
        mergeLock = false;

        newBlock();

        if (!canMove(currentBlock.x, currentBlock.y)) {
          endGame("over");
        }
      });
    });

    return;
  }

  // ----------------------------------------------------------
  // 合体できない場合は現在位置に置く
  // ----------------------------------------------------------

  const placedX = currentBlock.x;
  const placedY = currentBlock.y;

  placeBlock();

  mergeLock = true;

  mergeAndFall(placedX, placedY).then(() => {
    mergeLock = false;

    currentBlock = null;
    newBlock();

    if (!canMove(currentBlock.x, currentBlock.y)) {
      endGame("over");
    }
  });
}

function placeBlock() {
  grid[currentBlock.y][currentBlock.x] = currentBlock.value;
}

// ============================================================
// 複数合体 + 下まで落下
// 直前に合体してできたタイルを優先して連鎖させる
// ============================================================

async function mergeAndFall(startX = null, startY = null) {
  // 直前にマージしてできたタイル
  let priorityTile = null;

  if (startX !== null && startY !== null && grid[startY] && grid[startY][startX] != null) {
    priorityTile = {
      x: startX,
      y: startY,
      value: grid[startY][startX],
    };
  }

  while (true) {
    let mergeTarget = null;

    // ========================================================
    // ① 直前にマージしてできたタイルを最優先
    // ========================================================

    if (priorityTile) {
      const { x, y, value } = priorityTile;

      if (y >= 0 && y < rows && x >= 0 && x < cols && grid[y][x] === value) {
        const dirs = [
          [0, 1], // 下
          [1, 0], // 右
          [0, -1], // 上
          [-1, 0], // 左
        ];

        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === value) {
            mergeTarget = {
              fx: x,
              fy: y,
              tx: nx,
              ty: ny,
            };

            break;
          }
        }
      }

      priorityTile = null;
    }

    // ========================================================
    // ② 通常のマージ探索
    //
    // 下の行 → 上の行
    // 左 → 右
    // ========================================================

    if (!mergeTarget) {
      for (let row = rows - 1; row >= 0 && !mergeTarget; row--) {
        for (let col = 0; col < cols && !mergeTarget; col++) {
          if (!grid[row][col]) continue;

          const val = grid[row][col];

          const dirs = [
            [0, 1], // 下
            [1, 0], // 右
            [0, -1], // 上
            [-1, 0], // 左
          ];

          for (const [dx, dy] of dirs) {
            const nx = col + dx;
            const ny = row + dy;

            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === val) {
              mergeTarget = {
                fx: col,
                fy: row,
                tx: nx,
                ty: ny,
              };

              break;
            }
          }
        }
      }
    }

    // ========================================================
    // マージできなければ終了
    // ========================================================

    if (!mergeTarget) {
      break;
    }

    const { fx, fy, tx, ty } = mergeTarget;

    const val = grid[fy][fx];
    const mergedValue = val * 2;

    // ========================================================
    // マージアニメーション
    // ========================================================

    await animateMerge(fx, fy, tx, ty, val);

    // ========================================================
    // 実際にマージ
    // ========================================================

    grid[fy][fx] = mergedValue;
    grid[ty][tx] = null;

    score += mergedValue;

    // ========================================================
    // 新しい数字を解禁
    // ========================================================

    if (mergedValue > highestUnlockedNumber) {
      highestUnlockedNumber = mergedValue;

      if (!availableNumbers.includes(mergedValue)) {
        availableNumbers.push(mergedValue);
      }
    }

    // ========================================================
    // 今作ったタイルを次のマージの最優先にする
    // ========================================================

    priorityTile = {
      x: fx,
      y: fy,
      value: mergedValue,
    };

    // ========================================================
    // 重力
    // ========================================================

    applyGravity();

    drawGrid();

    await sleep(80);

    // ========================================================
    // 重力後の位置を探す
    //
    // 同じ列を優先して探す
    // ========================================================

    priorityTile = findPriorityTile(mergedValue, fx, fy);
  }
}

// ============================================================
// 重力
// ============================================================

function applyGravity() {
  for (let col = 0; col < cols; col++) {
    let writeRow = rows - 1;

    for (let row = rows - 1; row >= 0; row--) {
      if (grid[row][col] !== null) {
        grid[writeRow][col] = grid[row][col];

        if (writeRow !== row) {
          grid[row][col] = null;
        }

        writeRow--;
      }
    }

    while (writeRow >= 0) {
      grid[writeRow][col] = null;
      writeRow--;
    }
  }
}

// ============================================================
// 重力後の「直前にマージしたタイル」を探す
// ============================================================

function findPriorityTile(value, preferredX, preferredY) {
  // ========================================================
  // ① 元の位置にまだあるなら、それが確実に直前のタイル
  // ========================================================

  if (
    preferredY >= 0 &&
    preferredY < rows &&
    preferredX >= 0 &&
    preferredX < cols &&
    grid[preferredY][preferredX] === value
  ) {
    return {
      x: preferredX,
      y: preferredY,
      value: value,
    };
  }

  // ========================================================
  // ② 重力で下に移動した可能性があるので、
  //    同じ列から探す
  // ========================================================

  for (let row = rows - 1; row >= 0; row--) {
    if (grid[row][preferredX] === value) {
      return {
        x: preferredX,
        y: row,
        value: value,
      };
    }
  }

  // ========================================================
  // ③ 同じ列にない場合は、元の位置から近いものを探す
  // ========================================================

  let best = null;
  let bestDistance = Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== value) continue;

      const distance = Math.abs(col - preferredX) + Math.abs(row - preferredY);

      if (distance < bestDistance) {
        bestDistance = distance;

        best = {
          x: col,
          y: row,
          value: value,
        };
      }
    }
  }

  return best;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// マージアニメーション
//
// ① 2つのタイルが近づく
// ② 接触直前に少し縮む
// ③ 合体
// ④ 合体後のタイルがポンッと拡大
// ============================================================

async function animateMerge(fx, fy, tx, ty, val) {
  isMergeAnimating = true;

  const duration = 220;
  const startTime = performance.now();

  const centerX = (fx + tx) / 2;
  const centerY = (fy + ty) / 2;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ==========================================================
  // ① 2つのタイルが近づく
  // ==========================================================

  while (true) {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);

    const eased = easeInOut(t);

    const x1 = fx + (centerX - fx) * eased;
    const y1 = fy + (centerY - fy) * eased;

    const x2 = tx + (centerX - tx) * eased;
    const y2 = ty + (centerY - ty) * eased;

    // 接触直前に少し縮む
    const scale = t > 0.7 ? 1 - ((t - 0.7) / 0.3) * 0.15 : 1;

    drawGrid();

    // 元の2タイルを消す
    ctx.clearRect(fx * blockSize - 4, fy * blockSize - 4, blockSize + 8, blockSize + 8);

    ctx.clearRect(tx * blockSize - 4, ty * blockSize - 4, blockSize + 8, blockSize + 8);

    // 2つのタイルを中央へ
    drawCell(x1, y1, val, scale);
    drawCell(x2, y2, val, scale);

    if (t >= 1) break;

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  // ==========================================================
  // ② 合体した瞬間
  // ==========================================================

  const popSteps = 8;

  for (let i = 0; i <= popSteps; i++) {
    const t = i / popSteps;

    let scale;

    if (t < 0.5) {
      // 1 → 1.18
      scale = 1 + 0.18 * (t / 0.5);
    } else {
      // 1.18 → 1
      scale = 1.18 - 0.18 * ((t - 0.5) / 0.5);
    }

    drawGrid();

    // 元の2タイルを消す
    ctx.clearRect(fx * blockSize - 5, fy * blockSize - 5, blockSize + 10, blockSize + 10);

    ctx.clearRect(tx * blockSize - 5, ty * blockSize - 5, blockSize + 10, blockSize + 10);

    // 合体後の数字
    drawCell(centerX, centerY, val * 2, scale);

    await sleep(20);
  }

  isMergeAnimating = false;

  drawGrid();
}

// キー操作
document.addEventListener("keydown", (e) => {
  if (!gameStarted || !currentBlock || paused) return;
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
  if (!gameStarted || !currentBlock || mergeLock || paused) return;

  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();

  // Canvas内でタッチしたか確認
  if (
    touch.clientX < rect.left ||
    touch.clientX > rect.right ||
    touch.clientY < rect.top ||
    touch.clientY > rect.bottom
  ) {
    return;
  }

  // Canvas内なら現在のタイルをつかむ
  touchPrevX = touch.clientX;
  touchPrevY = touch.clientY;
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
  if (!isTouching || !currentBlock || paused) return;

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

window.addEventListener("touchend", (e) => {
  if (!isTouching) return;

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
  dropCounter = 0;
});

// ============================================================
// ゲームループ
// ============================================================

let lastTime = 0;
let dropCounter = 0;
let dropInterval = 500;
let gameLoopId = null;

function gameLoop(time = performance.now()) {
  if (!gameStarted) {
    gameLoopId = null;
    return;
  }

  if (paused) {
    lastTime = time;
    gameLoopId = requestAnimationFrame(gameLoop);
    return;
  }

  const delta = time - lastTime;
  lastTime = time;

  // ----------------------------------------------------------
  // マージアニメーション中は落下させない
  // ----------------------------------------------------------

  if (!mergeLock) {
    dropCounter += delta;

    if (dropCounter > dropInterval) {
      drop();
      dropCounter = 0;
    }
  }

  // ----------------------------------------------------------
  // マージアニメーション中は
  // animateMerge() 側が描画を担当する
  // ----------------------------------------------------------

  if (!isMergeAnimating) {
    drawGrid();
  }

  scoreElem.innerText = "Score: " + score;

  gameLoopId = requestAnimationFrame(gameLoop);
}

const resetDialog = createResetDialog({
  // 「リセット」が押された
  onConfirm: () => {
    startGame();
  },

  // 「キャンセル」が押された
  onCancel: () => {
    paused = pausedBeforeReset;

    // 確認中に経過した時間を落下判定に含めない
    lastTime = performance.now();
  },
});

// スタートボタン
document.getElementById("startBtn").addEventListener("click", () => {
  // マージ中は操作しない
  if (mergeLock) return;

  // ゲーム中なら確認ダイアログを表示
  if (gameStarted && !gameOver && !gameCleared) {
    pausedBeforeReset = paused;

    // 確認中はゲームを停止
    paused = true;

    resetDialog.show();

    return;
  }

  startGame();
});

// ゲーム開始・リセット処理
function startGame() {
  // 既存のゲームループを停止
  if (gameLoopId !== null) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  score = 0;

  mergeLock = false;
  isMergeAnimating = false;

  availableNumbers = [2, 4, 8];
  highestUnlockedNumber = 8;

  initGrid();

  nextBlocks = [];
  newBlock();

  gameStarted = true;
  gameOver = false;
  gameCleared = false;
  paused = false;

  document.getElementById("startBtn").textContent = "ゲームリセット";

  pauseControl.update();

  dropCounter = 0;
  lastTime = performance.now();

  gameLoop();
}

// 一時停止ボタン
const pauseControl = createPauseButton({
  canToggle: () => gameStarted && !gameOver && !mergeLock,

  isPaused: () => paused,

  onPause: () => {
    paused = true;
  },

  onResume: () => {
    paused = false;

    // 一時停止中の時間を落下判定に含めない
    lastTime = performance.now();
  },
});
