/*
  إعدادات الربط بقاعدة البيانات
  --------------------------------
  - اتركها فارغة للتجربة: يعمل الموقع في "الوضع التجريبي" ويحفظ البيانات في المتصفح فقط.
  - بعد إنشاء مشروع Supabase المجاني، الصق القيمتين من:
    Project Settings → API → Project URL  و  anon public key
*/
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // اسم المستخدم "admin" يتحول تلقائياً إلى البريد admin@hbrc-admin.local
  // (هذا هو الحساب الذي تنشئه في Supabase → Authentication → Users)
  ADMIN_EMAIL_DOMAIN: "hbrc-admin.local"
};
