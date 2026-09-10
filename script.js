const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const landing = document.getElementById("landing");
const playGameButton = document.getElementById("playGame");
const gameOver = document.getElementById("over");
const restartButton = document.getElementById("restart");
const soundButton = document.getElementById("soundButton");
const status = document.getElementById("status");

const distanceEl = document.getElementById("distance");
const bestEl = document.getElementById("best");
const fuelNumEl = document.getElementById("fuelNum");
const fuelMeter = document.getElementById("fuelMeter");
const coinsEl = document.getElementById("coins");
const finalDist = document.getElementById("finalDist");
const overMsg = document.getElementById("overMsg");

const gasButton = document.getElementById("gas");
const brakeButton = document.getElementById("brake");
const diffButtons = document.querySelectorAll(".diff");

let width = 900;
let height = 450;
let dpr = 1;
let lastTime = 0;
let running = false;
let soundEnabled = true;
let audioContext = null;

let best = Number(localStorage.getItem("hillbound-best")) || 0;
let totalCoins = Number(localStorage.getItem("hillbound-total-coins")) || 0;
let difficulty = "hard";
let level = Number(localStorage.getItem("hillbound-level")) || 1;

const input = {
    gas: false,
    brake: false
};

const car = {
    x: 150,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    fuel: 100,
    coins: 0,
    distance: 0,
    grounded: false
};

let terrain = [];
let pickups = [];
let particles = [];
let cameraX = 0;

// Sound
function playTone(frequency, duration, type = "square", volume = 0.03) {
    if (!soundEnabled) return;

    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

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

// Level target
function levelTarget() {
    const targets = [500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5700, 6800];
    return targets[Math.min(level - 1, targets.length - 1)];
}

// Canvas resize
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    width = Math.max(300, rect.width);
    height = Math.max(180, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildTerrain();

    car.y = terrainY(car.x) - 34;
    cameraX = Math.max(0, car.x - width * 0.28);
}

// Terrain height
function terrainY(x) {
    const index = Math.max(0, Math.floor(x / 18));
    const current = terrain[index] ?? height * 0.7;
    const next = terrain[index + 1] ?? current;
    const part = (x % 18) / 18;

    return current + (next - current) * part;
}

// Create terrain
function buildTerrain() {
    terrain = [];
    pickups = [];

    const hard = difficulty === "hard";
    const factor = 1 + (level - 1) * 0.08;

    for (let x = 0; x < 30000; x += 18) {
        let y;

        if (x < 400) {
            y = height * 0.72;
        } else {
            const hill = Math.sin(x / 210) * (hard ? 35 : 20) * factor;
            const valley = Math.sin(x / 75) * (hard ? 16 : 8) * factor;
            const smallHill = Math.sin(x / 32) * (hard ? 7 : 3) * factor;

            y = height * 0.72 + hill + valley + smallHill;

            if (hard) {
                y += Math.max(0, Math.sin(x / 380)) ** 6 * 35 * factor;
            }
        }

        y = Math.max(height * 0.48, Math.min(height * 0.84, y));
        terrain.push(y);

        if (x > 350 && x % 170 < 18) {
            pickups.push({
                x,
                y: y - 40,
                type: "coin",
                collected: false
            });
        }

        if (x > 600 && x % 900 < 18) {
            pickups.push({
                x,
                y: y - 48,
                type: "fuel",
                collected: false
            });
        }
    }
}

// Reset game
function resetGame() {
    buildTerrain();

    car.x = 150;
    car.y = terrainY(car.x) - 34;
    car.vx = 0;
    car.vy = 0;
    car.angle = 0;
    car.angularVelocity = 0;
    car.fuel = 100;
    car.coins = 0;
    car.distance = 0;
    car.grounded = false;

    cameraX = Math.max(0, car.x - width * 0.28);
    particles = [];
    running = true;

    gameOver.classList.remove("visible");
    status.textContent = difficulty === "hard" ? "HARD ROUTE" : "EASY ROUTE";
}

// Start game
function startGame() {
    landing.classList.remove("visible");
    landing.classList.add("landing-hidden");
    resetGame();
}

// Physics
function update(dt) {
    if (!running) return;

    const rearGround = terrainY(car.x - 23);
    const frontGround = terrainY(car.x + 23);
    const ground = (rearGround + frontGround) / 2;

    const slope = Math.atan2(frontGround - rearGround, 46);

    const gravity = 620;
    const engineForce = input.gas && car.fuel > 0 ? 185 : 0;
    const brakeForce = input.brake ? 240 : 0;

    const hillForce = Math.sin(slope) * 220;
    const resistance = car.vx * (car.grounded ? 0.18 : 0.045);

    car.vx += (engineForce - brakeForce * Math.sign(car.vx || 1) + hillForce - resistance) * dt;

    if (input.gas && car.fuel > 0) {
        car.fuel -= 3.8 * dt;
    }

    car.fuel = Math.max(0, car.fuel);
    car.vx = Math.max(-80, Math.min(300, car.vx));

    car.vy += gravity * dt;
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    const carBottom = car.y + 34;
    car.grounded = carBottom >= ground;

    if (car.grounded) {
        car.y = ground - 34;
        car.vy = Math.min(0, car.vy);
        car.angularVelocity += (slope - car.angle) * 18 * dt;
        car.angularVelocity *= Math.pow(0.12, dt);
    } else {
        if (input.gas) car.angularVelocity += 1.1 * dt;
        if (input.brake) car.angularVelocity -= 1.4 * dt;
        car.angularVelocity *= Math.pow(0.992, dt * 60);
    }

    car.angle += car.angularVelocity * dt;

    car.distance = Math.max(car.distance, Math.floor((car.x - 150) / 8));

    cameraX += (car.x - width * 0.28 - cameraX) * 4 * dt;
    cameraX = Math.max(0, cameraX);

    collectPickups();

    if (Math.abs(car.angle) > Math.PI * 0.65) {
        finishGame("CAR FLIPPED");
        return;
    }

    if (car.fuel <= 0 && Math.abs(car.vx) < 15) {
        finishGame("OUT OF FUEL");
        return;
    }

    if (car.y > height + 100) {
        finishGame("CRASH LANDING");
        return;
    }

    if (car.distance >= levelTarget()) {
        finishGame(`LEVEL ${level} COMPLETE`, true);
    }

    updateParticles(dt);
}

// Collect fuel and coins
function collectPickups() {
    pickups.forEach(item => {
        if (item.collected) return;

        const closeX = Math.abs(item.x - car.x) < 30;
        const closeY = Math.abs(item.y - car.y) < 45;

        if (!closeX || !closeY) return;

        item.collected = true;

        if (item.type === "coin") {
            car.coins++;
            totalCoins++;
            localStorage.setItem("hillbound-total-coins", totalCoins);
            playTone(880, 0.1, "sine", 0.05);
            burst(item.x, item.y, "#f7c84b");
        } else {
            car.fuel = Math.min(100, car.fuel + 35);
            playTone(440, 0.1, "sine", 0.05);
            burst(item.x, item.y, "#e95d32");
        }
    });
}

// Finish game
function finishGame(message, completed = false) {
    running = false;

    overMsg.textContent = message;
    finalDist.textContent = String(car.distance).padStart(4, "0");

    if (car.distance > best) {
        best = car.distance;
        localStorage.setItem("hillbound-best", best);
    }

    if (completed && level < 10) {
        level++;
        localStorage.setItem("hillbound-level", level);
    }

    gameOver.classList.add("visible");
    status.textContent = "RUN COMPLETE";

    playTone(180, 0.3, "sawtooth", 0.05);
}

// Particles
function burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.8) * 100,
            life: 0.6,
            color
        });
    }
}

