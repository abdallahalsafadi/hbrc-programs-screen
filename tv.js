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
      // البرامج السابقة خلال السنة الحالية فقط (تظهر تلقائياً، وتُتخطّى إن لم توجد)
      const lc = (S.labelCompleted && S.labelCompleted !== 'البرامج المنتهية') ? S.labelCompleted : 'البرامج السابقة خلال السنة';
      groups.push(['completed', lc]);
      const yr = String(new Date().getFullYear());
      groups.forEach(([key, label]) => {
        const list = P.filter(p => p._st === key && (key !== 'completed' || String(p.end_date || '').slice(0, 4) === yr)).sort(byPublic);
        if (!list.length) { if (!S.hideEmpty && key !== 'completed') slides.push({ type: 'prog', key, label, items: [], n: 0 }); return; }
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
    pruneCache(vids).then(() => setTimeout(() => warm(vids), 5000));

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
    fitAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll).catch(() => {});
    show(0);
  }

  /* ضبط حجم الخط تلقائياً: كل بطاقة تعرض نصها كاملاً (العنوان والمسؤول والتاريخ) مهما كان عدد البرامج */
  function fitTiles(box) {
    const tiles = [...box.querySelectorAll('.tile')];
    if (!tiles.length) return;
    let t = parseFloat(box.style.getPropertyValue('--t')) || 3.2;
    const min = 1.5;
    const bad = () => tiles.some(el => {
      const b = el.querySelector('.body'), im = el.querySelector('.img');
      if (!b) return false;
      if (b.scrollHeight > el.clientHeight + 1) return true;                         // النص أكبر من البطاقة
      if (b.scrollWidth > b.clientWidth + 1 || box.scrollWidth > box.clientWidth + 1) return true;
      if (im && im.clientHeight < el.clientHeight * 0.26) return true;               // الصورة صغيرة جداً
      return el.querySelectorAll('h2,.sub').length && [...el.querySelectorAll('h2,.sub')].some(x => x.scrollHeight > x.clientHeight + 2);   // نص مقطوع
    });
    let n = 0;
    while (bad() && t > min && n++ < 40) { t = Math.max(min, +(t * 0.94).toFixed(3)); box.style.setProperty('--t', t + 'rem'); }
    if (bad()) {                                                                     // ما زال لا يكفي: نخفي الصور لإعطاء النص كامل المساحة
      tiles.forEach(el => { const im = el.querySelector('.img'); if (im) { im.remove(); el.classList.add('noimg'); } });
      n = 0; while (bad() && t > min && n++ < 40) { t = Math.max(min, +(t * 0.94).toFixed(3)); box.style.setProperty('--t', t + 'rem'); }
    }
  }
  function fitAll() { document.querySelectorAll('#slides .tiles').forEach(fitTiles); }
  window.addEventListener('resize', () => { clearTimeout(fitAll._t); fitAll._t = setTimeout(fitAll, 300); });

  function slideHTML(s) {
    const [cols, t] = SIZE[s.items.length] || SIZE[4];
    return `<section class="slide${s.items.length >= 5 ? ' dense' : ''}">
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
      ${s.v.title ? `<div class="vtitle">${esc(s.v.title)}</div>` : ''}
      <button type="button" class="vskip" aria-label="تخطّي الفيديو">تخطّي <span aria-hidden="true">⏭</span></button></section>`;
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
        <div class="head">${plogo ? `<img class="plogo" src="${esc(plogo)}" alt="" onerror="this.remove()">` : ''}<h2>${esc(p.title)}</h2></div>
        <div class="info">
          ${p.owner ? `<div class="owner">${icons.user}<span>${esc(p.owner)}</span></div>` : ''}
          ${date || chip ? `<div class="meta">${date ? `<span class="date">${icons.calendar}${esc(date)}</span>` : ''}${chip}</div>` : ''}
        </div>
      </div>
    </article>`;
  }

  /* ---------- الفيديو: كل ملف يُنزَّل مرة واحدة فقط ثم يُعرض من ذاكرة الجهاز ---------- */
  // الخطة المجانية تسمح بـ 5 غيغابايت تنزيل شهرياً لكل الشاشات معاً، لذلك لا نعيد تنزيل أي فيديو
  const MB = 1048576;
  const MEM = new Map();                 // نسخة في الذاكرة إن كان التخزين الدائم ممتلئاً أو غير مدعوم
  const MEM_MAX = 300 * MB;
  const DAY_CAP = 250 * MB;              // حد أمان: أقصى تنزيل فيديو لكل شاشة في اليوم
  const diag = { cache: 'لم يُختبر', persist: '?', hits: 0, downloads: 0, skipped: 0, err: '' };
  let memDl = 0;
  let noLocal = false; try { noLocal = localStorage.getItem('hbrc-nolocal') === '1'; } catch (e) {}
  const setNoLocal = why => { noLocal = true; diag.err = why; try { localStorage.setItem('hbrc-nolocal', '1'); } catch (e) {} };
  const dayKey = () => 'hbrc-dl-' + new Date().toISOString().slice(0, 10);
  const dlToday = () => { try { const v = +localStorage.getItem(dayKey()); return Math.max(v || 0, memDl); } catch (e) { return memDl; } };
  const addDl = n => { memDl = dlToday() + n; try { localStorage.setItem(dayKey(), String(memDl)); } catch (e) {} };
  let cacheP = null;
  const openCache = () => cacheP || (cacheP = ('caches' in window ? caches.open(VCACHE) : Promise.reject(new Error('no cache'))).catch(() => { diag.cache = 'غير مدعوم'; return null; }));
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(p => { diag.persist = p ? 'نعم' : 'لا'; }).catch(() => {}); } catch (e) {}
  const urlsOf = v => v.parts && v.parts.length > 1 ? v.parts.map(p => p.url) : [v.url];

  async function isLocal(v) {
    if (MEM.has(v.url)) return true;
    const c = await openCache(); if (!c) return false;
    for (const u of urlsOf(v)) if (!(await c.match(u).catch(() => null))) return false;
    return true;
  }
  async function localBlob(v) {
    if (MEM.has(v.url)) return MEM.get(v.url);
    const c = await openCache(); if (!c) return null;
    const blobs = [];
    for (const u of urlsOf(v)) { const r = await c.match(u).catch(() => null); if (!r) return null; blobs.push(await r.blob()); }
    return blobs.length === 1 ? blobs[0] : new Blob(blobs, { type: 'video/mp4' });
  }
  const inflight = new Map();
  function download(v, force) {
    if (inflight.has(v.url)) return inflight.get(v.url);
    const job = (async () => {
      if (!force && dlToday() > DAY_CAP) { diag.skipped++; throw new Error('daily cap'); }
      const c = await openCache(); const blobs = []; let stored = !!c;
      for (const u of urlsOf(v)) {
        const r = await fetch(u, { mode: 'cors' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const b = await r.blob(); addDl(b.size); blobs.push(b);
        if (c) { try { await c.put(u, new Response(b, { headers: { 'Content-Type': 'video/mp4' } })); } catch (e) { stored = false; diag.err = (e && e.name) || String(e); } }
      }
      diag.downloads++;
      const blob = blobs.length === 1 ? blobs[0] : new Blob(blobs, { type: 'video/mp4' });
      if (stored) diag.cache = 'يعمل';
      else {
        if (c) diag.cache = 'ممتلئ';
        let used = 0; MEM.forEach(x => { used += x.size; });
        if (used + blob.size <= MEM_MAX) MEM.set(v.url, blob);
      }
      return blob;
    })();
    inflight.set(v.url, job);
    job.then(() => inflight.delete(v.url), () => inflight.delete(v.url));
    return job;
  }
  async function videoSrc(v) {
    let b = await localBlob(v);
    if (b) diag.hits++; else b = await download(v, true);   // التشغيل لا يُمنع بالحد اليومي (الحد للتنزيل المسبق فقط)
    blobUrl = URL.createObjectURL(b);
    return blobUrl;
  }
  // تنزيل مسبق في الخلفية — فيديو واحد في كل مرة، ولا يُعاد تنزيل الموجود
  let warming = false;
  async function warm(vids) {
    if (warming || noLocal) return; warming = true;
    try { for (const v of vids) if (v.kind !== 'youtube' && !(await isLocal(v))) await download(v).catch(() => {}); }
    finally { warming = false; }
  }
  async function pruneCache(vids) {
    if (!('caches' in window)) return;
    try {
      const keep = new Set();
      vids.filter(v => v.kind !== 'youtube').forEach(v => { keep.add(v.url); (v.parts || []).forEach(p => keep.add(p.url)); });
      [...MEM.keys()].forEach(k => { if (!keep.has(k)) MEM.delete(k); });
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
    timer = setTimeout(go, 10 * 60 * 1000);                       // حدّ أمان للتحميل — يُعدَّل حسب مدة الفيديو بعد معرفتها
    const byDuration = d => { if (my !== tok || !isFinite(d) || d <= 0) return; clearTimeout(timer); timer = setTimeout(go, (d + 90) * 1000); };
    if (v.kind === 'youtube') {
      await loadYT();
      const el = document.createElement('div'); box.appendChild(el);
      player = new YT.Player(el, {
        videoId: ytId(v.url), width: '100%', height: '100%',
        playerVars: { autoplay: 1, mute: sound ? 0 : 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1 },
        events: {
          onReady: e => { sound ? e.target.unMute() : e.target.mute(); e.target.playVideo();
            setTimeout(() => { try { if (player && player.getPlayerState && player.getPlayerState() !== 1) { player.mute(); player.playVideo(); if (sound) showSoundHint(); } } catch (x) {} }, 4000); },
          onStateChange: e => { if (e.data === 1) { try { byDuration(player.getDuration()); } catch (x) {} } if (e.data === 0) ended(); },
          onError: () => setTimeout(go, 2000)
        }
      });
    } else {
      const vid = document.createElement('video');
      vid.playsInline = true; vid.autoplay = true; vid.muted = !sound; vid.preload = 'auto';
      vid.onended = ended;
      vid.onloadedmetadata = () => byDuration(vid.duration);
      vid.onerror = () => setTimeout(go, 2000);
      box.appendChild(vid);
      player = vid;
      let src;
      let direct = false;
      const multi = v.parts && v.parts.length > 1;
      if (noLocal && !multi) { direct = true; src = v.url; }               // هذا الجهاز لا يتحمّل نسخة محلية: بثّ مباشر
      else {
        try { src = await videoSrc(v); }
        catch (e) { if (!multi) { setNoLocal('local copy failed: ' + (e && e.message)); direct = true; src = v.url; } else return setTimeout(go, 1500); }
      }
      vid.onerror = () => {
        if (my !== tok) return;
        if (!direct && !multi) { direct = true; setNoLocal('blob rejected → stream'); vid.src = v.url; vid.play().catch(() => {}); return; }   // المتصفح رفض نسخة الجهاز: جرّب الرابط المباشر مرة واحدة
        setTimeout(go, 1500);
      };
      if (my !== tok) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); return; }
      vid.src = src;
      vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); if (sound) showSoundHint(); });
    }
  }

  /* ---------- التنقل ---------- */
  function next() {
    if (reloadNext) return reloadNext();
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
    const sp = new URLSearchParams(q.replace(/^\?/, ''));
    if (Store.screen !== 'main') sp.set('s', Store.screen);
    const qs = sp.toString();
    const go = () => location.replace(location.pathname + (qs ? '?' + qs : ''));
    if (!player) return go();
    reloadNext = go;                                   // يُعاد التحميل فور انتهاء الفيديو الحالي
    setTimeout(go, 20 * 60 * 1000);                    // حد أمان
  }
  let reloadNext = null;

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
  // ملء الشاشة تلقائياً: محاولة كل 5 ثوانٍ (تنجح في متصفحات التلفاز/وضع الكشك/التطبيق المثبّت)،
  // ومتصفحات الحاسوب تشترط لمسة واحدة، فنعيد المحاولة مع أول ضغطة أو حركة أو زر ريموت
  function goFull() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      const f = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (f) { const r = f.call(el); if (r && r.catch) r.catch(() => {}); }
    } catch (e) {}
  }
  setInterval(goFull, 5000);
  setTimeout(goFull, 1500);
  ['click', 'pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { goFull(); }, true));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setTimeout(goFull, 1000); });
  document.addEventListener('click', () => { unmute(); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'OK' || e.keyCode === 13) unmute(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') next();
    else if (e.key === 'ArrowRight') show(idx - 1);
    else if (e.key === ' ') { paused = !paused; show(idx); }
  });
  let idleT;
  // زر التخطّي: باهت دائماً، ويتّضح لثوانٍ عند تحريك الفأرة أو لمس الشاشة أو الضغط على الريموت
  let awakeT;
  const wakeUi = () => { document.body.classList.add('awake'); clearTimeout(awakeT); awakeT = setTimeout(() => document.body.classList.remove('awake'), 3000); };
  document.addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 3000); wakeUi(); });
  document.addEventListener('touchstart', wakeUi, { passive: true });
  document.addEventListener('keydown', wakeUi);
  document.addEventListener('click', e => {
    if (!e.target.closest('.vskip')) return;
    e.stopPropagation(); e.preventDefault();
    next();
  }, true);
  setTimeout(() => $('#hint').classList.add('gone'), 6000);
  async function wake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  /* ---------- التشغيل ---------- */
  (async () => {
    try {
      if (Store.screen !== 'main' && !(await Store.screenExists())) {
        $('#slides').innerHTML = '<div class="empty">هذه الشاشة غير موجودة — تأكد من الرابط</div>'; return;
      }
      await load();
    } catch (e) { console.error(e); $('#slides').innerHTML = '<div class="empty">تعذّر تحميل البيانات — ستتم المحاولة مجدداً</div>'; }
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
    // إعادة تحميل يومية واحدة الساعة 4 فجراً (الفيديوهات محفوظة على الجهاز فلا تُنزَّل مجدداً)
    const n4 = new Date(); n4.setHours(4, 0, 0, 0); if (n4 <= new Date()) n4.setDate(n4.getDate() + 1);
    setTimeout(() => reloadWhenFree(''), n4 - new Date());
    // فحص الشاشة: أضف ?diag=1 إلى الرابط لعرض حالة التخزين وكمية التنزيل اليوم
    if (/[?&]diag=1/.test(location.search)) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;background:rgba(0,0,0,.75);color:#fff;font:16px/1.5 monospace;padding:10px 14px;border-radius:10px;direction:rtl';
      document.body.appendChild(d);
      const upd = async () => {
        let est = '';
        try { const e = await navigator.storage.estimate(); est = `${(e.usage / MB).toFixed(0)} / ${(e.quota / MB).toFixed(0)} MB`; } catch (x) { est = 'غير معروف'; }
        d.innerHTML = `التخزين: ${diag.cache} · دائم: ${diag.persist}<br>المساحة: ${est}<br>تنزيل اليوم: ${(dlToday() / MB).toFixed(0)} MB (الحد ${DAY_CAP / MB})<br>تنزيلات: ${diag.downloads} · من الجهاز: ${diag.hits} · متجاوز: ${diag.skipped}<br>${esc(diag.err || '')}`;
      };
      upd(); setInterval(upd, 5000);
    }
  })();
})();
