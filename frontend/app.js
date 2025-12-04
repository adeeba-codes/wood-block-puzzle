/* ======================================================
   BASIC SETUP & DOM ELEMENTS
====================================================== */
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const highScoreEl = document.getElementById("high-score");

const gameOverPanel = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");

const rotateBtn = document.getElementById("rotate-btn");
const undoBtn = document.getElementById("undo-btn");
const restartBtn = document.getElementById("restart-btn");
const restartFromGameOverBtn = document.getElementById("restart-from-gameover");

const currentBlockContainer = document.getElementById("current-block-container");
const nextBlockContainer = document.getElementById("next-block");

const ghostEl = document.getElementById("ghost-block");

const difficultySelectEl = document.getElementById("difficulty-select");
const soundToggleBtn = document.getElementById("sound-toggle-btn");

// SOUND ELEMENTS
const sndPlace = document.getElementById("snd-place");
const sndClear = document.getElementById("snd-clear");
const sndGameover = document.getElementById("snd-gameover");
const sndClick = document.getElementById("snd-click");

// Board size
const rows = 10;
const cols = 10;

// localStorage keys
const STATE_KEY = "woodBlockGameStateV1";
const HIGH_SCORE_KEY = "woodBlockHighScore";
const DIFFICULTY_KEY = "woodBlockDifficulty";
const SOUND_ENABLED_KEY = "woodBlockSoundEnabled";

// Game state
let grid = [];
let score = 0;
let level = 1;
let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

// difficulty (load from localStorage or default normal)
let difficulty = localStorage.getItem(DIFFICULTY_KEY) || "normal";
if (difficultySelectEl) difficultySelectEl.value = difficulty;

// sound enabled flag
let soundEnabled = true;
const storedSound = localStorage.getItem(SOUND_ENABLED_KEY);
if (storedSound !== null) {
  soundEnabled = storedSound === "true";
}

// apply initial high score
if (highScoreEl) highScoreEl.textContent = highScore;

// Blocks
let currentBlock = null;
let nextBlock = null;

// Undo
let undoStack = [];

// Drag / ghost state
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

/* ======================================================
   SOUND HELPERS
====================================================== */
function playSound(audioEl) {
  if (!audioEl || !soundEnabled) return;
  try {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {
      // ignore autoplay / user gesture errors
    });
  } catch {
    // ignore
  }
}

function updateSoundToggleUI() {
  if (!soundToggleBtn) return;
  soundToggleBtn.textContent = soundEnabled ? "🔊 Sound: On" : "🔇 Sound: Off";
}

updateSoundToggleUI();

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
    updateSoundToggleUI();
    playSound(sndClick);
  });
}

/* ======================================================
   BLOCK SHAPES (per difficulty)
====================================================== */

// Easy shapes – small & beginner-friendly
const SHAPES_EASY = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1], [1, 1]],
];

// Common medium shapes
const THREE_LINE_H = [[1, 1, 1]];
const THREE_LINE_V = [[1], [1], [1]];
const SMALL_L = [[1, 1], [1, 0]];
const SMALL_L_MIRROR = [[1, 0], [1, 1]];

// More advanced shapes
const T_SHAPE = [
  [0, 1, 0],
  [1, 1, 1],
];

const ZIGZAG = [
  [1, 1, 0],
  [0, 1, 1],
];

const LONG4_H = [[1, 1, 1, 1]];
const LONG4_V = [[1], [1], [1], [1]];

const PLUS_SHAPE = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
];

// Normal = easy shapes + some extra
const SHAPES_NORMAL = [
  ...SHAPES_EASY,
  THREE_LINE_H,
  THREE_LINE_V,
  SMALL_L,
  SMALL_L_MIRROR,
  T_SHAPE,
  ZIGZAG,
];

// Hard = normal + bigger shapes
const SHAPES_HARD = [
  ...SHAPES_NORMAL,
  LONG4_H,
  LONG4_V,
  PLUS_SHAPE,
];

