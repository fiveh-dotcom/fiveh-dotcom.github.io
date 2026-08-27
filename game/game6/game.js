const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const canvasWidth = 400;
const canvasHeight = 600;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

// ============================================================
// ゲーム設定
// ============================================================

// 10列 × 15段
const cols = 10;
const rows = 15;

const cellSize = canvasWidth / cols;

// ============================================================
// ゲーム状態
// ============================================================

let score = 0;
let gameStarted = false;
let gameOver = false;
let paused = false;

let clearing = false;
let clearAnimationId = null;

let falling = false;
let fallingAnimationId = null;

// ブロック一覧
let blocks = [];

// ブロックID
let nextBlockId = 1;

// ドラッグ状態
let isDragging = false;
let draggedBlock = null;
let dragStartX = 0;
let originalX = 0;

// アニメーション
let animationId = null;

// ブロックの色
const blockColors = ["#3498db", "#e74c3c", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];

// ============================================================
// ブロック生成
// ============================================================

function createBlock(x, y, width) {
  return {
    id: nextBlockId++,
    x: x,
    y: y,
    drawY: y,
    width: width,
    color: blockColors[Math.floor(Math.random() * blockColors.length)],
  };
}

// ============================================================
// 初期行生成
// ============================================================

function createInitialRow(row) {
  const newBlocks = [];

  // 初期行には必ず2～3マスの空きを作る
  const emptyCount = Math.random() < 0.5 ? 2 : 3;

  const emptyCells = [];

  while (emptyCells.length < emptyCount) {
    const randomX = Math.floor(Math.random() * cols);

    if (!emptyCells.includes(randomX)) {
      emptyCells.push(randomX);
    }
  }

  emptyCells.sort((a, b) => a - b);

  let x = 0;

  while (x < cols) {
    // 空きマス
    if (emptyCells.includes(x)) {
      x++;
      continue;
    }

    // 連続している空き部分の最大幅を調べる
    let maxWidth = 0;

    for (let width = 1; width <= 4; width++) {
      if (x + width > cols) {
        break;
      }

      let valid = true;

      for (let i = x; i < x + width; i++) {
        if (emptyCells.includes(i)) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        break;
      }

      maxWidth = width;
    }

    if (maxWidth === 0) {
      x++;
      continue;
    }

    const width = Math.floor(Math.random() * maxWidth) + 1;

    newBlocks.push(createBlock(x, row, width));

    x += width;
  }

  blocks.push(...newBlocks);
}

// ============================================================
// 最下段のブロック生成
// 必ず2～3マスの空きができる
// ============================================================

function createBottomBlocks() {
  const newBlocks = [];

  // 最下段には必ず2～3マスの空きを作る
  const emptyCount = Math.random() < 0.7 ? 2 : 3;

  const emptyCells = [];

  while (emptyCells.length < emptyCount) {
    const randomX = Math.floor(Math.random() * cols);

    if (!emptyCells.includes(randomX)) {
      emptyCells.push(randomX);
    }
  }

  emptyCells.sort((a, b) => a - b);

  let x = 0;

  while (x < cols) {
    // 空きマス
    if (emptyCells.includes(x)) {
      x++;
      continue;
    }

    let maxWidth = 0;

    for (let width = 1; width <= 4; width++) {
      if (x + width > cols) {
        break;
      }

      let valid = true;

      for (let i = x; i < x + width; i++) {
        if (emptyCells.includes(i)) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        break;
      }

      maxWidth = width;
    }

    if (maxWidth === 0) {
      x++;
      continue;
    }

    const width = Math.floor(Math.random() * maxWidth) + 1;

    newBlocks.push(createBlock(x, rows - 1, width));

    x += width;
  }

  return newBlocks;
}

// ============================================================
// 指定位置にあるブロックを取得
// ============================================================

function getBlockAt(x, y) {
  return blocks.find((block) => block.y === y && x >= block.x && x < block.x + block.width);
}

