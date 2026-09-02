const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const canvasSize = 600;

canvas.width = canvasSize;
canvas.height = canvasSize;

// ============================================================
// 基本設定
// ============================================================

const rows = 6;
const cols = 6;

let blockSize = canvasSize / cols;

let blocks = [];

// 現在のステージの初期配置
let initialBlocks = [];

let score = 0;
let stage = 1;

let gameStarted = false;
let gameCleared = false;

let selectedBlock = null;

let dragOffsetX = 0;
let dragOffsetY = 0;

let pointerStartX = 0;
let pointerStartY = 0;

let lastPointerX = 0;
let lastPointerY = 0;

// クリア演出中
let exitingTarget = false;
let exitAnimationId = null;

const colors = [
  "#4a90e2",
  "#50c878",
  "#f5a623",
  "#9b59b6",
  "#e67e22",
  "#3498db",
  "#1abc9c",
  "#8e44ad",
  "#2ecc71",
  "#e74c3c",
  "#16a085",
  "#d35400",
];

// ============================================================
// ブロック生成
// ============================================================

function createBlock(id, row, col, length, direction, color, isTarget = false) {
  const block = {
    id,
    row,
    col,
    length,
    direction,
    color,
    isTarget,

    // 実際の描画位置
    x: col * blockSize,
    y: row * blockSize,
  };

  return block;
}

// ============================================================
// 基準となる完成状態
//
// この状態から合法的な移動をランダムに逆再生して
// ステージを作る。
// そのため、生成されたステージは必ずクリア可能。
// ============================================================

// ============================================================
// ランダム盤面生成
// ============================================================

function generateRandomLayout() {
  const newBlocks = [];

  // ------------------------------------------------------------
  // 赤ブロック
  //
  // 必ず中央の出口と同じ2行目。
  // 最初は左側に配置する。
  // ------------------------------------------------------------

  newBlocks.push(createBlock(0, 2, 0, 2, "horizontal", "#e53935", true));

  // ------------------------------------------------------------
  // その他のブロック
  // ------------------------------------------------------------

  let blockCount;

  if (stage <= 3) {
    blockCount = 9;
  } else {
    blockCount = 10;
  }

  let attempts = 0;
  let id = 1;

  while (newBlocks.length < blockCount + 1 && attempts < 3000) {
    attempts++;

    const direction = Math.random() < 0.5 ? "horizontal" : "vertical";

    const length = Math.random() < 0.75 ? 2 : 3;

    let row;
    let col;

    if (direction === "horizontal") {
      row = Math.floor(Math.random() * rows);
      col = Math.floor(Math.random() * (cols - length + 1));
    } else {
      row = Math.floor(Math.random() * (rows - length + 1));
      col = Math.floor(Math.random() * cols);
    }

    const candidate = {
      row,
      col,
      length,
      direction,
    };

    if (layoutOverlaps(candidate, newBlocks)) {
      continue;
    }

    // 赤ブロックのすぐ右側を
    // 最初から空けすぎないようにする
    if (direction === "horizontal" && row === 2 && col < 5) {
      continue;
    }

    newBlocks.push(createBlock(id++, row, col, length, direction, colors[(id - 1) % colors.length]));
  }

  if (newBlocks.length !== blockCount + 1) {
    return null;
  }

  return newBlocks;
}

// ============================================================
// 重なりチェック
// ============================================================

