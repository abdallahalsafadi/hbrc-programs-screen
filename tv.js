(function () {
  'use strict';
  const { Store, esc, safeUrl, fmtRange, daysUntil, daysWord, effectiveStatus, applyTheme, icons, byPublic } = App;
  const $ = s => document.querySelector(s);
  const SIZE = { 1: ['1', '4.8rem'], 2: ['2', '4rem'], 3: ['3', '3.4rem'], 4: ['2', '3.2rem'], 5: ['3', '2.7rem'], 6: ['3', '2.7rem'] };
  const VCACHE = 'hbrc-videos-v1';
  let tok = 0, S, slides = [], idx = 0, timer = null, sig = '', paused = false, pending = null, player = null, blobUrl = null;

  /* ---------- البيانات ---------- */
  async function load() {
    const [s, p] = await Promise.all([Store.getSettings(), Store.listPrograms(false)]);
    const next = JSON.stringify([s, p]);
    if (next === sig) return;
    sig = next;
    // لا نقطع فيديو أثناء تشغيله؛ نطبّق التحديث عند انتهائه
    if (slides[idx] && slides[idx].type === 'video' && player) { pending = [s, p]; return; }
    apply(s, p);
  }
  function apply(s, p) {
    S = s; pending = null;
    applyTheme(S);
    p.forEach(x => { x._st = effectiveStatus(x, S); });
    build(p);
  }

  function ytId(u) {
    const m = String(u || '').match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function build(P) {
    const mode = S.displayMode || 'programs';
    const per = Math.min(6, Math.max(1, parseInt(S.perSlide, 10) || 4));
    slides = [];
    if (mode !== 'videos') {
      const groups = [['current', S.labelCurrent], ['upcoming', S.labelUpcoming]];
      if (S.showCompleted) groups.push(['completed', S.labelCompleted]);
      groups.forEach(([key, label]) => {
        const list = P.filter(p => p._st === key).sort(byPublic);
        if (!list.length) { if (!S.hideEmpty) slides.push({ type: 'prog', key, label, items: [], n: 0 }); return; }
        const pages = Math.ceil(list.length / per);
        for (let i = 0; i < pages; i++) slides.push({ type: 'prog', key, label, items: list.slice(i * per, i * per + per), n: list.length, page: i + 1, pages });
      });
    }
    const vids = (S.videos || []).filter(v => v.visible !== false && (v.kind === 'youtube' ? ytId(v.url) : safeUrl(v.url)));
    // تكرار شرائح البرامج عدداً من المرات قبل عرض الفيديو
    if (mode === 'both' && vids.length) {
      const reps = Math.min(10, Math.max(1, parseInt(S.progRepeat, 10) || 1));
      const once = slides.slice();
      for (let r = 1; r < reps; r++) once.forEach(s => slides.push(s));
    }
    if (mode === 'mix' && vids.length && slides.length) {
      // فيديو واحد بعد كل X شرائح، بالتناوب حسب ترتيب القائمة
      const every = Math.min(10, Math.max(1, parseInt(S.mixEvery, 10) || 2));
      const prog = slides.slice(); slides = [];
      let vi = 0, count = 0;
      do {
        prog.forEach(s => { slides.push(s); count++; if (count % every === 0 && vi < vids.length) slides.push({ type: 'video', v: vids[vi++] }); });
      } while (vi < vids.length);
    } else if (mode !== 'programs') vids.forEach(v => slides.push({ type: 'video', v }));
    pruneCache(vids);

    // الترويسة: شعار المؤسسة + شعار المركز (أو اسمه إن لم يُرفع شعار)
    const logo = safeUrl(S.logoUrl), cl = safeUrl(S.centreLogoUrl);
    $('#logo').outerHTML = logo
      ? `<img class="logo" id="logo" src="${esc(logo)}" alt="">`
      : '<span class="logo fallback" id="logo">ح</span>';
    $('#name').outerHTML = cl
      ? `<img class="centre-logo" id="name" src="${esc(cl)}" alt="${esc(S.siteTitle)}">`
      : `<div class="name" id="name">${esc(S.siteTitle)}</div>`;
    $('#clock').hidden = !S.showClock;
    document.title = S.siteTitle;

    stopVideo();
    $('#slides').innerHTML = slides.length ? slides.map((s, i) => s.type === 'video' ? videoHTML(s, i) : slideHTML(s)).join('') : '<div class="empty">لا يوجد محتوى للعرض</div>';
    $('#dots').innerHTML = slides.length > 1 ? slides.map(() => '<span></span>').join('') : '';
    idx = 0;
    show(0);
  }

  function slideHTML(s) {
    const [cols, t] = SIZE[s.items.length] || SIZE[4];
    return `<section class="slide">
      <div class="s-head"><span class="bar"></span><h1>${esc(s.label)}</h1>${s.n ? `<span class="n">${s.n}</span>` : ''}
        ${s.pages > 1 ? `<span class="pg">${s.page} / ${s.pages}</span>` : ''}</div>
      ${s.items.length
        ? `<div class="tiles" style="--cols:${cols};--t:${t}">${s.items.map(p => tile(p, s.key)).join('')}</div>`
        : '<div class="empty">لا توجد برامج حالياً</div>'}
    </section>`;
  }
  function videoHTML(s) {
    const logo = safeUrl(S.logoUrl), cl = safeUrl(S.centreLogoUrl);
    return `<section class="slide video"><div class="vbox"></div>
      ${logo || cl ? `<div class="wm">${logo ? `<img src="${esc(logo)}" alt="">` : ''}${cl ? `<img src="${esc(cl)}" alt="">` : ''}</div>` : ''}
      ${s.v.title ? `<div class="vtitle">${esc(s.v.title)}</div>` : ''}</section>`;
  }

  function tile(p, key) {
    const img = S.showImages ? safeUrl(p.image_url) : '';
    const plogo = safeUrl(p.logo_url);
    const date = fmtRange(p.start_date, p.end_date, S.dateLocale);
    let chip = '';
    if (key === 'upcoming' && S.showCountdown && p.start_date) {
      const d = daysUntil(p.start_date);
      if (d >= 0) chip = `<span class="chip">${daysWord(d)}</span>`;
    }
    return `<article class="tile ${img ? '' : 'noimg'}">
      ${img ? `<div class="img"><img src="${esc(img)}" alt=""></div>` : ''}
      <div class="body">
        <div class="head">${plogo ? `<img class="plogo" src="${esc(plogo)}" alt="">` : ''}<h2>${esc(p.title)}</h2></div>
        ${p.owner ? `<div class="owner">${icons.user}<span>${esc(p.owner)}</span></div>` : ''}
        ${date || chip ? `<div class="meta">${date ? `<span class="date">${icons.calendar}${esc(date)}</span>` : ''}${chip}</div>` : ''}
      </div>
    </article>`;
  }

  /* ---------- الفيديو ---------- */
  async function cachedSrc(url) {
    if (!('caches' in window) || url.startsWith('data:')) return url;
    try {
      const c = await caches.open(VCACHE);
      const hit = await c.match(url);
      if (hit) { blobUrl = URL.createObjectURL(await hit.blob()); return blobUrl; }
      // أول مرة: نعرض من الإنترنت ونحفظ نسخة في الخلفية حتى لا يُحمَّل الفيديو مرة أخرى
      fetch(url, { mode: 'cors' }).then(r => { if (r.ok) c.put(url, r); }).catch(() => {});
    } catch (e) {}
    return url;
  }
  async function pruneCache(vids) {
    if (!('caches' in window)) return;
    try {
      const keep = new Set(vids.filter(v => v.kind !== 'youtube').map(v => v.url));
      const c = await caches.open(VCACHE);
      (await c.keys()).forEach(r => { if (!keep.has(r.url)) c.delete(r); });
    } catch (e) {}
  }
  let ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(res => {
      if (window.YT && window.YT.Player) return res();
      window.onYouTubeIframeAPIReady = res;
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc);
    });
    return ytReady;
  }
  function showSoundHint() {
    const h = $('#hint'); h.textContent = 'اضغط على الشاشة أو زر OK لتشغيل الصوت'; h.classList.remove('gone');
    setTimeout(() => h.classList.add('gone'), 8000);
  }
  function stopVideo() {
    clearTimeout(timer);
    if (player) { try { player.destroy ? player.destroy() : (player.pause(), player.remove()); } catch (e) {} player = null; }
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    document.querySelectorAll('.slide.video .vbox').forEach(b => { b.innerHTML = ''; });
  }
  function videoEnded() {
    if (slides.length === 1) { stopVideo(); return show(idx); }   // فيديو واحد: يُعاد تشغيله
    next();
  }
  async function playVideo(s, box) {
    const v = s.v, sound = !!S.videoSound, my = tok;
    const go = () => { if (my === tok) next(); };
    const ended = () => { if (my === tok) videoEnded(); };
    clearTimeout(timer);
    timer = setTimeout(go, 20 * 60 * 1000);                       // حدّ أمان: 20 دقيقة كحد أقصى
    if (v.kind === 'youtube') {
      await loadYT();
      const el = document.createElement('div'); box.appendChild(el);
      player = new YT.Player(el, {
        videoId: ytId(v.url), width: '100%', height: '100%',
        playerVars: { autoplay: 1, mute: sound ? 0 : 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1 },
        events: {
          onReady: e => { sound ? e.target.unMute() : e.target.mute(); e.target.playVideo();
            setTimeout(() => { try { if (player && player.getPlayerState && player.getPlayerState() !== 1) { player.mute(); player.playVideo(); if (sound) showSoundHint(); } } catch (x) {} }, 4000); },
          onStateChange: e => { if (e.data === 0) ended(); },
          onError: () => setTimeout(go, 2000)
        }
      });
    } else {
      const vid = document.createElement('video');
      vid.playsInline = true; vid.autoplay = true; vid.muted = !sound; vid.preload = 'auto';
      vid.onended = ended;
      vid.onerror = () => setTimeout(go, 2000);
      box.appendChild(vid);
      player = vid;
      vid.src = await cachedSrc(v.url);
      vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); if (sound) showSoundHint(); });
    }
  }

  /* ---------- التنقل ---------- */
  function next() {
    if (pending) { const [s, p] = pending; stopVideo(); apply(s, p); return; }
    show(idx + 1);
  }
  function show(i) {
    const els = [...document.querySelectorAll('#slides .slide')];
    if (!els.length) return;
    stopVideo();
    tok++;
    idx = (i + els.length) % els.length;
    els.forEach((el, k) => {
      el.classList.toggle('out', el.classList.contains('on') && k !== idx);
      el.classList.toggle('on', k === idx);
    });
    setTimeout(() => els.forEach((el, k) => { if (k !== idx) el.classList.remove('out'); }), 950);
    [...document.querySelectorAll('#dots span')].forEach((d, k) => d.classList.toggle('on', k === idx));
    const s = slides[idx];
    const bar = $('#timer');
    bar.style.transition = 'none'; bar.style.width = '0';
    if (s.type === 'video') return playVideo(s, els[idx].querySelector('.vbox'));
    if (slides.length < 2 || paused) return;
    const secs = Math.max(4, parseInt(S.slideSeconds, 10) || 12);
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${secs}s linear`; bar.style.width = '100%'; }));
    timer = setTimeout(next, secs * 1000);
  }

  function reloadWhenFree(q) {
    const go = () => location.replace(location.pathname + q);
    if (!player) return go();
    const t = setInterval(() => { if (!player) { clearInterval(t); go(); } }, 2000);
  }

  /* ---------- الساعة ---------- */
  function tick() {
    const n = new Date();
    $('#time').textContent = n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('#date').textContent = n.toLocaleDateString(S ? S.dateLocale : 'ar-AE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ---------- وضع الشاشة ---------- */
  // أي ضغطة (فأرة أو زر OK في الريموت) تسمح للمتصفح بتشغيل الصوت
  function unmute() {
    if (!S || !S.videoSound || !player) return;
    try { if (player.unMute) { player.unMute(); player.setVolume && player.setVolume(100); player.playVideo(); } else { player.muted = false; player.play(); } } catch (e) {}
    $('#hint').classList.add('gone');
  }
  document.addEventListener('click', () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    unmute();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'OK' || e.keyCode === 13) unmute(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') next();
    else if (e.key === 'ArrowRight') show(idx - 1);
    else if (e.key === ' ') { paused = !paused; show(idx); }
  });
  let idleT;
  document.addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 3000); });
  setTimeout(() => $('#hint').classList.add('gone'), 6000);
  async function wake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  /* ---------- التشغيل ---------- */
  (async () => {
    try { await load(); } catch (e) { console.error(e); $('#slides').innerHTML = '<div class="empty">تعذّر تحميل البيانات — ستتم المحاولة مجدداً</div>'; }
    tick(); setInterval(tick, 10000);
    wake();
    setInterval(() => load().catch(console.error), 60000);
    // تحديث التصميم تلقائياً: عند رفع نسخة جديدة من الموقع تُعاد تحميل الشاشة وحدها
    let siteVer = null;
    const checkVer = () => fetch('version.json?ts=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !j.v) return;
      if (siteVer === null) { siteVer = j.v; return; }
      if (j.v !== siteVer) { reloadWhenFree('?r=' + encodeURIComponent(j.v)); }
    }).catch(() => {});
    checkVer(); setInterval(checkVer, 3 * 60 * 1000);
    setTimeout(() => reloadWhenFree(''), 6 * 3600 * 1000);
  })();
})();
