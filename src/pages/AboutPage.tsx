import React, { useEffect } from 'react';
import {
  AlertCircle,
  BookOpen,
  Clock,
  FileText,
  PhoneCall,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { updatePageMeta } from '../utils/seo';

export function AboutPage() {
  const { lang } = useLanguage();

  useEffect(() => {
    updatePageMeta({
      title: 'তথ্যসূত্র ও ব্যবহার নির্দেশিকা — EduDirectory BD',
      description:
        'EduDirectory BD-এর তথ্যের উৎস, তথ্য হালনাগাদ নীতি, সতর্কীকরণ ও ভুল সংশোধন সংক্রান্ত অফিশিয়াল নির্দেশিকা।',
      canonicalPath: '/about',
    });
  }, []);

  const sections = [
    {
      icon: FileText,
      titleBn: 'তথ্যের উৎস',
      titleEn: 'Source of Information',
      descBn:
        'সরকারি জাতীয় তথ্য বাতায়ন, সংশ্লিষ্ট দপ্তরসমূহের অফিশিয়াল ওয়েব পোর্টাল এবং পূর্বসংগৃহীত দাপ্তরিক নথিপত্র থেকে শিক্ষাপ্রতিষ্ঠান ও শিক্ষা অফিসের তথ্যসমূহ সংকলন করা হয়েছে।',
      descEn:
        'Information on educational institutions and education offices has been compiled from the Bangladesh National Portal, official department websites, and available administrative records.',
    },
    {
      icon: Clock,
      titleBn: 'তথ্য হালনাগাদ ও পরিবর্তনশীলতা',
      titleEn: 'Updates & Periodic Changes',
      descBn:
        'প্রতিষ্ঠান প্রধান বা কর্মকর্তাগণের বদলি, পদোন্নতি, অবসর কিংবা অফিসিয়াল ফোন নম্বর ও ইমেইল পরিবর্তনের কারণে প্রদর্শিত তথ্যের সাথে বর্তমান বাস্তব অবস্থার সাময়িক ভিন্নতা থাকতে পারে। নিয়মিত ও তাৎক্ষণিক সব তথ্য হালনাগাদ করা সম্ভব না হওয়ায় প্রাপ্ত তথ্যের ভিত্তিতে পর্যায়ক্রমে এগুলো সংশোধন করা হয়।',
      descEn:
        'Due to officer transfers, promotions, retirements, or changes in official phone numbers and emails, displayed records may occasionally differ from current details. Information is updated periodically as confirmed data becomes available.',
    },
    {
      icon: AlertCircle,
      titleBn: 'সতর্কীকরণ ও সীমাবদ্ধতা (Disclaimer)',
      titleEn: 'Disclaimer & Verification',
      descBn:
        'এই প্ল্যাটফর্মে প্রদর্শিত সকল তথ্য কেবল প্রাথমিক যোগাযোগ ও সাধারণ অবগতির জন্য সরবরাহ করা হয়েছে। তথ্য সংকলন বা টাইপিংয়ের ক্ষেত্রে অনিচ্ছাকৃত কোনো ভুল থাকতে পারে। তাই যেকোনো গুরুত্বপূর্ণ দাপ্তরিক কাজে ব্যবহারের পূর্বে সংশ্লিষ্ট শিক্ষা অফিস বা প্রতিষ্ঠানের মূল সরকারি ওয়েব পোর্টাল থেকে তথ্য নিশ্চিত হয়ে নেওয়ার অনুরোধ রইল।',
      descEn:
        'All information provided here is intended solely for preliminary communication and general reference. Unintentional typographical or compilation errors may exist; please verify critical details with the respective official government portal before formal use.',
    },
    {
      icon: PhoneCall,
      titleBn: 'ভুল সংশোধন ও তথ্য হালনাগাদের অনুরোধ',
      titleEn: 'Correction & Update Requests',
      descBn:
        'কোনো শিক্ষাপ্রতিষ্ঠান বা শিক্ষা অফিসের তথ্য, মোবাইল নম্বর, ইমেইল কিংবা পোর্টাল লিংকে কোনো অসঙ্গতি বা ভুল পরিলক্ষিত হলে অনুগ্রহ করে নিচে দেওয়া সাপোর্ট নম্বর বা হোয়াটসঅ্যাপে আমাদের অবহিত করুন। আপনার প্রদত্ত সঠিক তথ্য যাচাই সাপেক্ষে দ্রুত হালনাগাদ করে দেওয়া হবে।',
      descEn:
        'If you notice any inaccuracy in institution or office names, phone numbers, emails, or portal links, please let us know via the support number or WhatsApp provided in the footer for prompt review and correction.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
          <BookOpen className="w-4 h-4" />
          <span>
            {lang === 'bn' ? 'তথ্যসূত্র ও ব্যবহার নির্দেশিকা' : 'Sources & Usage Guidelines'}
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
          {lang === 'bn'
            ? 'বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি'
            : 'Smart Digital Educational Institution Directory'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {lang === 'bn'
            ? 'রংপুর অঞ্চলের শিক্ষাপ্রতিষ্ঠানসমূহ এবং জেলা ও উপজেলা শিক্ষা অফিসের যোগাযোগ সংক্রান্ত তথ্যাদি দ্রুত ও সহজে খুঁজে পাওয়ার লক্ষ্যে এই ডিজিটাল তথ্যভাণ্ডারটি প্রস্তুত করা হয়েছে। শিক্ষা সংশ্লিষ্ট কর্মকর্তা, প্রতিষ্ঠান প্রধান, শিক্ষক, শিক্ষার্থী ও অভিভাবকগণের দৈনন্দিন দাপ্তরিক ও প্রাতিষ্ঠানিক কাজে সহায়তা করাই এর মূল উদ্দেশ্য।'
            : 'This digital directory has been prepared to help education officials, heads of institutions, teachers, students, and guardians quickly find contact details of educational institutions and education offices across the Rangpur region.'}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.titleEn}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2.5"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base text-slate-900">
                {lang === 'bn' ? item.titleBn : item.titleEn}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {lang === 'bn' ? item.descBn : item.descEn}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