function layoutOverlaps(candidate, list) {
  for (const block of list) {
    for (let i = 0; i < candidate.length; i++) {
      const r1 = candidate.row + (candidate.direction === "vertical" ? i : 0);

      const c1 = candidate.col + (candidate.direction === "horizontal" ? i : 0);

      for (let j = 0; j < block.length; j++) {
        const r2 = block.row + (block.direction === "vertical" ? j : 0);

        const c2 = block.col + (block.direction === "horizontal" ? j : 0);

        if (r1 === r2 && c1 === c2) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================================
// 盤面上のブロック位置を調べる
// ============================================================

function getOccupiedCells(excludeBlock = null) {
  const occupied = [];

  for (const block of blocks) {
    if (block === excludeBlock) {
      continue;
    }

    for (let i = 0; i < block.length; i++) {
      let row = block.row;
      let col = block.col;

      if (block.direction === "horizontal") {
        col += i;
      } else {
        row += i;
      }

      occupied.push({ row, col });
    }
  }

  return occupied;
}

// ============================================================
// 指定ブロックを指定方向へ移動できるか
// ============================================================

function canMove(block, delta, blockList = blocks) {
  const newRow = block.direction === "vertical" ? block.row + delta : block.row;

  const newCol = block.direction === "horizontal" ? block.col + delta : block.col;

  // 盤面外
  if (block.direction === "horizontal") {
    if (newCol < 0 || newCol + block.length > cols) {
      return false;
    }
  } else {
    if (newRow < 0 || newRow + block.length > rows) {
      return false;
    }
  }

  for (const other of blockList) {
    if (other === block) {
      continue;
    }

    for (let i = 0; i < block.length; i++) {
      const row = newRow + (block.direction === "vertical" ? i : 0);

      const col = newCol + (block.direction === "horizontal" ? i : 0);

      for (let j = 0; j < other.length; j++) {
        const otherRow = other.row + (other.direction === "vertical" ? j : 0);

        const otherCol = other.col + (other.direction === "horizontal" ? j : 0);

        if (row === otherRow && col === otherCol) {
          return false;
        }
      }
    }
  }

  return true;
}

// ============================================================
// ブロックを移動
// ============================================================

function moveBlock(block, delta) {
  if (!canMove(block, delta)) {
    return false;
  }

  if (block.direction === "horizontal") {
    block.col += delta;
  } else {
    block.row += delta;
  }

  return true;
}

// ============================================================
// ランダムな合法移動を取得
// ============================================================

function getPossibleMoves() {
  const moves = [];

  for (const block of blocks) {
    if (canMove(block, -1)) {
      moves.push({
        block,
        delta: -1,
      });
    }

    if (canMove(block, 1)) {
      moves.push({
        block,
        delta: 1,
      });
    }
  }

  return moves;
}

// ============================================================
// ステージ生成
// ============================================================

function generateStage() {
  exitingTarget = false;
  gameCleared = false;

  let generated = null;
  let generatedMoves = null;

  let minimumMoves;

  if (stage <= 3) {
    minimumMoves = 12 + stage * 2;
  } else {
    minimumMoves = Math.min(18 + (stage - 4), 24);
  }

  // ----------------------------------------------------------
  // 条件を満たすステージを探す
  // ----------------------------------------------------------

  for (let attempt = 0; attempt < 300; attempt++) {
    const candidate = generateRandomLayout();

    if (!candidate) {
      continue;
    }

    const solutionMoves = getMinimumSolutionMoves(candidate, 50);

    // 解けない盤面は絶対に採用しない
    if (solutionMoves === null) {
      continue;
    }

    // 難易度条件
    if (solutionMoves >= minimumMoves) {
      generated = candidate;
      generatedMoves = solutionMoves;

      console.log(`Stage ${stage}: minimum moves = ${solutionMoves}`);

      break;
    }
  }

  // ----------------------------------------------------------
  // 条件を満たす盤面が見つからなかった場合
  // ----------------------------------------------------------

  if (!generated) {
    console.warn(`Stage ${stage}: difficulty condition not met.`);

    // 最低限「解ける」盤面を探す
    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate = generateRandomLayout();

      if (!candidate) {
        continue;
      }

      const solutionMoves = getMinimumSolutionMoves(candidate, 50);

      if (solutionMoves !== null) {
        generated = candidate;
        generatedMoves = solutionMoves;

        console.warn(`Stage ${stage}: fallback minimum moves = ${solutionMoves}`);

        break;
      }
    }
  }

  // ----------------------------------------------------------
  // それでも生成できなかった場合
  // ----------------------------------------------------------

  if (!generated) {
    console.error(`Stage ${stage}: could not generate a solvable stage.`);

    return;
  }

  blocks = generated;

  // 現在のステージの初期配置を保存
  initialBlocks = generated.map((block) => ({
    ...block,
  }));

  // 描画位置を初期化
  for (const block of blocks) {
    block.x = block.col * blockSize;
    block.y = block.row * blockSize;
  }
}

// ============================================================
// ステージ生成（ローディング表示付き）
// ============================================================

function generateStageWithLoading() {
  showGameLoading("ステージ生成中…");

  // ローディング画面を確実に描画させてから
  // 重いステージ生成処理を開始するため、2回待つ
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      generateStage();

      hideGameLoading();

      draw();
    });
  });
}

// ============================================================
// 盤面を文字列化
// ============================================================

