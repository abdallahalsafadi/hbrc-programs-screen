/* تجهيز الفيديو قبل الرفع: يقبل معظم الصيغ، يحوّلها إلى MP4 (H.264/AAC) المناسب للتلفاز،
   ويضغط أي فيديو أكبر من 100 ميغابايت ليصبح 100 أو أقل — كل ذلك داخل متصفح الرافع (بدون خادم). */
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/mediabunny@1.61.0/dist/bundles/mediabunny.min.mjs';
  const MB = 1024 * 1024;
  const MAX = 100 * MB;             // الحد الأقصى بعد التجهيز
  const TARGET = 92 * MB;           // هدف الضغط (هامش أمان تحت 100)
  const PART = 45 * MB;             // الخادم المجاني يقبل حتى 50 ميغابايت للملف الواحد، فنقسّم الأكبر إلى أجزاء
  const AUDIO_BPS = 128000;
  const ACCEPT = 'video/*,.mp4,.m4v,.mov,.qt,.webm,.mkv,.3gp,.3g2,.ts,.mts,.m2ts,.mpg,.mpeg,.ogv,.avi,.wmv,.flv';
  const fmtMB = n => (n / MB).toFixed(n < 10 * MB ? 1 : 0);
  const ext = f => ((f.name || '').split('.').pop() || '').toLowerCase();

  let lib = null;
  function load() {
    if (!lib) lib = import(LIB).catch(() => { lib = null; throw new Error('تعذّر تحميل أداة تحويل الفيديو — تحقق من اتصال الإنترنت ثم أعد المحاولة'); });
    return lib;
  }

  function fail(msg) { const e = new Error(msg); e.userMsg = true; return e; }
  const NOT_SUPPORTED = n => fail(`«${n}»: صيغة الملف غير مدعومة في المتصفح (مثل AVI أو WMV أو FLV القديمة). حوّله إلى MP4 أو MOV، أو ارفعه على يوتيوب وأرسل الرابط`);

  // فحص الملف: الصيغة، الترميز، المدة، الأبعاد
  async function probe(file) {
    const M = await load();
    const input = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) });
    let fmt;
    try { fmt = await input.getFormat(); } catch (e) { throw NOT_SUPPORTED(file.name); }
    const v = await input.getPrimaryVideoTrack();
    if (!v) throw fail(`«${file.name}»: الملف لا يحتوي على صورة فيديو (ربما ملف صوتي فقط)`);
    const a = await input.getPrimaryAudioTrack();
    let duration = 0;
    try { duration = await input.computeDuration(); } catch (e) {}
    return { M, input, mime: fmt.mimeType, vcodec: v.codec, acodec: a ? a.codec : null,
      width: v.displayWidth, height: v.displayHeight, duration, canDecode: await v.canDecode().catch(() => false) };
  }

  function qualityWarn(info, size, compressed) {
    const short = Math.min(info.width || 0, info.height || 0);
    const mbps = info.duration ? size * 8 / 1e6 / info.duration : null;
    if (short && short < 720) return `دقة منخفضة (${info.width}×${info.height}) — ستبدو غير واضحة على الشاشة الكبيرة. أرسل الملف الأصلي بدقة 1080p إن وُجد.`;
    if (compressed && mbps != null && mbps < 1.5) return `الفيديو طويل بالنسبة لحد 100 ميغابايت، لذلك ضُغط بشدة (${mbps.toFixed(1)} ميغابت/ث) وقد تظهر الصورة أقل وضوحاً. للفيديوهات الطويلة يُفضّل رابط يوتيوب.`;
    return '';
  }

  // تحويل/ضغط باستخدام WebCodecs
  async function convert(p, file, opts, onStage) {
    const M = p.M;
    const input = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) });
    const target = new M.BufferTarget();
    const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const video = opts.transcode ? (() => {
      const o = { codec: 'avc', forceTranscode: true, quality: new M.Quality({ bitrate: Math.round(opts.vbps) }) };
      const long = Math.max(p.width, p.height), cap = opts.maxSide;
      if (long > cap) { if (p.width >= p.height) o.width = cap - (cap % 2); else o.height = cap - (cap % 2); }
      return o;
    })() : { codec: 'avc' };
    const audio = p.acodec && p.acodec !== 'aac' || opts.transcode ? { codec: 'aac', quality: new M.Quality({ bitrate: AUDIO_BPS }), numberOfChannels: 2 } : { codec: 'aac' };
    const conv = await M.Conversion.init({ input, output, video, audio, showWarnings: false });
    const lost = conv.discardedTracks || [];
    const vLost = lost.find(d => d.track && d.track.type === 'video');
    if (!conv.isValid || vLost) {
      const r = vLost ? vLost.reason : (lost[0] && lost[0].reason);
      if (r === 'undecodable_source_codec' || r === 'unknown_source_codec')
        throw fail(`«${file.name}»: متصفحك لا يستطيع قراءة ترميز هذا الفيديو (${p.vcodec || 'غير معروف'}). جرّب من متصفح Chrome أو Edge على الكمبيوتر، أو ارفعه على يوتيوب وأرسل الرابط`);
      if (r === 'no_encodable_target_codec')
        throw fail(`«${file.name}»: متصفحك لا يدعم ضغط الفيديو. استخدم Chrome أو Edge على الكمبيوتر، أو ارفعه على يوتيوب وأرسل الرابط`);
      throw fail(`«${file.name}»: تعذّر تحويل الفيديو (${r || 'سبب غير معروف'})`);
    }
    conv.onProgress = pr => onStage && onStage(opts.label, Math.min(99, Math.round(pr * 100)));
    try { await conv.execute(); }
    catch (e) { throw fail(`«${file.name}»: توقّف التحويل — ${e && e.message ? e.message : 'خطأ غير معروف'}. قد تكون ذاكرة الجهاز غير كافية؛ جرّب من الكمبيوتر`); }
    return new Blob([target.buffer], { type: 'video/mp4' });
  }

  /**
   * prepare(file, onStage) → { blob, converted, info, warn }
   * onStage(text, pct) لعرض المرحلة: فحص / تحويل / ضغط
   */
  async function prepare(file, onStage) {
    const say = (t, p) => onStage && onStage(t, p);
    if (!file || !file.size) throw fail('الملف فارغ أو تالف');
    const looksVideo = /^video\//.test(file.type) || /^(mp4|m4v|mov|qt|webm|mkv|3gp|3g2|ts|mts|m2ts|mpg|mpeg|ogv|avi|wmv|flv)$/.test(ext(file));
    if (!looksVideo) throw fail(`«${file.name}»: هذا ليس ملف فيديو`);
    say('جارٍ الفحص…', 0);
    let p;
    try { p = await probe(file); }
    catch (e) {
      // لا يمكن تحميل أداة التحويل: نرفع ملف MP4 الصغير كما هو
      if (!e.userMsg && /mp4|m4v/.test(ext(file)) && file.size <= MAX) return { blob: file, converted: false, info: {}, warn: '' };
      throw e.userMsg ? e : fail(e.message || 'تعذّر فحص الملف');
    }
    p.input.dispose && p.input.dispose();
    const info = { duration: p.duration, width: p.width, height: p.height, portrait: p.height > p.width };
    const tvVideo = p.vcodec === 'avc';
    const tvAudio = !p.acodec || p.acodec === 'aac';

    // ملف «ثقيل»: معدّل بيانات أعلى مما تحتاجه الشاشة — نخفّفه لتقليل استهلاك الإنترنت المجاني
    const heavy = Math.max(p.width, p.height) > 1920 || (p.duration > 0 && file.size > 25 * MB && file.size * 8 / p.duration > 6.5e6);   // 4K أو معدّل بيانات عالٍ: ثقيل على شاشات التلفاز
    // 1) MP4 جاهز وحجمه مناسب → يُرفع كما هو
    if (p.mime === 'video/mp4' && tvVideo && tvAudio && file.size <= MAX && !heavy)
      return { blob: file, converted: false, info, warn: qualityWarn(p, file.size) };

    // 2) الترميز مناسب لكن الحاوية مختلفة (MOV/MKV…) وحجمه مناسب → تغيير الحاوية فقط (سريع وبلا فقد جودة)
    if (tvVideo && file.size <= MAX && !heavy) {
      try {
        const blob = await convert(p, file, { transcode: false, label: 'جارٍ التحويل إلى MP4' }, onStage);
        if (blob.size <= MAX) return { blob, converted: true, info, warn: qualityWarn(p, blob.size) };
      } catch (e) { /* نكمل بإعادة الترميز */ }
    }

    // 3) إعادة ترميز إلى H.264 مع ضغط ليصبح ≤ 100 ميغابايت
    if (!p.canDecode) throw fail(`«${file.name}»: متصفحك لا يستطيع قراءة ترميز هذا الفيديو (${p.vcodec || 'غير معروف'}). جرّب من متصفح Chrome أو Edge على الكمبيوتر، أو ارفعه على يوتيوب وأرسل الرابط`);
    const dur = p.duration > 0 ? p.duration : 0;
    if (!dur) throw fail(`«${file.name}»: تعذّر معرفة مدة الفيديو لضغطه — الملف قد يكون تالفاً`);
    const srcBps = file.size * 8 / dur;
    let vbps = Math.min(5e6, (TARGET * 8 / dur) - AUDIO_BPS, file.size <= MAX ? srcBps * 1.05 : Infinity);
    if (vbps < 150000) throw fail(`«${file.name}»: الفيديو طويل جداً (${Math.round(dur / 60)} دقيقة) ولا يمكن ضغطه إلى 100 ميغابايت بجودة مقبولة. ارفعه على يوتيوب وأرسل الرابط`);
    const willCompress = file.size > MAX || heavy;
    const canAvc = await p.M.canEncodeVideo('avc').catch(() => false);
    if (!canAvc) throw fail(`«${file.name}»: متصفحك لا يدعم ${willCompress ? 'ضغط' : 'تحويل'} الفيديو. استخدم Chrome أو Edge على الكمبيوتر، أو ارفعه على يوتيوب وأرسل الرابط`);
    for (let attempt = 0; attempt < 3; attempt++) {
      const maxSide = vbps < 1e6 ? 854 : vbps < 2.5e6 ? 1280 : 1920;
      const label = file.size > MAX ? `جارٍ الضغط (${fmtMB(file.size)} ← أقل من 100 ميغابايت)` : heavy ? 'جارٍ تخفيف حجم الفيديو' : 'جارٍ التحويل إلى MP4';
      const blob = await convert(p, file, { transcode: true, vbps, maxSide, label }, onStage);
      if (blob.size <= MAX) return { blob, converted: true, compressed: willCompress, info, warn: qualityWarn((sc => ({ ...p, width: Math.round(p.width * sc), height: Math.round(p.height * sc) }))(Math.min(1, maxSide / Math.max(p.width, p.height))), blob.size, willCompress) };
      vbps = vbps * (TARGET / blob.size) * 0.9;
    }
    throw fail(`«${file.name}»: تعذّر ضغط الفيديو إلى 100 ميغابايت. اختصر الفيديو أو ارفعه على يوتيوب وأرسل الرابط`);
  }

  // تقسيم الملف إلى أجزاء ≤ 45 ميغابايت (حد الخادم المجاني 50 للملف)
  function split(blob) {
    if (blob.size <= PART) return [blob];
    const n = Math.ceil(blob.size / PART), size = Math.ceil(blob.size / n), out = [];
    for (let i = 0; i < n; i++) out.push(blob.slice(i * size, Math.min(blob.size, (i + 1) * size), 'video/mp4'));
    return out;
  }

  // نص واضح لأي خطأ في رفع الملف إلى الخادم
  function uploadError(status, body) {
    let j = {}; try { j = typeof body === 'string' ? JSON.parse(body) : (body || {}); } catch (e) { j = { message: String(body || '') }; }
    const m = [j.error, j.message, j.msg].filter(Boolean).join(' ');
    if (!status) return 'انقطع الاتصال بالإنترنت أثناء الرفع — تحقق من الشبكة وأعد المحاولة';
    if (status === 413 || /exceeded|too large|maximum allowed size|Payload too large/i.test(m)) return 'الملف أكبر من الحد الذي يقبله الخادم';
    if (/mime|content type|invalid_mime_type/i.test(m)) return 'نوع الملف غير مسموح به على الخادم';
    if (status === 403 || /row-level security|unauthori[sz]ed|policy/i.test(m)) return 'لا توجد صلاحية للرفع — ربما انتهت صلاحية الرابط أو انتهت جلسة الدخول';
    if (status === 409 || /already exists|Duplicate/i.test(m)) return 'يوجد ملف بنفس الاسم — أعد المحاولة';
    if (status === 401) return 'انتهت جلسة الدخول — سجّل الدخول من جديد';
    if (status === 429) return 'طلبات كثيرة في وقت قصير — انتظر دقيقة ثم أعد المحاولة';
    if (status >= 500) return `الخادم لا يستجيب حالياً (رمز ${status}) — أعد المحاولة بعد قليل`;
    return `تعذّر الرفع (رمز ${status})${m ? ' — ' + m : ''}`;
  }

  // رفع جزء واحد مع تقدّم (XHR)
  function putFile(path, blob, token, onProg) {
    const CFG = window.APP_CONFIG || {};
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', CFG.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/media/' + path);
      x.setRequestHeader('apikey', CFG.SUPABASE_ANON_KEY);
      x.setRequestHeader('Authorization', 'Bearer ' + (token || CFG.SUPABASE_ANON_KEY));
      x.setRequestHeader('x-upsert', 'false');
      x.setRequestHeader('cache-control', 'max-age=31536000');
      x.setRequestHeader('Content-Type', 'video/mp4');   // كل الفيديوهات تُرفع بصيغة MP4
      x.upload.onprogress = e => { if (e.lengthComputable && onProg) onProg(e.loaded); };
      x.onload = () => x.status >= 200 && x.status < 300 ? resolve() : reject(fail(uploadError(x.status, x.responseText)));
      x.onerror = () => reject(fail(uploadError(0)));
      x.ontimeout = () => reject(fail(uploadError(0)));
      x.send(blob);
    });
  }

  /**
   * uploadVideo(blob, base, {token, onProgress}) → { url, path, parts? }
   * base مثل 'videos/123-abc' أو 'inbox/<رمز>/v-123' (بدون امتداد)
   */
  async function uploadVideo(blob, base, opts) {
    opts = opts || {};
    const CFG = window.APP_CONFIG || {};
    const pub = p => CFG.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/media/' + p.split('/').map(encodeURIComponent).join('/');
    const chunks = split(blob);
    const total = blob.size; let sent = 0;
    const parts = [];
    for (let i = 0; i < chunks.length; i++) {
      const path = chunks.length > 1 ? `${base}.part${i + 1}.mp4` : `${base}.mp4`;
      await putFile(path, chunks[i], opts.token, l => opts.onProgress && opts.onProgress(Math.min(99, Math.round((sent + l) / total * 100))));
      sent += chunks[i].size;
      parts.push({ path, url: pub(path) });
    }
    if (opts.onProgress) opts.onProgress(100);
    return chunks.length > 1 ? { url: parts[0].url, path: parts[0].path, parts } : parts[0];
  }

  // كل مسارات ملف الفيديو (للحذف)
  const pathsOf = v => v && v.parts && v.parts.length ? v.parts.map(p => p.path) : (v && v.path ? [v.path] : []);

  // رابط قابل للتشغيل: إن كان الفيديو مقسّماً نجمع أجزاءه في ملف واحد
  async function joinParts(v, opts) {
    if (!v.parts || v.parts.length < 2) return v.url;
    const blobs = [];
    for (const p of v.parts) {
      const r = await fetch(p.url, opts && opts.cache ? { cache: 'force-cache' } : undefined);
      if (!r.ok) throw new Error('تعذّر تحميل جزء من الفيديو (رمز ' + r.status + ')');
      blobs.push(await r.blob());
    }
    return URL.createObjectURL(new Blob(blobs, { type: 'video/mp4' }));
  }

  window.VideoPrep = { prepare, split, uploadVideo, uploadError, pathsOf, joinParts, MAX, ACCEPT, load };
})();
