/* طبقة البيانات والأدوات المشتركة بين صفحة العرض ولوحة الإدارة */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  let sb = null;
  if (!DEMO) {
    if (window.supabase) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    else console.error('تعذّر تحميل مكتبة Supabase');
  }

  const DEFAULT_SETTINGS = {
    orgName: 'مؤسسة حمدان بن راشد آل مكتوم للعلوم الطبية والتربوية',
    siteTitle: 'مركز حمدان بن راشد آل مكتوم للموهبة والابتكار',
    logoUrl: 'logo.svg',
    centreLogoUrl: 'centre-logo.jpg',
    displayMode: 'programs',
    videos: [],
    videoSound: false,
    progRepeat: 1,
    mixEvery: 2,
    labelCurrent: 'البرامج الحالية',
    labelUpcoming: 'البرامج القادمة',
    labelCompleted: 'البرامج المنتهية',
    slideSeconds: 12,
    perSlide: 4,
    showClock: true,
    showCountdown: true,
    showImages: true,
    showCompleted: false,
    hideEmpty: false,
    autoStatus: false,
    categories: [],
    colorPrimary: '#2C818A',
    colorAccent: '#BA9663',
    colorBg: '#F6F7F7',
    colorText: '#0D1010',
    fontFamily: 'IBM Plex Sans Arabic',
    fontScale: 1,
    dateLocale: 'ar-AE'
  };

  const FONTS = ['IBM Plex Sans Arabic', 'Tajawal', 'Cairo', 'Almarai', 'Noto Kufi Arabic'];

  const SEED = [
    { id: 's1', title: 'برنامج رعاية الموهوبين', status: 'current', featured: true, visible: true, sort_order: 1, owner: 'أ. محمد علي', start_date: '2026-09-07', end_date: '2027-06-17' },
    { id: 's2', title: 'فريق FIRST LEGO League', status: 'current', featured: false, visible: true, sort_order: 2, owner: 'م. سارة أحمد', start_date: '2026-09-14', end_date: '2027-02-28' },
    { id: 's3', title: 'مختبر التصنيع الرقمي FabLab', status: 'current', featured: false, visible: true, sort_order: 3, owner: 'م. خالد يوسف', start_date: '2026-10-01', end_date: '2027-05-31' },
    { id: 's4', title: 'البرنامج الشتوي 2026', status: 'upcoming', featured: true, visible: true, sort_order: 4, owner: 'أ. مريم حسن', start_date: '2026-12-14', end_date: '2026-12-31' },
    { id: 's5', title: 'اختبارات الكشف عن الموهوبين', status: 'upcoming', featured: false, visible: true, sort_order: 5, owner: 'أ. نورة سالم', start_date: '2027-01-18', end_date: '2027-02-05' },
    { id: 's6', title: 'المخيم الصيفي 2027', status: 'upcoming', featured: false, visible: true, sort_order: 6, owner: 'م. أحمد عمر', start_date: '2027-07-05', end_date: '2027-08-12' }
  ];

  // قواعد رفع الفيديو
  const VIDEO_RULES = { maxMB: 100 };
  const VIDEO_RULES_TEXT = [
    'الحجم: حتى 100 ميغابايت — الأكبر من ذلك يُضغط تلقائياً ليصبح 100 أو أقل',
    'الصيغ المقبولة: MP4، MOV (آيفون)، WebM، MKV، 3GP، M4V، TS، MPEG وغيرها — تُحوَّل تلقائياً إلى MP4 المناسب للتلفاز',
    'لا يوجد حد لمدة الفيديو — لكن الفيديو الطويل جداً يُضغط أكثر فتقلّ جودته',
    'الدقة المفضّلة: 1920×1080 أفقي (16:9)',
    'لأفضل جودة: أرسل الملف الأصلي من الكاميرا أو من برنامج المونتاج — لا ترسل نسخة منقولة عبر واتساب لأنها تكون مضغوطة',
    'الضغط والتحويل يتمّان على جهازك قبل الرفع ويُفضّل متصفح Chrome أو Edge — لا تغلق الصفحة حتى تظهر علامة ✓',
    'الفيديو الطويل جداً (أكثر من 15 دقيقة تقريباً): يُفضّل رفعه على يوتيوب (غير مُدرج) وإرسال الرابط'
  ];
  const K = { p: 'hbrc_programs', s: 'hbrc_settings', cred: 'hbrc_demo_cred', ses: 'hbrc_demo_session' };
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('مساحة التخزين في المتصفح ممتلئة'); } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }

  const FIELDS = ['id', 'title', 'summary', 'description', 'category', 'status', 'start_date', 'end_date', 'schedule', 'location',
    'audience', 'seats', 'registered', 'image_url', 'register_url', 'contact', 'featured', 'visible', 'sort_order', 'logo_url', 'owner', 'shared', 'source', 'pending'];
  function clean(p) {
    const o = {};
    FIELDS.forEach(k => {
      let v = p[k];
      if (v === undefined) return;
      if (typeof v === 'string') v = v.trim();
      if (k === 'seats' || k === 'registered' || k === 'sort_order') v = (v === '' || v == null || isNaN(+v)) ? null : parseInt(v, 10);
      else if (k === 'featured' || k === 'visible' || k === 'shared' || k === 'pending') v = !!v;
      else if (v === '') v = null;
      o[k] = v;
    });
    if (o.sort_order == null) o.sort_order = 0;
    if (!o.status) o.status = 'upcoming';
    return o;
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const byOrder = (a, b) => ((a.sort_order || 0) - (b.sort_order || 0)) || String(a.start_date || '9999').localeCompare(String(b.start_date || '9999'));
  const byPublic = (a, b) => ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || byOrder(a, b);
  const reason = e => { const m = (e && (e.message || e.error_description || e.error)) || ''; if (window.VideoPrep && (e.statusCode || e.status)) return VideoPrep.uploadError(+(e.statusCode || e.status), { message: m }); if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'انقطع الاتصال بالإنترنت — تحقق من الشبكة'; if (/JWT|expired/i.test(m)) return 'انتهت جلسة الدخول — سجّل الدخول من جديد'; if (/row-level security|permission denied/i.test(m)) return 'لا توجد صلاحية — سجّل الدخول من جديد'; return m; };
  const fail = (error, msg) => { if (error) { console.error(error); const r = reason(error); throw new Error(msg ? (r ? msg + ' — السبب: ' + r : msg) : r || 'حدث خطأ'); } };

  // الشاشة الحالية: من الرابط ?s=اسم-القسم (الافتراضي main)
  const urlScreen = (() => { try { const v = new URLSearchParams(location.search).get('s'); return v && /^[a-z0-9-]{2,40}$/.test(v) ? v : 'main'; } catch (e) { return 'main'; } })();
  const sKey = sc => sc === 'main' ? K.s : K.s + '__' + sc;
  const demoScreens = () => lsGet('hbrc_screens', [{ slug: 'main', name: DEFAULT_SETTINGS.siteTitle, sort_order: 0 }]);

  const Store = {
    demo: DEMO,
    screen: urlScreen,
    async listScreens() {
      if (DEMO) return demoScreens();
      const { data, error } = await sb.from('screens').select('slug,name,sort_order').order('sort_order').order('created_at');
      fail(error, 'تعذّر تحميل الشاشات');
      return data || [];
    },
    async createScreen(slug, name, copyFrom) {
      slug = String(slug || '').trim().toLowerCase();
      if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error('رمز الرابط: حروف إنجليزية صغيرة وأرقام وشرطة (-) فقط');
      const base = copyFrom ? await this.getSettings(copyFrom) : { ...DEFAULT_SETTINGS };
      const data = { ...base, siteTitle: name, videos: [], displayMode: 'programs' };
      if (DEMO) {
        const L = demoScreens(); if (L.some(x => x.slug === slug)) throw new Error('هذا الرمز مستخدم لشاشة أخرى');
        L.push({ slug, name, sort_order: L.length }); lsSet('hbrc_screens', L); lsSet(sKey(slug), data); return;
      }
      const { count } = await sb.from('screens').select('slug', { count: 'exact', head: true });
      const { error } = await sb.from('screens').insert({ slug, name, data, sort_order: count || 0 });
      if (error && /duplicate|unique/i.test(error.message)) throw new Error('هذا الرمز مستخدم لشاشة أخرى');
      fail(error, 'تعذّر إنشاء الشاشة');
    },
    async renameScreen(slug, name) {
      if (DEMO) { const L = demoScreens(); const x = L.find(x => x.slug === slug); if (x) x.name = name; return lsSet('hbrc_screens', L); }
      const { error } = await sb.from('screens').update({ name }).eq('slug', slug);
      fail(error, 'تعذّر تغيير الاسم');
    },
    async deleteScreen(slug) {
      if (slug === 'main') throw new Error('لا يمكن حذف الشاشة الرئيسية');
      if (DEMO) {
        lsSet('hbrc_screens', demoScreens().filter(x => x.slug !== slug));
        lsSet(K.p, lsGet(K.p, []).filter(r => (r.screen || 'main') !== slug));
        try { localStorage.removeItem(sKey(slug)); } catch (e) {} return;
      }
      const { error } = await sb.from('screens').delete().eq('slug', slug);
      fail(error, 'تعذّر حذف الشاشة');
    },
    async screenExists(slug) {
      slug = slug || this.screen;
      if (DEMO) return demoScreens().some(x => x.slug === slug);
      const { data, error } = await sb.from('screens').select('slug').eq('slug', slug).maybeSingle();
      fail(error, 'تعذّر تحميل الشاشة');
      return !!data;
    },
    // البرامج التي سمحت أقسام أخرى بمشاركتها
    async listSharedPrograms() {
      if (DEMO) return lsGet(K.p, []).filter(r => r.shared && (r.screen || 'main') !== this.screen);
      const { data, error } = await sb.from('programs').select('*').eq('shared', true).neq('screen', this.screen).order('sort_order');
      fail(error, 'تعذّر تحميل البرامج المشتركة');
      return data || [];
    },
    // بيانات كل الشاشات (للفيديوهات المشتركة)
    async allScreensData() {
      if (DEMO) return demoScreens().map(x => ({ slug: x.slug, name: x.name, data: lsGet(sKey(x.slug), {}) }));
      const { data, error } = await sb.from('screens').select('slug,name,data');
      fail(error, 'تعذّر تحميل الشاشات');
      return data || [];
    },
    // روابط الرفع المؤقتة (24 ساعة)
    async createLink(kind, hours) {
      if (DEMO) throw new Error('روابط الرفع تعمل بعد ربط قاعدة البيانات');
      const h = Math.min(24 * 30, Math.max(0.25, Number(hours) || 24));
      const expires_at = new Date(Date.now() + h * 3600 * 1000).toISOString();
      const { data, error } = await sb.from('upload_links').insert({ screen: this.screen, kind, expires_at }).select().single();
      fail(error, 'تعذّر إنشاء الرابط');
      return data;
    },
    async listLinks(kind) {
      if (DEMO) return [];
      const { data, error } = await sb.from('upload_links').select('*').eq('screen', this.screen).eq('kind', kind)
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      fail(error, 'تعذّر تحميل الروابط');
      return data || [];
    },
    async deleteLink(token) {
      const { error } = await sb.from('upload_links').delete().eq('token', token);
      fail(error, 'تعذّر إلغاء الرابط');
    },
    async listInbox() {
      if (DEMO) return [];
      const { data, error } = await sb.from('inbox_videos').select('*').eq('screen', this.screen).order('created_at');
      fail(error, 'تعذّر تحميل الفيديوهات الواردة');
      return data || [];
    },
    async deleteInbox(id) {
      const { error } = await sb.from('inbox_videos').delete().eq('id', id);
      fail(error, 'تعذّر الحذف');
    },
    async getSettings(screen) {
      const sc = screen || this.screen;
      if (DEMO) return { ...DEFAULT_SETTINGS, ...lsGet(sKey(sc), {}) };
      const { data, error } = await sb.from('screens').select('data').eq('slug', sc).maybeSingle();
      fail(error, 'تعذّر تحميل الإعدادات');
      return { ...DEFAULT_SETTINGS, ...((data && data.data) || {}) };
    },
    async saveSettings(s) {
      if (DEMO) return lsSet(sKey(this.screen), s);
      const { error } = await sb.from('screens').update({ data: s, updated_at: new Date().toISOString() }).eq('slug', this.screen);
      fail(error, 'تعذّر حفظ الإعدادات');
    },
    async listPrograms(all) {
      let rows;
      if (DEMO) {
        rows = lsGet(K.p, null);
        if (!rows) { rows = SEED.map(x => ({ ...x })); lsSet(K.p, rows); }
        rows = rows.filter(r => (r.screen || 'main') === this.screen);
      } else {
        const { data, error } = await sb.from('programs').select('*').eq('screen', this.screen);
        fail(error, 'تعذّر تحميل البرامج');
        rows = data || [];
      }
      if (!all) rows = rows.filter(r => r.visible !== false);
      return rows.slice().sort(byOrder);
    },
    async saveProgram(p) {
      const row = clean(p);
      row.screen = p.screen || this.screen;
      row.updated_at = new Date().toISOString();
      if (DEMO) {
        const rows = lsGet(K.p, []);
        if (!row.id) { row.id = uid(); rows.push(row); }
        else { const i = rows.findIndex(r => r.id === row.id); if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row); }
        lsSet(K.p, rows); return row;
      }
      if (!row.id) delete row.id;
      const { data, error } = await sb.from('programs').upsert(row).select().single();
      fail(error, 'تعذّر حفظ البرنامج');
      return data;
    },
    async deleteProgram(id) {
      if (DEMO) return lsSet(K.p, lsGet(K.p, []).filter(r => r.id !== id));
      const { error } = await sb.from('programs').delete().eq('id', id);
      fail(error, 'تعذّر حذف البرنامج');
    },
    async setOrder(list) {
      if (DEMO) {
        const rows = lsGet(K.p, []);
        list.forEach(x => { const r = rows.find(r => r.id === x.id); if (r) r.sort_order = x.sort_order; });
        return lsSet(K.p, rows);
      }
      const res = await Promise.all(list.map(x => sb.from('programs').update({ sort_order: x.sort_order }).eq('id', x.id)));
      res.forEach(r => fail(r.error, 'تعذّر حفظ الترتيب'));
    },
    async uploadImage(file) { return this.uploadFile(file, 'image'); },
    async uploadFile(file, kind, onStage) {
      const isVid = kind === 'video';
      if (!isVid && !file.type.startsWith('image/')) throw new Error(`«${file.name}»: الرجاء اختيار ملف صورة`);
      if (DEMO) {
        if (isVid) throw new Error('رفع الفيديو يعمل بعد ربط قاعدة البيانات. استخدم رابط يوتيوب في الوضع التجريبي');
        if (file.size > 1.5 * 1024 * 1024) throw new Error('في الوضع التجريبي الحد الأقصى للصورة 1.5 ميغابايت');
        return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      }
      if (isVid) {
        if (!window.VideoPrep) throw new Error('أداة تجهيز الفيديو غير محمّلة — حدّث الصفحة');
        const prep = await VideoPrep.prepare(file, onStage);
        const { data } = await sb.auth.getSession();
        const token = data && data.session && data.session.access_token;
        if (!token) throw new Error('انتهت جلسة الدخول — سجّل الدخول من جديد');
        const base = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const up = await VideoPrep.uploadVideo(prep.blob, base, { token, onProgress: p => onStage && onStage(`جارٍ الرفع ${p}%`, p) });
        return { ...up, warn: prep.warn, info: prep.info };
      }
      if (file.size > 5 * 1024 * 1024) throw new Error(`«${file.name}»: حجم الصورة ${(file.size / 1048576).toFixed(1)} ميغابايت — الحد الأقصى 5`);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
      fail(error, 'تعذّر رفع الصورة');
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },
    async deleteFile(path) {
      if (DEMO || !path || !path.length) return;
      const all = Array.isArray(path) ? path : [path];
      const vids = CFG.R2_UPLOAD_API ? all.filter(p => /\.mp4$/i.test(p)) : [];
      const rest = all.filter(p => !vids.includes(p));
      if (vids.length) {
        const { data } = await sb.auth.getSession(); const tk = data && data.session && data.session.access_token;
        for (const p of vids) {
          try { await fetch(CFG.R2_UPLOAD_API.replace(/\/$/, '') + '/' + p.split('/').map(encodeURIComponent).join('/'), { method: 'DELETE', headers: tk ? { Authorization: 'Bearer ' + tk, apikey: CFG.SUPABASE_ANON_KEY } : {} }); } catch (e) { console.error(e); }
        }
        // ملفات قديمة قد تكون ما زالت في Supabase
        rest.push(...vids);
      }
      if (rest.length) { const { error } = await sb.storage.from('media').remove(rest); if (error) console.error(error); }
    },
    async login(user, pw) {
      user = (user || '').trim().toLowerCase();
      if (DEMO) {
        const c = lsGet(K.cred, { u: 'admin', p: 'admin123' });
        if (user !== c.u || pw !== c.p) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
        ssSet(K.ses, '1'); return;
      }
      const email = user.includes('@') ? user : `${user}@${CFG.ADMIN_EMAIL_DOMAIN || 'hbrc-admin.local'}`;
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      const { data: ok, error: e2 } = await sb.rpc('is_admin');
      if (e2 || !ok) { await sb.auth.signOut(); throw new Error('هذا الحساب لا يملك صلاحية الإدارة'); }
    },
    async logout() { if (DEMO) return ssSet(K.ses, null); await sb.auth.signOut(); },
    async isLoggedIn() {
      if (DEMO) return ssGet(K.ses) === '1';
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      const { data: ok } = await sb.rpc('is_admin');
      return !!ok;
    },
    async changePassword(pw, newUser) {
      if (DEMO) { const c = lsGet(K.cred, { u: 'admin', p: 'admin123' }); lsSet(K.cred, { u: (newUser || c.u).toLowerCase(), p: pw }); return; }
      const { error } = await sb.auth.updateUser({ password: pw });
      fail(error, 'تعذّر تغيير كلمة المرور (يجب ألا تقل عن 8 أحرف)');
    },
    async replaceAll(settings, programs) {
      const sc = this.screen;
      if (DEMO) {
        if (settings) lsSet(sKey(sc), settings);
        if (programs) lsSet(K.p, lsGet(K.p, []).filter(r => (r.screen || 'main') !== sc).concat(programs.map(p => ({ ...clean(p), id: uid(), screen: sc }))));
        return;
      }
      if (settings) await this.saveSettings(settings);
      if (programs) {
        const { error } = await sb.from('programs').delete().eq('screen', sc);
        fail(error, 'تعذّر حذف البرامج القديمة');
        if (programs.length) {
          const rows = programs.map(p => { const r = clean(p); delete r.id; r.screen = sc; return r; });
          const { error: e2 } = await sb.from('programs').insert(rows);
          fail(e2, 'تعذّر استيراد البرامج');
        }
      }
    },
    resetDemo() { try { Object.keys(localStorage).filter(k => k.indexOf('hbrc_') === 0 && k !== 'hbrc_uscale').forEach(k => localStorage.removeItem(k)); } catch (e) {} }
  };

  /* ===== أدوات العرض ===== */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => { u = String(u || '').trim(); return /^(https?:\/\/|data:image\/|\.?\/|[a-z0-9_\/-]+\.(png|jpe?g|svg|webp|mp4|webm)$)/i.test(u) ? u : ''; };
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const toDate = s => (s ? new Date(s + 'T00:00:00') : null);
  const daysUntil = s => (s ? Math.round((toDate(s) - today0()) / 864e5) : null);
  function fmtDate(s, loc, noYear) {
    if (!s) return '';
    const o = { day: 'numeric', month: 'long' };
    if (!noYear) o.year = 'numeric';
    try { return toDate(s).toLocaleDateString(loc || 'ar-AE', o); } catch (e) { return s; }
  }
  function fmtRange(a, b, loc) {
    if (a && b && a.slice(0, 7) === b.slice(0, 7)) { try { return toDate(a).toLocaleDateString(loc || 'ar-AE', { day: 'numeric' }) + ' – ' + fmtDate(b, loc); } catch (e) {} }
    if (a && b) return fmtDate(a, loc, a.slice(0, 4) === b.slice(0, 4)) + ' – ' + fmtDate(b, loc);
    if (a) return 'يبدأ ' + fmtDate(a, loc);
    if (b) return 'حتى ' + fmtDate(b, loc);
    return '';
  }
  function effectiveStatus(p, s) {
    if (!s || !s.autoStatus) return p.status || 'upcoming';
    const t = today0();
    if (p.end_date && toDate(p.end_date) < t) return 'completed';
    if (p.start_date && toDate(p.start_date) > t) return 'upcoming';
    if (p.start_date) return 'current';
    return p.status || 'upcoming';
  }
  const STATUS = { current: 'حالي', upcoming: 'قادم', completed: 'منتهٍ' };
  function daysWord(n) {
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غداً';
    if (n === 2) return 'بعد يومين';
    if (n >= 3 && n <= 10) return `بعد ${n} أيام`;
    return `بعد ${n} يوماً`;
  }
  function applyTheme(s) {
    const r = document.documentElement.style;
    r.setProperty('--primary', s.colorPrimary);
    r.setProperty('--accent', s.colorAccent);
    r.setProperty('--bg', s.colorBg);
    r.setProperty('--text', s.colorText);
    r.setProperty('--font', `'${s.fontFamily}'`);
    r.setProperty('--scale', String(s.fontScale || 1.15));
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.fontFamily).replace(/%20/g, '+')}:wght@400;500;700&display=swap`;
    let l = document.getElementById('gf-font');
    if (!l) { l = document.createElement('link'); l.id = 'gf-font'; l.rel = 'stylesheet'; document.head.appendChild(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
  }
  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    const life = type === 'err' ? Math.max(8000, Math.min(20000, String(msg).length * 90)) : 3200;   // رسائل الخطأ تبقى وقتاً كافياً لقراءة السبب
    t.title = 'اضغط للإغلاق'; t.style.cursor = 'pointer'; t.onclick = () => t.remove();
    setTimeout(() => t.classList.add('out'), life);
    setTimeout(() => t.remove(), life + 500);
  }

  const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const I = d => `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" ${P}>${d}</svg>`;
  const icons = {
    calendar: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'),
    pin: I('<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    video: I('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3"/>'),
    share: I('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
    download: I('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>'),
    clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    link: I('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    edit: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
    copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: I('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    close: I('<path d="M6 6l12 12M18 6L6 18"/>')
  };

  window.App = { DEMO, Store, VIDEO_RULES, VIDEO_RULES_TEXT, sb, DEFAULT_SETTINGS, FONTS, SEED, applyTheme, esc, safeUrl, fmtDate, fmtRange, daysUntil, daysWord,
    effectiveStatus, STATUS, toast, icons, lsGet, lsSet, byPublic, byOrder };
})();
