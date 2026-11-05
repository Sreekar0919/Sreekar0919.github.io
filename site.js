// Tabs. Each tab is filed under a brain region; opening it fires that region.
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));

  function open(i, { focus = false, fire = true } = {}) {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
    history.replaceState(null, "", `#${tabs[i].dataset.key}`);
    if (fire) window.brain.excite(...regionOf(tabs[i]));
  }

  const regionOf = t => t.dataset.region.split(",").map(Number);

  // as in v2: a region keeps firing for as long as its tab is hovered
  let hoverTimer;
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => open(i));
    t.addEventListener("pointerenter", () => {
      const [x, y] = regionOf(t);
      window.brain.excite(x, y);
      clearInterval(hoverTimer);
      hoverTimer = setInterval(() => window.brain.excite(x, y, 0.08), 450);
    });
    t.addEventListener("pointerleave", () => clearInterval(hoverTimer));
  });

  // the open tab's region pulses quietly so you can always see where you are
  setInterval(() => {
    const t = tabs.find(x => x.getAttribute("aria-selected") === "true");
    if (t && !document.hidden) window.brain.excite(...regionOf(t), 0.06);
  }, 2200);

  // arrow keys move between tabs, as screen-reader users expect
  document.querySelector('[role="tablist"]').addEventListener("keydown", e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (next) { e.preventDefault(); open((i + next + tabs.length) % tabs.length, { focus: true }); }
    if (e.key === "Home") { e.preventDefault(); open(0, { focus: true }); }
    if (e.key === "End") { e.preventDefault(); open(tabs.length - 1, { focus: true }); }
  });

  const start = tabs.findIndex(t => `#${t.dataset.key}` === location.hash);
  open(Math.max(0, start), { fire: false });
})();

// Trumpet: three valves + hold to play. Valve combinations follow the real fingering chart
// on one partial (written C5, which sounds a concert B-flat on a B-flat trumpet).
(() => {
  const horn = document.getElementById("trumpet");
  if (!horn) return;
  const STEPS = { "000": 0, "010": -1, "100": -2, "110": -3, "011": -4, "101": -5, "111": -6 };
  const WRITTEN = { "000": "C", "010": "B", "100": "B♭", "110": "A", "011": "A♭", "101": "G", "111": "F♯" };
  const valves = [0, 0, 0];
  const keyFor = () => valves.join("");
  const hz = () => 466.16 * 2 ** (STEPS[keyFor()] / 12);
  const noteOut = horn.querySelector(".note");
  let audio, voice;

  const show = () => { noteOut.textContent = `written ${WRITTEN[keyFor()]}`; };

  function blow() {
    if (voice) return;
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    const osc = audio.createOscillator(), filter = audio.createBiquadFilter(), amp = audio.createGain();
    const vib = audio.createOscillator(), vibDepth = audio.createGain();
    osc.type = "sawtooth"; osc.frequency.value = hz();
    filter.type = "lowpass"; filter.Q.value = 2;
    filter.frequency.setValueAtTime(500, t); filter.frequency.linearRampToValueAtTime(2600, t + 0.08);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.16, t + 0.05);
    vib.frequency.value = 5.5; vibDepth.gain.setValueAtTime(0, t); vibDepth.gain.linearRampToValueAtTime(4, t + 0.6);
    vib.connect(vibDepth).connect(osc.frequency);
    osc.connect(filter).connect(amp).connect(audio.destination);
    osc.start(); vib.start();
    voice = { osc, vib, amp };
    horn.classList.add("playing");
  }

  function rest() {
    if (!voice) return;
    const t = audio.currentTime;
    voice.amp.gain.cancelScheduledValues(t);
    voice.amp.gain.setTargetAtTime(0, t, 0.03);
    voice.osc.stop(t + 0.2); voice.vib.stop(t + 0.2);
    voice = null;
    horn.classList.remove("playing");
  }

  function press(i, down) {
    valves[i] = down ? 1 : 0;
    horn.querySelectorAll(".valve")[i].setAttribute("aria-pressed", String(down));
    if (voice) voice.osc.frequency.setTargetAtTime(hz(), audio.currentTime, 0.015);
    show();
  }

  horn.querySelectorAll(".valve").forEach((v, i) =>
    v.addEventListener("click", () => press(i, !valves[i])));
  const mouthpiece = horn.querySelector(".blow");
  mouthpiece.addEventListener("pointerdown", e => { e.preventDefault(); blow(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => mouthpiece.addEventListener(ev, rest));

  // keyboard, only while the trumpet has focus: 1 2 3 hold valves, space blows
  horn.addEventListener("keydown", e => {
    if (e.repeat) return;
    if ("123".includes(e.key)) press(+e.key - 1, true);
    if (e.code === "Space") { e.preventDefault(); blow(); }
  });
  horn.addEventListener("keyup", e => {
    if ("123".includes(e.key)) press(+e.key - 1, false);
    if (e.code === "Space") rest();
  });
  horn.addEventListener("focusout", rest);
  show();
})();
