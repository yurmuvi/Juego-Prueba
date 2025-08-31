const gameArea = document.getElementById("gameArea");
const player   = document.getElementById("player");
const obstacle = document.getElementById("obstacle");
const cave     = document.getElementById("cave");

const startScreen = document.getElementById("startScreen");
const playBtn     = document.getElementById("playBtn");

const btnLeft  = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");
const btnJump  = document.getElementById("btnJump");

/* --- Estado --- */
let running = false;
let isJumping = false;
let gameOverLock = false;

let leftPressed = false;
let rightPressed = false;

let playerX = 50;          // px (arranca a la izquierda)
const PLAYER_WIDTH = 80;   // px
const PLAYER_SPEED = 260;  // px/s

// Impulso horizontal del salto (siempre hacia adelante)
const JUMP_FORWARD_VX = 260; // px/s extra durante el salto
const JUMP_BOOST_TIME = 360; // ms de impulso
let jumpBoostVX = 0;
let jumpBoostUntil = 0;

// Dirección “mirando” del oso: 1 derecha, -1 izquierda
let lastMoveDir = 1;

/* --- Mundo de 2 minutos caminando recto --- */
const TRACK_LENGTH = PLAYER_SPEED * 120; // px de “mundo” para 120s
let worldX = 0; // progreso real en el mundo

/* ---------- Inicio ---------- */
playBtn.addEventListener("click", () => {
  startScreen.classList.remove("visible");
  startGame();
});

function startGame() {
  running = true;
  isJumping = false;
  leftPressed = rightPressed = false;
  playerX = 50; worldX = 0; lastMoveDir = 1;
  player.style.left = playerX + "px";
  cave.style.display = "none";
  gameOverLock = false;

  restartObstacle();
}

/* ---------- Input teclado ---------- */
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (running && !isJumping) jump();
  }
  if (e.code === "ArrowLeft")  { leftPressed  = true; lastMoveDir = -1; }
  if (e.code === "ArrowRight") { rightPressed = true; lastMoveDir =  1; }

  if ((e.code === "Enter" || e.code === "Space") && startScreen.classList.contains("visible")) {
    e.preventDefault();
    playBtn.click();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft")  leftPressed  = false;
  if (e.code === "ArrowRight") rightPressed = false;
});

/* ---------- Controles táctiles ---------- */
function bindHold(btn, on, off){
  const start = (ev)=>{ ev.preventDefault(); on(); };
  const end   = (ev)=>{ ev.preventDefault(); off(); };
  btn?.addEventListener("touchstart", start, {passive:false});
  btn?.addEventListener("mousedown",  start);
  btn?.addEventListener("touchend",   end);
  btn?.addEventListener("touchcancel",end);
  btn?.addEventListener("mouseup",    end);
  btn?.addEventListener("mouseleave", end);
}
bindHold(btnLeft,  ()=>{ leftPressed  = true; lastMoveDir = -1; }, ()=> leftPressed = false);
bindHold(btnRight, ()=>{ rightPressed = true; lastMoveDir =  1; }, ()=> rightPressed = false);
bindHold(btnJump,  ()=>{ if (running && !isJumping) jump(); }, ()=>{});

/* ---------- Movimiento + “mundo” ---------- */
const RIGHT_FRACTION_WHEN_TRAVELING = 0.65;

let lastTime = 0;
function moveLoop(t){
  if (!lastTime) lastTime = t;
  const dt = Math.min((t - lastTime)/1000, 0.033);
  lastTime = t;

  if (running){
    const rect = gameArea.getBoundingClientRect();

    // Velocidad local del oso (en pantalla)
    let vx = 0;
    if (leftPressed)  vx -= PLAYER_SPEED;
    if (rightPressed) vx += PLAYER_SPEED;

    // Impulso horizontal del salto (ACTIVO SIEMPRE en la dirección actual/última)
    if (performance.now() < jumpBoostUntil) {
      vx += jumpBoostVX; // jumpBoostVX ya incluye el signo (±)
    }

    // Límite dinámico a la derecha
    const nearEnd = worldX > TRACK_LENGTH - rect.width * 1.2;
    const rightLimit = nearEnd
      ? rect.width - PLAYER_WIDTH
      : rect.width * RIGHT_FRACTION_WHEN_TRAVELING - PLAYER_WIDTH;

    // Posición visible en pantalla
    playerX = Math.max(0, Math.min(rightLimit, playerX + vx * dt));
    player.style.left = playerX + "px";

    // Avance real del mundo
    const boost = (performance.now() < jumpBoostUntil) ? (JUMP_FORWARD_VX * lastMoveDir) : 0;
    const worldVX =
      (rightPressed ? PLAYER_SPEED : 0) +
      boost -
      (leftPressed ? PLAYER_SPEED : 0);

    worldX = Math.max(0, Math.min(TRACK_LENGTH, worldX + worldVX * dt));

    // Parallax del fondo
    gameArea.style.backgroundPositionX = `${-worldX * 0.25}px`;

    // Cueva visible al acercarte al final
    if (worldX > TRACK_LENGTH - rect.width * 2) {
      cave.style.display = "block";
    } else {
      cave.style.display = "none";
    }

    // Llegada a la cueva
    if (worldX >= TRACK_LENGTH) {
      running = false;
      alert("¡Llegaste a la cueva! 🥳");
      startScreen.classList.add("visible");
    }
  }
  requestAnimationFrame(moveLoop);
}
requestAnimationFrame(moveLoop);

/* ---------- Salto (alto + impulso horizontal) ---------- */
function jump() {
  isJumping = true;

  const dir = rightPressed ? 1 : (leftPressed ? -1 : lastMoveDir);
  lastMoveDir = dir;
  jumpBoostVX = JUMP_FORWARD_VX * dir;
  jumpBoostUntil = performance.now() + JUMP_BOOST_TIME;

  player.classList.add("jump");
  setTimeout(() => {
    player.classList.remove("jump");
    isJumping = false;
  }, 550);
}

/* ---------- Obstáculo (enemigo) ---------- */
function restartObstacle() {
  obstacle.style.animation = "none";
  void obstacle.offsetWidth; // reflow
  obstacle.style.animation = "moveObstacle 2s linear infinite";
}

// Colisiones AABB (en pantalla)
function isColliding(a, b) {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return !(ra.right < rb.left || ra.left > rb.right || ra.bottom < rb.top || ra.top > rb.bottom);
}
function isStomp(playerEl, obstEl) {
  const rp = playerEl.getBoundingClientRect();
  const ro = obstEl.getBoundingClientRect();
  const verticalOK = rp.bottom <= ro.top + 18;
  const horizontalOverlap = !(rp.right < ro.left || rp.left > ro.right);
  return isJumping && verticalOK && horizontalOverlap;
}

// Pisar enemigo = eliminar; golpe lateral = fin
setInterval(() => {
  if (!running) return;

  if (isColliding(player, obstacle)) {
    if (isStomp(player, obstacle)) {
      obstacle.style.transition = "opacity .12s";
      obstacle.style.opacity = "0";
      setTimeout(() => {
        obstacle.style.transition = "";
        obstacle.style.opacity = "1";
        restartObstacle();
      }, 140);
    } else if (!gameOverLock) {
      gameOverLock = true; running = false;
      alert("¡Te golpeó el enemigo!");
      setTimeout(() => {
        gameOverLock = false;
        startScreen.classList.add("visible");
      }, 250);
    }
  }
}, 100);