function getStateKey(state) {
  return state.map((block) => `${block.row},${block.col}`).join("|");
}

// ============================================================
// 解答手数を調べる
// ============================================================

function getMinimumSolutionMoves(initialBlocks, maxDepth = 30) {
  const startState = initialBlocks.map((block) => ({
    row: block.row,
    col: block.col,
  }));

  const queue = [
    {
      state: startState,
      depth: 0,
    },
  ];

  const visited = new Set();

  visited.add(getStateKey(startState));

  while (queue.length > 0) {
    const current = queue.shift();

    // 赤ブロックが出口に到達
    const target = current.state[0];

    if (target.row === 2 && target.col + initialBlocks[0].length === cols) {
      return current.depth;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const tempBlocks = initialBlocks.map((block, index) => ({
      ...block,
      row: current.state[index].row,
      col: current.state[index].col,
    }));

    for (let i = 0; i < tempBlocks.length; i++) {
      const block = tempBlocks[i];

      for (const delta of [-1, 1]) {
        if (!canMove(block, delta, tempBlocks)) {
          continue;
        }

        const nextState = current.state.map((pos) => ({
          row: pos.row,
          col: pos.col,
        }));

        if (block.direction === "horizontal") {
          nextState[i].col += delta;
        } else {
          nextState[i].row += delta;
        }

        const key = getStateKey(nextState);

        if (visited.has(key)) {
          continue;
        }

        visited.add(key);

        queue.push({
          state: nextState,
          depth: current.depth + 1,
        });
      }
    }
  }

  return null;
}

// ============================================================
// 赤ブロックが出口位置にあるか
// ============================================================

function isTargetReadyToExit() {
  const target = blocks.find((block) => block.isTarget);

  if (!target) {
    return false;
  }

  return target.row === 2 && target.x + target.length * blockSize >= canvasSize;
}

// ============================================================
// クリア判定
// ============================================================

function checkClear() {
  const target = blocks.find((block) => block.isTarget);

  if (!target || exitingTarget) {
    return;
  }

  // ----------------------------------------------------------
  // 赤ブロックが1マス分、出口の外へ出たら自動脱出
  // ----------------------------------------------------------
  const targetRight = target.x + target.length * blockSize;

  if (target.row === 2 && targetRight >= canvasSize + blockSize) {
    startTargetExit(target);
  }
}

// ============================================================
// 赤ブロックを外へスーッと移動
// ============================================================

function startTargetExit(target) {
  if (exitingTarget) {
    return;
  }

  exitingTarget = true;

  // クリア表示を出して操作をロック
  gameCleared = true;

  score += 100;
  updateScore();

  draw();

  const startX = target.x;

  // 画面外まで脱出
  const targetX = canvasSize + blockSize * target.length + 40;

  const duration = 350;
  const startTime = performance.now();

  function animate(time) {
    const progress = Math.min((time - startTime) / duration, 1);

    const eased = 1 - Math.pow(1 - progress, 3);

    target.x = startX + (targetX - startX) * eased;

    draw();

    if (progress < 1) {
      exitAnimationId = requestAnimationFrame(animate);
    } else {
      setTimeout(() => {
        stage++;

        updateStage();

        exitingTarget = false;
        gameCleared = false;
        selectedBlock = null;

        generateStageWithLoading();
      }, 400);
    }
  }

  exitAnimationId = requestAnimationFrame(animate);
}

// ============================================================
// スコア更新
// ============================================================

function updateScore() {
  document.getElementById("score").textContent = "Score: " + score;
}

// ============================================================
// ステージ表示
// ============================================================

function updateStage() {
  document.getElementById("stage").textContent = "Stage: " + stage;
}

// ============================================================
// ステージリセット
// ============================================================

function resetStage() {
  if (!gameStarted || gameCleared || exitingTarget) {
    return;
  }

  // 初期配置を復元
  blocks = initialBlocks.map((block) => ({
    ...block,
    x: block.col * blockSize,
    y: block.row * blockSize,
  }));

  selectedBlock = null;

  draw();
}

// ============================================================
// 盤面描画
// ============================================================

function drawBoard() {
  // 背景
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // 内側のグリッド
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  for (let r = 1; r < rows; r++) {
    const y = r * blockSize;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize, y);
    ctx.stroke();
  }

  for (let c = 1; c < cols; c++) {
    const x = c * blockSize;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize);
    ctx.stroke();
  }

  // ----------------------------------------------------------
  // 外周
  // ----------------------------------------------------------

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 8;

  // 上
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(canvasSize, 0);
  ctx.stroke();

  // 左
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, canvasSize);
  ctx.stroke();

  // 下
  ctx.beginPath();
  ctx.moveTo(0, canvasSize);
  ctx.lineTo(canvasSize, canvasSize);
  ctx.stroke();

  // ----------------------------------------------------------
  // 右側
  //
  // 2行目だけ出口なので線を描かない
  // ----------------------------------------------------------

  const exitTop = 2 * blockSize;
  const exitBottom = 3 * blockSize;

  // 右上
  ctx.beginPath();
  ctx.moveTo(canvasSize, 0);
  ctx.lineTo(canvasSize, exitTop);
  ctx.stroke();

  // 右下
  ctx.beginPath();
  ctx.moveTo(canvasSize, exitBottom);
  ctx.lineTo(canvasSize, canvasSize);
  ctx.stroke();
}