// ============================================================
// ブロックを横に移動できるか
// ============================================================

function canMoveHorizontally(block, newX) {
  if (newX < 0) {
    return false;
  }

  if (newX + block.width > cols) {
    return false;
  }

  return !blocks.some((other) => {
    if (other === block) {
      return false;
    }

    if (other.y !== block.y) {
      return false;
    }

    return newX < other.x + other.width && newX + block.width > other.x;
  });
}

// ============================================================
// ブロックを下に落とせるか
// ============================================================

function canFall(block) {
  if (block.y + 1 >= rows) {
    return false;
  }

  return !blocks.some((other) => {
    if (other === block) {
      return false;
    }

    if (other.y !== block.y + 1) {
      return false;
    }

    return block.x < other.x + other.width && block.x + block.width > other.x;
  });
}

// ============================================================
// 重力処理（即時）
// ゲーム開始時など、アニメーション不要な場合に使用
// ============================================================

function applyGravity() {
  let moved = true;

  while (moved) {
    moved = false;

    // 下にあるブロックから判定
    const sortedBlocks = [...blocks].sort((a, b) => b.y - a.y);

    sortedBlocks.forEach((block) => {
      if (canFall(block)) {
        block.y++;
        block.drawY = block.y;
        moved = true;
      }
    });
  }

  blocks.forEach((block) => {
    block.drawY = block.y;
  });
}

// ============================================================
// 重力処理（アニメーション）
// ============================================================

function applyGravityAnimated(callback) {
  if (falling) {
    return;
  }

  // 各ブロックの現在位置を仮想的に管理
  const virtualY = new Map();

  blocks.forEach((block) => {
    virtualY.set(block.id, block.y);
  });

  // 各ブロックの最終落下位置
  const targetY = new Map();

  blocks.forEach((block) => {
    targetY.set(block.id, block.y);
  });

  // ==========================================================
  // 重力を仮想的に1段ずつ適用
  // ==========================================================

  let moved = true;

  while (moved) {
    moved = false;

    // 下にあるブロックから判定
    const sortedBlocks = [...blocks].sort((a, b) => {
      return virtualY.get(b.id) - virtualY.get(a.id);
    });

    sortedBlocks.forEach((block) => {
      const currentY = virtualY.get(block.id);

      // 一番下なら落下できない
      if (currentY + 1 >= rows) {
        return;
      }

      // 1段下に他のブロックがあるか確認
      const blocked = blocks.some((other) => {
        if (other === block) {
          return false;
        }

        const otherY = virtualY.get(other.id);

        if (otherY !== currentY + 1) {
          return false;
        }

        // 横方向に重なっているか
        return block.x < other.x + other.width && block.x + block.width > other.x;
      });

      // ブロックがあれば落下できない
      if (blocked) {
        return;
      }

      // 1段下へ移動
      virtualY.set(block.id, currentY + 1);
      targetY.set(block.id, currentY + 1);

      moved = true;
    });
  }

  // ==========================================================
  // 落下するブロックがない
  // ==========================================================

  let hasFallingBlock = false;

  blocks.forEach((block) => {
    if (targetY.get(block.id) !== block.y) {
      hasFallingBlock = true;
    }
  });

  if (!hasFallingBlock) {
    blocks.forEach((block) => {
      block.drawY = block.y;
    });

    if (callback) {
      callback();
    }

    return;
  }

  falling = true;

  // ==========================================================
  // アニメーション開始位置を保存
  // ==========================================================

  const startY = new Map();

  blocks.forEach((block) => {
    startY.set(block.id, block.y);
  });

  // 最大落下距離
  let maxDistance = 0;

  blocks.forEach((block) => {
    const distance = targetY.get(block.id) - startY.get(block.id);

    maxDistance = Math.max(maxDistance, distance);
  });

  // 落下距離に応じてアニメーション時間を調整
  const duration = Math.max(120, maxDistance * 60);

  const startTime = performance.now();

  // ==========================================================
  // 落下アニメーション
  // ==========================================================

  function animate(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);

    // なめらかに減速
    const eased = 1 - Math.pow(1 - progress, 3);

    blocks.forEach((block) => {
      const fromY = startY.get(block.id);
      const toY = targetY.get(block.id);

      block.drawY = fromY + (toY - fromY) * eased;
    });

    draw();

    if (progress < 1) {
      fallingAnimationId = requestAnimationFrame(animate);

      return;
    }

    // ========================================================
    // アニメーション終了
    // ========================================================

    blocks.forEach((block) => {
      block.y = targetY.get(block.id);
      block.drawY = block.y;
    });

    falling = false;
    fallingAnimationId = null;

    // 次の処理へ
    if (callback) {
      callback();
    }
  }

  fallingAnimationId = requestAnimationFrame(animate);
}

