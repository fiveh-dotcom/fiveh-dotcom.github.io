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
  2: "#D95ABF", // ピンク
  4: "#82B64A", // グリーン
  8: "#42C6C7", // シアン
  16: "#637DDA", // ブルー
  32: "#E58752", // オレンジ
  64: "#9775FF", // パープル
  128: "#8DB6C7", // ライトブルー
  256: "#FF4D70", // ピンク
  512: "#00B878", // グリーン
  1024: "#9BA8A8", // グレー
  2048: "#FF8200", // オレンジ
  4096: "#A05BE8", // パープル
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

  // Canvasのサイズ変更で描画内容が消えるため、盤面を再描画
  if (gameStarted) {
    drawGrid();
  }

  // ゲーム終了後は結果表示も再描画
  if (gameOver || gameCleared) {
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

  const size = blockSize * scale;

  drawBlock(ctx, centerX, centerY, size, value);
}

// ============================================================
// 安全な角丸矩形
//
// ・width / height が小さくなってもエラーにしない
// ・radius が負にならないようにする
// ・radius が矩形サイズを超えないようにする
// ============================================================

function roundRectSafe(ctx, x, y, width, height, radius) {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));

  ctx.roundRect(x, y, w, h, r);
}

// ============================================================
// ブロック共通描画
//
// ・Block Dropping Merge風
// ・角は少し丸める
// ・濃い外周＋細い内枠
// ・4096以上は金色の特別フレーム＋王冠
// ・4096以上は数字を少し小さくして下側へ配置
// ============================================================

