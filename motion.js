/* ═══════════════════════════════════════════════════════════
   motion layer — progressive enhancement
   The dossier is complete without this file: every effect adds,
   none restructures. ?motion=off shows the static page, and
   prefers-reduced-motion is respected.
   ═══════════════════════════════════════════════════════════ */
(() => {
  if (new URLSearchParams(location.search).get('motion') === 'off') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('motion');

  // ─── helpers ───
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lang = () => (root.lang || 'zh').startsWith('zh') ? 'zh' : 'en';
  const make = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  };
  // a pair of spans the page's own language toggle will show / hide
  const pair = (zh, en) =>
    `<span data-zh${lang() === 'zh' ? '' : ' hidden'}>${zh}</span><span data-en${lang() === 'en' ? '' : ' hidden'}>${en}</span>`;
  const onLang = fn => $$('.lang-toggle button').forEach(b =>
    b.addEventListener('click', () => requestAnimationFrame(() => fn(b.dataset.lang))));

  // one shared frame loop; each ticker returns true while it still wants frames
  const tickers = new Set();
  let raf = 0, last = 0;
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  function frame(now) {
    const dt = Math.min(0.034, (now - last) / 1000); last = now;
    let more = false;
    for (const t of tickers) if (t(dt, now)) more = true;
    raf = more ? requestAnimationFrame(frame) : 0;
  }
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);

  // damped spring toward .t; returns true while still moving
  const spring = (s, dt, k, c) => {
    s.v += (k * (s.t - s.x) - c * s.v) * dt;
    s.x += s.v * dt;
    return Math.abs(s.v) > 1e-3 || Math.abs(s.t - s.x) > 1e-3;
  };

  // ─── 1 · masthead: the Guide looks the entry up ───
  (function masthead() {
    const meta = $('.entry-meta span');
    const m = meta && meta.textContent.match(/^(.*?)(\d+)$/);
    if (m) {
      const [, label, num] = m;
      meta.textContent = label;
      const odo = make('span', 'odo');
      odo.setAttribute('aria-label', num);
      const cols = [...num].map(d => {
        const col = make('span', 'odo-col', '0123456789'.repeat(2).split('').map(x => `<span>${x}</span>`).join(''));
        col.setAttribute('aria-hidden', 'true');
        col.dataset.d = d;
        odo.appendChild(col);
        return col;
      });
      meta.appendChild(odo);
      setTimeout(() => cols.forEach((col, i) => {
        col.style.transitionDelay = `${i * 160}ms`;
        col.style.transform = `translateY(${-(10 + +col.dataset.d) * 1.2}em)`;
      }), 250);
      setTimeout(() => { meta.textContent = label + num; }, 2100);
    }

    const parts = $$('.guide-title .zh-name, .guide-title .latin');
    let i = 0;
    parts.forEach(p => {
      const txt = p.textContent;
      p.dataset.txt = txt;
      p.textContent = '';
      for (const ch of txt) {
        const s = make('span', 'ink-ch');
        s.textContent = ch;
        if (ch === ' ') s.style.whiteSpace = 'pre';
        s.style.transitionDelay = `${150 + i++ * 55}ms`;
        p.appendChild(s);
      }
    });
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.ink-ch').forEach(s => s.classList.add('in'))));
    // give the letters back their kerning once they have landed
    setTimeout(() => parts.forEach(p => { p.textContent = p.dataset.txt; }), 150 + i * 55 + 900);
  })();

  // ─── 2 · Don't Panic: a rubber stamp, and a 42 ───
  (function panic() {
    const box = $('.panic');
    if (!box) return;
    const text = $('.panic-text', box);
    const cites = $$('.panic-cite', box);
    const ring = make('div', 'panic-ring');
    box.appendChild(ring);
    setTimeout(() => {
      ring.classList.add('go');
      $('.masthead').classList.add('thud');
    }, 700 + 450);

    const split = () => {
      const t = text.textContent;
      // one span per letter, built as nodes: the text never goes back through innerHTML
      text.replaceChildren(...[...t].map(ch => { const s = make('span', 'pl'); s.textContent = ch; return s; }));
      text.setAttribute('aria-label', t);
    };
    split();

    // letters near the pointer lift, each on its own spring
    let springs = [], centers = [], hovering = false, px = 0;
    const measure = () => {
      const letters = $$('.pl', text);
      centers = letters.map(l => l.offsetLeft + l.offsetWidth / 2);
      springs = letters.map((_, i) => springs[i] || { x: 0, v: 0, t: 0 });
    };
    box.addEventListener('pointerenter', () => { measure(); hovering = true; kick(); });
    box.addEventListener('pointermove', e => { px = e.clientX - text.getBoundingClientRect().left; kick(); });
    box.addEventListener('pointerleave', () => { hovering = false; kick(); });
    tickers.add(dt => {
      const letters = $$('.pl', text);
      if (letters.length !== springs.length) return false;
      let moving = false;
      letters.forEach((l, i) => {
        const s = springs[i];
        s.t = hovering ? -Math.max(0, 1 - Math.abs(px - centers[i]) / 70) * 7 : 0;
        if (spring(s, dt, 320, 16)) moving = true;
        l.style.transform = `translateY(${s.x.toFixed(2)}px) rotate(${(s.x * -0.9).toFixed(2)}deg)`;
      });
      return moving;
    });

    // the answer: type 4 then 2, or triple-click the stamp
    const flip = swap => {
      box.classList.remove('flip'); void box.offsetWidth; box.classList.add('flip');
      setTimeout(swap, 330);
      setTimeout(() => box.classList.remove('flip'), 680);
    };
    let busy = false;
    const answer = () => {
      if (busy) return;
      busy = true;
      const saved = [text.textContent, ...cites.map(c => c.textContent)];
      flip(() => {
        text.textContent = '42';
        if (cites[0]) cites[0].textContent = '— 生命、宇宙以及一切的终极答案';
        if (cites[1]) cites[1].textContent = '— the answer to life, the universe and everything';
      });
      setTimeout(() => flip(() => {
        text.textContent = saved[0];
        cites.forEach((c, i) => { c.textContent = saved[i + 1]; });
        split();
        busy = false;
      }), 3400);
    };
    let keys = '';
    addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      keys = (keys + e.key).slice(-2);
      if (keys === '42') answer();
    });
    let clicks = 0, timer = 0;
    box.addEventListener('click', () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 900);
      if (clicks === 3) { clicks = 0; answer(); }
    });
  })();

  // ─── 3 · switching language: carbon ⇄ silicon ───
  (function translate() {
    const HAN = '碳硅译码漫游指南词条田野日志器', LAT = 'abcdefghijkmnopqrstuvwxyz0101';
    const isHan = ch => /[一-鿿]/.test(ch);
    const inView = el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    };
    const decode = (el, delay) => {
      const final = el.textContent;
      const n = final.length;
      const start = performance.now() + delay;
      const dur = 480 + n * 7;
      el.classList.add('decoding');
      const step = now => {
        const t = (now - start) / dur;
        if (t >= 1) { el.textContent = final; el.classList.remove('decoding'); return; }
        if (t >= 0) {
          let out = '';
          for (let i = 0; i < n; i++) {
            const ch = final[i];
            if (ch === ' ' || t >= 0.2 + 0.75 * (i / n)) out += ch;
            else {
              const pool = isHan(ch) ? HAN : LAT;
              out += pool[(Math.random() * pool.length) | 0];
            }
          }
          el.textContent = out;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    onLang(l => {
      $$(`[data-${l}]`).filter(el => !el.hidden && inView(el)).forEach((el, i) => {
        if (el.children.length === 0 && el.textContent.trim().length <= 90) decode(el, i * 30);
        else {
          el.classList.remove('wash'); void el.offsetWidth;
          el.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
          el.classList.add('wash');
        }
      });
    });
  })();

  // ─── 4 · an FDE's day: the sun crosses the three cards ───
  (function day() {
    const solve = $('.solve');
    if (!solve) return;
    const cards = $$('.solve-card', solve);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'dayarc');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path class="track"/><path class="trail"/>
      <g class="sun"><circle class="glow" r="15" opacity=".18"/><g class="rays"></g><circle class="disc" r="7.5"/>
      <circle class="bite" r="6.6" cx="4" cy="-2.5" opacity="0"/></g>`;
    solve.before(svg);
    const track = $('.track', svg), trail = $('.trail', svg), sun = $('.sun', svg);
    const rays = $('.rays', svg), disc = $('.disc', svg), glow = $('.glow', svg), bite = $('.bite', svg);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', (Math.cos(a) * 10.5).toFixed(2)); l.setAttribute('y1', (Math.sin(a) * 10.5).toFixed(2));
      l.setAttribute('x2', (Math.cos(a) * 14).toFixed(2)); l.setAttribute('y2', (Math.sin(a) * 14).toFixed(2));
      rays.appendChild(l);
    }
    // meter for card ii, and its counting label
    const meter = make('div', 'meter', '<i></i><b>0%</b>');
    const ii = cards[1];
    if (ii) ii.appendChild(meter);

    let W = 0, len = 0, stops = [], stacked = false;
    const H = 84, pad = 14;
    bite.setAttribute('fill', getComputedStyle(root).getPropertyValue('--paper').trim() || '#ede4cf');
    const layout = () => {
      W = svg.clientWidth;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const d = `M ${pad} ${H - 8} Q ${W / 2} ${-H * 0.62} ${W - pad} ${H - 8}`;
      track.setAttribute('d', d); trail.setAttribute('d', d);
      len = trail.getTotalLength();
      stacked = getComputedStyle(solve).gridTemplateColumns.split(' ').length < 2;
      const left = svg.getBoundingClientRect().left;
      stops = cards.map(c => {
        const r = c.getBoundingClientRect();
        return clamp((r.left + r.width / 2 - left - pad) / (W - 2 * pad), 0, 1);
      });
    };
    layout();
    addEventListener('resize', layout);

    const P = { x: 0, v: 0, t: 0 };
    const dawn = [199, 120, 43], noon = [217, 164, 65], dusk = [139, 30, 30], moon = [42, 90, 94];
    const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
    const rgb = c => `rgb(${c.join(',')})`;
    let spin = 0, counted = false;

    tickers.add((dt, now) => {
      const r = solve.getBoundingClientRect(), vh = innerHeight;
      P.t = clamp((vh * 0.85 - r.top) / (vh * 0.55), 0, 1);
      const moving = spring(P, dt, 60, 14);
      const p = clamp(P.x, 0, 1);
      const pt = trail.getPointAtLength(p * len);
      sun.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      trail.setAttribute('stroke-dasharray', `${(p * len).toFixed(1)} ${len.toFixed(1)}`);
      const c = p < 0.5 ? mix(dawn, noon, p / 0.5) : p < 0.86 ? mix(noon, dusk, (p - 0.5) / 0.36) : mix(dusk, moon, clamp((p - 0.86) / 0.1, 0, 1));
      disc.setAttribute('fill', rgb(c)); glow.setAttribute('fill', rgb(c));
      const night = clamp((p - 0.86) / 0.1, 0, 1);
      rays.setAttribute('stroke', rgb(c)); rays.setAttribute('opacity', (1 - night).toFixed(2));
      bite.setAttribute('opacity', night.toFixed(2));
      spin += dt * 0.6;
      rays.setAttribute('transform', `rotate(${(spin * 57.3).toFixed(1)})`);
      solve.style.setProperty('--sunx', `${(pt.x / W * 100).toFixed(1)}%`);
      solve.style.setProperty('--glow', `rgba(${c.join(',')}, ${(0.12 * (1 - night) + 0.06 * night).toFixed(3)})`);
      cards.forEach((card, i) => {
        const lit = stacked ? card.getBoundingClientRect().top < vh * 0.72 : p >= stops[i] - 0.04;
        card.classList.toggle('lit', lit);
        if (lit && i === 1 && !counted) {
          counted = true;
          const b = $('b', meter), t0 = now + 150;
          const count = n => {
            const k = clamp((n - t0) / 1100, 0, 1);
            b.textContent = `${Math.round(80 * (1 - Math.pow(1 - k, 3)))}%`;
            if (k < 1) requestAnimationFrame(count);
          };
          requestAnimationFrame(count);
        }
      });
      // keep the rays turning only while the section is on screen
      return moving || (r.bottom > 0 && r.top < vh);
    });
  })();

  // ─── 5 · general vs vertical: silos fall, then it spreads ───
  (function generalVsVertical() {
    const method = $('.method');
    if (!method) return;
    const leads = $$('.method-lead', method);
    const wrap = make('div', 'gv');
    wrap.innerHTML = `<button class="gv-replay" type="button">${pair('↺ 重播', '↺ replay')}</button>
      <div class="gv-count"><b>0</b><small>${pair('人', 'members')}</small></div>
      <canvas aria-hidden="true"></canvas><div class="gv-cap"></div>`;
    leads[leads.length - 1].after(wrap);
    const cv = $('canvas', wrap), ctx = cv.getContext('2d'), cap = $('.gv-cap', wrap);
    const countEl = $('.gv-count b', wrap);

    const DEPT = [['人事', 'HR'], ['销售', 'Sales'], ['法务', 'Legal'], ['财务', 'Finance'], ['IT', 'IT'], ['研发', 'R&D']];
    const CAP = {
      silo: ['垂类：每个部门一座孤岛，越筑越高', 'vertical: one silo per department, built ever higher'],
      net: ['通用：一个够好的agent，人传人', 'general: one good agent, passed person to person'],
    };
    const INK = '#3a342b', GHOST = '#a39a82', GILT = '#b88b3a', CRIMSON = '#8b1e1e';
    const FINAL = 2200;

    let W = 0, H = 0, dpr = 1, silos = [], dots = [], edges = [], seed = 0, maxInf = 1;
    let t0 = 0, running = false, capKey = '';
    // seeded random, so a replay tells the same story
    let rs = 7;
    const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);

    function build() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rs = 7;
      const base = H - 26, margin = 18;
      const slot = (W - 2 * margin) / DEPT.length, sw = Math.min(58, slot - 16);
      silos = DEPT.map((d, i) => ({
        x: margin + slot * i + (slot - sw) / 2, w: sw, base,
        h: { x: 0, v: 0, t: 70 + rnd() * 70 }, label: d,
      }));
      const N = W < 520 ? 96 : 150;
      const cols = Math.round(Math.sqrt(N * W / H)), rows = Math.ceil(N / cols);
      const cw = (W - 28) / cols, ch = (H - 34) / rows;
      dots = [];
      for (let k = 0; k < N; k++) {
        const cx = 14 + (k % cols + 0.5) * cw + (rnd() - 0.5) * cw * 0.7;
        const cy = 26 + (Math.floor(k / cols) + 0.5) * ch + (rnd() - 0.5) * ch * 0.7;
        const s = k < DEPT.length * 5 ? silos[k % DEPT.length] : null;
        dots.push({
          tx: cx, ty: cy, silo: s,
          x: s ? s.x + 6 + rnd() * (s.w - 12) : cx, y: s ? base - 8 - rnd() * 30 : cy,
          vx: 0, vy: 0, born: s ? 0 : 3100 + rnd() * 700, inf: Infinity,
        });
      }
      // nearest neighbours → edges; infection time = shortest path with random delays
      edges = [];
      const near = dots.map((a, i) => dots.map((b, j) => [j, (a.tx - b.tx) ** 2 + (a.ty - b.ty) ** 2])
        .filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 4).map(([j]) => j));
      near.forEach((js, i) => js.forEach(j => { if (i < j || !near[j].includes(i)) edges.push([i, j, 90 + rnd() * 260]); }));
      const adj = dots.map(() => []);
      edges.forEach(([a, b, w]) => { adj[a].push([b, w]); adj[b].push([a, w]); });
      seed = dots.reduce((best, d, i) => (Math.hypot(d.tx - W * 0.18, d.ty - H * 0.5) < Math.hypot(dots[best].tx - W * 0.18, dots[best].ty - H * 0.5) ? i : best), 0);
      dots[seed].inf = 0;
      const done = new Set(), queue = [seed];
      while (queue.length) {
        queue.sort((a, b) => dots[a].inf - dots[b].inf);
        const u = queue.shift();
        if (done.has(u)) continue;
        done.add(u);
        for (const [v, w] of adj[u]) if (dots[u].inf + w < dots[v].inf) { dots[v].inf = dots[u].inf + w; queue.push(v); }
      }
      maxInf = Math.max(...dots.map(d => (Number.isFinite(d.inf) ? d.inf : 0))) || 1;
      dots.forEach(d => { if (!Number.isFinite(d.inf)) d.inf = maxInf; });
    }

    const setCap = key => {
      if (key === capKey) return;
      capKey = key;
      cap.innerHTML = key ? pair(...CAP[key]) : '';
    };
    const fmt = n => (lang() === 'zh' ? String(n) : n.toLocaleString('en-US'));

    function draw(t, dt) {
      ctx.clearRect(0, 0, W, H);
      const net = t > 3100;
      const fall = clamp((t - 2300) / 800, 0, 1);
      const spreadT = clamp((t - 3500) / 2600, 0, 1) * maxInf;

      // silos rise, creep higher, then fall outward
      if (fall < 1) {
        silos.forEach((s, i) => {
          if (t > 1500) s.h.t += dt * 14;
          if (t > i * 120) spring(s.h, dt, 90, 11);
          const h = s.h.x * (1 - fall), lean = fall * 0.9, a = 1 - fall;
          ctx.strokeStyle = INK; ctx.globalAlpha = a; ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(s.x, s.base); ctx.lineTo(s.x - Math.sin(lean) * h, s.base - Math.cos(lean) * h);
          ctx.moveTo(s.x + s.w, s.base); ctx.lineTo(s.x + s.w + Math.sin(lean) * h, s.base - Math.cos(lean) * h);
          ctx.moveTo(s.x, s.base); ctx.lineTo(s.x + s.w, s.base);
          ctx.stroke();
          ctx.globalAlpha = a * 0.9; ctx.fillStyle = GHOST;
          ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
          ctx.fillText(s.label[lang() === 'zh' ? 0 : 1], s.x + s.w / 2, s.base + 15);
          ctx.globalAlpha = 1;
        });
      }

      // edges light up behind the spread
      if (net) {
        ctx.lineWidth = 1;
        for (const [a, b] of edges) {
          const A = dots[a], B = dots[b];
          const on = A.inf <= spreadT && B.inf <= spreadT;
          ctx.strokeStyle = on ? GILT : INK;
          ctx.globalAlpha = on ? 0.4 : 0.06 * clamp((t - 3100) / 600, 0, 1);
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // people: trapped in silos first, then released onto one field
      let lit = 0;
      dots.forEach((d, i) => {
        if (t < d.born) return;
        if (!net && d.silo && fall < 0.35) {
          const s = d.silo, top = s.base - s.h.x + 6;
          d.vx += (rnd() - 0.5) * 60 * dt; d.vy += (rnd() - 0.5) * 60 * dt;
          d.vx *= 0.96; d.vy *= 0.96;
          d.x = clamp(d.x + d.vx, s.x + 4, s.x + s.w - 4);
          d.y = clamp(d.y + d.vy, Math.min(top, s.base - 6), s.base - 5);
        } else if (net || fall >= 0.35) {
          const k = net ? 38 : 8, c = net ? 8.5 : 4;
          d.vx += (k * (d.tx - d.x) - c * d.vx) * dt; d.vy += (k * (d.ty - d.y) - c * d.vy) * dt;
          d.x += d.vx * dt; d.y += d.vy * dt;
        }
        const on = net && d.inf <= spreadT;
        if (on) lit++;
        const alpha = d.silo ? 1 : clamp((t - d.born) / 500, 0, 1);
        if (on) {
          ctx.globalAlpha = 0.18 * alpha; ctx.fillStyle = GILT;
          ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = alpha; ctx.fillStyle = on ? GILT : GHOST;
        ctx.beginPath(); ctx.arc(d.x, d.y, on ? 2.8 : 2.3, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        if (net && i === seed) {
          ctx.fillStyle = CRIMSON; ctx.font = '14px "Cormorant Garamond", serif'; ctx.textAlign = 'center';
          ctx.fillText('✦', d.x, d.y - 7);
        }
      });

      setCap(t < 2400 ? 'silo' : t > 2900 ? 'net' : '');
      if (net) {
        wrap.classList.add('spreading');
        const n = spreadT >= maxInf ? FINAL : Math.round(FINAL * lit / dots.length);
        countEl.textContent = spreadT >= maxInf ? `${fmt(FINAL)}+` : fmt(n);
      }
      return t < 6400;
    }

    const start = () => {
      build();
      wrap.classList.remove('done', 'spreading');
      countEl.textContent = '0';
      capKey = '';
      t0 = performance.now();
      if (!running) { running = true; tickers.add(tick); kick(); }
    };
    const tick = (dt, now) => {
      const more = draw(now - t0, dt);
      if (!more) { running = false; tickers.delete(tick); wrap.classList.add('done'); }
      return more;
    };
    // a static first frame until the block scrolls into view
    build(); draw(0, 0);
    new IntersectionObserver((es, io) => es.forEach(e => {
      if (e.isIntersecting) { io.disconnect(); start(); }
    }), { threshold: 0.6 }).observe(wrap);
    $('.gv-replay', wrap).addEventListener('click', start);
    addEventListener('resize', () => {
      if (running) return;
      build();
      if (wrap.classList.contains('done')) {
        dots.forEach(d => { d.x = d.tx; d.y = d.ty; });
        draw(99999, 0);
      } else draw(0, 0);
    });
    onLang(() => {
      if (capKey) { const k = capKey; capKey = ''; setCap(k); }
      if (wrap.classList.contains('done')) countEl.textContent = `${fmt(FINAL)}+`;
      if (!running) { if (wrap.classList.contains('done')) draw(99999, 0); else draw(0, 0); }
    });
  })();

  // ─── 6 · field log: the line draws as you read ───
  (function fieldlog() {
    const list = $('.fieldlog');
    if (!list) return;
    const entries = $$('.log-entry', list);
    const midea = $('[data-countries]', list);
    if (midea) {
      const dots = make('span', 'c13');
      dots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < +midea.dataset.countries; i++) {
        const d = make('i');
        d.style.transitionDelay = `${250 + i * 70}ms`;
        dots.appendChild(d);
      }
      $('.log-org', midea).appendChild(dots);
    }
    const D = { x: 0, v: 0, t: 0 };
    tickers.add(dt => {
      const r = list.getBoundingClientRect();
      D.t = Math.max(D.t, clamp((innerHeight * 0.78 - r.top) / r.height, 0, 1));
      const moving = spring(D, dt, 70, 15);
      list.style.setProperty('--draw', clamp(D.x, 0, 1).toFixed(4));
      const hgt = list.offsetHeight;
      entries.forEach(e => { if (D.x >= (e.offsetTop + 12) / hgt) e.classList.add('reached'); });
      return moving;
    });
    kick();
  })();

  // ─── 7 · fine print deserves a loupe ───
  (function loupe() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const box = $('.buqi'), list = box && $('.buqi-list', box);
    if (!list) return;
    const S = 1.9, R = 75;
    const lens = make('div', 'loupe');
    let clone = null;
    box.appendChild(lens);
    list.addEventListener('pointerenter', () => {
      clone = list.cloneNode(true);
      clone.style.width = `${list.clientWidth}px`;
      lens.replaceChildren(clone);
      lens.classList.add('on');
    });
    list.addEventListener('pointerleave', () => lens.classList.remove('on'));
    list.addEventListener('pointermove', e => {
      if (!clone) return;
      const lr = list.getBoundingClientRect(), br = box.getBoundingClientRect();
      const x = e.clientX - lr.left, y = e.clientY - lr.top;
      lens.style.left = `${e.clientX - br.left - R}px`;
      lens.style.top = `${e.clientY - br.top - R}px`;
      clone.style.transform = `translate(${R - x * S}px, ${R - y * S}px) scale(${S})`;
    });
  })();

  // ─── 8 · hand it off ───
  (function handoff() {
    const contact = $('.contact');
    if (!contact) return;
    const heads = $$('.contact-headline', contact);
    const link = $('.contact-row a', contact);
    const PH = { zh: '写下那件活，比如：每周五的周报', en: 'name the chore, e.g. the Friday status report' };
    const SUBJ = { zh: '想甩给机器的活：', en: "A chore I'd hand off: " };
    const form = make('form', 'handoff');
    form.innerHTML = `<input type="text" maxlength="60" autocomplete="off">
      <button type="submit">${pair('甩给机器 →', 'hand it off →')}</button>`;
    heads[heads.length - 1].after(form);
    const input = $('input', form);
    const setPh = l => { input.placeholder = PH[l]; input.setAttribute('aria-label', PH[l]); };
    setPh(lang());
    onLang(setPh);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) {
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        input.focus();
        return;
      }
      const a = input.getBoundingClientRect(), b = link.getBoundingClientRect();
      const chip = make('div', 'chip');
      chip.textContent = text;
      document.body.appendChild(chip);
      const x0 = a.left + Math.min(a.width / 2, 120), y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 90;
      const T = performance.now(), D = 720;
      const subject = SUBJ[lang()] + text;
      input.value = '';
      const step = now => {
        const t = Math.min(1, (now - T) / D);
        const e2 = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, u = 1 - e2;
        const x = u * u * x0 + 2 * u * e2 * cx + e2 * e2 * x1;
        const y = u * u * y0 + 2 * u * e2 * cy + e2 * e2 * y1;
        chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 - 0.75 * e2}) rotate(${(e2 * -14).toFixed(1)}deg)`;
        chip.style.opacity = t > 0.85 ? String(1 - (t - 0.85) / 0.15) : '1';
        if (t < 1) { requestAnimationFrame(step); return; }
        chip.remove();
        link.classList.remove('gulp'); void link.offsetWidth; link.classList.add('gulp');
        setTimeout(() => { location.href = `${link.getAttribute('href')}?subject=${encodeURIComponent(subject)}`; }, 420);
      };
      requestAnimationFrame(step);
    });
  })();

  kick();
})();