// ============================================================
// 横一列が埋まっているか判定
// ============================================================

function getFullRows() {
  const fullRows = [];

  for (let y = 0; y < rows; y++) {
    const occupied = Array(cols).fill(false);

    blocks.forEach((block) => {
      if (block.y !== y) {
        return;
      }

      for (let x = block.x; x < block.x + block.width; x++) {
        if (x >= 0 && x < cols) {
          occupied[x] = true;
        }
      }
    });

    if (occupied.every((cell) => cell)) {
      fullRows.push(y);
    }
  }

  return fullRows;
}

// ============================================================
// 揃った列を即時削除
// ゲーム開始時など、アニメーション不要な場合に使用
// ============================================================

function clearFullRowsImmediately(addScore = true) {
  let clearedAny = false;

  while (true) {
    const fullRows = getFullRows();

    if (fullRows.length === 0) {
      break;
    }

    clearedAny = true;

    // 揃った行を削除
    blocks = blocks.filter((block) => !fullRows.includes(block.y));

    // 消えた行数だけ上のブロックを下げる
    blocks.forEach((block) => {
      const rowsBelow = fullRows.filter((row) => row > block.y).length;

      block.y += rowsBelow;
      block.drawY = block.y;
    });

    // ゲーム中の消去だけスコア加算
    if (addScore) {
      score += fullRows.length * 100;
      updateScore();
    }

    // 連鎖
    applyGravity();
  }

  return clearedAny;
}

// ============================================================
// 揃った列を削除（アニメーション）
// ============================================================

function clearFullRows(callback) {
  const fullRows = getFullRows();

  if (fullRows.length === 0) {
    if (callback) {
      callback();
    }

    return;
  }

  clearing = true;

  const startTime = performance.now();
  const duration = 250;

  function animateClear(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);

    // なめらかに縮む
    const scale = 1 - progress;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawGrid();

    blocks.forEach((block) => {
      const isClearing = fullRows.includes(block.y);

      const drawY = block.drawY !== undefined ? block.drawY : block.y;

      if (isClearing) {
        const centerX = (block.x + block.width / 2) * cellSize;

        const centerY = (drawY + 0.5) * cellSize;

        const width = block.width * cellSize * scale;

        const height = cellSize * scale;

        ctx.save();

        ctx.fillStyle = block.color;

        ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height);

        ctx.restore();
      } else {
        const x = block.x * cellSize;

        const y = drawY * cellSize;

        ctx.fillStyle = block.color;

        ctx.fillRect(x + 1, y + 1, block.width * cellSize - 2, cellSize - 2);

        ctx.strokeStyle = "rgba(255,255,255,0.4)";

        ctx.lineWidth = 1;

        ctx.strokeRect(x + 1, y + 1, block.width * cellSize - 2, cellSize - 2);
      }
    });

    if (progress < 1) {
      clearAnimationId = requestAnimationFrame(animateClear);

      return;
    }

    // 実際に削除
    blocks = blocks.filter((block) => !fullRows.includes(block.y));

    // 消えた行数分だけ下げる
    blocks.forEach((block) => {
      const rowsBelow = fullRows.filter((row) => row > block.y).length;

      block.y += rowsBelow;
      block.drawY = block.y;
    });

    score += fullRows.length * 100;

    updateScore();

    clearing = false;

    draw();

    // 消去後の重力
    applyGravityAnimated(() => {
      // 重力後にさらに揃っていたら連鎖
      if (getFullRows().length > 0) {
        clearFullRows(callback);
        return;
      }

      // 連鎖終了
      if (callback) {
        callback();
      }
    });
  }

  clearAnimationId = requestAnimationFrame(animateClear);
}