function makeBlock(shape) {
  return {
    shape,
    height: shape.length,
    width: shape[0].length,
  };
}

function randomBlock() {
  let pool = SHAPES_NORMAL;
  if (difficulty === "easy") pool = SHAPES_EASY;
  else if (difficulty === "hard") pool = SHAPES_HARD;

  const idx = Math.floor(Math.random() * pool.length);
  return makeBlock(pool[idx]);
}

function rotateMatrix(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  const rotated = [];
  for (let c = 0; c < w; c++) {
    const row = [];
    for (let r = h - 1; r >= 0; r--) {
      row.push(matrix[r][c]);
    }
    rotated.push(row);
  }
  return rotated;
}

/* ======================================================
   HIGH SCORE UI
====================================================== */
function updateHighScoreUI(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return;
  highScore = num;
  if (highScoreEl) highScoreEl.textContent = highScore;
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
}

/* ======================================================
   SAVE / LOAD GAME STATE
====================================================== */
function saveGameState() {
  try {
    const state = {
      grid,
      score,
      level,
      difficulty,
      currentBlock,
      nextBlock,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save game state:", err);
  }
}

function loadSavedGameOrNew() {
  createBoard();

  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) {
    // no saved state → fresh game
    renderBoard();
    initBlocks();
    return;
  }

  try {
    const state = JSON.parse(raw);
    if (!state || !Array.isArray(state.grid) || state.grid.length !== rows) {
      renderBoard();
      initBlocks();
      return;
    }

    // restore grid & stats
    grid = state.grid;
    score = Number(state.score) || 0;
    level = Number(state.level) || 1;

    // restore difficulty from state (if present)
    if (state.difficulty) {
      difficulty = state.difficulty;
      localStorage.setItem(DIFFICULTY_KEY, difficulty);
      if (difficultySelectEl) difficultySelectEl.value = difficulty;
    }

    // restore blocks
    currentBlock = state.currentBlock || null;
    nextBlock = state.nextBlock || null;

    renderBoard();
    renderCurrentBlock();
    renderNextBlock();

    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
  } catch (err) {
    console.warn("Could not load game state:", err);
    renderBoard();
    initBlocks();
  }
}

/* ======================================================
   BOARD INIT & RENDER
====================================================== */
function createBoard() {
  if (!boardEl) return;

  grid = [];
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < cols; c++) {
      rowArr.push(0);

      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.row = r;
      cell.dataset.col = c;

      // mobile tap placement
      cell.addEventListener("click", () => {
        if (currentBlock) {
          playSound(sndClick);
          placeBlock(r, c);
        }
      });

      boardEl.appendChild(cell);
    }
    grid.push(rowArr);
  }
}

function renderBoard() {
  if (!boardEl) return;
  const cells = boardEl.children;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[idx++];
      if (!cell) continue;
      if (grid[r][c] === 1) {
        cell.classList.add("filled");
      } else {
        cell.classList.remove("filled");
      }
    }
  }
}

function getCellElement(r, c) {
  if (!boardEl) return null;
  const index = r * cols + c;
  return boardEl.children[index] || null;
}

function flashCells(cells) {
  cells.forEach(([r, c]) => {
    const cell = getCellElement(r, c);
    if (!cell) return;
    cell.classList.add("just-filled");
    setTimeout(() => cell.classList.remove("just-filled"), 250);
  });
}
function sparkleCells(cells) {
  cells.forEach(([r, c]) => {
    const cell = getCellElement(r, c);
    if (!cell) return;
    cell.classList.add("sparkle");
    // remove sparkle class after animation
    setTimeout(() => {
      cell.classList.remove("sparkle");
    }, 500);
  });
}

