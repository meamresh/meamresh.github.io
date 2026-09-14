// A sheet of hairline grid, drawn in ink on the page, that dips toward the cursor.
// A click leaves a mass behind (up to six). No stars, no glow, no colour.
(() => {
  const canvas = document.getElementById('fabric');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const INK = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1E2A3A';
  const MAX_MASSES = 6;
  const EPS = 22;
  const CURSOR = 30;

  let W = 0, H = 0, dpr = 1;
  const fabricW = 182, fabricH = 124;
  let gridX = 72, gridY = 40;
  let verts = [];

  function build() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gridX = W < 900 ? 56 : 84; gridY = W < 900 ? 32 : 46;
    verts = [];
    for (let iy = 0; iy <= gridY; iy++)
      for (let ix = 0; ix <= gridX; ix++)
        verts.push({ x: (ix / gridX - 0.5) * fabricW, y: (iy / gridY - 0.5) * fabricH, z: 0 });
  }

  const cursor = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
  const masses = [];

  function toFabric(cx, cy) {
    return {
      x: Math.max(-fabricW / 2 + 1.4, Math.min(fabricW / 2 - 1.4, (cx / W - 0.5) * fabricW)),
      y: Math.max(-fabricH / 2 + 1.4, Math.min(fabricH / 2 - 1.4, ((1 - cy / H) - 0.5) * fabricH))
    };
  }
  function toScreen(x, y, z) {
    const depth = 1 / (1 + (58 - y) * 0.012);
    return {
      sx: W * 0.5 + x * depth * (W / 220),
      sy: H * 0.5 - (y * 0.58 + z * 1.6) * depth * (H / 180) - H * 0.12
    };
  }
  const dip = (vx, vy, mx, my, s) => -s / Math.sqrt((vx - mx) ** 2 + (vy - my) ** 2 + EPS);

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', e => {
      const p = toFabric(e.clientX, e.clientY);
      cursor.tx = p.x; cursor.ty = p.y; cursor.ts = CURSOR;
    }, { passive: true });
    window.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('a, button, input')) return;
      const p = toFabric(e.clientX, e.clientY);
      masses.push({ x: p.x, y: p.y, s: 0, ts: 16 + Math.random() * 10 });
      if (masses.length > MAX_MASSES) masses.shift();
    }, { passive: true });
    const release = () => { cursor.ts = 0; };
    window.addEventListener('blur', release);
    document.addEventListener('mouseleave', release);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (window.scrollY > H * 0.9) return;          // nothing visible, skip the work

    cursor.x += (cursor.tx - cursor.x) * 0.16;
    cursor.y += (cursor.ty - cursor.y) * 0.16;
    cursor.s += (cursor.ts - cursor.s) * 0.085;
    for (const m of masses) m.s += (m.ts - m.s) * 0.08;

    for (const v of verts) {
      let z = dip(v.x, v.y, cursor.x, cursor.y, cursor.s);
      for (const m of masses) z += dip(v.x, v.y, m.x, m.y, m.s);
      v.z += (z - v.z) * 0.12;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 0.6;

    for (let iy = 0; iy <= gridY; iy++) {
      ctx.beginPath();
      for (let ix = 0; ix <= gridX; ix++) {
        const v = verts[iy * (gridX + 1) + ix], p = toScreen(v.x, v.y, v.z);
        ix ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy);
      }
      ctx.stroke();
    }
    for (let ix = 0; ix <= gridX; ix += 2) {
      ctx.beginPath();
      for (let iy = 0; iy <= gridY; iy++) {
        const v = verts[iy * (gridX + 1) + ix], p = toScreen(v.x, v.y, v.z);
        iy ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy);
      }
      ctx.stroke();
    }

    // a mass is a small filled dot, nothing more
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = INK;
    for (const m of masses) {
      const p = toScreen(m.x, m.y, -2.2);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  build();
  window.addEventListener('resize', build, { passive: true });
  frame();
})();