// ============================================================
// 1段上昇
// ============================================================

function raiseBlocks() {
  blocks.forEach((block) => {
    block.y--;
    block.drawY = block.y;
  });
}

// ============================================================
// 最下段に新しいブロックを追加
// ============================================================

function addBottomRow() {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const newBlocks = createBottomBlocks();

    const testBlocks = [...blocks, ...newBlocks];

    const occupied = Array(cols).fill(false);

    testBlocks.forEach((block) => {
      if (block.y !== rows - 1) {
        return;
      }

      for (let x = block.x; x < block.x + block.width; x++) {
        if (x >= 0 && x < cols) {
          occupied[x] = true;
        }
      }
    });

    // 最下段が完全に埋まっていない
    // 配置だけ採用する
    if (!occupied.every((cell) => cell)) {
      blocks.push(...newBlocks);

      return;
    }
  }

  // 念のためのフォールバック
  const newBlocks = createBottomBlocks();

  blocks.push(...newBlocks);
}

// ============================================================
// 追加後の連鎖を処理
// 新しい段は追加しない
// ゲームオーバー判定もしない
// ============================================================

function resolveAfterRowAdded() {
  if (!gameStarted || gameOver) {
    return;
  }

  // 追加した段によって落下
  applyGravityAnimated(() => {
    // 揃ったら消す
    if (getFullRows().length > 0) {
      clearFullRows(() => {
        // 連鎖後も新しい段は追加しない
        resolveAfterRowAdded();
      });

      return;
    }

    // ここではゲームオーバー判定をしない
    // 最上段にブロックが残っていても、
    // 次のユーザー操作で消せる可能性があるため
    draw();
  });
}

// ============================================================
// 1回の操作が終了した後の処理
// ============================================================

function finishTurn() {
  if (clearing || falling || !gameStarted || gameOver) {
    return;
  }

  // ① 操作したブロックを重力で落とす
  applyGravityAnimated(() => {
    // ② 落下後に揃っていたら消去
    if (getFullRows().length > 0) {
      clearFullRows(() => {
        // 消去・連鎖がすべて終わったら
        // 1段追加へ進む
        addRowAfterChain();
      });

      return;
    }

    // ③ 揃っていなければ
    // 今回の操作が終了したので1段追加へ進む
    addRowAfterChain();
  });
}
// ============================================================
// 連鎖終了後に1段だけ追加
// ============================================================

function addRowAfterChain() {
  if (!gameStarted || gameOver) {
    return;
  }

  // 最上段にブロックがある場合
  // 今回の操作で消せなかったためゲームオーバー
  if (blocks.some((block) => block.y <= 0)) {
    endGame();
    return;
  }

  // 最上段にブロックがなければ1段上昇
  blocks.forEach((block) => {
    block.y--;
    block.drawY = block.y;
  });

  // 最下段に新しいブロックを追加
  addBottomRow();

  // 追加後の落下・連鎖
  // ここでは新しい段を追加しない
  resolveAfterRowAdded();
}

// ============================================================
// ゲームオーバー
// ============================================================