// ============================================================
// ブロック描画
// ============================================================

function drawBlock(block) {
  const padding = blockSize * 0.07;

  let x = block.x + padding;
  let y = block.y + padding;

  let width;
  let height;

  if (block.direction === "horizontal") {
    width = block.length * blockSize - padding * 2;

    height = blockSize - padding * 2;
  } else {
    width = blockSize - padding * 2;

    height = block.length * blockSize - padding * 2;
  }

  const radius = blockSize * 0.12;

  // ----------------------------------------------------------
  // ゴールブロック
  // ----------------------------------------------------------

  if (block.isTarget) {
    // 本体
    const gradient = ctx.createLinearGradient(x, y, x, y + height);

    gradient.addColorStop(0, "#ff5a5a");
    gradient.addColorStop(0.5, "#e53935");
    gradient.addColorStop(1, "#b71c1c");

    ctx.fillStyle = gradient;

    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // 外側の白い枠
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = blockSize * 0.045;

    roundRect(ctx, x, y, width, height, radius);
    ctx.stroke();

    // 内側の光沢
    ctx.fillStyle = "rgba(255,255,255,0.22)";

    if (block.direction === "horizontal") {
      ctx.fillRect(x + 6, y + 6, Math.max(width - 12, 0), Math.max(height * 0.2, 0));
    } else {
      ctx.fillRect(x + 6, y + 6, Math.max(width * 0.2, 0), Math.max(height - 12, 0));
    }

    // 矢印
    ctx.fillStyle = "#fff";

    ctx.font = `bold ${blockSize * 0.32}px sans-serif`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText("→", x + width / 2, y + height / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    return;
  }

  // ----------------------------------------------------------
  // 通常ブロック
  // ----------------------------------------------------------

  ctx.fillStyle = block.color;

  roundRect(ctx, x, y, width, height, radius);

  ctx.fill();

  // ハイライト
  ctx.fillStyle = "rgba(255,255,255,0.16)";

  if (block.direction === "horizontal") {
    ctx.fillRect(x + 5, y + 5, Math.max(width - 10, 0), Math.max(height * 0.22, 0));
  } else {
    ctx.fillRect(x + 5, y + 5, Math.max(width * 0.22, 0), Math.max(height - 10, 0));
  }
}

// ============================================================
// 角丸矩形
// ============================================================

function roundRect(ctx, x, y, width, height, radius) {
  radius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();

  ctx.moveTo(x + radius, y);

  ctx.lineTo(x + width - radius, y);

  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);

  ctx.lineTo(x + width, y + height - radius);

  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);

  ctx.lineTo(x + radius, y + height);

  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);

  ctx.lineTo(x, y + radius);

  ctx.quadraticCurveTo(x, y, x + radius, y);

  ctx.closePath();
}

// ============================================================
// 全体描画
// ============================================================

function draw() {
  drawBoard();

  for (const block of blocks) {
    drawBlock(block);
  }

  if (gameCleared) {
    drawClear();
  }
}

// ============================================================
// クリア表示
// ============================================================

function drawClear() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  ctx.font = "bold 50px sans-serif";
  ctx.fillText("CLEAR!", canvasSize / 2, canvasSize / 2 - 15);

  ctx.font = "24px sans-serif";
  ctx.fillText("+100", canvasSize / 2, canvasSize / 2 + 35);

  ctx.textAlign = "left";
}

// ============================================================
// キャンバス座標
// ============================================================