function drawBlock(ctx, centerX, centerY, size, value) {
  const px = centerX - size / 2;
  const py = centerY - size / 2;

  // ----------------------------------------------------------
  // 高レベル判定
  // ----------------------------------------------------------

  const isHigh = value >= 1024;
  const isSpecial = value >= 4096;

  // 角の丸み
  const radius = Math.min(size * 0.12, 6, size / 2);

  // 外枠の太さ
  const border = Math.min(Math.max(1, size * 0.025), size / 4);

  // ==========================================================
  // 外側のフレーム
  // ==========================================================

  ctx.beginPath();

  roundRectSafe(ctx, px, py, size, size, radius);

  ctx.fillStyle = isSpecial ? "#3A2A18" : "#222";

  ctx.fill();

  // ==========================================================
  // タイル本体
  // ==========================================================

  const innerSize = Math.max(0, size - border * 2);
  const innerRadius = Math.min(Math.max(0, radius - border), innerSize / 2);

  ctx.beginPath();

  roundRectSafe(ctx, px + border, py + border, innerSize, innerSize, innerRadius);

  ctx.fillStyle = getColor(value);
  ctx.fill();

  // ==========================================================
  // 通常の内側ライン
  // ==========================================================

  const lineInset = border + 1;
  const lineSize = Math.max(0, size - lineInset * 2);

  const lineRadius = Math.min(Math.max(0, radius - lineInset), lineSize / 2);

  ctx.beginPath();

  roundRectSafe(ctx, px + lineInset, py + lineInset, lineSize, lineSize, lineRadius);

  ctx.strokeStyle = isSpecial ? "#FFD75A" : isHigh ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.25)";

  ctx.lineWidth = isSpecial
    ? Math.min(Math.max(1, size * 0.035), lineSize / 2)
    : isHigh
      ? Math.min(Math.max(1, size * 0.03), lineSize / 2)
      : 1;

  ctx.stroke();

  // ==========================================================
  // 上側ハイライト
  // ==========================================================

  ctx.beginPath();

  ctx.moveTo(px + border + radius * 0.5, py + border + 1);

  ctx.lineTo(px + size - border - radius * 0.5, py + border + 1);

  ctx.strokeStyle = isSpecial ? "rgba(255, 230, 130, 0.95)" : "rgba(255, 255, 255, 0.35)";

  ctx.lineWidth = 1;

  ctx.stroke();

  // ==========================================================
  // 1024以上：銀色の特別フレーム
  //
  // 4096未満は銀枠
  // 4096以上は金枠＋王冠
  // ==========================================================

  if (isHigh && !isSpecial) {
    const silver = "#E2E5E9";

    const frameInset = Math.min(Math.max(1, size * 0.07), size / 4);

    const frameSize = Math.max(0, size - frameInset * 2);

    const frameRadius = Math.min(Math.max(0, radius - frameInset * 0.5), frameSize / 2);

    ctx.beginPath();

    roundRectSafe(ctx, px + frameInset, py + frameInset, frameSize, frameSize, frameRadius);

    ctx.strokeStyle = silver;
    ctx.lineWidth = Math.min(Math.max(1, size * 0.035), frameSize / 2);

    ctx.stroke();
  }

  // ==========================================================
  // 4096以上：金色の特別フレーム
  //
  // ブロックの外には出さず、
  // ブロックサイズの内側に金枠を追加する
  // ==========================================================

  if (isSpecial) {
    const gold = "#FFD34D";

    // --------------------------------------------------------
    // 金色の内側フレーム
    // --------------------------------------------------------

    const frameInset = Math.min(Math.max(1, size * 0.07), size / 4);

    const frameSize = Math.max(0, size - frameInset * 2);

    const frameRadius = Math.min(Math.max(0, radius - frameInset * 0.5), frameSize / 2);

    ctx.beginPath();

    roundRectSafe(ctx, px + frameInset, py + frameInset, frameSize, frameSize, frameRadius);

    ctx.strokeStyle = gold;
    ctx.lineWidth = Math.min(Math.max(1, size * 0.035), frameSize / 2);

    ctx.stroke();

    // --------------------------------------------------------
    // 四隅の金色装飾
    // --------------------------------------------------------

    const ornament = Math.max(3, size * 0.09);

    const offset = frameInset + size * 0.025;

    ctx.strokeStyle = "#FFE27A";
    ctx.lineWidth = Math.max(1, size * 0.022);
    ctx.lineCap = "round";

    // 左上
    ctx.beginPath();
    ctx.moveTo(px + offset, py + offset + ornament);
    ctx.lineTo(px + offset, py + offset);
    ctx.lineTo(px + offset + ornament, py + offset);
    ctx.stroke();

    // 右上
    ctx.beginPath();
    ctx.moveTo(px + size - offset - ornament, py + offset);
    ctx.lineTo(px + size - offset, py + offset);
    ctx.lineTo(px + size - offset, py + offset + ornament);
    ctx.stroke();

    // 左下
    ctx.beginPath();
    ctx.moveTo(px + offset, py + size - offset - ornament);
    ctx.lineTo(px + offset, py + size - offset);
    ctx.lineTo(px + offset + ornament, py + size - offset);
    ctx.stroke();

    // 右下
    ctx.beginPath();
    ctx.moveTo(px + size - offset - ornament, py + size - offset);
    ctx.lineTo(px + size - offset, py + size - offset);
    ctx.lineTo(px + size - offset, py + size - offset - ornament);
    ctx.stroke();

    ctx.lineCap = "butt";

    // --------------------------------------------------------
    // 王冠
    // --------------------------------------------------------

    drawCrown(ctx, centerX, py + size * 0.3, size * 0.34);
  }

  // ==========================================================
  // 数字
  // ==========================================================

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = formatNumber(value);

  // 4096以上は数字を少し下へ
  const textY = isSpecial ? centerY + size * 0.15 : centerY;

  // 4096以上は少し小さくする
  const textMaxWidth = isSpecial ? size * 0.72 : size * 0.8;

  const textBaseSize = isSpecial ? size * 0.44 : size * 0.5;

  // ----------------------------------------------------------
  // 文字の影・縁
  // ----------------------------------------------------------

  ctx.strokeStyle = isSpecial ? "rgba(60, 35, 0, 0.8)" : "rgba(0, 0, 0, 0.45)";

  ctx.lineWidth = Math.max(1.5, size * 0.025);
  ctx.lineJoin = "round";

  drawCenteredText(ctx, text, centerX, textY, textMaxWidth, textBaseSize);

  // ----------------------------------------------------------
  // 数字本体
  // ----------------------------------------------------------

  ctx.fillStyle = "#fff";

  drawCenteredText(ctx, text, centerX, textY, textMaxWidth, textBaseSize);
}

// ============================================================
// 王冠描画
//
// ・4096以上専用
// ・数字の上に配置
// ・左・中央・右の3つの尖った山で王冠らしくする
// ・中央の山を一番高くする
// ・下に太い帯を付ける
// ・3つの宝石を配置
// ============================================================

