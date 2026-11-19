# EduDirectory BD

**বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি।**

EduDirectory BD একটি সম্পূর্ণ ফ্রি, ওপেন-সোর্স, Supabase PostgreSQL + PWA ভিত্তিক শিক্ষা প্রতিষ্ঠান ডিরেক্টরি, অ্যাডমিন কন্ট্রোল প্যানেল, নিরাপদ Excel Import/Export এবং ডায়নামিক রিপোর্ট ম্যানেজমেন্ট ওয়েব অ্যাপ্লিকেশন।

---

## প্রধান বৈশিষ্ট্যসমূহ

- **৪,৪১৪টি প্রকৃত প্রতিষ্ঠানের তথ্য**: রংপুর বিভাগের ৮টি জেলা ও ৫৭টি উপজেলার স্কুল, কলেজ, স্কুল অ্যান্ড কলেজ এবং মাদ্রাসা/কারিগরি প্রতিষ্ঠানের মূল উৎস ডেটা।
- **স্মার্ট অনুসন্ধান ও ক্যাসকেডিং ফিল্টার**: বাংলা/ইংরেজি নাম, EIIN, মোবাইল বা ইমেইল দিয়ে তাৎক্ষণিক অনুসন্ধান; জেলা → উপজেলা, ৮টি ক্যাটাগরি, ব্যবস্থাপনা (সরকারি/বেসরকারি/স্বায়ত্তশাসিত), এমপিও অবস্থা এবং যাচাই অবস্থা অনুযায়ী ফিল্টার।
- **নিরাপদ যোগাযোগ অ্যাকশন**: সরাসরি ফোন কল (`tel:`), WhatsApp চ্যাট (`wa.me/880...` — ওয়েব ব্রাউজারের সীমাবদ্ধতার নোটসহ), ইমেইল (`mailto:`) এবং কপি বাটন।
- **তথ্যের সুরক্ষা নীতি**:
  - প্লেসহোল্ডার প্রতিষ্ঠান প্রধানের নাম (`"প্রতিষ্ঠান প্রধান"` / `"প্রতিষ্ঠান প্রধানের নাম"`) খালি/অযাচাইকৃত হিসেবে গণ্য হয়।
  - সব কলেজ প্রাথমিকভাবে `"কলেজ"` মূল ধরনে থাকে এবং অ্যাডমিন দ্বারা যাচাইয়ের পর ডিগ্রি বা উচ্চ মাধ্যমিক হিসেবে শ্রেণিবিভাগ করা যায়; `original_type` কখনো নষ্ট হয় না।
- **অফিসিয়াল ২-শিট Excel Template ও ১০-ধাপের নিরাপদ ইম্পোর্ট**:
  - `Institution Data` (১৯ কলাম, Text ফরম্যাট ও ড্রপডাউন ভ্যালিডেশন) এবং `Instructions` শিট।
  - Record ID → বৈধ EIIN → নাম+জেলা+উপজেলা অনুসারে ডুপ্লিকেট সতর্কতা ও পরিবর্তন প্রিভিউ (Diff)।
- **শুধুমাত্র অ্যাডমিনের জন্য কাস্টম রিপোর্ট বিল্ডার**: বাংলা, English অথবা দ্বিভাষিক (`বাংলা ও English`) রিপোর্ট তৈরি, Excel/CSV এক্সপোর্ট, প্রিন্ট PDF এবং টেমপ্লেট সংরক্ষণ।
- **PWA ও অফলাইন সাপোর্ট**: `manifest.webmanifest`, Workbox Service Worker, IndexedDB অফলাইন ক্যাশ এবং মোবাইল ইনস্টল ব্যানার।

---

## Supabase ও Cloudflare Pages সেটআপ নির্দেশিকা (ধাপে ধাপে)

