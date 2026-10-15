(async function () {
  'use strict';
  const { Store, DEMO, DEFAULT_SETTINGS, FONTS, esc, safeUrl, fmtRange, STATUS, applyTheme, toast, icons } = App;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let S = { ...DEFAULT_SETTINGS }, P = [];

  const logoHTML = s => safeUrl(s.logoUrl)
    ? `<img class="logo" src="${esc(safeUrl(s.logoUrl))}" alt="" onerror="this.outerHTML='<span class=&quot;logo logo-fallback&quot;>ح</span>'">`
    : '<span class="logo logo-fallback">ح</span>';

  async function busy(btn, fn) {
    const t = btn && btn.innerHTML;
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ…'; }
    try { return await fn(); }
    catch (e) { toast(e.message || 'حدث خطأ', 'err'); console.error(e); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = t; } }
  }

  /* ========== الدخول ========== */
  let SCREENS = [];
  const remembered = (() => { try { return localStorage.getItem('hbrc_admin_screen'); } catch (e) { return null; } })();
  if (Store.screen === 'main' && remembered && /^[a-z0-9-]{2,40}$/.test(remembered)) Store.screen = remembered;
  try { S = await Store.getSettings('main'); } catch (e) { console.error(e); }
  applyTheme(S);
  if (await Store.isLoggedIn().catch(() => false)) startApp(); else showLogin();

  function showLogin() {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginLogo').outerHTML = logoHTML(S);
    $('#loginSub').textContent = S.siteTitle;
    if (DEMO) $('#loginSub').innerHTML = esc(S.siteTitle) + '<br><b>وضع تجريبي:</b> <span dir="ltr">admin / admin123</span>';
    $('#lu').focus();
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
    try { await Store.login($('#lu').value, $('#lp').value); $('#lp').value = ''; startApp(); }
    catch (err) { $('#loginErr').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = 'دخول'; }
  });
  $('#logoutBtn').onclick = async () => { await Store.logout(); location.reload(); };

  async function startApp() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    $('#demoNote').hidden = !DEMO;
    $('#resetDemo').hidden = !DEMO;
    $('#newUserField').hidden = !DEMO;
    $('#accountHint').textContent = DEMO
      ? 'في الوضع التجريبي: اسم المستخدم admin وكلمة المرور admin123 ويمكنك تغييرهما هنا.'
      : 'حساب مشرف واحد يملك التحكم الكامل في المحتوى. غيّر كلمة المرور من هنا في أي وقت.';
    $('#adminLogo').outerHTML = logoHTML(S);
    $('#addBtn').innerHTML = `${icons.plus} برنامج جديد`;
    $('#aqIcon').outerHTML = icons.search;
    $('#editor [data-close].dlg-close').innerHTML = icons.close;
    try { SCREENS = await Store.listScreens(); } catch (e) { toast(e.message, 'err'); }
    if (!SCREENS.some(x => x.slug === Store.screen)) Store.screen = 'main';
    await switchScreen(Store.screen, true);
    $('#vidUpHint').textContent = DEMO ? 'رفع الملفات يعمل بعد ربط قاعدة البيانات — استخدم يوتيوب في الوضع التجريبي.' : 'MP4 حتى 50 ميغابايت. يُحمَّل مرة واحدة ويُحفظ على جهاز التلفاز.';
  }

  /* ========== شاشات الأقسام ========== */
  const screenUrl = slug => { const base = location.href.replace(/[?#].*$/, '').replace(/admin\.html$/, ''); return base + (slug === 'main' ? '' : '?s=' + slug); };
  const screenName = slug => (SCREENS.find(x => x.slug === slug) || {}).name || slug;
  async function switchScreen(slug, first) {
    Store.screen = slug;
    try { localStorage.setItem('hbrc_admin_screen', slug); } catch (e) {}
    try { [S, P] = await Promise.all([Store.getSettings(), Store.listPrograms(true)]); } catch (e) { toast(e.message, 'err'); }
    applyTheme(S);
    renderScreenBar(); renderRows(); renderContent(); renderLook(); renderVideos(); renderScreens();
    if (!first) toast('تعدّل الآن: ' + screenName(slug), 'ok');
  }
  function renderScreenBar() {
    $('#screenSel').innerHTML = SCREENS.map(x => `<option value="${esc(x.slug)}" ${x.slug === Store.screen ? 'selected' : ''}>${esc(x.name)}${x.slug === 'main' ? ' (الرئيسية)' : ''}</option>`).join('');
    $('#screenLink').textContent = screenUrl(Store.screen);
    $('#viewLink').href = screenUrl(Store.screen);
  }
  $('#screenSel').addEventListener('change', e => switchScreen(e.target.value));
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('تم نسخ الرابط', 'ok'); }
    catch (e) { prompt('انسخ الرابط:', t); }
  }
  $('#copyLink').addEventListener('click', () => copyText(screenUrl(Store.screen)));
  function renderScreens() {
    $('#screenRows').innerHTML = SCREENS.map(x => `<div class="row" data-slug="${esc(x.slug)}" style="${x.slug === Store.screen ? 'border-color:var(--primary)' : ''}">
        <div class="thumb" style="font-size:1rem">${x.slug === 'main' ? '★' : esc(x.slug.charAt(0).toUpperCase())}</div>
        <div><h3>${esc(x.name)} ${x.slug === Store.screen ? '<span class="tag">تعدّلها الآن</span>' : ''}</h3>
          <div class="sub"><span dir="ltr">${esc(screenUrl(x.slug))}</span></div></div>
        <div class="row-actions">
          <button class="btn sm primary" data-s="edit">${icons.edit} تعديل المحتوى</button>
          <button class="btn sm" data-s="copy">${icons.copy} نسخ الرابط</button>
          <a class="btn sm" href="${esc(screenUrl(x.slug))}" target="_blank">${icons.link} فتح</a>
          <button class="btn sm" data-s="ren">إعادة تسمية</button>
          ${x.slug === 'main' ? '' : `<button class="btn sm danger" data-s="del" aria-label="حذف">${icons.trash}</button>`}
        </div></div>`).join('');
  }
  $('#screenRows').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const slug = b.closest('.row').dataset.slug, x = SCREENS.find(y => y.slug === slug);
    const a = b.dataset.s;
    if (a === 'edit') { await switchScreen(slug); $('[data-tab=programs]').click(); window.scrollTo(0, 0); return; }
    if (a === 'copy') return copyText(screenUrl(slug));
    if (a === 'ren') {
      const n = prompt('الاسم الجديد للشاشة:', x.name); if (!n || !n.trim()) return;
      return busy(null, async () => { await Store.renameScreen(slug, n.trim()); x.name = n.trim(); renderScreenBar(); renderScreens(); toast('تم تغيير الاسم', 'ok'); });
    }
    if (a === 'del') {
      if (!confirm(`حذف شاشة «${x.name}» وكل برامجها نهائياً؟ لا يمكن التراجع.`)) return;
      return busy(null, async () => {
        await Store.deleteScreen(slug);
        SCREENS = SCREENS.filter(y => y.slug !== slug);
        if (Store.screen === slug) await switchScreen('main', true); else { renderScreenBar(); renderScreens(); }
        toast('تم حذف الشاشة', 'ok');
      });
    }
  });
  $('#nsName').addEventListener('input', () => {
    const sl = $('#nsSlug');
    if (sl.dataset.touched) return;
    const ascii = $('#nsName').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (ascii.length >= 2) sl.value = ascii.slice(0, 40);
  });
  $('#nsSlug').addEventListener('input', e => { e.target.dataset.touched = '1'; e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });
  $('#newScreenForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#nsName').value.trim(), slug = $('#nsSlug').value.trim();
    if (!name) return toast('اكتب اسم القسم', 'err');
    busy($('#nsBtn'), async () => {
      await Store.createScreen(slug, name, $('#nsCopy').checked ? 'main' : null);
      SCREENS = await Store.listScreens();
      $('#nsName').value = ''; $('#nsSlug').value = ''; delete $('#nsSlug').dataset.touched;
      await switchScreen(slug, true);
      toast('تم إنشاء الشاشة — يمكنك الآن إضافة برامجها', 'ok');
    });
  });

  /* ========== الاستيراد من الأقسام الأخرى ========== */
  let impMode = null, impItems = [];
  const impDlg = $('#importDlg');
  impDlg.addEventListener('click', e => { if (e.target.closest('[data-iclose]')) impDlg.close(); });
  function groupHTML(groups, render) {
    const keys = Object.keys(groups);
    if (!keys.length) return '<div class="empty">لا توجد عناصر مشتركة من أقسام أخرى بعد.<br><small>اطلب من القسم الآخر تفعيل خيار «المشاركة» على البرنامج أو الفيديو.</small></div>';
    return keys.map(k => `<div class="imp-group"><h3>${esc(screenName(k))}</h3>${groups[k].map(render).join('')}</div>`).join('');
  }
  async function openImport(mode) {
    impMode = mode; impItems = [];
    $('#impTitle').textContent = mode === 'prog' ? 'استيراد برامج من قسم آخر' : 'استيراد فيديو من قسم آخر';
    $('#impBody').innerHTML = '<div class="empty">جارٍ التحميل…</div>';
    impDlg.showModal();
    try {
      const groups = {};
      if (mode === 'prog') {
        const list = await Store.listSharedPrograms();
        list.forEach(p => {
          const done = P.some(x => x.source === p.screen && x.title === p.title);
          impItems.push({ src: p.screen, item: p, done });
          (groups[p.screen] = groups[p.screen] || []).push(impItems.length - 1);
        });
        $('#impBody').innerHTML = groupHTML(groups, i => { const o = impItems[i], p = o.item;
          return `<label class="imp-item ${o.done ? 'done' : ''}"><input type="checkbox" data-ii="${i}" ${o.done ? 'disabled' : ''}>
            <div><div class="t">${esc(p.title)}</div><div class="m">${esc(STATUS[p.status] || '')}${p.owner ? ' · ' + esc(p.owner) : ''}${p.start_date || p.end_date ? ' · ' + esc(fmtRange(p.start_date, p.end_date, S.dateLocale)) : ''}${o.done ? ' · مستورد مسبقاً' : ''}</div></div></label>`; });
      } else {
        const all = await Store.allScreensData();
        all.filter(x => x.slug !== Store.screen).forEach(x => ((x.data && x.data.videos) || []).filter(v => v.shared).forEach(v => {
          const done = (S.videos || []).some(o => o.url === v.url);
          impItems.push({ src: x.slug, item: v, done });
          (groups[x.slug] = groups[x.slug] || []).push(impItems.length - 1);
        }));
        $('#impBody').innerHTML = groupHTML(groups, i => { const o = impItems[i], v = o.item;
          return `<label class="imp-item ${o.done ? 'done' : ''}"><input type="checkbox" data-ii="${i}" ${o.done ? 'disabled' : ''}>
            <div><div class="t">${esc(v.title || (v.kind === 'youtube' ? 'فيديو يوتيوب' : 'فيديو مرفوع'))}</div><div class="m">${v.kind === 'youtube' ? 'يوتيوب' : 'ملف مرفوع'}${o.done ? ' · موجود مسبقاً' : ''}</div></div></label>`; });
      }
    } catch (e) { $('#impBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  $('#impProgBtn').addEventListener('click', () => openImport('prog'));
  $('#impVidBtn').addEventListener('click', () => openImport('vid'));
  $('#impGo').addEventListener('click', () => {
    const picked = [...$('#impBody').querySelectorAll('input[data-ii]:checked')].map(c => impItems[+c.dataset.ii]);
    if (!picked.length) return toast('اختر عنصراً واحداً على الأقل', 'err');
    busy($('#impGo'), async () => {
      if (impMode === 'prog') {
        let order = P.reduce((m, x) => Math.max(m, x.sort_order || 0), 0);
        for (const o of picked) {
          const src = o.item;
          const row = { ...src, id: undefined, screen: Store.screen, shared: false, source: o.src, featured: false, visible: true, sort_order: ++order };
          P.push(await Store.saveProgram(row));
        }
        renderRows();
      } else {
        picked.forEach((o, k) => { S.videos = [...(S.videos || []), { ...o.item, id: Date.now().toString(36) + k, shared: false, source: o.src, visible: true }]; });
        await Store.saveSettings(S); renderVideos();
      }
      impDlg.close();
      toast(`تم استيراد ${picked.length} ${impMode === 'prog' ? 'برنامج' : 'فيديو'}`, 'ok');
    });
  });

  /* ========== التبويبات ========== */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    $$('main section.panel').forEach(p => { p.hidden = p.id !== 'tab-' + t.dataset.tab; });
  }));

  /* ========== قائمة البرامج ========== */
  $('#aq').addEventListener('input', renderRows);
  $('#af').addEventListener('change', renderRows);
  function renderRows() {
    const q = $('#aq').value.trim(), f = $('#af').value;
    const list = P.filter(p => (!q || [p.title, p.owner].join(' ').includes(q)) &&
      (!f || (f === 'hidden' ? p.visible === false : p.status === f)));
    if (!P.length) { $('#rows').innerHTML = '<div class="empty">لا توجد برامج بعد. اضغط «برنامج جديد» للبدء.</div>'; return; }
    if (!list.length) { $('#rows').innerHTML = '<div class="empty">لا توجد نتائج.</div>'; return; }
    const filtered = !!(q || f);
    $('#rows').innerHTML = list.map(p => {
      const i = P.indexOf(p), img = safeUrl(p.image_url);
      return `<div class="row ${p.visible === false ? 'hidden-prog' : ''}" data-id="${esc(p.id)}">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="">` : `<div class="thumb">${esc((p.title || '؟').charAt(0))}</div>`}
        <div>
          <h3>${esc(p.title)} ${p.featured ? `<span class="tag" style="vertical-align:middle">${icons.star} مميز</span>` : ''} ${p.shared ? `<span class="tag share" style="vertical-align:middle">${icons.share} مشترك</span>` : ''} ${p.source ? `<span class="tag" style="vertical-align:middle">${icons.download} من ${esc(screenName(p.source))}</span>` : ''}</h3>
          <div class="sub"><span class="badge st-${p.status}">${STATUS[p.status] || ''}</span>
            ${p.owner ? `<span>${icons.user} ${esc(p.owner)}</span>` : ''}
            ${p.start_date || p.end_date ? `<span>${esc(fmtRange(p.start_date, p.end_date, S.dateLocale))}</span>` : ''}
            ${p.visible === false ? '<b>مخفي عن الزوار</b>' : ''}</div>
        </div>
        <div class="row-actions">
          <button class="btn sm" data-act="up" title="تحريك لأعلى" aria-label="تحريك لأعلى" ${i === 0 || filtered ? 'disabled' : ''}>${icons.up}</button>
          <button class="btn sm" data-act="down" title="تحريك لأسفل" aria-label="تحريك لأسفل" ${i === P.length - 1 || filtered ? 'disabled' : ''}>${icons.down}</button>
          <button class="btn sm" data-act="vis" title="${p.visible === false ? 'إظهار' : 'إخفاء'}" aria-label="${p.visible === false ? 'إظهار' : 'إخفاء'}">${p.visible === false ? icons.eyeOff : icons.eye}</button>
          <button class="btn sm" data-act="dup" title="نسخ" aria-label="نسخ">${icons.copy}</button>
          <button class="btn sm" data-act="edit">${icons.edit} تعديل</button>
          <button class="btn sm danger" data-act="del" title="حذف" aria-label="حذف">${icons.trash}</button>
        </div>
      </div>`;
    }).join('');
  }
  $('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.row').dataset.id, p = P.find(x => String(x.id) === id), i = P.indexOf(p);
    const act = b.dataset.act;
    if (act === 'edit') return openEditor(p);
    if (act === 'dup') return openEditor({ ...p, id: undefined, title: p.title + ' (نسخة)', visible: false, shared: false, source: null });
    if (act === 'del') {
      if (!confirm(`حذف «${p.title}» نهائياً؟ لا يمكن التراجع.`)) return;
      return busy(null, async () => { await Store.deleteProgram(p.id); P.splice(i, 1); renderRows(); toast('تم الحذف', 'ok'); });
    }
    if (act === 'vis') return busy(null, async () => {
      const saved = await Store.saveProgram({ ...p, visible: p.visible === false });
      Object.assign(p, saved); renderRows(); toast(p.visible ? 'أصبح البرنامج ظاهراً للزوار' : 'تم إخفاء البرنامج', 'ok');
    });
    if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= P.length) return;
      [P[i], P[j]] = [P[j], P[i]];
      P.forEach((x, k) => { x.sort_order = k + 1; });
      renderRows();
      busy(null, () => Store.setOrder(P.map(x => ({ id: x.id, sort_order: x.sort_order }))));
    }
  });
  $('#addBtn').addEventListener('click', () => openEditor({ status: 'upcoming', visible: true, featured: false }));

  /* ========== محرر البرنامج ========== */
  const PF = [
    { k: 'title', l: 'اسم البرنامج *', full: true },
    { k: 'owner', l: 'الشخص المسؤول', h: 'مثال: م. سارة أحمد' },
    { k: 'status', l: 'الحالة', t: 'select', o: [['current', 'حالي'], ['upcoming', 'قادم'], ['completed', 'منتهٍ']] },
    { k: 'start_date', l: 'تاريخ البدء', t: 'date' },
    { k: 'end_date', l: 'تاريخ الانتهاء', t: 'date' },
    { k: 'logo_url', l: 'شعار البرنامج (اختياري)', t: 'image', full: true, h: 'يظهر بجانب اسم البرنامج — يُفضّل PNG بخلفية شفافة' },
    { k: 'image_url', l: 'صورة البرنامج (اختياري)', t: 'image', full: true },
    { k: 'featured', l: 'يظهر أولاً', t: 'check' },
    { k: 'visible', l: 'ظاهر على الشاشة', t: 'check' },
    { k: 'shared', l: 'السماح للأقسام الأخرى باستيراد هذا البرنامج', t: 'check', full: true }
  ];
  let editing = null;
  function fieldHTML(f, v, prefix) {
    const id = prefix + f.k, full = f.full ? ' full' : '';
    const hint = f.h ? `<small>${esc(f.h)}</small>` : '';
    switch (f.t) {
      case 'textarea': return `<div class="field${full}"><label for="${id}">${f.l}</label><textarea id="${id}" data-k="${f.k}" rows="${f.rows || 5}">${esc(v)}</textarea>${hint}</div>`;
      case 'select': return `<div class="field${full}"><label for="${id}">${f.l}</label><select id="${id}" data-k="${f.k}">${f.o.map(([a, b]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>${hint}</div>`;
      case 'cat': return `<div class="field${full}"><label for="${id}">${f.l}</label><input type="text" id="${id}" data-k="${f.k}" list="catList" value="${esc(v)}"><datalist id="catList">${(S.categories || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist><small>اختر من القائمة أو اكتب مجالاً جديداً</small></div>`;
      case 'check': return `<div class="field${full}"><label class="check"><input type="checkbox" id="${id}" data-k="${f.k}" ${v ? 'checked' : ''}> ${f.l}</label>${hint}</div>`;
      case 'image': return `<div class="field${full}"><span class="label">${f.l}</span>
          <div class="img-field"><img class="img-prev" id="${id}-prev" alt="" ${safeUrl(v) ? `src="${esc(safeUrl(v))}"` : 'hidden'}>
          <div style="display:grid;gap:8px;flex:1;min-width:220px">
            <input type="url" id="${id}" data-k="${f.k}" dir="ltr" placeholder="https://… أو ارفع صورة" value="${esc(v && !String(v).startsWith('data:') ? v : '')}" data-full="${esc(v)}">
            <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn sm" for="${id}-file">رفع صورة من الجهاز</label><input type="file" id="${id}-file" accept="image/*" hidden data-up="${id}">
            <button type="button" class="btn sm danger" data-clear="${id}">إزالة الصورة</button></div>
          </div></div>${hint}</div>`;
      default: return `<div class="field${full}"><label for="${id}">${f.l}</label><input type="${f.t || 'text'}" id="${id}" data-k="${f.k}" value="${esc(v)}" ${f.t === 'url' ? 'dir="ltr"' : ''} ${f.t === 'number' ? 'min="0" inputmode="numeric"' : ''}>${hint}</div>`;
    }
  }
  function bindImage(root, onChange) {
    root.querySelectorAll('[data-up]').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      const target = root.querySelector('#' + inp.dataset.up), prev = root.querySelector('#' + inp.dataset.up + '-prev');
      toast('جارٍ رفع الصورة…');
      try {
        const url = await Store.uploadImage(f);
        target.dataset.full = url; target.value = url.startsWith('data:') ? '' : url;
        target.placeholder = url.startsWith('data:') ? 'تم رفع صورة من الجهاز' : target.placeholder;
        prev.src = url; prev.hidden = false; toast('تم رفع الصورة', 'ok'); onChange && onChange();
      } catch (e) { toast(e.message, 'err'); }
      inp.value = '';
    }));
    root.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const t = root.querySelector('#' + b.dataset.clear), prev = root.querySelector('#' + b.dataset.clear + '-prev');
      t.value = ''; t.dataset.full = ''; prev.hidden = true; prev.removeAttribute('src'); onChange && onChange();
    }));
    root.querySelectorAll('input[type=url][data-full]').forEach(t => t.addEventListener('input', () => {
      t.dataset.full = t.value; const prev = root.querySelector('#' + t.id + '-prev');
      if (safeUrl(t.value)) { prev.src = t.value; prev.hidden = false; } else prev.hidden = true;
      onChange && onChange();
    }));
  }
  function readFields(root) {
    const o = {};
    root.querySelectorAll('[data-k]').forEach(el => {
      const k = el.dataset.k;
      if (el.type === 'checkbox') o[k] = el.checked;
      else if (el.dataset.full !== undefined) o[k] = el.dataset.full || el.value;
      else o[k] = el.value;
    });
    return o;
  }
  const ed = $('#editor');
  function openEditor(p) {
    editing = p;
    $('#edTitle').textContent = p.id ? 'تعديل برنامج' : 'برنامج جديد';
    $('#progFields').innerHTML = PF.map(f => fieldHTML(f, p[f.k] == null ? (f.k === 'visible' ? true : '') : p[f.k], 'pf-')).join('');
    bindImage($('#progFields'));
    ed.showModal();
    $('#pf-title').focus();
  }
  ed.addEventListener('click', e => { if (e.target.closest('[data-close]')) ed.close(); });
  $('#progForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = readFields($('#progFields'));
    if (!data.title.trim()) { toast('اسم البرنامج مطلوب', 'err'); $('#pf-title').focus(); return; }
    if (data.start_date && data.end_date && data.end_date < data.start_date) { toast('تاريخ الانتهاء قبل تاريخ البدء', 'err'); return; }
    if (data.register_url && !/^https?:\/\//i.test(data.register_url.trim())) { toast('رابط التسجيل يجب أن يبدأ بـ https://', 'err'); return; }
    await busy($('#saveProg'), async () => {
      const row = { ...editing, ...data };
      if (!row.id) row.sort_order = P.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 1;
      const saved = await Store.saveProgram(row);
      const i = P.findIndex(x => x.id === saved.id);
      if (i >= 0) P[i] = { ...P[i], ...saved }; else P.push(saved);
      ed.close(); renderRows(); toast('تم الحفظ', 'ok');
    });
  });

  /* ========== محتوى الموقع ========== */
  const CF = [
    { k: 'siteTitle', l: 'اسم المركز / القسم (يظهر إذا لم يُرفع شعار)', full: true },
    { k: 'logoUrl', l: 'شعار المؤسسة', t: 'image', full: true, h: 'يُفضّل SVG أو PNG بخلفية شفافة' },
    { k: 'centreLogoUrl', l: 'شعار المركز / القسم', t: 'image', full: true, h: 'يظهر أعلى الشاشة بجانب شعار المؤسسة. إن تُرك فارغاً يظهر الاسم المكتوب.' },
    { k: 'labelCurrent', l: 'عنوان شريحة البرامج الحالية' },
    { k: 'labelUpcoming', l: 'عنوان شريحة البرامج القادمة' },
    { k: 'labelCompleted', l: 'عنوان شريحة البرامج المنتهية' },
    { k: 'showCompleted', l: 'عرض شريحة البرامج المنتهية', t: 'check' },
    { k: 'hideEmpty', l: 'تخطّي الشريحة إذا لم تحتوِ برامج', t: 'check' },
    { k: 'autoStatus', l: 'نقل البرنامج تلقائياً بين «قادم» و«حالي» و«منتهٍ» حسب التواريخ', t: 'check', full: true }
  ];
  function renderContent() {
    const v = { ...S };
    $('#contentForm').innerHTML = `<div class="form-grid">${CF.map(f => fieldHTML(f, v[f.k], 'cf-')).join('')}</div>
      <div class="form-actions"><button class="btn primary" type="submit">حفظ المحتوى</button></div>`;
    bindImage($('#contentForm'));
  }
  $('#contentForm').addEventListener('submit', e => {
    e.preventDefault();
    const d = readFields($('#contentForm'));
    busy(e.submitter, async () => { const n = { ...S, ...d }; await Store.saveSettings(n); S = n; toast('تم حفظ المحتوى', 'ok'); });
  });

  /* ========== المظهر ========== */
  const LF = [
    { k: 'colorPrimary', l: 'اللون الرئيسي', t: 'color' },
    { k: 'colorAccent', l: 'اللون الثانوي (ذهبي)', t: 'color' },
    { k: 'colorBg', l: 'لون الخلفية', t: 'color' },
    { k: 'colorText', l: 'لون النص', t: 'color' }
  ];
  function renderLook() {
    $('#lookForm').innerHTML = `<div class="form-grid">
      <div class="field"><label for="lf-sec">مدة عرض كل شريحة (ثانية)</label><input type="number" id="lf-sec" data-k="slideSeconds" min="4" max="120" value="${esc(S.slideSeconds)}"></div>
      <div class="field"><label for="lf-per">عدد البرامج في الشريحة الواحدة</label><select id="lf-per" data-k="perSlide">${[1, 2, 3, 4, 5, 6].map(n => `<option ${+S.perSlide === n ? 'selected' : ''}>${n}</option>`).join('')}</select><small>إذا زاد عدد البرامج تُقسَّم على أكثر من شريحة تلقائياً</small></div>
      <div class="field"><label class="check"><input type="checkbox" data-k="showClock" ${S.showClock ? 'checked' : ''}> إظهار الساعة والتاريخ</label></div>
      <div class="field"><label class="check"><input type="checkbox" data-k="showCountdown" ${S.showCountdown ? 'checked' : ''}> إظهار «بعد X يوماً» للبرامج القادمة</label></div>
      <div class="field"><label class="check"><input type="checkbox" data-k="showImages" ${S.showImages ? 'checked' : ''}> إظهار صور البرامج</label></div>
      <div class="field"></div>
      ${LF.map(f => `<div class="field"><label for="lf-${f.k}">${f.l}</label><div class="color-row"><input type="color" id="lf-${f.k}" data-k="${f.k}" value="${esc(S[f.k])}"><input type="text" dir="ltr" data-mirror="lf-${f.k}" value="${esc(S[f.k])}" style="max-width:150px"></div></div>`).join('')}
      <div class="field"><label for="lf-font">نوع الخط</label><select id="lf-font" data-k="fontFamily">${FONTS.map(f => `<option ${f === S.fontFamily ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select></div>
      <div class="field"><label for="lf-scale">حجم الخط في الموقع: <span class="scale-val" id="scaleVal"></span></label><input type="range" id="lf-scale" data-k="fontScale" min="0.8" max="1.4" step="0.05" value="${esc(S.fontScale)}"><small>100% مصمم لشاشة 55 بوصة</small></div>
      <div class="field"><label for="lf-loc">صيغة التواريخ</label><select id="lf-loc" data-k="dateLocale">
        <option value="ar-AE" ${S.dateLocale === 'ar-AE' ? 'selected' : ''}>أرقام إنجليزية (14 ديسمبر 2026)</option>
        <option value="ar-SA" ${S.dateLocale === 'ar-SA' ? 'selected' : ''}>أرقام عربية مع التقويم الهجري</option>
        <option value="ar-EG" ${S.dateLocale === 'ar-EG' ? 'selected' : ''}>أرقام عربية (١٤ ديسمبر ٢٠٢٦)</option>
      </select></div>
    </div>
    <div class="form-actions">
      <button class="btn primary" type="submit">حفظ المظهر</button>
      <button class="btn" type="button" id="brandReset">استعادة ألوان المؤسسة الافتراضية</button>
    </div>`;
    const sv = () => { $('#scaleVal').textContent = Math.round($('#lf-scale').value * 100) + '%'; };
    sv();
    const live = () => { applyTheme({ ...S, ...readLook() }); sv(); };
    $('#lookForm').querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => {
      const m = el.id && $('#lookForm').querySelector(`[data-mirror="${el.id}"]`); if (m) m.value = el.value; live();
    }));
    $('#lookForm').querySelectorAll('[data-mirror]').forEach(m => m.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(m.value)) { $('#' + m.dataset.mirror).value = m.value; live(); }
    }));
    $('#brandReset').onclick = () => {
      LF.forEach(f => { $('#lf-' + f.k).value = DEFAULT_SETTINGS[f.k]; $(`[data-mirror="lf-${f.k}"]`).value = DEFAULT_SETTINGS[f.k]; });
      live(); toast('اضغط «حفظ المظهر» لاعتماد الألوان');
    };
  }
  function readLook() { const o = {}; $('#lookForm').querySelectorAll('[data-k]').forEach(el => { const k = el.dataset.k; o[k] = el.type === 'checkbox' ? el.checked : (k === 'fontScale' ? parseFloat(el.value) : (k === 'slideSeconds' || k === 'perSlide') ? parseInt(el.value, 10) : el.value); }); return o; }
  $('#lookForm').addEventListener('submit', e => {
    e.preventDefault();
    busy(e.submitter, async () => { const n = { ...S, ...readLook() }; await Store.saveSettings(n); S = n; applyTheme(S); toast('تم حفظ المظهر', 'ok'); });
  });

  /* ========== النسخ الاحتياطي ========== */
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'hbrc-programs', exported_at: new Date().toISOString(), settings: S, programs: P }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة-${Store.screen}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let d;
    try { d = JSON.parse(await f.text()); } catch (err) { return toast('الملف غير صالح', 'err'); }
    if (!d || !Array.isArray(d.programs)) return toast('هذا الملف ليس نسخة احتياطية من هذا الموقع', 'err');
    if (!confirm(`سيتم استبدال كل المحتوى الحالي بـ ${d.programs.length} برنامجاً من الملف. متابعة؟`)) return;
    busy(null, async () => {
      await Store.replaceAll(d.settings ? { ...DEFAULT_SETTINGS, ...d.settings } : null, d.programs);
      toast('تم الاستيراد', 'ok'); setTimeout(() => location.reload(), 800);
    });
  });
  $('#resetDemo').onclick = () => { if (confirm('إعادة البيانات التجريبية الأصلية؟')) { Store.resetDemo(); location.reload(); } };


  /* ========== الفيديو ========== */
  const MODES = [['programs', 'البرامج فقط'], ['videos', 'الفيديو فقط'], ['both', 'البرامج ثم الفيديو'], ['mix', 'مزج الفيديو بين الشرائح']];
  function renderVideos() {
    const V = S.videos || [];
    $('#vidMode').innerHTML = MODES.map(([k, l]) => `<label class="check"><input type="radio" name="vmode" value="${k}" ${(S.displayMode || 'programs') === k ? 'checked' : ''}> ${l}</label>`).join('');
    $('#vidSound').checked = !!S.videoSound;
    $('#vidRepeat').value = S.progRepeat || 1;
    $('#vidEvery').value = S.mixEvery || 2;
    const m = S.displayMode || 'programs';
    $('#repeatField').hidden = m !== 'both';
    $('#everyField').hidden = m !== 'mix';
    $('#vidRows').innerHTML = V.length ? V.map((v, i) => `<div class="row ${v.visible === false ? 'hidden-prog' : ''}" data-i="${i}">
        <div class="thumb" style="font-size:1.2rem">${i + 1}</div>
        <div><h3>${esc(v.title || (v.kind === 'youtube' ? 'فيديو يوتيوب' : 'فيديو مرفوع'))}</h3>
          <div class="sub"><span class="badge ${v.kind === 'youtube' ? 'st-upcoming' : 'st-current'}">${v.kind === 'youtube' ? 'يوتيوب' : 'ملف مرفوع'}</span>${v.visible === false ? '<b>مخفي</b>' : ''}${v.shared ? `<span class="tag share">${icons.share} مشترك</span>` : ''}${v.source ? `<span class="tag">${icons.download} من ${esc(screenName(v.source))}</span>` : ''}</div></div>
        <div class="row-actions">
          <button class="btn sm" data-v="up" aria-label="لأعلى" ${i === 0 ? 'disabled' : ''}>${icons.up}</button>
          <button class="btn sm" data-v="down" aria-label="لأسفل" ${i === V.length - 1 ? 'disabled' : ''}>${icons.down}</button>
          <button class="btn sm" data-v="vis" aria-label="إظهار/إخفاء">${v.visible === false ? icons.eyeOff : icons.eye}</button>
          <button class="btn sm" data-v="share" title="مشاركة مع الأقسام">${icons.share} ${v.shared ? 'إلغاء المشاركة' : 'مشاركة'}</button>
          <button class="btn sm" data-v="ren">${icons.edit} عنوان</button>
          <button class="btn sm danger" data-v="del" aria-label="حذف">${icons.trash}</button>
        </div></div>`).join('') : '<div class="empty">لا توجد فيديوهات بعد.</div>';
  }
  async function saveVideos(msg) { await Store.saveSettings(S); renderVideos(); if (msg) toast(msg, 'ok'); }
  $('#vidMode').addEventListener('change', e => { S.displayMode = e.target.value; busy(null, () => saveVideos('تم تغيير وضع العرض')); });
  $('#vidSound').addEventListener('change', e => { S.videoSound = e.target.checked; busy(null, () => saveVideos('تم الحفظ')); });
  $('#vidRepeat').addEventListener('change', e => { S.progRepeat = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)); e.target.value = S.progRepeat; busy(null, () => saveVideos('تم الحفظ')); });
  $('#vidEvery').addEventListener('change', e => { S.mixEvery = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 2)); e.target.value = S.mixEvery; busy(null, () => saveVideos('تم الحفظ')); });
  $('#ytAdd').addEventListener('click', () => {
    const url = $('#ytUrl').value.trim();
    if (!/(youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)[\w-]{11}/.test(url)) return toast('رابط يوتيوب غير صحيح', 'err');
    S.videos = [...(S.videos || []), { id: Date.now().toString(36), kind: 'youtube', url, title: $('#vidTitle').value.trim(), visible: true }];
    busy($('#ytAdd'), async () => { await saveVideos('تمت إضافة الفيديو'); $('#ytUrl').value = ''; $('#vidTitle').value = ''; });
  });
  $('#vidFile').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    const lbl = $('#vidFileLbl'), t = lbl.textContent, title = $('#vidTitle').value.trim();
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      lbl.textContent = `جارٍ رفع ${i + 1} من ${files.length}… لا تغلق الصفحة`;
      try {
        const { url, path } = await Store.uploadFile(files[i], 'video');
        const name = files.length > 1 ? files[i].name.replace(/\.[^.]+$/, '') : title;
        S.videos = [...(S.videos || []), { id: Date.now().toString(36) + i, kind: 'file', url, path, title: name, visible: true }];
        await Store.saveSettings(S); ok++;
      } catch (err) { toast(`${files[i].name}: ${err.message}`, 'err'); }
    }
    renderVideos(); $('#vidTitle').value = ''; lbl.textContent = t;
    if (ok) toast(`تم رفع ${ok} فيديو`, 'ok');
  });
  $('#vidRows').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const i = +b.closest('.row').dataset.i, V = S.videos, v = V[i];
    const a = b.dataset.v;
    if (a === 'up' || a === 'down') { const j = a === 'up' ? i - 1 : i + 1; [V[i], V[j]] = [V[j], V[i]]; return busy(null, () => saveVideos()); }
    if (a === 'vis') { v.visible = v.visible === false; return busy(null, () => saveVideos()); }
    if (a === 'share') { v.shared = !v.shared; return busy(null, () => saveVideos(v.shared ? 'أصبح الفيديو متاحاً للأقسام الأخرى' : 'تم إلغاء المشاركة')); }
    if (a === 'ren') { const t = prompt('عنوان الفيديو (اختياري — يظهر أسفل الشاشة):', v.title || ''); if (t === null) return; v.title = t.trim(); return busy(null, () => saveVideos('تم الحفظ')); }
    if (a === 'del') {
      if (!confirm('حذف هذا الفيديو؟')) return;
      V.splice(i, 1);
      return busy(null, async () => {
        await saveVideos('تم الحذف');
        if (!v.path) return;
        const all = await Store.allScreensData().catch(() => null);
        const used = !all || all.some(x => ((x.data && x.data.videos) || []).some(o => o.path === v.path));
        if (!used) await Store.deleteFile(v.path);   // الملف يُحذف فقط إن لم يستخدمه قسم آخر
      });
    }
  });

  /* ========== الحساب ========== */
  $('#pwForm').addEventListener('submit', e => {
    e.preventDefault();
    const a = $('#np1').value, b = $('#np2').value;
    if (a.length < 8) return toast('كلمة المرور يجب ألا تقل عن 8 أحرف', 'err');
    if (a !== b) return toast('كلمتا المرور غير متطابقتين', 'err');
    busy(e.submitter, async () => { await Store.changePassword(a, $('#nu').value.trim()); $('#np1').value = $('#np2').value = ''; toast('تم تغيير كلمة المرور', 'ok'); });
  });
})();