function getCanvasPosition(event) {
  const rect = canvas.getBoundingClientRect();

  let clientX;
  let clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),

    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

// ============================================================
// ブロック選択
// ============================================================

function getBlockAtPosition(x, y) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];

    const width = block.direction === "horizontal" ? block.length * blockSize : blockSize;

    const height = block.direction === "vertical" ? block.length * blockSize : blockSize;

    if (x >= block.x && x <= block.x + width && y >= block.y && y <= block.y + height) {
      return block;
    }
  }

  return null;
}

// ============================================================
// ドラッグ開始
// ============================================================

function startDrag(event) {
  if (!gameStarted || gameCleared || exitingTarget) {
    return;
  }

  const pos = getCanvasPosition(event);

  const block = getBlockAtPosition(pos.x, pos.y);

  if (!block) {
    return;
  }

  selectedBlock = block;

  pointerStartX = pos.x;
  pointerStartY = pos.y;

  lastPointerX = pos.x;
  lastPointerY = pos.y;

  dragOffsetX = pos.x - block.x;
  dragOffsetY = pos.y - block.y;
}

// ============================================================
// ドラッグ中
// ============================================================

function drag(event) {
  if (!selectedBlock || !gameStarted || gameCleared || exitingTarget) {
    return;
  }

  event.preventDefault();

  const pos = getCanvasPosition(event);

  const block = selectedBlock;

  if (block.direction === "horizontal") {
    const newX = pos.x - dragOffsetX;

    moveBlockSmoothly(block, newX, true);
  } else {
    const newY = pos.y - dragOffsetY;

    moveBlockSmoothly(block, newY, false);
  }

  draw();

  checkClear();
}

// ============================================================
// 滑らかな移動＋衝突判定
// ============================================================