/* ======================================================
   LINE CHECK & CLEAR
====================================================== */
function clearCompletedLines() {
  const fullRows = [];
  const fullCols = [];

  // find full rows
  for (let r = 0; r < rows; r++) {
    let full = true;
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) fullRows.push(r);
  }

  // find full columns
  for (let c = 0; c < cols; c++) {
    let full = true;
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) fullCols.push(c);
  }

  if (fullRows.length === 0 && fullCols.length === 0) return 0;

  const clearedCells = [];
  const seen = new Set();

  // clear rows
  for (const r of fullRows) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) {
        grid[r][c] = 0;
        const key = `${r}-${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          clearedCells.push([r, c]);
        }
      }
    }
  }

  // clear cols
  for (const c of fullCols) {
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === 1) {
        grid[r][c] = 0;
        const key = `${r}-${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          clearedCells.push([r, c]);
        }
      }
    }
  }

  // existing pop animation
  flashCells(clearedCells);
  // NEW: sparkle overlay
  sparkleCells(clearedCells);

  renderBoard();

  return fullRows.length + fullCols.length;
}

/* ======================================================
   RENDER BLOCKS (CURRENT + NEXT)
====================================================== */
function renderBlockIn(container, block, draggable = false) {
  if (!container) return;
  container.innerHTML = "";
  if (!block) return;

  const { shape, width, height } = block;
  const wrapper = document.createElement("div");
  wrapper.className = "block";
  wrapper.style.display = "grid";
  wrapper.style.gridTemplateColumns = `repeat(${width}, 20px)`;
  wrapper.style.gap = "2px";

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = document.createElement("div");
      cell.className = "block-cell" + (shape[r][c] ? " filled" : "");
      wrapper.appendChild(cell);
    }
  }

  if (draggable) {
    wrapper.draggable = true;
    wrapper.addEventListener("dragstart", handleBlockDragStart);
  }

  container.appendChild(wrapper);
}

function renderCurrentBlock() {
  renderBlockIn(currentBlockContainer, currentBlock, true);
}

function renderNextBlock() {
  renderBlockIn(nextBlockContainer, nextBlock, false);
}

function initBlocks() {
  currentBlock = randomBlock();
  nextBlock = randomBlock();
  renderCurrentBlock();
  renderNextBlock();
}

function advanceBlocks() {
  currentBlock = nextBlock;
  nextBlock = randomBlock();
  renderCurrentBlock();
  renderNextBlock();
}

/* ======================================================
   GHOST BLOCK BUILD + VALIDATION
====================================================== */
function buildGhostBlock(shape) {
  if (!ghostEl) return;
  ghostEl.innerHTML = "";
  const h = shape.length;
  const w = shape[0].length;

  ghostEl.style.gridTemplateColumns = `repeat(${w}, 20px)`;
  ghostEl.style.gridTemplateRows = `repeat(${h}, 20px)`;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cell = document.createElement("div");
      cell.className = "gcell";
      if (shape[r][c] === 0) {
        cell.style.visibility = "hidden";
      }
      ghostEl.appendChild(cell);
    }
  }
}

function canPlaceAt(r, c) {
  if (!currentBlock) return false;
  const shape = currentBlock.shape;
  const h = currentBlock.height;
  const w = currentBlock.width;

  for (let rr = 0; rr < h; rr++) {
    for (let cc = 0; cc < w; cc++) {
      if (!shape[rr][cc]) continue;
      const br = r + rr;
      const bc = c + cc;
      if (br < 0 || br >= rows || bc < 0 || bc >= cols) return false;
      if (grid[br][bc] === 1) return false;
    }
  }
  return true;
}

/* ======================================================
   REAL GAME-OVER LOGIC HELPERS
   (check if any valid move exists for current or next block)
====================================================== */

// get up to 4 unique rotations of a shape (0°, 90°, 180°, 270°)
function getUniqueRotations(shape) {
  const rotations = [];
  const seen = new Set();
  let cur = shape;

  for (let i = 0; i < 4; i++) {
    const key = cur.map((row) => row.join("")).join("|");
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(cur);
    }
    cur = rotateMatrix(cur);
  }

  return rotations;
}

