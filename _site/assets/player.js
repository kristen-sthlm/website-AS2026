// Custom audio player — phone-friendly, large tap targets, keyboard accessible
// Used on both the hymn (lyrics) page and the score page.
// Supports an optional loop with a 3-second gap between repeats.

const LOOP_GAP_MS = 100;

const player = document.querySelector(".player");
if (player) {
  const src = player.dataset.src;
  const playBtn = player.querySelector(".player-play");
  const loopBtn = player.querySelector(".player-loop");
  const progress = player.querySelector(".player-progress");
  const fill = player.querySelector(".player-progress-fill");
  const thumb = player.querySelector(".player-progress-thumb");
  const currentEl = player.querySelector(".player-time-current");
  const totalEl = player.querySelector(".player-time-total");

  let audio = null;
  let dragging = false;
  let loopOn = true;        // default: loop enabled
  let loopTimeout = null;   // timer for the gap between repeats

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(src);
    audio.preload = "metadata";

    audio.addEventListener("loadedmetadata", () => {
      totalEl.textContent = formatTime(audio.duration);
      progress.setAttribute("aria-valuemax", String(Math.floor(audio.duration)));
    });
    audio.addEventListener("timeupdate", () => {
      if (!dragging) updateProgress();
    });
    audio.addEventListener("ended", () => {
      if (loopOn) {
        // Visually keep "playing" state during the gap
        clearTimeout(loopTimeout);
        loopTimeout = setTimeout(() => {
          if (loopOn) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          }
        }, LOOP_GAP_MS);
      } else {
        player.classList.remove("is-playing");
        playBtn.setAttribute("aria-label", "Spela");
      }
    });
    audio.addEventListener("play", () => {
      player.classList.add("is-playing");
      playBtn.setAttribute("aria-label", "Pausa");
    });
    audio.addEventListener("pause", () => {
      // If a loop gap is pending, the user paused — cancel the upcoming repeat
      clearTimeout(loopTimeout);
      player.classList.remove("is-playing");
      playBtn.setAttribute("aria-label", "Spela");
    });

    return audio;
  }

  function formatTime(s) {
    if (!isFinite(s)) return "—";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function updateProgress() {
    if (!audio || !audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = pct + "%";
    thumb.style.left = pct + "%";
    currentEl.textContent = formatTime(audio.currentTime);
    progress.setAttribute("aria-valuenow", String(Math.floor(audio.currentTime)));
  }

  // --- Play / pause ---
  playBtn.addEventListener("click", () => {
    const a = ensureAudio();
    if (a.paused) {
      // If the user pressed play during a loop gap, cancel it
      clearTimeout(loopTimeout);
      a.play();
    } else {
      a.pause();
    }
  });

  // --- Loop toggle ---
  if (loopBtn) {
    loopBtn.addEventListener("click", () => {
      loopOn = !loopOn;
      loopBtn.classList.toggle("is-active", loopOn);
      loopBtn.setAttribute("aria-pressed", String(loopOn));
      if (!loopOn) {
        // Cancel a pending repeat if loop is turned off mid-gap
        clearTimeout(loopTimeout);
      }
    });
  }

  // --- Seek (click or drag on progress bar) ---
  function seekFromEvent(ev) {
    const a = ensureAudio();
    if (!a.duration || !isFinite(a.duration)) return;
    const rect = progress.getBoundingClientRect();
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * a.duration;
    updateProgress();
  }

  progress.addEventListener("pointerdown", (ev) => {
    dragging = true;
    progress.setPointerCapture(ev.pointerId);
    seekFromEvent(ev);
  });
  progress.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    seekFromEvent(ev);
  });
  progress.addEventListener("pointerup", () => { dragging = false; });
  progress.addEventListener("pointercancel", () => { dragging = false; });

  // --- Keyboard accessibility ---
  progress.addEventListener("keydown", (ev) => {
    const a = ensureAudio();
    if (!a.duration) return;
    const step = 5;
    if (ev.key === "ArrowLeft") {
      a.currentTime = Math.max(0, a.currentTime - step);
      updateProgress();
      ev.preventDefault();
    } else if (ev.key === "ArrowRight") {
      a.currentTime = Math.min(a.duration, a.currentTime + step);
      updateProgress();
      ev.preventDefault();
    } else if (ev.key === " ") {
      if (a.paused) a.play(); else a.pause();
      ev.preventDefault();
    }
  });
}