function endGame() {
  gameStarted = false;
  gameOver = true;
  paused = false;
  clearing = false;
  falling = false;

  if (animationId) {
    cancelAnimationFrame(animationId);

    animationId = null;
  }

  if (clearAnimationId) {
    cancelAnimationFrame(clearAnimationId);

    clearAnimationId = null;
  }

  if (fallingAnimationId) {
    cancelAnimationFrame(fallingAnimationId);

    fallingAnimationId = null;
  }

  draw();

  // alert("ゲームオーバー！\nスコア: " + score);

  document.getElementById("startBtn").textContent = "もう一度プレイ";
}

// ============================================================
// ゲーム開始
// ============================================================

function startGame() {
  score = 0;
  gameStarted = true;
  gameOver = false;
  paused = false;
  clearing = false;
  falling = false;

  blocks = [];
  nextBlockId = 1;

  updateScore();

  // まず3段分の初期配置を生成
  for (let y = rows - 3; y < rows; y++) {
    createInitialRow(y);
  }

  // 重力を適用
  applyGravity();

  // 揃っている列を消去
  // 初期配置なのでスコアには加算しない
  clearFullRowsImmediately(false);

  // 消去後の重力
  applyGravity();

  // 消去によって3段未満になった場合は補充
  while (getOccupiedRowCount() < 3) {
    addInitialRow();

    applyGravity();

    // 初期配置なのでスコアには加算しない
    clearFullRowsImmediately(false);

    applyGravity();
  }

  // 最終的な描画位置を確定
  blocks.forEach((block) => {
    block.drawY = block.y;
  });

  draw();

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(draw);

  document.getElementById("startBtn").textContent = "ゲームリセット";
}

// ============================================================
// 初期配置に1段追加
// ============================================================

function addInitialRow() {
  const occupiedRows = getOccupiedRows();

  let targetRow = rows - 1;

  if (occupiedRows.length > 0) {
    targetRow = Math.min(...occupiedRows) - 1;
  }

  // 画面外には追加しない
  if (targetRow < 0) {
    return false;
  }

  // 揃った列が生成されない配置を探す
  for (let attempt = 0; attempt < 100; attempt++) {
    const beforeIds = new Set(blocks.map((block) => block.id));

    createInitialRow(targetRow);

    const newBlocks = blocks.filter((block) => !beforeIds.has(block.id));

    // この行が揃っていなければ採用
    if (!getFullRows().includes(targetRow)) {
      return true;
    }

    // 揃ってしまった場合は追加したブロックだけ削除
    blocks = blocks.filter((block) => !newBlocks.includes(block));
  }

  return false;
}

// ============================================================
// ブロックが存在する行を取得
// ============================================================

function getOccupiedRows() {
  const rowsSet = new Set();

  blocks.forEach((block) => {
    rowsSet.add(block.y);
  });

  return [...rowsSet].sort((a, b) => a - b);
}

// ============================================================
// ブロックが存在する行数を取得
// ============================================================

function getOccupiedRowCount() {
  return getOccupiedRows().length;
}

// ============================================================
// ドラッグ開始
// ============================================================

function startDrag(clientX, clientY) {
  if (!gameStarted || gameOver || paused || clearing || falling) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);

  const block = getBlockAt(gridX, gridY);

  if (!block) {
    return;
  }

  isDragging = true;
  draggedBlock = block;

  dragStartX = x;
  originalX = block.x;
}

// ============================================================
// ドラッグ中
// ============================================================

function moveDrag(clientX) {
  if (!isDragging || !draggedBlock) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvasWidth / rect.width;

  const x = (clientX - rect.left) * scaleX;

  const dx = x - dragStartX;

  // ドラッグ開始位置から何マス移動したか
  const cellMove = Math.round(dx / cellSize);

  // 目標位置
  const targetX = originalX + cellMove;

  // 現在位置
  let currentX = draggedBlock.x;

  // 右方向へ移動
  if (targetX > currentX) {
    while (currentX < targetX) {
      const nextX = currentX + 1;

      // 1マス先へ移動できなければ、そこで停止
      if (!canMoveHorizontally(draggedBlock, nextX)) {
        break;
      }

      currentX = nextX;
    }
  }

  // 左方向へ移動
  else if (targetX < currentX) {
    while (currentX > targetX) {
      const nextX = currentX - 1;

      // 1マス先へ移動できなければ、そこで停止
      if (!canMoveHorizontally(draggedBlock, nextX)) {
        break;
      }

      currentX = nextX;
    }
  }

  // 実際に移動した場合だけ座標を変更
  if (currentX !== draggedBlock.x) {
    draggedBlock.x = currentX;
  }

  draw();
}