// generic "can place this shape at r,c on the board?" (uses global grid/rows/cols)
function canPlaceShapeAtOnBoard(shape, h, w, r, c) {
  for (let rr = 0; rr < h; rr++) {
    for (let cc = 0; cc < w; cc++) {
      if (!shape[rr][cc]) continue;
      const br = r + rr;
      const bc = c + cc;
      if (br < 0 || br >= rows || bc < 0 || bc >= cols) return false;
      if (grid[br][bc] === 1) return false;
    }
  }
  return true;
}

// does this block have ANY valid placement (with any rotation) on the current grid?
function hasAnyValidMoveForBlock(block) {
  if (!block) return false;

  const rotations = getUniqueRotations(block.shape);

  for (const shape of rotations) {
    const h = shape.length;
    const w = shape[0].length;

    for (let r = 0; r <= rows - h; r++) {
      for (let c = 0; c <= cols - w; c++) {
        if (canPlaceShapeAtOnBoard(shape, h, w, r, c)) {
          return true;
        }
      }
    }
  }

  return false;
}

/* ======================================================
   DRAG & DROP WITH GHOST PREVIEW
====================================================== */
function handleBlockDragStart(e) {
  if (!currentBlock) return;

  isDragging = true;
  const rect = e.target.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  e.dataTransfer.setData("text/plain", "block");

  buildGhostBlock(currentBlock.shape);
  ghostEl.classList.remove("hidden");
  ghostEl.classList.remove("valid", "invalid");

  playSound(sndClick);
}

if (boardEl) {
  boardEl.addEventListener("dragover", handleBoardDragOver);
  boardEl.addEventListener("drop", handleBoardDrop);
}

document.addEventListener("dragend", () => {
  isDragging = false;
  if (ghostEl) {
    ghostEl.classList.add("hidden");
  }
});

function handleBoardDragOver(e) {
  e.preventDefault();
  if (!isDragging || !currentBlock || !ghostEl) return;

  const boardRect = boardEl.getBoundingClientRect();
  const firstCell = boardEl.querySelector(".cell");
  if (!firstCell) return;
  const cellSize = firstCell.getBoundingClientRect().width;

  const cursorX = e.clientX - boardRect.left;
  const cursorY = e.clientY - boardRect.top;

  const topLeftX = cursorX - dragOffsetX;
  const topLeftY = cursorY - dragOffsetY;

  let col = Math.floor(topLeftX / cellSize);
  let row = Math.floor(topLeftY / cellSize);

  // clamp
  if (row < 0) row = 0;
  if (col < 0) col = 0;
  if (row >= rows) row = rows - 1;
  if (col >= cols) col = cols - 1;

  const screenLeft = boardRect.left + col * cellSize;
  const screenTop = boardRect.top + row * cellSize;

  ghostEl.style.left = `${screenLeft}px`;
  ghostEl.style.top = `${screenTop}px`;

  const valid = canPlaceAt(row, col);
  ghostEl.classList.toggle("valid", valid);
  ghostEl.classList.toggle("invalid", !valid);
}

function handleBoardDrop(e) {
  e.preventDefault();
  isDragging = false;
  if (ghostEl) {
    ghostEl.classList.add("hidden");
  }

  const boardRect = boardEl.getBoundingClientRect();
  const firstCell = boardEl.querySelector(".cell");
  if (!firstCell) return;

  const cellSize = firstCell.getBoundingClientRect().width;

  const cursorX = e.clientX - boardRect.left;
  const cursorY = e.clientY - boardRect.top;

  const topLeftX = cursorX - dragOffsetX;
  const topLeftY = cursorY - dragOffsetY;

  let col = Math.floor(topLeftX / cellSize);
  let row = Math.floor(topLeftY / cellSize);

  // clamp
  if (row < 0) row = 0;
  if (col < 0) col = 0;
  if (row >= rows) row = rows - 1;
  if (col >= cols) col = cols - 1;

  if (!canPlaceAt(row, col)) return;

  placeBlock(row, col);
}