function drawCrown(ctx, centerX, centerY, width) {
  const height = width * 0.78;

  const left = centerX - width / 2;
  const right = centerX + width / 2;

  const top = centerY - height / 2;
  const bottom = centerY + height / 2;

  // ==========================================================
  // 王冠本体
  // ==========================================================

  ctx.beginPath();

  ctx.moveTo(left, bottom);

  // ==========================================================
  // 左の山
  // ==========================================================

  // 左端から左の山へ
  ctx.lineTo(left, top + height * 0.3);

  // 左の谷
  ctx.lineTo(centerX - width * 0.24, top + height * 0.62);

  // ==========================================================
  // 中央の山
  // ==========================================================

  ctx.lineTo(centerX, top + height * 0.08);

  // ==========================================================
  // 右の谷
  // ==========================================================

  ctx.lineTo(centerX + width * 0.24, top + height * 0.62);

  // ==========================================================
  // 右の山
  // ==========================================================

  // 右の山の頂点
  ctx.lineTo(right, top + height * 0.3);

  // 右端へ
  ctx.lineTo(right, bottom);

  ctx.closePath();

  // 王冠本体
  ctx.fillStyle = "#FFD34D";
  ctx.fill();

  // 王冠の外周
  ctx.strokeStyle = "#FFE27A";
  ctx.lineWidth = Math.max(1, width * 0.035);
  ctx.lineJoin = "round";
  ctx.stroke();

  // ==========================================================
  // 王冠の帯
  // ==========================================================

  const bandTop = bottom - height * 0.25;
  const bandHeight = height * 0.25;
  const bandWidth = width * 0.92;
  const bandRadius = Math.min(height * 0.04, bandWidth / 2, bandHeight / 2);

  ctx.beginPath();

  roundRectSafe(ctx, left + width * 0.04, bandTop, bandWidth, bandHeight, bandRadius);

  ctx.fillStyle = "#FFE27A";
  ctx.fill();

  // 帯の下側ライン
  ctx.beginPath();

  ctx.moveTo(left + width * 0.06, bottom - height * 0.04);

  ctx.lineTo(right - width * 0.06, bottom - height * 0.04);

  ctx.strokeStyle = "#D99E25";
  ctx.lineWidth = Math.max(1, width * 0.025);
  ctx.stroke();

  // ==========================================================
  // 王冠の宝石
  //
  // 左   ：ルビー
  // 中央 ：サファイア
  // 右   ：エメラルド
  // ==========================================================

  const jewelRadius = Math.max(1, width * 0.045);

  function drawJewel(x, y, radius, darkColor, mainColor, lightColor) {
    // --------------------------------------------------------
    // 外側
    // --------------------------------------------------------

    ctx.beginPath();

    ctx.arc(x, y, radius, 0, Math.PI * 2);

    ctx.fillStyle = darkColor;
    ctx.fill();

    // --------------------------------------------------------
    // 宝石本体
    // --------------------------------------------------------

    ctx.beginPath();

    ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);

    ctx.fillStyle = mainColor;
    ctx.fill();

    // --------------------------------------------------------
    // ハイライト
    // --------------------------------------------------------

    ctx.beginPath();

    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.22, 0, Math.PI * 2);

    ctx.fillStyle = lightColor;
    ctx.fill();
  }

  // ----------------------------------------------------------
  // 左：ルビー
  // ----------------------------------------------------------

  drawJewel(left + width * 0.25, bandTop + bandHeight * 0.4, jewelRadius, "#7A1020", "#E3263F", "#FF9AA5");

  // ----------------------------------------------------------
  // 中央：サファイア
  // ----------------------------------------------------------

  drawJewel(centerX, bandTop + bandHeight * 0.4, jewelRadius * 1.2, "#123A78", "#2878E8", "#A9D5FF");

  // ----------------------------------------------------------
  // 右：エメラルド
  // ----------------------------------------------------------

  drawJewel(right - width * 0.25, bandTop + bandHeight * 0.4, jewelRadius, "#075A3B", "#16B978", "#9CFFD8");
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

  const gap = 5;

  // Next用のタイルサイズ
  const size = Math.max(0, Math.min(nextCanvas.width - 4, (nextCanvas.height - gap * 2) / 3));

  nextBlocks.forEach((val, i) => {
    const x = (nextCanvas.width - size) / 2;
    const y = i * (size + gap);

    const centerX = x + size / 2;
    const centerY = y + size / 2;

    drawBlock(nextCtx, centerX, centerY, size, val);
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
    // マージ中は落下中ブロックを描画しない
    // ========================================================

    currentBlock = null;

    // ========================================================
    // マージする2タイルを先にgridから消す
    //
    // animateMerge()中にdrawGrid()が呼ばれるため、
    // アニメーション中に元のタイルが再描画されないようにする。
    // ========================================================

    grid[fy][fx] = null;
    grid[ty][tx] = null;

    // ========================================================
    // マージアニメーション
    // ========================================================

    await animateMerge(fx, fy, tx, ty, val);

    // ========================================================
    // 実際にマージ
    // ========================================================

    grid[fy][fx] = mergedValue;

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
    // 重力
    // ========================================================

    applyGravity();

    drawGrid();

    // ========================================================
    // 重力後の「直前にマージしたタイル」を探す
    // ========================================================

    priorityTile = findPriorityTile(mergedValue, fx, fy);

    // ========================================================
    // 次の連鎖が実際に可能か確認
    // ========================================================

    let canChain = false;

    if (priorityTile) {
      const { x, y, value } = priorityTile;

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
          canChain = true;
          break;
        }
      }
    }

    // ========================================================
    // 連鎖が続く場合だけ少し待つ
    //
    // 最後のマージなら待たずに次のブロックへ進む。
    // ========================================================

    if (canChain) {
      await sleep(80);
    }
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
//
// ※ アニメーション時間はrequestAnimationFrameで管理
//    sleep()は使用しない
// ============================================================

