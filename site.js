// Brain-region navigation, the sticky minimap, and the three-valve trumpet.
(() => {
  const regionOf = el => el.dataset.region.split(",").map(Number);

  // hovering a region link fires that part of the hero brain
  document.querySelectorAll("[data-region]").forEach(el => {
    if (el.tagName !== "A") return;
    let timer;
    el.addEventListener("pointerenter", () => {
      const [x, y] = regionOf(el);
      window.brain.excite(x, y);
      timer = setInterval(() => window.brain.excite(x, y, 0.07), 450);
    });
    el.addEventListener("pointerleave", () => clearInterval(timer));
  });

  // minimap: a scaled-down copy of the hero's own network, drawn once in SVG
  const map = document.getElementById("minimap");
  if (map) {
    const NS = "http://www.w3.org/2000/svg";
    const pts = window.brain.points().map(([x, y]) => [(x * 100).toFixed(1), (y * 100).toFixed(1)]);
    const path = (d, cls) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d); p.setAttribute("class", cls);
      map.append(p);
    };
    path(window.brain.links().map(([i, j]) => `M${pts[i]}L${pts[j]}`).join(""), "wire");
    path(pts.map(p => `M${p}h0`).join(""), "cell");

    const sections = [...document.querySelectorAll("section[data-region]")];
    const dots = sections.map(sec => {
      const [x, y] = regionOf(sec);
      const a = document.createElementNS(NS, "a");
      a.setAttribute("href", `#${sec.id}`);
      a.innerHTML = `<circle cx="${x * 100}" cy="${y * 100}" r="5"/><title>${sec.dataset.label}</title>`;
      map.append(a);
      return a;
    });

    const label = document.getElementById("minimap-label");
    const seen = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const i = sections.indexOf(entry.target);
        dots.forEach((d, j) => d.classList.toggle("on", i === j));
        label.textContent = entry.target.dataset.label;
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(s => seen.observe(s));
  }

  // trumpet: three valves + hold to play. Valve combinations follow the real fingering chart
  // on one partial (written C5, which sounds a concert B-flat on a B-flat trumpet).
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
