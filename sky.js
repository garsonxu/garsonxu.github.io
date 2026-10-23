/* ═══════════════════════════════════════════════════════════
   sky — the night behind the page
   三层视差星缓慢右移、邻星之间连极淡的黄铜线（星座）、最亮的几颗渲成小四芒、
   不定时划过流星、斜贯一条银河带、右下角一道被画框切掉的地球弧（纹理
   earth-equirect.webp是NASA Blue Marble，公有领域）。

   流星间隔放宽到3.5–8s：本页是长文，满屏流星会抢正文。

   reduced-motion只画一帧；页面不可见就停rAF；DPR封顶2；dt封顶50ms；
   canvas只是装饰（aria-hidden），JS没跑 = 一片干净的深色底。
   ═══════════════════════════════════════════════════════════ */
(() => {
  const cv = document.querySelector('canvas.sky');
  const ctx = cv && cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CFG = {
    drift: 24,          // 最近一层的漂移px/s（再慢就看不出在动）
    density: 4600,      // 每颗星摊多少px²
    maxStars: 280,
    spikeEvery: 24,     // 每N颗渲一颗四芒
    starGain: 1.35,
    link: 110,          // 近层星之间连线的最大距离
    meteorGap: [3.5, 8],
  };
  const BRASS = '198,161,91', STAR = '245,243,238';

  let W = 0, H = 0, dpr = 1, stars = [], milky = null, meteors = [];
  let nextMeteor = 2.5, raf = 0, last = 0, t = 0;

  // ─── four-pointed star ───
  function spike(x, y, r, w, col) {
    ctx.fillStyle = col;
    for (const rot of [0, Math.PI / 2]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(w, 0); ctx.lineTo(0, r); ctx.lineTo(-w, 0);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // ─── milky way: static, so cached off-screen ───
  function makeMilkyWay() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (!x) return null;
    x.save(); x.translate(W * 0.5, H * 0.42); x.rotate(-0.42);
    const L = Math.hypot(W, H) * 1.2, band = Math.min(W, H) * 0.42;
    const g = x.createLinearGradient(0, -band / 2, 0, band / 2);
    g.addColorStop(0, 'rgba(150,175,215,0)');
    g.addColorStop(0.42, 'rgba(168,190,228,.085)');
    g.addColorStop(0.52, 'rgba(198,214,240,.115)');
    g.addColorStop(0.62, 'rgba(168,190,228,.075)');
    g.addColorStop(1, 'rgba(150,175,215,0)');
    x.fillStyle = g; x.fillRect(-L / 2, -band / 2, L, band);
    for (let i = 0; i < 320; i++) {
      const px = (Math.random() - 0.5) * L;
      const py = (Math.random() - 0.5) * band * (Math.random() < 0.6 ? 0.45 : 1);
      const a = (0.1 + Math.random() * 0.34) * (1 - Math.abs(py) / (band / 2));
      x.fillStyle = `rgba(228,236,250,${a.toFixed(3)})`;
      x.fillRect(px, py, Math.random() < 0.18 ? 1.6 : 1, 1);
    }
    x.restore();
    return c;
  }

  function newMeteor() {
    const big = Math.random() < 0.34;
    const ang = (20 + Math.random() * 16) * Math.PI / 180;
    const sp = (big ? 900 : 620) + Math.random() * 320;
    return {
      x: -80 - Math.random() * W * 0.25, y: -60 + Math.random() * H * 0.55,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      len: (big ? 240 : 130) + Math.random() * 100, wd: big ? 2.6 : 1.7,
      brass: Math.random() < 0.35, life: 0, max: 1.5 + Math.random() * 0.5,
    };
  }

  // ─── earth: an arc cut off by the frame, spinning slowly ───
  // 要点：球面逐像素采样等距圆柱
  // 纹理（不是转一张平面照片 —— 那会像转硬币）；只渲染「球 ∩ 画布」那一块；按等效
  // 直径封顶降采样；每0.22s才重算一次；圆心在画布外，只露一道弧。
  const EARTH_SRC = 'earth-equirect.webp';
  const SPIN = 150, GMAX = 640, REFRESH = 0.22;
  const LX = -0.824, LY = 0.237, LZ = -0.515;   // sun behind the globe, upper left
  const NIGHT = 0.07, TERM = 0.11, HALO = 1.13;
  let tex = null, texW = 0, texH = 0, globe = null, gctx = null, gImg = null, gRect = null;
  let R = 0, gcx = 0, gcy = 0, gAge = 99;

  function loadEarth() {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = texW = im.naturalWidth; c.height = texH = im.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true });
      if (!x) return;
      x.drawImage(im, 0, 0);
      try { tex = x.getImageData(0, 0, texW, texH).data; } catch (e) { tex = null; }
      gAge = 99;
      if (REDUCED) draw(0);
    };
    im.onerror = () => { tex = null; };   // no earth, the stars stay
    im.src = EARTH_SRC;
  }

  function renderGlobe(lon0) {
    const RH = R * HALO;
    const x0 = Math.max(0, Math.floor(gcx - RH)), y0 = Math.max(0, Math.floor(gcy - RH));
    const x1 = Math.min(W, Math.ceil(gcx + RH)), y1 = Math.min(H, Math.ceil(gcy + RH));
    const vw = x1 - x0, vh = y1 - y0;
    if (vw <= 0 || vh <= 0 || !tex) { gRect = null; return; }
    const k = Math.min(1, GMAX / (R * 2));
    const cw = Math.max(1, Math.round(vw * k)), ch = Math.max(1, Math.round(vh * k));
    if (!globe) { globe = document.createElement('canvas'); gctx = globe.getContext('2d'); }
    if (!gctx) return;
    if (globe.width !== cw || globe.height !== ch) { globe.width = cw; globe.height = ch; gImg = gctx.createImageData(cw, ch); }
    const o = gImg.data, sx = vw / cw, sy = vh / ch;
    for (let py = 0; py < ch; py++) {
      const ny = (y0 + (py + 0.5) * sy - gcy) / R, ny2 = ny * ny, row = py * cw * 4;
      if (ny2 >= HALO * HALO) { for (let px = 0; px < cw; px++) o[row + px * 4 + 3] = 0; continue; }
      const wy = -ny, inSphere = ny2 < 1;
      const vRow = inSphere ? Math.min(texH - 1, Math.max(0, (0.5 - Math.asin(wy) / Math.PI) * texH | 0)) * texW : 0;
      const ambY = wy * LY;
      for (let px = 0; px < cw; px++) {
        const nx = (x0 + (px + 0.5) * sx - gcx) / R, i = row + px * 4, r2 = nx * nx + ny2;
        if (r2 >= HALO * HALO) { o[i + 3] = 0; continue; }
        const rr = Math.sqrt(r2);
        // atmosphere: only where the grazing point is sunlit
        let lamL = (nx / rr) * LX + (wy / rr) * LY;
        lamL = lamL > 0 ? Math.pow(lamL, 0.55) : 0;
        let fall;
        if (rr >= 1) { const q = (HALO - rr) / (HALO - 1); fall = q * q; }
        else { const q = Math.max(0, (rr - 0.92) / 0.08); fall = q * q; }
        const ga = Math.min(1, lamL * fall * 0.93);
        if (r2 >= 1) { o[i] = 168; o[i + 1] = 214; o[i + 2] = 255; o[i + 3] = ga * 255; continue; }
        const nz = Math.sqrt(1 - r2);
        let u = (Math.atan2(nx, nz) / 6.283185 + 0.5 + lon0) % 1;
        if (u < 0) u += 1;
        const ti = (vRow + Math.min(texW - 1, (u * texW) | 0)) * 4;
        // Lambert with a soft terminator band, then limb darkening for volume
        const lam = nx * LX + ambY + nz * LZ;
        let lit = 0;
        if (lam > 0) { const s = Math.min(1, (lam + TERM) / (2 * TERM)); lit = Math.pow(lam, 0.72) * s * s * (3 - 2 * s); }
        const kk = (NIGHT + (1 - NIGHT) * lit) * (0.72 + 0.28 * nz);
        // atmosphere over the ground, true alpha-over so the rim does not step
        const aS = Math.min(1, (1 - rr) * R * k / 2.5), wS = aS * (1 - ga), outA = ga + wS, inv = outA > 0 ? 1 / outA : 0;
        o[i]     = (168 * ga + tex[ti]     * kk * wS) * inv;
        o[i + 1] = (214 * ga + tex[ti + 1] * kk * wS) * inv;
        o[i + 2] = (255 * ga + tex[ti + 2] * kk * wS) * inv;
        o[i + 3] = outA * 255;
      }
    }
    gctx.putImageData(gImg, 0, 0);
    gRect = { x: x0, y: y0, w: vw, h: vh };
  }

  // ─── build / draw ───
  function build() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(CFG.maxStars, Math.round(W * H / CFG.density));
    stars = Array.from({ length: n }, (_, i) => {
      const z = Math.random();
      return {
        x: Math.random() * W, y: Math.random() * H, z,
        r: 0.35 + z * 1.05,
        a: Math.min(1, (0.22 + Math.random() * 0.6) * CFG.starGain),
        tw: Math.random() * 6.28,
        spike: i % CFG.spikeEvery === 0, brass: Math.random() < 0.3,
      };
    });
    milky = makeMilkyWay();
    R = Math.min(W, H) * 0.56;        // 弧从右下扫上来，圆心在画布外
    gcx = W * 1.05; gcy = H * 1.04;
    gAge = 99;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    if (milky) ctx.drawImage(milky, 0, 0, W, H);

    for (const s of stars) {
      s.x += CFG.drift * (0.25 + 0.75 * s.z) * dt;
      if (s.x > W + 4) s.x = -4;
    }
    // constellation lines among the near layer
    ctx.lineWidth = 0.7;
    const near = stars.filter(s => s.z > 0.55);
    for (let i = 0; i < near.length; i++) {
      const a = near[i];
      for (let j = i + 1; j < near.length; j++) {
        const b = near[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d > CFG.link) continue;
        ctx.strokeStyle = `rgba(${BRASS},${((1 - d / CFG.link) * 0.16).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const s of stars) {
      const a = s.a * (0.72 + 0.28 * Math.sin(t * 1.3 + s.tw));
      if (s.spike) spike(s.x, s.y, 3.6 + s.z * 3, 0.8 + s.z * 0.5, `rgba(${s.brass ? BRASS : STAR},${a.toFixed(3)})`);
      else {
        ctx.fillStyle = `rgba(${STAR},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
      }
    }

    // meteors
    nextMeteor -= dt;
    if (!REDUCED && nextMeteor <= 0) {
      meteors.push(newMeteor());
      nextMeteor = CFG.meteorGap[0] + Math.random() * (CFG.meteorGap[1] - CFG.meteorGap[0]);
    }
    meteors = meteors.filter(m => (m.life += dt) < m.max && m.x < W + 300 && m.y < H + 300);
    for (const m of meteors) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      const k = Math.hypot(m.vx, m.vy), tx = m.x - m.vx / k * m.len, ty = m.y - m.vy / k * m.len;
      const fade = Math.min(1, m.life / 0.15) * Math.min(1, (m.max - m.life) / 0.4);
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(${m.brass ? BRASS : STAR},${(0.9 * fade).toFixed(3)})`);
      g.addColorStop(1, `rgba(${m.brass ? BRASS : STAR},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = m.wd; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
    }

    // earth last: nothing should shine through the planet
    gAge += dt;
    if (tex && gAge >= REFRESH) { renderGlobe((t / SPIN) % 1); gAge = 0; }
    if (gRect && globe) {
      ctx.save();
      ctx.globalAlpha = 0.8;            // 弧不能抢前景
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(globe, gRect.x, gRect.y, gRect.w, gRect.h);
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && !REDUCED) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  build();
  loadEarth();
  if (REDUCED) draw(0); else start();
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  let rz = 0;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { build(); if (REDUCED) draw(0); }, 150);
  });
})();