### ধাপ ১: Supabase প্রোজেক্ট তৈরি
1. [Supabase](https://supabase.com)-এ সাইন ইন করে একটি নতুন ফ্রি প্রোজেক্ট তৈরি করুন।
2. প্রোজেক্টের **Settings → API** থেকে `Project URL` (`VITE_SUPABASE_URL`) এবং `anon public` key (`VITE_SUPABASE_ANON_KEY`) কপি করুন। *(কখনোই `service_role` key ফ্রন্টএন্ডে ব্যবহার করবেন না।)*

### ধাপ ২: ডাটাবেস স্কিমা ও RLS চালানো
1. Supabase Dashboard-এ **SQL Editor** খুলুন।
2. এই রিপোজিটরির `supabase_setup.sql` ফাইলের সম্পূর্ণ কোড পেস্ট করে **Run** করুন।
3. এটি স্বয়ংক্রিয়ভাবে সকল টেবিল (`institutions`, `institution_categories`, `admin_users`, `import_batches`, `audit_logs`, `report_templates`), সার্চ ইনডেক্স, RLS নীতি এবং RPC ফাংশন তৈরি করবে।

### ধাপ ৩: প্রথম অ্যাডমিন ইউজার তৈরি ও লিংক করা
1. Supabase Dashboard → **Authentication → Users → Add user**-এ গিয়ে আপনার অ্যাডমিন ইমেইল ও শক্তিশালী পাসওয়ার্ড দিয়ে ইউজার তৈরি করুন (`Auto Confirm User` চালু রাখুন)।
2. SQL Editor-এ নিচের কমান্ডটি আপনার অ্যাডমিন ইমেইল বসিয়ে চালান (অথবা `supabase_setup.sql`-এর শেষ অংশ দেখুন):
```sql
INSERT INTO public.admin_users (user_id, email, full_name, role, is_active)
SELECT id, email, 'System Administrator', 'super_admin', TRUE
FROM auth.users
WHERE lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, is_active = TRUE;
```

### ধাপ ৪: এনভায়রনমেন্ট ভ্যারিয়েবল সেটআপ
`.env.example` কপি করে `.env` তৈরি করুন:
```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_SITE_URL="https://your-domain.pages.dev"
```

### ধাপ ৫: লোকালি চালানো ও ৪,৪১৪টি ডেটা সিড করা
1. `npm install` এবং `npm run dev` চালান।
2. `/login` থেকে আপনার Supabase অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।
3. অ্যাডমিন প্যানেলের **Excel ইম্পোর্ট ও এক্সপোর্ট** ট্যাবে গিয়ে **“মূল ৪,৪১৪ CSV সিড প্রিভিউ লোড করুন”** বাটনে ক্লিক করে সরাসরি এক ক্লিকে মূল ৪,৪১৪টি প্রতিষ্ঠানের তথ্য Supabase ডাটাবেসে ইম্পোর্ট করুন।

### ধাপ ৬: Cloudflare Pages-এ ডিপ্লয়মেন্ট
1. কোডটি GitHub-এ পুশ করুন।
2. Cloudflare Dashboard → **Workers & Pages → Create application → Pages → Connect to Git** নির্বাচন করুন।
3. Build settings দিন:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables**-এ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, এবং `VITE_SITE_URL` যুক্ত করুন।
5. `public/_redirects` ফাইল থাকায় SPA রাউটিং (`/institution/...`, `/admin`, `/stats`) সরাসরি কাজ করবে।

### ধাপ ৭: টেস্ট ও যাচাই চালানো
```bash
npm run lint
npm run build
npx tsx tests/verify.ts
```

---

## সিকিউরিটি চেকলিস্ট
- `service_role` কী কখনো ক্লায়েন্ট কোডে ব্যবহার করা হয়নি।
- সকল অ্যাডমিন অ্যাকশন, বাল্ক ইম্পোর্ট এবং রিপোর্ট জেনারেশন `public.is_admin()` ও Supabase RLS দ্বারা সুরক্ষিত।
- `/admin` ও `/login` রুট `robots.txt` এবং `noindex` মেটা ট্যাগ দিয়ে সার্চ ইঞ্জিন থেকে বাদ রাখা হয়েছে।