/* ======================================================
   PLACE BLOCK + CLEAR LINES + SAVE
====================================================== */
function placeBlock(r, c) {
  if (!currentBlock) return;

  const shape = currentBlock.shape;
  const h = currentBlock.height;
  const w = currentBlock.width;

  if (!canPlaceAt(r, c)) return;

  // backup for undo
  undoStack.push(JSON.parse(JSON.stringify(grid)));

  const newlyFilled = [];
  for (let rr = 0; rr < h; rr++) {
    for (let cc = 0; cc < w; cc++) {
      if (!shape[rr][cc]) continue;
      const br = r + rr;
      const bc = c + cc;
      grid[br][bc] = 1;
      newlyFilled.push([br, bc]);
    }
  }

  flashCells(newlyFilled);
  renderBoard();
  updateScoreAndLevel(10); // base points
  playSound(sndPlace);

  const linesCleared = clearCompletedLines();
  if (linesCleared > 0) {
    updateScoreAndLevel(linesCleared * 50);
    playSound(sndClear);
  }

  currentBlock = null;
  renderCurrentBlock();
  advanceBlocks();

  // 🔥 REAL GAME-OVER CHECK: after we have a fresh current & next block
  checkGameOver();

  // save after every move
  saveGameState();
}

/* ======================================================
   SCORE & LEVEL
====================================================== */
function updateScoreAndLevel(pts) {
  score += pts;
  if (scoreEl) {
    scoreEl.textContent = score;
    scoreEl.classList.add("score-bump");
    setTimeout(() => scoreEl.classList.remove("score-bump"), 180);
  }

  if (score > highScore) {
    updateHighScoreUI(score);
  }

  level = Math.floor(score / 100) + 1;
  if (levelEl) levelEl.textContent = level;
}

/* ======================================================
   GAME OVER (REAL: NO VALID MOVES LEFT)
====================================================== */
function checkGameOver() {
  const hasMoveCurrent = hasAnyValidMoveForBlock(currentBlock);
  const hasMoveNext = hasAnyValidMoveForBlock(nextBlock);

  if (!hasMoveCurrent && !hasMoveNext) {
    handleGameOver();
  }
}

function handleGameOver() {
  if (finalScoreEl) finalScoreEl.textContent = score;
  if (gameOverPanel) {
    gameOverPanel.classList.remove("hidden");
    gameOverPanel.classList.add("show");
  }

  console.log("GAME OVER — sending score:", score);

  playSound(sndGameover);

  if (window.api && typeof window.api.updateScore === "function") {
    window.api
      .updateScore(score)
      .then((res) => {
        console.log("Backend updateScore response:", res);
        if (res && typeof res.highScore === "number") {
          updateHighScoreUI(res.highScore);
        }
        loadLeaderboard();
      })
      .catch((err) => {
        console.error("Backend updateScore error:", err.message);
      });
  }

  saveGameState();
}

/* ======================================================
   UNDO / RESTART
====================================================== */
if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    if (undoStack.length === 0) return;
    grid = undoStack.pop();
    renderBoard();
    playSound(sndClick);
    saveGameState();
  });
}

if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    playSound(sndClick);
    restartGame();
  });
}

if (restartFromGameOverBtn) {
  restartFromGameOverBtn.addEventListener("click", () => {
    playSound(sndClick);
    restartGame();
  });
}

function restartGame() {
  score = 0;
  level = 1;
  if (scoreEl) scoreEl.textContent = score;
  if (levelEl) levelEl.textContent = level;

  if (gameOverPanel) {
    gameOverPanel.classList.add("hidden");
    gameOverPanel.classList.remove("show");
  }

  undoStack = [];
  createBoard();
  renderBoard();
  initBlocks();
  saveGameState();
}

