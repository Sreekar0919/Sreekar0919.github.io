// A side view of a brain made of ~450 neurons. Spikes travel along connections;
// the cursor excites nearby cells and a click fires a burst.
(() => {
  const canvas = document.getElementById("brain");
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // brain silhouette as a union of ellipses, in units where the cerebrum is ~1.6 wide.
  // [cx, cy, rx, ry, rotation]; front of the brain faces left.
  const PARTS = [
    [0.0, -0.06, 0.8, 0.5, 0],        // cerebrum
    [-0.12, 0.24, 0.5, 0.2, 0.05],    // temporal lobe
    [0.5, 0.36, 0.26, 0.16, -0.15],   // cerebellum
    [0.28, 0.52, 0.07, 0.2, -0.35],   // brainstem
  ];
  // empty bands so the lobes read: the lateral (Sylvian) fissure and the gap above the cerebellum
  const GAPS = [
    [-0.06, 0.1, 0.44, 0.045, -0.3],
    [0.47, 0.22, 0.26, 0.04, 0.12],
  ];
  const inEllipse = (x, y, [cx, cy, rx, ry, r]) => {
    const dx = x - cx, dy = y - cy, c = Math.cos(r), s = Math.sin(r);
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
    return u * u + v * v <= 1;
  };
  const insideBrain = (x, y) =>
    PARTS.some(p => inEllipse(x, y, p)) && !GAPS.some(g => inEllipse(x, y, g));

  const N = 450, K = 5, SPEED = 260; // neurons, connections each, px/s
  // tuned headless: ~14 of 450 cells lit on average, peaks ~30, never runs away
  const P_TRANSMIT = 0.42, REFRACTORY = 0.9, SPONTANEOUS = 4; // per second

  let nodes = [], edges = [], pulses = [], w = 0, h = 0, scale = 1;
  const mouse = { x: -1e4, y: -1e4 };
  let colors = {};

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    colors = { ink: css.getPropertyValue("--ink").trim(), accent: css.getPropertyValue("--accent").trim() };
  }

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = w > 760;
    scale = Math.min(w / (wide ? 2.6 : 2.1), h / 1.7);
    const ox = w * (wide ? 0.64 : 0.5), oy = h * (wide ? 0.48 : 0.36);

    // rejection-sample points with a minimum spacing so the shape reads evenly
    nodes = [];
    const minD = scale * 0.045;
    for (let tries = 0; nodes.length < N && tries < N * 60; tries++) {
      const x = (Math.random() * 1.8 - 0.9), y = (Math.random() * 1.4 - 0.62);
      if (!insideBrain(x, y)) continue;
      const px = ox + x * scale, py = oy + y * scale;
      if (nodes.some(n => (n.x - px) ** 2 + (n.y - py) ** 2 < minD * minD)) continue;
      nodes.push({ x: px, y: py, ux: x, uy: y, glow: 0, rest: 0, out: [] });
    }

    // an edge may not jump across a fissure
    const crossesGap = (a, b) => {
      for (let t = 0.2; t < 1; t += 0.2) {
        const x = a.ux + (b.ux - a.ux) * t, y = a.uy + (b.uy - a.uy) * t;
        if (GAPS.some(g => inEllipse(x, y, g))) return true;
      }
      return false;
    };

    edges = [];
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2])
        .filter(([j]) => j !== i && !crossesGap(a, nodes[j]))
        .sort((p, q) => p[1] - q[1])
        .slice(0, K);
      for (const [j] of near) {
        if (j > i || !nodes[j].out.includes(i)) {
          const len = Math.hypot(a.x - nodes[j].x, a.y - nodes[j].y);
          edges.push([i, j]);
          a.out.push(j); nodes[j].out.push(i);
          a.len = a.len || {}; a.len[j] = len;
          nodes[j].len = nodes[j].len || {}; nodes[j].len[i] = len;
        }
      }
    });
    pulses = [];
  }

  function fire(i) {
    const n = nodes[i];
    if (n.rest > 0) return;
    n.glow = 1; n.rest = REFRACTORY;
    for (const j of n.out) {
      if (Math.random() < P_TRANSMIT && pulses.length < 1500) {
        pulses.push({ a: i, b: j, t: 0, dur: n.len[j] / SPEED });
      }
    }
  }

  function step(dt) {
    if (Math.random() < SPONTANEOUS * dt) fire((Math.random() * nodes.length) | 0);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.rest = Math.max(0, n.rest - dt);
      n.glow *= Math.exp(-dt * 2.6);
      const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
      if (d < 80 && Math.random() < dt * 2.2 * (1 - d / 80)) fire(i);
    }

    pulses = pulses.filter(p => {
      p.t += dt;
      if (p.t >= p.dur) { fire(p.b); return false; }
      return true;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = colors.ink; ctx.globalAlpha = 0.07; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const [i, j] of edges) { ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); }
    ctx.stroke();

    ctx.strokeStyle = colors.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of pulses) {
      const a = nodes[p.a], b = nodes[p.b], f = p.t / p.dur, g = Math.max(0, f - 0.35);
      ctx.moveTo(a.x + (b.x - a.x) * g, a.y + (b.y - a.y) * g);
      ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    }
    ctx.stroke();

    for (const n of nodes) {
      ctx.globalAlpha = 0.28 + 0.72 * n.glow;
      ctx.fillStyle = n.glow > 0.08 ? colors.accent : colors.ink;
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.3 + 1.6 * n.glow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); draw();
    requestAnimationFrame(loop);
  }

  const setMouse = e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
  canvas.addEventListener("pointermove", setMouse);
  canvas.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });
  canvas.addEventListener("pointerdown", e => {
    setMouse(e);
    nodes.forEach((n, i) => { if (Math.hypot(n.x - mouse.x, n.y - mouse.y) < 45) fire(i); });
  });

  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

  readColors(); build();
  if (still) draw(); else requestAnimationFrame(loop);
})();
