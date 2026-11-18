// Ported verbatim from v4 (legacy/index.html NOTE_TEMPLATES, legacy/exercise-explorer.js VID_DB and REC).
export const JOURNAL_TEMPLATES: Record<string, { label: string; text: string }> = {
 "workout": {
  "label": "🏋️ رياضة وبناء جسم",
  "text": "🏋️ تمرين اليوم\n━━━━━━━━━━━━━━━\n💪 التمارين:\n• \n\n⚖️ الوزن: ___ كغ\n💧 الماء: ___ لتر\n🔥 السعرات المحروقة: ___\n\n😤 مستوى الجهد (1-10): ___\n📝 ملاحظات:\n"
 },
 "nutrition": {
  "label": "🍽️ تغذية",
  "text": "🍽️ تغذية اليوم\n━━━━━━━━━━━━━━━\n🌅 الفطور:\n• \n\n☀️ الغداء:\n• \n\n🌙 العشاء:\n• \n\n💧 الماء: ___ لتر\n🔢 إجمالي السعرات: ___\n"
 },
 "sleep": {
  "label": "😴 نوم وراحة",
  "text": "😴 نوم اليوم\n━━━━━━━━━━━━━━━\n🌙 وقت النوم: ___\n🌅 وقت الاستيقاظ: ___\n⏱️ ساعات النوم: ___\n⭐ جودة النوم (1-10): ___\n\n🧘 كيف أشعر اليوم:\n"
 },
 "reflect": {
  "label": "💡 تأمل وأفكار",
  "text": "💡 تأملي اليوم\n━━━━━━━━━━━━━━━\n🙏 أشكر الله على:\n• \n\n🎯 هدفي اليوم:\n\n✅ ما أنجزته:\n\n💭 فكرة أو شيء تعلمته:\n\n🌟 أفضل لحظة اليوم:\n"
 },
 "free": {
  "label": "✍️ كتابة حرة",
  "text": ""
 }
};

export const EXERCISE_VIDEOS: Record<string, Array<{ id: string; title: string; ch: string }>> = {
 "bench press": [
  {
   "id": "rT7DgCr-3pg",
   "title": "Bench Press Full Guide",
   "ch": "Jeff Nippard"
  },
  {
   "id": "SCVCLChPQEY",
   "title": "Perfect Bench Press",
   "ch": "Athlean-X"
  }
 ],
 "incline bench press": [
  {
   "id": "DbFgADa2PL8",
   "title": "Incline Bench Press Guide",
   "ch": "Jeremy Ethier"
  }
 ],
 "barbell squat": [
  {
   "id": "ultWZbUMPL8",
   "title": "How To Squat",
   "ch": "Athlean-X"
  },
  {
   "id": "nEQQle9-0NA",
   "title": "Squat Technique",
   "ch": "Jeremy Ethier"
  }
 ],
 "deadlift": [
  {
   "id": "op9kVnSso6Q",
   "title": "Deadlift Tutorial",
   "ch": "Athlean-X"
  },
  {
   "id": "ytGaGIn3SjE",
   "title": "Deadlift Technique",
   "ch": "Jeff Nippard"
  }
 ],
 "romanian deadlift": [
  {
   "id": "JCXUYuzwNrM",
   "title": "Romanian Deadlift Guide",
   "ch": "Jeff Nippard"
  }
 ],
 "overhead press": [
  {
   "id": "2yjwXTZbDtY",
   "title": "Overhead Press Form",
   "ch": "Athlean-X"
  }
 ],
 "lateral raise": [
  {
   "id": "FeRxNWuVxzw",
   "title": "Lateral Raise Tutorial",
   "ch": "Jeremy Ethier"
  }
 ],
 "pull-up": [
  {
   "id": "eGo4IYlbE5g",
   "title": "Pull-Up Tutorial",
   "ch": "Athlean-X"
  }
 ],
 "lat pulldown": [
  {
   "id": "CAwf7n6Luuc",
   "title": "Lat Pulldown Guide",
   "ch": "Jeremy Ethier"
  }
 ],
 "barbell row": [
  {
   "id": "kBWAon7ItDw",
   "title": "Barbell Row Technique",
   "ch": "Jeff Nippard"
  }
 ],
 "bicep curl": [
  {
   "id": "ykJmrZ5v0Oo",
   "title": "Bicep Curl Tutorial",
   "ch": "Athlean-X"
  }
 ],
 "hammer curl": [
  {
   "id": "zC3nLlEvin4",
   "title": "Hammer Curl Guide",
   "ch": "Jeff Nippard"
  }
 ],
 "tricep pushdown": [
  {
   "id": "2-LAMcpzODU",
   "title": "Tricep Pushdown Form",
   "ch": "Athlean-X"
  }
 ],
 "skull crusher": [
  {
   "id": "d_KZxkY_0cM",
   "title": "Skull Crusher Tutorial",
   "ch": "Jeff Nippard"
  }
 ],
 "leg press": [
  {
   "id": "yZmx_Ac3R8k",
   "title": "Leg Press Technique",
   "ch": "Athlean-X"
  }
 ],
 "lunge": [
  {
   "id": "QOVaHwm-Q6U",
   "title": "Lunge Form Guide",
   "ch": "Jeremy Ethier"
  }
 ],
 "plank": [
  {
   "id": "pvIjChbkIZs",
   "title": "Perfect Plank Form",
   "ch": "Athlean-X"
  }
 ],
 "cable fly": [
  {
   "id": "TAj8LFhLMrk",
   "title": "Cable Fly Tutorial",
   "ch": "Athlean-X"
  }
 ]
};

