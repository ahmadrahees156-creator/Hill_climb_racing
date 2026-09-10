const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const landing = document.getElementById("landing");
const playGameButton = document.getElementById("playGame");
const gameShell = document.querySelector(".shell");
const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const fuelNumEl = document.getElementById("fuelNum");
const fuelMeter = document.getElementById("fuelMeter");
const coinsEl = document.getElementById("coins");
const totalCoinsEl = null;
const toast = document.getElementById("toast");
const startScreen = landing;
const startGameButton = playGameButton;
const gameOver = document.getElementById("over");
const soundButton = document.getElementById("soundButton");
const finalDist = document.getElementById("finalDist");
const finalCoins = null;
const overBest = null;
const overMsg = document.getElementById("overMsg");
const status = document.getElementById("status");
const levelLabel = document.getElementById("levelLabel");
const levelList = document.getElementById("levels");
const missionText = document.getElementById("missionText");
const nextLevelButton = null;
const diffBtns = document.querySelectorAll(".diff");
let audioContext = null;
let soundEnabled = true;

let width = 900,
  height = 450,
  dpr = 1,
  lastTime = 0,
  running = false;
let best = Number(localStorage.getItem("hillbound-best") || 0);
let totalCoins = Number(localStorage.getItem("hillbound-total-coins") || 0);
let level = Number(localStorage.getItem("hillbound-level") || 1);
let highestLevel = Number(localStorage.getItem("hillbound-highest-level") || 1);
let checkpointX = 150;
let checkpointDistance = 0;
let difficulty = "hard";
const input = { gas: false, brake: false };
const car = {
  x: 150,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  angularVelocity: 0,
  flipTime: 0,
  flipping: false,
  flipStartAngle: 0,
  flipDirection: 1,
  balanceTime: 0,
  fuelEmptyTime: 0,
  fuel: 100,
  coins: 0,
  distance: 0,
  grounded: false,
};
let terrain = [],
  pickups = [],
  particles = [],
  cameraX = 0;