/* ======================================================
   ROTATE CURRENT BLOCK
====================================================== */
if (rotateBtn) {
  rotateBtn.addEventListener("click", () => {
    if (!currentBlock) return;

    // rotate the matrix
    currentBlock.shape = rotateMatrix(currentBlock.shape);
    currentBlock.height = currentBlock.shape.length;
    currentBlock.width = currentBlock.shape[0].length;

    // re-render
    renderCurrentBlock();

    // add small spin animation on the rendered block
    const blockEl = currentBlockContainer.querySelector(".block");
    if (blockEl) {
      blockEl.classList.add("rotating");
      setTimeout(() => {
        blockEl.classList.remove("rotating");
      }, 200); // slightly more than animation duration
    }

    // update ghost if dragging
    if (isDragging) {
      buildGhostBlock(currentBlock.shape);
    }

    playSound(sndClick);
    saveGameState();
  });
}

/* ======================================================
   DIFFICULTY CHANGE HANDLER
====================================================== */
if (difficultySelectEl) {
  difficultySelectEl.addEventListener("change", (e) => {
    difficulty = e.target.value;
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
    playSound(sndClick);
    restartGame(); // restart with new difficulty & save
  });
}

/* ======================================================
   AUTH + USERS + LEADERBOARD
====================================================== */
const authMessageEl = document.getElementById("auth-message");

function showAuthMessage(msg, isError = false) {
  if (!authMessageEl) return;
  authMessageEl.style.color = isError ? "#ff7777" : "#77ff77";
  authMessageEl.textContent = msg;
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    showAuthMessage("Logging in...");
    try {
      const user = await window.api.loginUser({ email, password });
      showAuthMessage(`Welcome back, ${user.name}`);
      if (typeof user.highScore === "number") {
        updateHighScoreUI(user.highScore);
      }
      loadLeaderboard();
    } catch (err) {
      showAuthMessage(err.message, true);
    }
  });
}

const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();
    showAuthMessage("Creating account...");
    try {
      const user = await window.api.registerUser({ name, email, password });
      showAuthMessage(`Account created. Hello, ${user.name}`);
      if (typeof user.highScore === "number") {
        updateHighScoreUI(user.highScore);
      }
      loadLeaderboard();
    } catch (err) {
      showAuthMessage(err.message, true);
    }
  });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn && window.api) {
  logoutBtn.addEventListener("click", () => {
    window.api.setToken(null);
    window.api.setCurrentUser(null);
    showAuthMessage("Logged out.");
  });
}

const showUsersBtn = document.getElementById("show-users-btn");
const usersOutputEl = document.getElementById("users-output");
if (showUsersBtn && usersOutputEl && window.api) {
  showUsersBtn.addEventListener("click", async () => {
    usersOutputEl.textContent = "Loading users...";
    try {
      const users = await window.api.getUsers();
      usersOutputEl.textContent = JSON.stringify(users, null, 2);
    } catch (err) {
      usersOutputEl.textContent = err.message;
    }
  });
}

const leaderboardListEl = document.getElementById("leaderboard-list");
const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard-btn");

async function loadLeaderboard() {
  if (!leaderboardListEl || !window.api || !window.api.getLeaderboard) return;
  leaderboardListEl.innerHTML = "<li>Loading...</li>";
  try {
    const players = await window.api.getLeaderboard();
    if (!players || players.length === 0) {
      leaderboardListEl.innerHTML = "<li>No scores yet. Play a game!</li>";
      return;
    }
    leaderboardListEl.innerHTML = "";
    players.forEach((p, idx) => {
      const li = document.createElement("li");
      const name = p.name || "Anonymous";
      const sc = typeof p.highScore === "number" ? p.highScore : 0;
      li.textContent = `${idx + 1}. ${name} — ${sc}`;
      leaderboardListEl.appendChild(li);
    });
  } catch (err) {
    console.error("Leaderboard load error:", err);
    leaderboardListEl.innerHTML = "<li>Error loading leaderboard</li>";
  }
}

if (refreshLeaderboardBtn) {
  refreshLeaderboardBtn.addEventListener("click", loadLeaderboard);
}

/* ======================================================
   INIT GAME (load last state or fresh)
====================================================== */
loadSavedGameOrNew();
loadLeaderboard();
