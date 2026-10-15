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

  // اسم المستخدم "admin" يتحول تلقائياً إلى البريد admin@hbrc-admin.local
  // (هذا هو الحساب الذي تنشئه في Supabase → Authentication → Users)
  ADMIN_EMAIL_DOMAIN: "hbrc-admin.local"
};