async function animateMerge(fx, fy, tx, ty, val) {
  isMergeAnimating = true;

  const duration = 220;
  const popDuration = 160;

  const centerX = (fx + tx) / 2;
  const centerY = (fy + ty) / 2;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ==========================================================
  // ① 2つのタイルが近づく
  // ==========================================================

  const startTime = performance.now();

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
    ctx.clearRect(fx * blockSize, fy * blockSize, blockSize, blockSize);

    ctx.clearRect(tx * blockSize, ty * blockSize, blockSize, blockSize);

    // 2つのタイルを中央へ
    drawCell(x1, y1, val, scale);
    drawCell(x2, y2, val, scale);

    if (t >= 1) {
      break;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  // ==========================================================
  // ② 合体後のタイルがポンッと拡大
  // ==========================================================

  const popStartTime = performance.now();

  while (true) {
    const elapsed = performance.now() - popStartTime;
    const t = Math.min(elapsed / popDuration, 1);

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
    ctx.clearRect(fx * blockSize, fy * blockSize, blockSize, blockSize);

    ctx.clearRect(tx * blockSize, ty * blockSize, blockSize, blockSize);

    // 合体後の数字
    drawCell(centerX, centerY, val * 2, scale);

    if (t >= 1) {
      break;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  // ==========================================================
  // アニメーション終了
  // ==========================================================

  isMergeAnimating = false;
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

// ============================================================
// スマホ操作（Pointer Events）
//
// ・操作開始はcanvas内のみ
// ・タップ → 通常通り落下
// ・長押し → 通常通り落下
// ・横ドラッグ → ブロックを横移動
// ・下方向ドラッグ → ブロックを1マスずつ高速落下
// ・上方向スワイプ → 一気に最下部まで高速落下
// ・canvas外へ出ても急降下しない
// ・タップ終了時にdropCounterをリセットしない
// ============================================================

let isTouching = false;
let touchPrevX = 0;
let touchPrevY = 0;
let touchStartY = 0;
let touchMoveY = 0;
let activePointerId = null;

// ============================================================
// タッチ開始
// ============================================================

canvas.addEventListener("pointerdown", (e) => {
  // スマホ・タブレットのタッチ操作だけを対象
  if (e.pointerType !== "touch") {
    return;
  }

  // ゲーム中でなければ操作しない
  if (!gameStarted || !currentBlock || mergeLock || paused) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  // ----------------------------------------------------------
  // canvas内から開始したタッチだけを受け付ける
  // ----------------------------------------------------------

  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
    return;
  }

  // ----------------------------------------------------------
  // タッチ開始位置を保存
  // ----------------------------------------------------------

  isTouching = true;
  activePointerId = e.pointerId;

  touchPrevX = e.clientX;
  touchPrevY = e.clientY;
  touchStartY = e.clientY;
  touchMoveY = 0;

  // 指がcanvas外へ出てもイベントを受け取り続ける
  canvas.setPointerCapture(e.pointerId);

  // ブラウザのスクロール・ジェスチャーを防止
  e.preventDefault();
});

// ============================================================
// タッチ移動
// ============================================================

canvas.addEventListener("pointermove", (e) => {
  // 操作中でなければ何もしない
  if (!isTouching) {
    return;
  }

  // 操作中の指以外は無視
  if (e.pointerId !== activePointerId) {
    return;
  }

  if (!currentBlock || paused || mergeLock) {
    return;
  }

  e.preventDefault();

  const rect = canvas.getBoundingClientRect();

  // ==========================================================
  // 指の位置
  //
  // canvas外へ出た場合でも、
  // 横方向はcanvasの端より外側を移動量として扱わない。
  //
  // これにより、高速スワイプでclientXが大きくジャンプしても
  // ブロックが一気に右端・左端へ飛ぶのを防ぐ。
  // ==========================================================

  const clampedX = Math.max(rect.left, Math.min(e.clientX, rect.right));

  // ----------------------------------------------------------
  // 指の移動量
  // ----------------------------------------------------------

  const dx = clampedX - touchPrevX;
  const dy = e.clientY - touchPrevY;

  // ==========================================================
  // 横ドラッグ
  //
  // 指を横にblockSize/2以上動かしたら1マス移動
  // ==========================================================

  if (Math.abs(dx) > blockSize / 2) {
    if (dx > 0 && canMove(currentBlock.x + 1, currentBlock.y)) {
      currentBlock.x++;
    } else if (dx < 0 && canMove(currentBlock.x - 1, currentBlock.y)) {
      currentBlock.x--;
    }

    // 次回の横方向の基準位置
    touchPrevX = clampedX;
  }

  // ==========================================================
  // 下方向ドラッグ
  //
  // 下方向への移動量を累積する。
  // blockSize/2以上たまるたびに1マス落下。
  // 上方向へ戻した場合は累積量も減る。
  // ==========================================================

  touchMoveY += dy;

  if (touchMoveY >= blockSize / 2) {
    drop();

    // 余った移動量を残す
    touchMoveY -= blockSize / 2;
  } else if (touchMoveY < 0) {
    // 上方向へ戻した分は累積をリセット
    touchMoveY = 0;
  }

  // 次回の移動量計算用
  touchPrevY = e.clientY;
});

// ============================================================
// タッチ終了
// ============================================================

canvas.addEventListener("pointerup", (e) => {
  // 操作中でなければ何もしない
  if (!isTouching) {
    return;
  }

  // 操作中の指以外は無視
  if (e.pointerId !== activePointerId) {
    return;
  }

  // ----------------------------------------------------------
  // pointerup時点の位置
  // ----------------------------------------------------------

  const endY = e.clientY;

  // タッチ終了
  isTouching = false;
  activePointerId = null;

  // ==========================================================
  // 上方向スワイプ
  //
  // canvas内で開始して、
  // 指を上方向へ20px以上動かして離した場合だけ高速落下
  //
  // canvas外へ出た場合でもpointer captureでイベントは届くが、
  // 上スワイプとして扱わない。
  // ==========================================================

  const rect = canvas.getBoundingClientRect();

  const startedInside = touchStartY >= rect.top && touchStartY <= rect.bottom;

  const endedInside = endY >= rect.top && endY <= rect.bottom;

  const totalDy = endY - touchStartY;

  if (startedInside && endedInside && totalDy < -20 && currentBlock && !paused && !mergeLock) {
    // 一気に最下部まで落とす
    while (canMove(currentBlock.x, currentBlock.y + 1)) {
      currentBlock.y++;
    }

    // 到達した位置で設置・マージ処理
    drop();
  }

  // ----------------------------------------------------------
  // 重要：
  //
  // dropCounter = 0 は絶対にしない。
  //
  // タップ連打しても落下時間は蓄積する。
  // ----------------------------------------------------------

  // Pointer Capture解除
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
});

// ============================================================
// タッチキャンセル
// ============================================================

canvas.addEventListener("pointercancel", (e) => {
  if (e.pointerId !== activePointerId) {
    return;
  }

  isTouching = false;
  activePointerId = null;

  // ここでもdropCounterはリセットしない

  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
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