// ============================================================
// ドラッグ終了
// ============================================================

function endDrag() {
  if (!isDragging) {
    return;
  }

  isDragging = false;

  if (draggedBlock) {
    draggedBlock.x = Math.round(draggedBlock.x);

    // 最終的に元の位置から変わっていなければ操作扱いにしない
    const moved = draggedBlock.x !== originalX;

    draggedBlock = null;

    if (!moved) {
      return;
    }

    // 操作終了
    finishTurn();

    return;
  }

  draggedBlock = null;
}

// ============================================================
// 描画
// ============================================================

function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  drawGrid();
  drawBlocks();

  if (gameOver) {
    drawGameOver();
  }

  if (gameStarted && !gameOver) {
    animationId = requestAnimationFrame(draw);
  }
}

// ============================================================
// グリッド描画
// ============================================================

function drawGrid() {
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();

    ctx.moveTo(x * cellSize, 0);

    ctx.lineTo(x * cellSize, canvasHeight);

    ctx.stroke();
  }

  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();

    ctx.moveTo(0, y * cellSize);

    ctx.lineTo(canvasWidth, y * cellSize);

    ctx.stroke();
  }
}

// ============================================================
// ブロック描画
// ============================================================

function drawBlocks() {
  blocks.forEach((block) => {
    const drawY = block.drawY !== undefined ? block.drawY : block.y;

    const x = block.x * cellSize;

    const y = drawY * cellSize;

    ctx.fillStyle = block.color;

    ctx.fillRect(x + 1, y + 1, block.width * cellSize - 2, cellSize - 2);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";

    ctx.lineWidth = 1;

    ctx.strokeRect(x + 1, y + 1, block.width * cellSize - 2, cellSize - 2);
  });
}

// ============================================================
// ゲームオーバー表示
// ============================================================

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";

  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  ctx.font = "bold 36px sans-serif";

  ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 20);

  ctx.font = "20px sans-serif";

  ctx.fillText("Score: " + score, canvasWidth / 2, canvasHeight / 2 + 25);

  ctx.textAlign = "left";
}

// ============================================================
// スコア更新
// ============================================================

function updateScore() {
  document.getElementById("score").textContent = "Score: " + score;
}

// ============================================================
// マウス操作
// ============================================================

canvas.addEventListener("mousedown", (e) => {
  startDrag(e.clientX, e.clientY);
});

canvas.addEventListener("mousemove", (e) => {
  moveDrag(e.clientX);
});

canvas.addEventListener("mouseup", () => {
  endDrag();
});

// ============================================================
// タッチ操作
// ============================================================

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }

    if (e.touches.length !== 1) {
      return;
    }

    const touch = e.touches[0];

    startDrag(touch.clientX, touch.clientY);
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }

    if (e.touches.length !== 1) {
      return;
    }

    const touch = e.touches[0];

    moveDrag(touch.clientX);
  },
  { passive: false },
);

canvas.addEventListener("touchend", (e) => {
  if (e.cancelable) {
    e.preventDefault();
  }

  endDrag();
});

canvas.addEventListener("touchcancel", (e) => {
  if (e.cancelable) {
    e.preventDefault();
  }

  endDrag();
});

// ============================================================
// スタートボタン
// ============================================================

document.getElementById("startBtn").addEventListener("click", () => {
  startGame();
});

// ============================================================
// 初期描画
// ============================================================

draw();