function moveBlockSmoothly(block, desiredPosition, horizontal) {
  const blockWidth = horizontal ? block.length * blockSize : blockSize;

  const blockHeight = horizontal ? blockSize : block.length * blockSize;

  const currentPosition = horizontal ? block.x : block.y;

  // ----------------------------------------------------------
  // 基本の移動範囲
  // ----------------------------------------------------------

  let minPosition = 0;

  let maxPosition = horizontal ? canvasSize - blockWidth : canvasSize - blockHeight;

  // ----------------------------------------------------------
  // 他のブロックとの衝突判定
  // ----------------------------------------------------------

  for (const other of blocks) {
    if (other === block) {
      continue;
    }

    const otherWidth = other.direction === "horizontal" ? other.length * blockSize : blockSize;

    const otherHeight = other.direction === "vertical" ? other.length * blockSize : blockSize;

    const otherLeft = other.x;
    const otherRight = other.x + otherWidth;

    const otherTop = other.y;
    const otherBottom = other.y + otherHeight;

    // ========================================================
    // 横方向に移動
    // ========================================================

    if (horizontal) {
      const blockTop = block.y;
      const blockBottom = block.y + blockHeight;

      // 縦方向に重なっていなければ衝突しない
      if (blockBottom <= otherTop || blockTop >= otherBottom) {
        continue;
      }

      const blockLeft = block.x;
      const blockRight = block.x + blockWidth;

      // ------------------------------------------------------
      // 右へ移動する場合
      // ------------------------------------------------------

      if (desiredPosition > currentPosition) {
        // 現在位置より右側にあるブロックだけを見る
        if (otherLeft >= blockRight - 0.001) {
          const limit = otherLeft - blockWidth;

          maxPosition = Math.min(maxPosition, limit);
        }
      }

      // ------------------------------------------------------
      // 左へ移動する場合
      // ------------------------------------------------------
      else if (desiredPosition < currentPosition) {
        // 現在位置より左側にあるブロックだけを見る
        if (otherRight <= blockLeft + 0.001) {
          const limit = otherRight;

          minPosition = Math.max(minPosition, limit);
        }
      }
    }

    // ========================================================
    // 縦方向に移動
    // ========================================================
    else {
      const blockLeft = block.x;
      const blockRight = block.x + blockWidth;

      // 横方向に重なっていなければ衝突しない
      if (blockRight <= otherLeft || blockLeft >= otherRight) {
        continue;
      }

      const blockTop = block.y;
      const blockBottom = block.y + blockHeight;

      // ------------------------------------------------------
      // 下へ移動する場合
      // ------------------------------------------------------

      if (desiredPosition > currentPosition) {
        // 現在位置より下側にあるブロックだけを見る
        if (otherTop >= blockBottom - 0.001) {
          const limit = otherTop - blockHeight;

          maxPosition = Math.min(maxPosition, limit);
        }
      }

      // ------------------------------------------------------
      // 上へ移動する場合
      // ------------------------------------------------------
      else if (desiredPosition < currentPosition) {
        // 現在位置より上側にあるブロックだけを見る
        if (otherBottom <= blockTop + 0.001) {
          const limit = otherBottom;

          minPosition = Math.max(minPosition, limit);
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 赤ブロックの出口
  // ----------------------------------------------------------
  //
  // 他のブロックによる制限を解除してはいけない。
  // 出口まで障害物がなければ、その先へ移動できるようにする。
  // ----------------------------------------------------------

  if (block.isTarget && horizontal && block.row === 2) {
    // 1マス分だけ出口の外までドラッグ可能
    const exitMax = canvasSize + blockSize;

    if (maxPosition >= canvasSize - blockWidth) {
      maxPosition = exitMax;
    }
  }

  // ----------------------------------------------------------
  // 移動可能範囲に制限
  // ----------------------------------------------------------

  const position = Math.max(minPosition, Math.min(desiredPosition, maxPosition));

  // ----------------------------------------------------------
  // 実際の位置を更新
  // ----------------------------------------------------------

  if (horizontal) {
    block.x = position;
  } else {
    block.y = position;
  }
}

// ============================================================
// ドラッグ終了
// ============================================================

function endDrag() {
  if (!selectedBlock) {
    return;
  }

  const block = selectedBlock;

  // ----------------------------------------------------------
  // 赤ブロックが脱出中
  // ----------------------------------------------------------

  if (exitingTarget) {
    selectedBlock = null;
    return;
  }

  // ----------------------------------------------------------
  // 赤ブロックが出口の外に出ている場合
  // ----------------------------------------------------------

  if (
    block.isTarget &&
    block.direction === "horizontal" &&
    block.row === 2 &&
    block.x + block.length * blockSize >= canvasSize
  ) {
    selectedBlock = null;
    checkClear();
    return;
  }

  // ----------------------------------------------------------
  // マスに吸着
  // ----------------------------------------------------------

  if (block.direction === "horizontal") {
    const targetCol = Math.round(block.x / blockSize);

    block.col = Math.max(0, Math.min(targetCol, cols - block.length));

    block.x = block.col * blockSize;
  } else {
    const targetRow = Math.round(block.y / blockSize);

    block.row = Math.max(0, Math.min(targetRow, rows - block.length));

    block.y = block.row * blockSize;
  }

  selectedBlock = null;

  draw();
}

// ============================================================
// タッチ操作
// ============================================================

canvas.addEventListener("touchstart", startDrag, { passive: false });

canvas.addEventListener("touchmove", drag, { passive: false });

canvas.addEventListener("touchend", endDrag);

// ============================================================
// マウス操作
// ============================================================

canvas.addEventListener("mousedown", startDrag);

canvas.addEventListener("mousemove", drag);

window.addEventListener("mouseup", endDrag);

// ============================================================
// リサイズ
// ============================================================

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();

  /*
   * canvas自体の内部サイズは600×600固定。
   * blockSizeだけ描画上のサイズとして計算。
   */
  blockSize = canvas.width / cols;

  draw();
}

window.addEventListener("resize", resizeCanvas);

// ============================================================
// ステージリセットボタン
// ============================================================

document.getElementById("resetStageBtn").addEventListener("click", () => {
  resetStage();
});

// ============================================================
// リセット確認ダイアログ
// ============================================================

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

// ============================================================
// スタートボタン
// ============================================================

document.getElementById("startBtn").addEventListener("click", () => {
  // ゲームクリア時は何もしない
  if (gameCleared) {
    return;
  }

  // ゲーム中なら確認ダイアログを表示
  if (gameStarted) {
    resetDialog.show();

    return;
  }

  startGame();
});

// ゲーム開始・リセット処理
function startGame() {
  score = 0;
  stage = 1;

  gameStarted = true;
  gameCleared = false;

  document.getElementById("startBtn").textContent = "ゲームリセット";

  updateScore();
  updateStage();

  generateStageWithLoading();
}

// ============================================================
// 初期表示
// ============================================================

resizeCanvas();
draw();
