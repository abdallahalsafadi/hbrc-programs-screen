/*
  إعدادات الربط بقاعدة البيانات
  --------------------------------
  - اتركها فارغة للتجربة: يعمل الموقع في "الوضع التجريبي" ويحفظ البيانات في المتصفح فقط.
  - بعد إنشاء مشروع Supabase المجاني، الصق القيمتين من:
    Project Settings → API → Project URL  و  anon public key
*/
window.APP_CONFIG = {
  SUPABASE_URL: "https://sekwsghbbsvipgtylmpd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_4hROEqu4dXJaQzr-vyz22Q_iSCZlCrM",

  // الفيديوهات تُخزَّن في Cloudflare R2 (بدون حد للنقل) عبر Worker الرفع
  R2_UPLOAD_API: "https://hbrc-upload.eng-safadi92.workers.dev",
  R2_PUBLIC_URL: "https://pub-bd9a426fe9de4745b602033077cf7c34.r2.dev",

  // اسم المستخدم "admin" يتحول تلقائياً إلى البريد admin@hbrc-admin.local
  // (هذا هو الحساب الذي تنشئه في Supabase → Authentication → Users)
  ADMIN_EMAIL_DOMAIN: "hbrc-admin.local"
};