export const RECOVERY_TIPS: Record<string, Record<string, string | string[]>> = {
 "chest": {
  "rest": "48–72 ساعة",
  "vol": "10–20 جلسة/أسبوع",
  "tips": [
   "تمدّد عضلة الصدر 30 ث × 3 بعد كل جلسة",
   "بروتين خلال 30 دقيقة من انتهاء التمرين",
   "الضغط الخفيف يوم الراحة يزيد تدفق الدم"
  ]
 },
 "back": {
  "rest": "48–72 ساعة",
  "vol": "10–20 جلسة/أسبوع",
  "tips": [
   "تمدّد العمود الفقري للأمام 20 ثانية",
   "نوم 7–9 ساعات يُضاعف إفراز هرمون النمو",
   "تدريب أحادي الذراع يقلل الإجهاد"
  ]
 },
 "shoulders": {
  "rest": "48 ساعة",
  "vol": "12–20 جلسة/أسبوع",
  "tips": [
   "تجنّب الرفع فوق الرأس في أيام الراحة",
   "تمدّد الدلتا الأمامي والخلفي 20 ث",
   "الكتف تُحمّل في كل تمرين علوي — راحتها مهمة"
  ]
 },
 "upper arms": {
  "rest": "48 ساعة",
  "vol": "12–20 جلسة/أسبوع",
  "tips": [
   "تمدّد الباي والتراي مع الإحماء",
   "الذراعان تتعافيان أسرع من الجذع",
   "تدريبها مرتين/أسبوع مثالي للبداية"
  ]
 },
 "upper legs": {
  "rest": "72 ساعة",
  "vol": "10–20 جلسة/أسبوع",
  "tips": [
   "المشي الخفيف يوم بعد السكوات يسرّع التعافي",
   "تمدّد رباعية الفخذ 30 ث × 2 جانب",
   "الساقان تحتاج أطول راحة — لا تتسرع"
  ]
 },
 "waist": {
  "rest": "24–48 ساعة",
  "vol": "12–25 جلسة/أسبوع",
  "tips": [
   "البطن يتحمّل تدريباً خفيفاً يومياً",
   "ربط التنفس بالحركة يضاعف التأثير",
   "الرياضة الهوائية تحرق دهون البطن أكثر"
  ]
 },
 "lower arms": {
  "rest": "24 ساعة",
  "vol": "8–16 جلسة/أسبوع",
  "tips": [
   "تمدّد المعصم للأمام والخلف 15 ث",
   "الساعد يتعافى بسرعة ويتحمّل التكرار",
   "قبضة الحديد تتطور مع الوقت — لا تتعجّل"
  ]
 },
 "lower legs": {
  "rest": "24–48 ساعة",
  "vol": "12–20 جلسة/أسبوع",
  "tips": [
   "السمانة تتحمّل تكراراً عالياً وتمديداً يومياً",
   "توقّف لحظة في أعلى الحركة لانقباض أقوى",
   "نوّع بين الواقف والجالس لاستهداف الرأسين"
  ]
 },
 "cardio": {
  "rest": "24 ساعة",
  "vol": "150 دقيقة/أسبوع",
  "tips": [
   "الكارديو المعتدل يسرّع تعافي العضلات",
   "ابقَ مرطّبًا: 30–40 مل ماء لكل كجم يومياً",
   "النوم الجيد يوازن هرمونات الطاقة"
  ]
 }
};
