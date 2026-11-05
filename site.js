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
    if (fire) {
      const [x, y] = tabs[i].dataset.region.split(",").map(Number);
      window.brain.excite(x, y);
    }
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => open(i));
    t.addEventListener("pointerenter", () => {
      const [x, y] = t.dataset.region.split(",").map(Number);
      window.brain.excite(x, y, 0.09);
    });
  });

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
