/* تصدير شاشة إلى ملف PowerPoint بنفس تصميم شاشة التلفاز */
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  const W = 13.333, H = 7.5;
  const FONT = 'Arial';

  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIB;
      s.onload = () => res(); s.onerror = () => rej(new Error('تعذّر تحميل مكتبة PowerPoint — تحقق من الإنترنت'));
      document.head.appendChild(s);
    });
  }
  // تحويل أي صورة (SVG/PNG/JPG) إلى PNG مع معرفة أبعادها
  function toPng(url, maxW) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const iw = img.naturalWidth || 600, ih = img.naturalHeight || 300;
          const scale = Math.min(1, (maxW || 1200) / iw);
          const c = document.createElement('canvas'); c.width = Math.round(iw * scale); c.height = Math.round(ih * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve({ data: c.toDataURL('image/png'), ratio: iw / ih });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  const rtl = t => String(t == null ? '' : t).replace(/(\d+)/g, '\u200F$1\u200F');
  const hex = c => String(c || '#000000').replace('#', '').slice(0, 6).toUpperCase();
  const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/); return m ? m[1] : null; };

  // الحجم حسب عدد البرامج في الشريحة: [أعمدة، حجم العنوان]
  const SIZE = { 1: [1, 40], 2: [2, 32], 3: [3, 26], 4: [2, 24], 5: [3, 20], 6: [3, 20] };

  async function exportScreen(opts) {
    const { S, P, screenName, includeVideos, onStatus } = opts;
    const { safeUrl, fmtRange, daysUntil, daysWord, effectiveStatus, byPublic } = App;
    const say = t => onStatus && onStatus(t);
    say('جارٍ تحميل مكتبة PowerPoint…');
    await loadLib();

    const C = { pri: hex(S.colorPrimary), acc: hex(S.colorAccent), bg: hex(S.colorBg), txt: hex(S.colorText) };
    say('جارٍ تجهيز الشعارات والصور…');
    const fLogo = await toPng(safeUrl(S.logoUrl), 900);
    const cLogo = await toPng(safeUrl(S.centreLogoUrl), 900);
    const imgCache = {};
    const img = async u => { u = safeUrl(u); if (!u) return null; if (!(u in imgCache)) imgCache[u] = await toPng(u, 800); return imgCache[u]; };

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.rtlMode = true;
    pptx.title = screenName;
    pptx.company = 'مؤسسة حمدان بن راشد آل مكتوم للعلوم الطبية والتربوية';

    // الترويسة: شعار المؤسسة يميناً ثم شعار المركز/القسم
    function header(slide) {
      slide.background = { color: C.bg };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.25, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: W, h: 0.06, fill: { color: C.acc }, line: { color: C.acc } });
      let x = W - 0.45;
      const lh = 0.9, y = 0.18;
      if (fLogo) { const w = Math.min(3.4, lh * fLogo.ratio); x -= w; slide.addImage({ data: fLogo.data, x, y, w, h: lh }); x -= 0.3; }
      if (fLogo && (cLogo || S.siteTitle)) { slide.addShape(pptx.ShapeType.line, { x, y: 0.28, w: 0, h: 0.7, line: { color: 'D9DDDD', width: 1.5 } }); x -= 0.3; }
      if (cLogo) { const w = Math.min(3.4, lh * cLogo.ratio); x -= w; slide.addImage({ data: cLogo.data, x, y, w, h: lh }); }
      else if (S.siteTitle) slide.addText(S.siteTitle, { x: 0.4, y: 0.3, w: x - 0.4, h: 0.65, fontFace: FONT, fontSize: 20, bold: true, color: C.pri, align: 'right', rtlMode: true });
    }
    function sectionTitle(slide, label, n, page, pages) {
      slide.addShape(pptx.ShapeType.roundRect, { x: W - 0.55, y: 1.62, w: 0.1, h: 0.62, fill: { color: C.acc }, line: { color: C.acc }, rectRadius: 0.05 });
      slide.addText(label, { x: 3.2, y: 1.52, w: W - 3.95, h: 0.82, fontFace: FONT, fontSize: 36, bold: true, color: C.txt, align: 'right', valign: 'middle', rtlMode: true });
      const tw = Math.min(W - 4.5, String(label).length * 0.27 + 0.3);
      if (n) slide.addText(String(n), { x: W - 0.75 - tw - 0.85, y: 1.6, w: 0.66, h: 0.66, shape: pptx.ShapeType.ellipse, fill: { color: C.pri }, color: 'FFFFFF', fontFace: FONT, fontSize: 20, bold: true, align: 'center', valign: 'middle' });
      if (pages > 1) slide.addText(`${page} / ${pages}`, { x: 0.45, y: 1.6, w: 1.6, h: 0.6, fontFace: FONT, fontSize: 16, color: '888888', align: 'left' });
    }

    const per = Math.min(6, Math.max(1, parseInt(S.perSlide, 10) || 4));
    const groups = [['current', S.labelCurrent], ['upcoming', S.labelUpcoming]];
    if (S.showCompleted) groups.push(['completed', S.labelCompleted]);
    const list = P.filter(p => p.visible !== false && !p.pending).map(p => ({ ...p, _st: effectiveStatus(p, S) }));
    let count = 0;

    for (const [key, label] of groups) {
      const items = list.filter(p => p._st === key).sort(byPublic);
      if (!items.length) {
        if (S.hideEmpty) continue;
        const sl = pptx.addSlide(); header(sl); sectionTitle(sl, label, 0, 1, 1);
        sl.addText('لا توجد برامج حالياً', { x: 0.45, y: 2.7, w: W - 0.9, h: 4.2, fontFace: FONT, fontSize: 28, color: 'AAAAAA', align: 'center', valign: 'middle', rtlMode: true,
          shape: pptx.ShapeType.roundRect, rectRadius: 0.2, line: { color: 'D9DDDD', width: 1.5, dashType: 'dash' } });
        count++; continue;
      }
      const pages = Math.ceil(items.length / per);
      for (let pg = 0; pg < pages; pg++) {
        const chunk = items.slice(pg * per, pg * per + per);
        say(`جارٍ إنشاء الشرائح… (${++count})`);
        const sl = pptx.addSlide(); header(sl); sectionTitle(sl, label, items.length, pg + 1, pages);
        const [cols, tSize] = SIZE[chunk.length] || SIZE[4];
        const rows = Math.ceil(chunk.length / cols), gap = 0.32;
        const areaX = 0.45, areaY = 2.62, areaW = W - 0.9, areaH = H - areaY - 0.4;
        const tw = (areaW - gap * (cols - 1)) / cols, th = (areaH - gap * (rows - 1)) / rows;
        for (let i = 0; i < chunk.length; i++) {
          const p = chunk[i], r = Math.floor(i / cols), c = i % cols;
          const x = areaX + areaW - (c + 1) * tw - c * gap, y = areaY + r * (th + gap);   // ترتيب من اليمين لليسار
          sl.addShape(pptx.ShapeType.roundRect, { x, y, w: tw, h: th, fill: { color: 'FFFFFF' }, line: { color: 'E6E9E9', width: 0.75 }, rectRadius: 0.18,
            shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 8, offset: 3, angle: 90 } });
          sl.addShape(pptx.ShapeType.rect, { x: x + tw - 0.09, y: y + 0.12, w: 0.09, h: th - 0.24, fill: { color: C.pri }, line: { color: C.pri } });
          let innerR = x + tw - 0.35, top = y + 0.3;
          const logo = await img(p.logo_url);
          if (logo) { const lh = Math.min(0.95, th * 0.28), lw = Math.min(lh * logo.ratio, 1.8); sl.addImage({ data: logo.data, x: innerR - lw, y: top, w: lw, h: lh }); top += lh + 0.12; }
          const lines = [];
          lines.push({ text: p.title, options: { fontSize: tSize, bold: true, color: C.txt, breakLine: true } });
          if (p.owner) lines.push({ text: p.owner + ' 👤', options: { fontSize: Math.round(tSize * 0.55), color: '666666', breakLine: true } });
          const dt = rtl(fmtRange(p.start_date, p.end_date, S.dateLocale));
          if (dt) lines.push({ text: dt + ' 📅', options: { fontSize: Math.round(tSize * 0.55), color: C.pri, bold: true, breakLine: true } });
          if (key === 'upcoming' && S.showCountdown && p.start_date) { const d = daysUntil(p.start_date); if (d >= 0) lines.push({ text: rtl(daysWord(d)) + ' ⏳', options: { fontSize: Math.round(tSize * 0.5), color: C.acc, bold: true } }); }
          sl.addText(lines, { x: x + 0.3, y: top, w: innerR - (x + 0.3), h: y + th - 0.25 - top, fontFace: FONT, align: 'right', valign: 'middle', rtlMode: true, paraSpaceAfter: 4, fit: 'shrink' });
        }
      }
    }

    // الفيديوهات
    const vids = (S.videos || []).filter(v => v.visible !== false);
    if (includeVideos && vids.length) {
      for (const v of vids) {
        say(`جارٍ إضافة الفيديو: ${v.title || ''}`);
        const sl = pptx.addSlide(); sl.background = { color: '000000' };
        if (v.kind === 'youtube' && ytId(v.url)) {
          sl.addMedia({ type: 'online', link: 'https://www.youtube.com/embed/' + ytId(v.url), x: 0, y: 0, w: W, h: H });
        } else if (v.kind === 'file' && safeUrl(v.url)) {
          try {
            const blob = await fetch(v.url).then(r => { if (!r.ok) throw new Error(); return r.blob(); });
            const data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
            sl.addMedia({ type: 'video', data, extn: 'mp4', x: 0, y: 0, w: W, h: H });
          } catch (e) {
            sl.addText('تعذّر تضمين الفيديو — رابطه: ' + v.url, { x: 0.5, y: 3, w: W - 1, h: 1.5, color: 'FFFFFF', fontFace: FONT, fontSize: 18, align: 'center', rtlMode: true });
          }
        }
        if (v.title) sl.addText(v.title, { x: W - 5.6, y: H - 1.0, w: 5.2, h: 0.65, fontFace: FONT, fontSize: 18, bold: true, color: 'FFFFFF', align: 'right', valign: 'middle', rtlMode: true,
          fill: { color: '0D1010', transparency: 35 }, rectRadius: 0.1, shape: pptx.ShapeType.roundRect });
      }
    }

    say('جارٍ إنشاء الملف…');
    const safe = String(screenName || 'screen').replace(/[\\/:*?"<>|]+/g, '').trim() || 'screen';
    const date = new Date().toISOString().slice(0, 10);
    await pptx.writeFile({ fileName: `${safe} - ${date}.pptx` });
    say('');
  }

  window.PptxExport = { exportScreen };
})();
