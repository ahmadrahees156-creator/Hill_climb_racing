const modeOptions = document.querySelectorAll(".mode-option");
const levelOptions = document.querySelectorAll(".level");
const startPlay = document.getElementById("startPlay");
const launchModal = document.getElementById("launchModal");
const launchLevel = document.getElementById("launchLevel");
const launchMode = document.getElementById("launchMode");

let selectedMode = "easy";
let selectedLevel = 1;
let launchTimer;

function selectMode(mode, option) {
  selectedMode = mode;
  selectedLevel = levelFor(mode);
  modeOptions.forEach((item) => item.classList.toggle("is-selected", item === option));
  levelOptions.forEach((item) => {
    const level = Number(item.dataset.level);
    const locked = level > highestLevelFor(selectedMode);
    item.disabled = locked;
    item.classList.toggle("is-locked", locked);
    item.classList.toggle("is-selected", !locked && level === selectedLevel);
  });
}

function modeKey(prefix, mode) {
  return `${prefix}-${mode}`;
}

function highestLevelFor(mode) {
  return Math.min(10, Math.max(1, Number(localStorage.getItem(modeKey("hillbound-highest-level", mode)) || 1)));
}

function levelFor(mode) {
  return Math.min(highestLevelFor(mode), Math.max(1, Number(localStorage.getItem(modeKey("hillbound-level", mode)) || 1)));
}

selectedLevel = levelFor(selectedMode);

function selectLevel(level, option) {
  selectedLevel = level;
  levelOptions.forEach((item) => item.classList.toggle("is-selected", item === option));
}

levelOptions.forEach((option) => {
  const level = Number(option.dataset.level);
  const locked = level > highestLevelFor(selectedMode);
  option.classList.toggle("is-locked", locked);
  option.disabled = locked;
  option.setAttribute("aria-label", locked ? `Level ${level}, locked` : `Level ${level}`);
  if (!locked && level === selectedLevel) option.classList.add("is-selected");
  option.addEventListener("click", () => selectLevel(level, option));
});

modeOptions.forEach((option) => {
  option.addEventListener("click", () => selectMode(option.dataset.mode, option));
});

startPlay.addEventListener("click", (event) => {
  event.preventDefault();
  clearTimeout(launchTimer);
  launchLevel.textContent = `LEVEL ${String(selectedLevel).padStart(2, "0")}`;
  launchMode.textContent = `${selectedMode.toUpperCase()} MODE`;
  launchModal.hidden = false;
  launchTimer = setTimeout(() => {
    window.location.href = `index.html?play=1&level=${selectedLevel}&difficulty=${selectedMode}`;
  }, 5000);
});