function playTone(frequency, duration, type = "square", volume = 0.035) {
  if (!soundEnabled) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playPickupSound(type) {
  playTone(type === "coin" ? 880 : 440, 0.12, "sine", 0.05);
  if (type === "coin") playTone(1320, 0.1, "sine", 0.035);
}

function levelTarget() {
  const levelDistances = [
    500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5700, 6800,
  ];
  return levelDistances[Math.min(level - 1, levelDistances.length - 1)];
}

function renderLevels() {
  if (!levelList || !levelLabel || !missionText) return;
  levelList.innerHTML = "";
  for (let number = 1; number <= 10; number++) {
    const button = document.createElement("button");
    button.className = "level-button";
    button.textContent = number;
    button.type = "button";
    button.disabled = number > highestLevel;
    button.classList.toggle("selected", number === level);
    button.classList.toggle("locked", number > highestLevel);
    button.title = button.disabled ? "Locked level" : `Play level ${number}`;
    button.addEventListener("click", () => {
      level = number;
      localStorage.setItem("hillbound-level", level);
      checkpointX = 150;
      checkpointDistance = 0;
      renderLevels();
      if (!startScreen.classList.contains("visible")) reset();
    });
    levelList.append(button);
  }
  levelLabel.textContent = String(level).padStart(2, "0");
  missionText.textContent = `REACH ${String(levelTarget()).padStart(4, "0")} M`;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function terrainY(x) {
  const index = Math.max(0, Math.floor(x / 18));
  const point = terrain[index] || terrain[terrain.length - 1];
  const next = terrain[index + 1] || point;
  const part = (x % 18) / 18;
  return point + (next - point) * part;
}
function buildWorld() {
  terrain = [];
  pickups = [];
  let y = height * 0.68;
  const hardRoute = difficulty === "hard";
  const levelFactor = 1 + (level - 1) * 0.09;
  const roughness = (hardRoute ? 2.4 : 1.1) * levelFactor;
  let nextFuelX = 650 + Math.random() * 350;
  for (let x = 0; x < 30000; x += 18) {
    const longHill = Math.sin(x / 210) * (hardRoute ? 9 : 5) * levelFactor;
    const valley = Math.sin(x / 92) * (hardRoute ? 5.5 : 2.2) * levelFactor;
    const ridge =
      (hardRoute ? Math.sin(x / 29) * 3.5 : Math.sin(x / 52) * 1.4) * levelFactor;
    const jump =
      (hardRoute ? Math.max(0, Math.sin(x / 390)) ** 7 * 14 : 0) * levelFactor;
    if (level >= 8) {
      const lateLevel = level - 7;
      const hillAmplitude = (hardRoute ? 72 + lateLevel * 12 : 42 + lateLevel * 5) * levelFactor;
      const valleyAmplitude = (hardRoute ? 38 + lateLevel * 8 : 18 + lateLevel * 3) * levelFactor;
      const ridgeAmplitude = (hardRoute ? 16 + lateLevel * 4 : 7 + lateLevel * 2) * levelFactor;
      const jumpHeight = (hardRoute ? 42 + lateLevel * 8 : 14 + lateLevel * 3) * levelFactor;
      y =
        height * 0.58 +
        Math.sin(x / 190) * hillAmplitude +
        Math.sin(x / 73) * valleyAmplitude +
        Math.sin(x / 31) * ridgeAmplitude +
        Math.max(0, Math.sin(x / 330)) ** 6 * jumpHeight;
    } else {
      y += longHill + valley + ridge + jump + Math.sin(x / 67) * roughness * 0.6;
    }
    y = Math.max(height * 0.27, Math.min(height * 0.86, y));
    terrain.push(y);
    if (x >= nextFuelX) {
      pickups.push({ x, y: y - 48, type: "fuel", collected: false });
      nextFuelX = x + 750 + Math.random() * 500;
    }
    if (x > 240 && x % 170 < 18)
      pickups.push({
        x,
        y: y - 35 - Math.abs(Math.sin(x)) * 18,
        type: "coin",
        collected: false,
      });
  }
}
function reset() {
  buildWorld();
  car.x = checkpointX;
  car.y = terrainY(car.x) - 34;
  car.vx = 0;
  car.vy = 0;
  car.angle = 0;
  car.angularVelocity = 0;
  car.flipTime = 0;
  car.flipping = false;
  car.flipStartAngle = 0;
  car.flipDirection = 1;
  car.balanceTime = 0;
  car.fuelEmptyTime = 0;
  car.fuel = 100;
  if (checkpointDistance === 0) car.coins = 0;
  car.distance = checkpointDistance;
  car.grounded = false;
  cameraX = Math.max(0, checkpointX - width * 0.28);
  particles = [];
  running = startScreen ? !startScreen.classList.contains("visible") : true;
  gameOver.classList.remove("visible");
  toast.style.display = "none";
  status.textContent = difficulty === "hard" ? "HARD ROUTE" : "EASY ROUTE";
  renderLevels();
}
function startIfNeeded() {
  if (startScreen && startScreen.classList.contains("visible")) return;
  if (!running || gameOver.classList.contains("visible")) reset();
}

function startGame() {
  if (startScreen) startScreen.classList.remove("visible");
  reset();
}

function openGame() {
  if (landing) landing.classList.add("landing-hidden");
  if (gameShell) gameShell.classList.remove("game-shell-hidden");
  resize();
  startGame();
}
function update(dt) {
  if (!running) return;
  const realDt = dt;
  const rearGround = terrainY(car.x - 23);
  const frontGround = terrainY(car.x + 23);
  const ground = (rearGround + frontGround) / 2;
  const slope = Math.atan2(frontGround - rearGround, 46);
  const flipThreshold = (40 * Math.PI) / 180;
  const currentSlopeError = Math.abs(
    Math.atan2(Math.sin(car.angle - slope), Math.cos(car.angle - slope)),
  );
  if (!car.flipping && currentSlopeError >= flipThreshold) {
    car.flipping = true;
    car.flipStartAngle = car.angle;
    const rotationIntent = car.angularVelocity || car.angle - slope;
    car.flipDirection = rotationIntent >= 0 ? 1 : -1;
    playTone(110, 0.2, "sawtooth", 0.05);
  }
  const slowMotion = car.flipping;
  const physicsDt = slowMotion ? dt * 0.3 : dt;
  const wheelRadius = 11;
  const wheelOffset = 23;
  const bodyClearance = 34;
  const rearContact = car.y + wheelOffset + wheelRadius >= rearGround;
  const frontContact = car.y + wheelOffset + wheelRadius >= frontGround;
  car.grounded = rearContact || frontContact;
  const engineForce = input.gas && car.fuel > 0 ? 185 : 0;
  const brakeForce = input.brake ? 240 : 0;
  const hillForce = Math.sin(slope) * 220;
  const rollingResistance = car.vx * (car.grounded ? 0.18 : 0.045);
  car.vx +=
    (engineForce -
      brakeForce * Math.sign(car.vx || 1) +
      hillForce -
      rollingResistance) *
    physicsDt;
  if (input.gas && car.fuel > 0) car.fuel -= 3.8 * physicsDt;
  car.vx = Math.max(-80, Math.min(300, car.vx));
  car.vy += 620 * physicsDt;
  car.x += car.vx * physicsDt;
  car.y += car.vy * physicsDt;
  if (car.grounded) {
    const suspensionError = ground - bodyClearance - car.y;
    car.vy += suspensionError * 90 * physicsDt;
    car.vy *= Math.pow(0.2, physicsDt);
    car.angularVelocity += (slope - car.angle) * 18 * physicsDt;
    car.angularVelocity *= Math.pow(0.12, physicsDt);
    car.angularVelocity += (input.gas ? 0.7 : 0) * physicsDt;
    car.angularVelocity -= (input.brake ? 1.1 : 0) * physicsDt;
    if (car.y > ground - bodyClearance) {
      car.y = ground - bodyClearance;
      car.vy = Math.min(0, car.vy);
    }
  } else {
    car.angularVelocity += (input.gas ? 1.1 : 0) * physicsDt;
    car.angularVelocity -= (input.brake ? 1.4 : 0) * physicsDt;
    car.angularVelocity *= Math.pow(0.992, physicsDt * 60);
  }
  if (car.flipping) car.angularVelocity = car.flipDirection * 5.5;
  car.angle += car.angularVelocity * physicsDt;
  const angleFromSlope = Math.abs(
    Math.atan2(Math.sin(car.angle - slope), Math.cos(car.angle - slope)),
  );
  car.flipTime = car.flipping ? car.flipTime + realDt : 0;
  car.distance = Math.max(car.distance, Math.floor((car.x - 150) / 8));
  cameraX += (car.x - width * 0.28 - cameraX) * 4 * dt;
  cameraX = Math.max(0, cameraX);
  pickups.forEach((item) => {
    if (
      !item.collected &&
      Math.abs(item.x - car.x) < 30 &&
      Math.abs(item.y - car.y) < 38
    ) {
      item.collected = true;
      if (item.type === "coin") {
        car.coins++;
        totalCoins++;
        localStorage.setItem("hillbound-total-coins", totalCoins);
      }
      else car.fuel = Math.min(100, car.fuel + 35);
      playPickupSound(item.type);
      burst(item.x, item.y, item.type === "coin" ? "#f7c84b" : "#e95d32");
    }
  });
  if (car.flipping && Math.abs(car.angle - car.flipStartAngle) >= Math.PI)
    finish("CAR FLIPPED");
  if (car.fuel <= 0) car.fuelEmptyTime += realDt;
  else car.fuelEmptyTime = 0;
  if (car.fuelEmptyTime > 0.8 && car.vx < 16) finish("OUT OF FUEL");
  if (car.y > height + 100) finish("CRASH LANDING");
  if (car.distance >= levelTarget()) finish(`LEVEL ${level} COMPLETE`, true);
  updateParticles(realDt);
}
function burst(x, y, color) {
  for (let i = 0; i < 12; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.8) * 100,
      life: 0.6,
      color,
    });
}
function updateParticles(dt) {
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 150 * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
}
function finish(title, completed = false) {
  running = false;
  playTone(title === "CAR FLIPPED" ? 120 : 180, 0.35, "sawtooth", 0.06);
  setTimeout(() => playTone(80, 0.28, "square", 0.04), 120);
  overMsg.textContent = title;
  finalDist.textContent = String(car.distance).padStart(4, "0");
  if (finalCoins) finalCoins.textContent = car.coins;
  const newBest = car.distance > best;
  gameOver.classList.add("visible");
  status.textContent = "RUN COMPLETE";
  if (newBest) {
    best = car.distance;
    localStorage.setItem("hillbound-best", best);
  }
  finalDist.classList.toggle("new-best-score", newBest);
  if (overBest) {
    overBest.textContent = newBest
      ? `NEW BEST RUN ${String(best).padStart(4, "0")} M`
      : `BEST RUN ${String(best).padStart(4, "0")} M`;
    overBest.classList.toggle("new-best", newBest);
  }
  if (!completed) {
    checkpointX = 150;
    checkpointDistance = 0;
  }
  if (nextLevelButton) nextLevelButton.hidden = !completed || level >= 10;
  if (completed && level < 10) {
    highestLevel = Math.max(highestLevel, level + 1);
    localStorage.setItem("hillbound-highest-level", highestLevel);
    renderLevels();
    if (overBest && !newBest) {
      overBest.textContent = `LEVEL ${level} CLEARED / NEXT: ${String(level + 1).padStart(2, "0")}`;
    }
    if (overBest) overBest.classList.add("new-best");
    playTone(660, 0.12, "sine", 0.05);
    setTimeout(() => playTone(880, 0.16, "sine", 0.05), 130);
  }
}
function draw() {
  ctx.clearRect(0, 0, width, height);
  drawSky();
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawTerrain();
  pickups.forEach(drawPickup);
  particles.forEach(drawParticle);
  drawCar();
  ctx.restore();
  distanceEl.textContent = String(car.distance).padStart(4, "0");
  bestEl.textContent = String(best).padStart(4, "0");
  coinsEl.textContent = car.coins;
  if (totalCoinsEl) totalCoinsEl.textContent = totalCoins;
  const fuel = Math.max(0, Math.round(car.fuel));
  fuelNumEl.textContent = `${fuel}%`;
  fuelMeter.style.width = `${fuel}%`;
  fuelMeter.style.background = fuel < 25 ? "#c93d32" : "#e95d32";
}
function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#79b7b0");
  gradient.addColorStop(1, "#d7d5ae");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,236,168,.45)";
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.22, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(47,103,104,.23)";
  for (let x = -100; x < width + 200; x += 180) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.62);
    ctx.lineTo(x + 85, height * 0.37);
    ctx.lineTo(x + 210, height * 0.62);
    ctx.fill();
  }
}
function drawTerrain() {
  ctx.beginPath();
  ctx.moveTo(cameraX, height);
  for (let x = Math.floor(cameraX / 18) * 18; x < cameraX + width + 40; x += 18)
    ctx.lineTo(x, terrainY(x));
  ctx.lineTo(cameraX + width + 40, height);
  ctx.closePath();
  ctx.fillStyle = "#315c53";
  ctx.fill();
  ctx.beginPath();
  for (
    let x = Math.floor(cameraX / 18) * 18;
    x < cameraX + width + 40;
    x += 18
  ) {
    if (x === Math.floor(cameraX / 18) * 18) ctx.moveTo(x, terrainY(x));
    else ctx.lineTo(x, terrainY(x));
  }
  ctx.strokeStyle = "#e6cf87";
  ctx.lineWidth = 5;
  ctx.stroke();
}
function drawPickup(item) {
  if (item.collected) return;
  ctx.save();
  ctx.translate(
    item.x,
    item.y + Math.sin(performance.now() / 250 + item.x) * 4,
  );
  if (item.type === "coin") {
    ctx.fillStyle = "#f7c84b";
    ctx.strokeStyle = "#a96d2b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff1a7";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✦", 0, 5);
  } else {
    ctx.fillStyle = "#e95d32";
    ctx.fillRect(-9, -13, 18, 26);
    ctx.fillStyle = "#f5f1e8";
    ctx.fillRect(-5, -8, 10, 7);
    ctx.fillRect(-5, 2, 10, 5);
  }
  ctx.restore();
}
function drawParticle(p) {
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, 4, 4);
  ctx.globalAlpha = 1;
}
function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = "rgba(20,37,43,.2)";
  ctx.beginPath();
  ctx.ellipse(0, 28, 34, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14252b";
  ctx.beginPath();
  ctx.arc(-23, 23, 11, 0, Math.PI * 2);
  ctx.arc(23, 23, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab7b3";
  ctx.beginPath();
  ctx.arc(-23, 23, 5, 0, Math.PI * 2);
  ctx.arc(23, 23, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5f1e8";
  ctx.beginPath();
  ctx.arc(-23, 23, 2, 0, Math.PI * 2);
  ctx.arc(23, 23, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f6e68";
  ctx.strokeStyle = "#14252b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-38, -7);
  ctx.lineTo(-29, -16);
  ctx.lineTo(20, -16);
  ctx.lineTo(36, -6);
  ctx.lineTo(32, 15);
  ctx.lineTo(-34, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e95d32";
  ctx.beginPath();
  ctx.moveTo(-20, -16);
  ctx.lineTo(-10, -29);
  ctx.lineTo(13, -29);
  ctx.lineTo(25, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b8d9cf";
  ctx.beginPath();
  ctx.moveTo(-7, -25);
  ctx.lineTo(4, -25);
  ctx.lineTo(13, -17);
  ctx.lineTo(-14, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f7c84b";
  ctx.beginPath();
  ctx.moveTo(-5, -16);
  ctx.lineTo(3, -16);
  ctx.lineTo(6, 15);
  ctx.lineTo(-7, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#14252b";
  ctx.fillRect(7, -15, 2, 29);
  ctx.fillRect(-29, -1, 58, 2);
  ctx.strokeStyle = "#f7c84b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-23, -17);
  ctx.lineTo(-18, -31);
  ctx.lineTo(18, -31);
  ctx.lineTo(25, -17);
  ctx.stroke();
  ctx.fillStyle = "#f5f1e8";
  ctx.beginPath();
  ctx.arc(30, -4, 3, 0, Math.PI * 2);
  ctx.arc(-30, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e95d32";
  ctx.fillRect(-38, 8, 6, 5);
  ctx.fillRect(32, 8, 6, 5);
  ctx.restore();
}
function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.035);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
function bindPedal(button, key) {
  const down = (e) => {
    e.preventDefault();
    if ((startScreen && startScreen.classList.contains("visible")) || gameOver.classList.contains("visible")) return;
    if (!input[key]) playTone(key === "gas" ? 220 : 150, 0.08, "triangle");
    input[key] = true;
    button.classList.add("active");
  };
  const up = (e) => {
    e.preventDefault();
    input[key] = false;
    button.classList.remove("active");
  };
  ["pointerdown", "touchstart"].forEach((type) =>
    button.addEventListener(type, down, { passive: false }),
  );
  ["pointerup", "pointercancel", "pointerleave", "touchend"].forEach((type) =>
    button.addEventListener(type, up, { passive: false }),
  );
}
bindPedal(document.getElementById("gas"), "gas");
bindPedal(document.getElementById("brake"), "brake");
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "♪" : "×";
  soundButton.setAttribute(
    "aria-label",
    soundEnabled ? "Mute sound" : "Enable sound",
  );
  if (soundEnabled) playTone(660, 0.12, "sine", 0.04);
});
window.addEventListener("keydown", (e) => {
  if ((startScreen && startScreen.classList.contains("visible")) || gameOver.classList.contains("visible")) return;
  if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") {
    if (!input.gas) playTone(220, 0.08, "triangle");
    input.gas = true;
  }
  if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") {
    if (!input.brake) playTone(150, 0.08, "triangle");
    input.brake = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") input.gas = false;
  if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") input.brake = false;
});
document.getElementById("restart").addEventListener("click", reset);
startGameButton.addEventListener("click", openGame);
if (playGameButton) playGameButton.addEventListener("click", openGame);
if (nextLevelButton) {
  nextLevelButton.addEventListener("click", () => {
    if (level >= 10) return;
    checkpointX = car.x;
    checkpointDistance = car.distance;
    level++;
    localStorage.setItem("hillbound-level", level);
    renderLevels();
    reset();
  });
}
diffBtns.forEach((button) =>
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;
    diffBtns.forEach((item) =>
      item.classList.toggle("selected", item === button),
    );
    checkpointX = 150;
    checkpointDistance = 0;
    reset();
  }),
);
window.addEventListener("resize", resize);
resize();
buildWorld();
renderLevels();
car.y = terrainY(car.x) - 34;
bestEl.textContent = String(best).padStart(4, "0");
requestAnimationFrame(loop);