function updateParticles(dt) {
    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt;
        p.life -= dt;
    });

    particles = particles.filter(p => p.life > 0);
}

// Draw everything
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

    updateHUD();
}

// Sky
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

// Terrain
function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(cameraX, height);

    for (let x = Math.floor(cameraX / 18) * 18; x < cameraX + width + 40; x += 18) {
        ctx.lineTo(x, terrainY(x));
    }

    ctx.lineTo(cameraX + width + 40, height);
    ctx.closePath();

    ctx.fillStyle = "#315c53";
    ctx.fill();

    ctx.beginPath();

    for (let x = Math.floor(cameraX / 18) * 18; x < cameraX + width + 40; x += 18) {
        if (x === Math.floor(cameraX / 18) * 18) {
            ctx.moveTo(x, terrainY(x));
        } else {
            ctx.lineTo(x, terrainY(x));
        }
    }

    ctx.strokeStyle = "#e6cf87";
    ctx.lineWidth = 5;
    ctx.stroke();
}

// Pickups
function drawPickup(item) {
    if (item.collected) return;

    ctx.save();

    const float = Math.sin(performance.now() / 250 + item.x) * 4;

    ctx.translate(item.x, item.y + float);

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

// Particles
function drawParticle(p) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
    ctx.globalAlpha = 1;
}

// Car
function drawCar() {
    ctx.save();

    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

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

    ctx.restore();
}

// HUD
function updateHUD() {
    distanceEl.textContent = String(car.distance).padStart(4, "0");
    bestEl.textContent = String(best).padStart(4, "0");
    coinsEl.textContent = car.coins;

    const fuel = Math.round(car.fuel);

    fuelNumEl.textContent = `${fuel}%`;
    fuelMeter.style.width = `${fuel}%`;

    if (fuel < 25) {
        fuelMeter.style.background = "#c93d32";
    } else {
        fuelMeter.style.background = "#e95d32";
    }
}

// Pedal controls
function bindPedal(button, key) {
    if (!button) return;

    const press = event => {
        event.preventDefault();
        input[key] = true;
        button.classList.add("active");
    };

    const release = event => {
        event.preventDefault();
        input[key] = false;
        button.classList.remove("active");
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

bindPedal(gasButton, "gas");
bindPedal(brakeButton, "brake");

// Keyboard
window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (key === "d" || event.key === "arrowright") {
        input.gas = true;
    }

    if (key === "a" || event.key === "arrowleft") {
        input.brake = true;
    }
});

window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();

    if (key === "d" || event.key === "arrowright") {
        input.gas = false;
    }

    if (key === "a" || event.key === "arrowleft") {
        input.brake = false;
    }
});

// Start button
playGameButton.addEventListener("click", startGame);

// Restart button
restartButton.addEventListener("click", resetGame);

// Sound
soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.textContent = soundEnabled ? "♪" : "×";
});

// Difficulty
diffButtons.forEach(button => {
    button.addEventListener("click", () => {
        difficulty = button.dataset.difficulty;

        diffButtons.forEach(item => {
            item.classList.toggle("selected", item === button);
        });

        resetGame();
    });
});

// Rotation
window.addEventListener("resize", () => {
    setTimeout(resizeCanvas, 100);
});

window.addEventListener("orientationchange", () => {
    setTimeout(() => {
        resizeCanvas();
        car.y = terrainY(car.x) - 34;
    }, 200);
});

// Game loop
function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, 0.035);

    lastTime = time;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Initialize
resizeCanvas();

bestEl.textContent = String(best).padStart(4, "0");

requestAnimationFrame(gameLoop);