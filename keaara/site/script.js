// Client-side script for search functionality, i18n, and form handling

document.addEventListener('DOMContentLoaded', () => {
  /**
   * i18n dictionary for Hebrew (he) and Arabic (ar)
   */
  const i18n = {
    he: {
      'page.title': 'מסעדה ביתית – דף נחיתה',
      'meta.description': 'מסעדה ביתית עם תפריט טרי, סלטים בהרכבה אישית, מנות טאבון, סמבוסק ומשקאות. גלריה, טופס קשר ויצירת קשר מהירה בוואטסאפ. מותאם עברית וערבית.',
      'skip.content': 'דלג לתוכן',
      'accessibility.toggle': 'ניגודיות',
      'hero.brand': 'הקערה',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'לתפריט',
      'cta.contact': 'צור קשר',
      'cta.whatsapp': 'הזמנה בוואטסאפ',
      'nav.menu': 'תפריט',
      'nav.about': 'אודות',
      'nav.services': 'שירותים',
      'nav.gallery': 'גלריה',
      'nav.contact': 'צור קשר',
      'menu.title': 'התפריט שלנו',
      'menu.desc': 'חפשו מנות, עיינו בקטגוריות וגלו את כל הטעמים שלנו.',
      'search.placeholder': 'חיפוש מנה...',
      'search.no_results': 'לא נמצאו תוצאות',
      'cat.breakfast': 'ארוחות בוקר',
      'cat.salads': 'סלטים בהרכבה אישית',
      'cat.taboon': 'מהטאבון',
      'cat.sambusak': 'סמבוסק אישי',
      'cat.drinks': 'משקאות',
      'item.pancakes': 'פנקייקים עם דבש',
      'item.omelette': 'חביתה ירקות טרייה',
      'item.shakshuka': 'שקשוקה ביתית',
      'item.caesar': 'סלט קיסר עם רוטב לימון',
      'item.greek': 'סלט יווני עם גבינה בולגרית',
      'item.green': 'סלט ירוק עם אגוזים ורימונים',
      'item.pizza': 'פיצה מרגריטה בטאבון',
      'item.zaatar': 'מאפה זעתר מסורתי',
      'item.focaccia': 'פוקאצ׳ה עם שמן זית ורוזמרין',
      'item.samb_cheese': 'סמבוסק גבינות וזיתים',
      'item.samb_spinach': 'סמבוסק תרד ופטריות',
      'item.samb_potato': 'סמבוסק תפוחי אדמה',
      'item.latte': 'קפה הפוך',
      'item.mint_tea': 'תה עם נענע',
      'item.orange_juice': 'מיץ תפוזים טרי',
      'about.title': 'אודותינו',
      'about.p1': 'בשנים האחרונות עולם האוכל הבריא עובר מהפכה, ומסעדת “הקערה” עומדת בחזית השינוי. המסעדה, שנוסדה בחיפה, הייתה הראשונה בישראל שהביאה את קונספט הרכבת הסלטים האישיים – ומאז היא ממשיכה להוביל את התחום עם חדשנות, טריות ואיכות ללא פשרות.',
      'about.p2': 'הסיפור של “הקערה” – איך הכל התחיל? עוד לפני שסלטים בהרכבה עצמית הפכו לטרנד עולמי, “הקערה” הייתה שם ראשונה. הרעיון נולד מתוך רצון להציע ארוחות בריאות, אישיות משבעות , שבהן כל לקוח יכול להרכיב את הקערה שמתאימה בדיוק לו. בעולם שבו אוכל מהיר שולט, “הקערה” שמה דגש על רכיבים טריים בלבד – ירקות שנחתכים מדי בוקר, חלבונים איכותיים, קטניות מלאות בערכים תזונתיים, ורטבים שנעשים בעבודת יד.',
      'founder.caption': 'המייסד שלנו, שף Jol Rhayel',
      'services.title': 'אז מה הופך את “הקערה” למובילה?',
      'services.p1': 'אצלנו תיהנו ממבחר סלטים טריים בהרכבה אישית, עם מגוון תוספות, גבינות ורטבים ביתיים – בדיוק כמו שאתם אוהבים.',
      'services.p2': 'ניתן להזמין לישיבה במקום או לקחת בטייק־אווי לאורך כל שעות הפעילות. יש שאלות או בקשות מיוחדות? נשמח לעזור.',
      'services.bullets.1': '✅ קונספט פורץ דרך: המסעדה הראשונה בישראל שהתמחתה בהרכבת סלטים אישיים.',
      'services.bullets.2': '✅ חומרי גלם איכותיים: שימוש בחומרי גלם מקומיים, טריים ובריאים.',
      'services.bullets.3': '✅ גמישות והתאמה אישית: כל אחד יכול ליצור את הקערה שמתאימה לו – טבעונית, חלבונית, קטוגנית ועוד.',
      'services.bullets.4': '✅ טרנד שהפך לקלאסיקה: מאז הקמתה, מסעדות רבות אימצו את הקונספט – אבל “הקערה” הייתה שם קודם!',
      'services.next_title': 'מה הלאה? החדשנות ממשיכה!',
      'services.future': 'בימים אלו “הקערה” מתכננת להרחיב את התפריט, עם קערות עונתיות, שילובי סופר-פוד חדשים, ורטבים מפתיעים. כמו כן, בקרוב יושק מועדון הלקוחות החדש, שיאפשר לחובבי הבריאות ליהנות מהטבות בלעדיות.',
      'services.slogan': 'הקערה – יותר מסלט. חוויה בריאה, טעימה ואישית.',
      'gallery.title': 'גלריה',
      'gallery.desc': 'קצת מהאווירה והטעמים שלנו כדי שתוכלו להרגיש בבית עוד לפני שאתם מגיעים.',
      'gallery.prev': 'תמונה קודמת',
      'gallery.next': 'תמונה הבאה',
      'usp.title': 'למה לבחור בנו',
      'usp.fresh.title': 'טרי מהשוק',
      'usp.fresh.desc': 'חומרי גלם יומיומיים ועונתיים שנחתכים ומוכנים במקום.',
      'usp.fast.title': 'מהיר וידידותי',
      'usp.fast.desc': 'הזמנה קלה ושירות מחויך – גם בישיבה וגם בטייק־אווי.',
      'usp.kosher.title': 'בריא ומאוזן',
      'usp.kosher.desc': 'אפשרויות צמחוניות וטבעוניות עם איזון נכון של טעמים.',
      'cta.banner.title': 'מתחשק לכם משהו טרי?',
      'cta.banner.desc': 'הרכיבו את הסלט המושלם והזמינו בקלות — אנחנו כבר מתחילים להכין.',
      'cta.banner.button': 'להזמנה מהירה',
      'contact.title': 'צור קשר',
      'contact.desc': 'נשמח לשמוע מכם! מלאו את הטופס ונחזור אליכם בהקדם.',
      'contact.name_label': 'שם מלא',
      'contact.phone_label': 'טלפון',
      'contact.email_label': 'דוא"ל',
      'contact.message_label': 'הודעה',
      'contact.phone_placeholder': '050-0000000',
      'contact.email_placeholder': 'example@email.com',
      'contact.submit': 'שלח הודעה',
      'contact.validation_error': 'אנא מלאו את כל הפרטים הנדרשים.',
      'contact.whatsapp_success': 'תודה! נפתח וואטסאפ עם פרטי ההודעה לשליחה.',
      'contact.wa_greeting': 'שלום, פנייה חדשה מהאתר:',
      'contact.wa_name_label': 'שם: ',
      'contact.wa_phone_label': 'טלפון: ',
      'contact.wa_email_label': 'דוא"ל: ',
      'contact.wa_message_label': 'הודעה: ',
      'footer.text': '© 2025 מסעדה ביתית – כל הזכויות שמורות'
    },
    ar: {
      'page.title': 'مطعم منزلي – صفحة هبوط',
      'meta.description': 'مطعم منزلي بقائمة طازجة، سلطات حسب الطلب، أطباق من التنور، سمبوسك ومشروبات. معرض صور ونموذج تواصل واتصال سريع عبر واتساب. يدعم العربية والعبرية.',
      'skip.content': 'تجاوز إلى المحتوى',
      'accessibility.toggle': 'تباين',
      'hero.brand': 'הקערה',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'إلى القائمة',
      'cta.contact': 'تواصل',
      'cta.whatsapp': 'اطلب عبر واتساب',
      'nav.menu': 'القائمة',
      'nav.about': 'من نحن',
      'nav.services': 'خدمات',
      'nav.gallery': 'معرض الصور',
      'nav.contact': 'تواصل',
      'menu.title': 'قائمتنا',
      'menu.desc': 'ابحثوا عن الأطباق، تصفحوا الفئات، واكتشفوا جميع نكهاتنا.',
      'search.placeholder': 'ابحث عن طبق...',
      'search.no_results': 'لا توجد نتائج',
      'cat.breakfast': 'وجبات الإفطار',
      'cat.salads': 'سلطات حسب الطلب',
      'cat.taboon': 'من التنور',
      'cat.sambusak': 'سمبوسك فردي',
      'cat.drinks': 'مشروبات',
      'item.pancakes': 'فطائر بانكيك مع عسل',
      'item.omelette': 'أومليت بخضار طازجة',
      'item.shakshuka': 'شكشوكة منزلية',
      'item.caesar': 'سلطة سيزار بصلصة الليمون',
      'item.greek': 'سلطة يونانية بجبنة بلغارية',
      'item.green': 'سلطة خضراء مع مكسرات ورمان',
      'item.pizza': 'بيتزا مارجريتا من التنور',
      'item.zaatar': 'معجنات زعتر تقليدية',
      'item.focaccia': 'فوكاتشا بزيت الزيتون وإكليل الجبل',
      'item.samb_cheese': 'سمبوسك بالجبن والزيتون',
      'item.samb_spinach': 'سمبوسك بالسبانخ والفطر',
      'item.samb_potato': 'سمبوسك ببطاطا',
      'item.latte': 'كافيه لاتيه',
      'item.mint_tea': 'شاي بالنعناع',
      'item.orange_juice': 'عصير برتقال طازج',
      'about.title': 'من نحن',
      'about.p1': 'في السنوات الأخيرة يشهد عالم الطعام الصحي ثورة، ومطعم “הקערה” يقف في طليعة هذا التغيير. تأسس المطعم في حيفا وكان الأول في إسرائيل الذي قدّم مفهوم السلطات المُعَدّة حسب الطلب — ومنذ ذلك الحين يواصل قيادة هذا المجال بالابتكار والنضارة وجودة لا تُساوَم.',
      'about.p2': 'قصة “הקערה” — كيف بدأ كل شيء؟ قبل أن تصبح السلطات المُعَدّة حسب الطلب ترنداً عالمياً، كانت “הקערה” هناك أولاً. وُلدت الفكرة من رغبة في تقديم وجبات صحية وشخصية ومشبِعة يستطيع فيها كل زبون تركيب الوعاء الذي يلائمه تماماً. في عالم يهيمن عليه الطعام السريع، تركز “הקערה” على المكونات الطازجة فقط — خضار تُقطَّع كل صباح، بروتينات عالية الجودة، بقوليات غنية بالقيم الغذائية، وصلصات تُحضَّر يدوياً.',
      'founder.caption': 'مؤسسنا، الشيف Jol Rhayel',
      'services.title': 'ما الذي يجعل “הקערה” رائدة؟',
      'services.p1': 'نقدّم تشكيلة واسعة من السلطات الطازجة تُحضَّر حسب طلبكم، مع إضافات متنوعة وأجبان وصلصات منزلية – تماماً كما تحبون.',
      'services.p2': 'يمكن الطلب للأكل في المكان أو للتيك أواي طوال ساعات العمل. لديكم أسئلة أو طلبات خاصة؟ يسعدنا مساعدتكم.',
      'services.bullets.1': '✅ مفهوم رائد: أول مطعم في إسرائيل تخصّص في سلطات مُعَدّة حسب الطلب.',
      'services.bullets.2': '✅ مكونات عالية الجودة: استخدام مكونات محلية طازجة وصحية.',
      'services.bullets.3': '✅ مرونة وتخصيص: بإمكان كل شخص صنع الوعاء الذي يناسبه — نباتي، غني بالبروتين، كيتو وغيرها.',
      'services.bullets.4': '✅ ترند أصبح كلاسيكياً: منذ تأسيسها، تبنّت مطاعم كثيرة المفهوم — لكن “הקערה” كانت هناك أولاً!',
      'services.next_title': 'ماذا بعد؟ الابتكار مستمر!',
      'services.future': 'في هذه الأيام تخطّط “הקערה” لتوسيع القائمة بأوعية موسمية، تركيبات سوبر فود جديدة وصلصات مفاجِئة. كما سيتم قريباً إطلاق نادي العملاء الجديد ليمنح عشّاق الصحة امتيازات حصرية.',
      'services.slogan': '“הקערה” — أكثر من سلطة. تجربة صحية، لذيذة وشخصية.',
      'gallery.title': 'معرض الصور',
      'gallery.desc': 'بعض الأجواء والنكهات لدينا لتشعروا بالبيت قبل أن تصلوا.',
      'gallery.prev': 'الصورة السابقة',
      'gallery.next': 'الصورة التالية',
      'usp.title': 'لماذا تختاروننا',
      'usp.fresh.title': 'طازج من السوق',
      'usp.fresh.desc': 'مكونات يومية وموسمية تُحضّر وتُقطع في المكان.',
      'usp.fast.title': 'سريع وودود',
      'usp.fast.desc': 'طلب سهل وخدمة بابتسامة – للجلوس أو للتيك أواي.',
      'usp.kosher.title': 'صحي ومتوازن',
      'usp.kosher.desc': 'خيارات نباتية ونباتية بالكامل مع توازن صحيح للنَكهات.',
      'cta.banner.title': 'جاهزون لشيء طازج؟',
      'cta.banner.desc': 'حضّروا السلطة المثالية واطلبوا بسهولة — سنبدأ بتحضيرها فوراً.',
      'cta.banner.button': 'اطلبوا الآن',
      'contact.title': 'تواصل معنا',
      'contact.desc': 'يسعدنا سماعكم! املؤوا النموذج وسنعاود الاتصال بكم في أقرب وقت.',
      'contact.name_label': 'الاسم الكامل',
      'contact.phone_label': 'هاتف',
      'contact.email_label': 'بريد إلكتروني',
      'contact.message_label': 'رسالة',
      'contact.phone_placeholder': '050-0000000',
      'contact.email_placeholder': 'example@email.com',
      'contact.submit': 'أرسل الرسالة',
      'contact.validation_error': 'يرجى ملء جميع الحقول المطلوبة.',
      'contact.whatsapp_success': 'شكراً! سيفتح واتساب مع تفاصيل الرسالة للإرسال.',
      'contact.wa_greeting': 'مرحباً، طلب جديد من الموقع:',
      'contact.wa_name_label': 'الاسم: ',
      'contact.wa_phone_label': 'الهاتف: ',
      'contact.wa_email_label': 'البريد: ',
      'contact.wa_message_label': 'الرسالة: ',
      'footer.text': '© 2025 مطعم منزلي – جميع الحقوق محفوظة'
    },
    en: {
      'page.title': 'Home Restaurant – Landing Page',
      'meta.description': 'Home restaurant with a fresh menu, custom salads, taboon dishes, sambusak, and drinks. Gallery, contact form, and quick contact via WhatsApp. Supports Hebrew and Arabic.',
      'skip.content': 'Skip to content',
      'accessibility.toggle': 'Contrast',
      'hero.brand': 'הקערה',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'To Menu',
      'cta.contact': 'Contact Us',
      'cta.whatsapp': 'Order on WhatsApp',
      'nav.menu': 'Menu',
      'nav.about': 'About',
      'nav.services': 'Services',
      'nav.gallery': 'Gallery',
      'nav.contact': 'Contact',
      'menu.title': 'Our Menu',
      'menu.desc': 'Search dishes, browse categories, and discover all our flavors.',
      'search.placeholder': 'Search for a dish...',
      'search.no_results': 'No results found',
      'cat.breakfast': 'Breakfasts',
      'cat.salads': 'Custom Salads',
      'cat.taboon': 'From the Taboon',
      'cat.sambusak': 'Individual Sambusak',
      'cat.drinks': 'Drinks',
      'item.pancakes': 'Pancakes with Honey',
      'item.omelette': 'Fresh Vegetable Omelette',
      'item.shakshuka': 'Homemade Shakshuka',
      'item.caesar': 'Caesar Salad with Lemon Dressing',
      'item.greek': 'Greek Salad with Bulgarian Cheese',
      'item.green': 'Green Salad with Nuts and Pomegranates',
      'item.pizza': 'Margherita Pizza from the Taboon',
      'item.zaatar': 'Traditional Zaatar Pastry',
      'item.focaccia': 'Focaccia with Olive Oil and Rosemary',
      'item.samb_cheese': 'Sambusak with Cheese and Olives',
      'item.samb_spinach': 'Sambusak with Spinach and Mushrooms',
      'item.samb_potato': 'Sambusak with Potatoes',
      'item.latte': 'Café Latte',
      'item.mint_tea': 'Mint Tea',
      'item.orange_juice': 'Fresh Orange Juice',
      'about.title': 'About Us',
      'about.p1': 'In recent years, the world of healthy food has been undergoing a revolution, and “HaKeara” stands at the forefront of this change. Founded in Haifa, the restaurant was the first in Israel to introduce the concept of build-your-own salads — and since then it has continued to lead the field with innovation, freshness, and uncompromising quality.',
      'about.p2': 'The story of “HaKeara” — how did it all begin? Even before build-your-own salads became a global trend, “HaKeara” was there first. The idea was born from a desire to offer healthy, personal, and satisfying meals in which every customer can assemble the bowl that suits them perfectly. In a world dominated by fast food, “HaKeara” focuses only on fresh ingredients — vegetables cut every morning, quality proteins, legumes rich in nutritional value, and dressings made by hand.',
      'founder.caption': 'Our Founder, Chef Jol Rhayel',
      'services.title': 'So what makes “HaKeara” a leader?',
      'services.p1': 'Enjoy a wide selection of fresh, build-your-own salads with a variety of toppings, cheeses, and house-made dressings — just the way you like.',
      'services.p2': 'Order for dine-in or takeout throughout our opening hours. Have questions or special requests? We’re happy to help.',
      'services.bullets.1': '✅ Breakthrough concept: the first restaurant in Israel specializing in build-your-own salads.',
      'services.bullets.2': '✅ Quality ingredients: using fresh, local, healthy produce.',
      'services.bullets.3': '✅ Flexibility and personalization: everyone can create the bowl that fits them — vegan, protein-rich, keto, and more.',
      'services.bullets.4': '✅ A trend turned classic: since its founding, many restaurants adopted the concept — but “HaKeara” was there first!',
      'services.next_title': 'What’s next? The innovation continues!',
      'services.future': 'These days, “HaKeara” is planning to expand the menu with seasonal bowls, new super‑food combinations, and surprising dressings. A new members club is also coming soon, offering exclusive benefits for health lovers.',
      'services.slogan': '“HaKeara” — more than a salad. A healthy, tasty, personal experience.',
      'gallery.title': 'Gallery',
      'gallery.desc': 'Some of our atmosphere and flavors so you can feel at home before you even arrive.',
      'gallery.prev': 'Previous Image',
      'gallery.next': 'Next Image',
      'usp.title': 'Why Choose Us',
      'usp.fresh.title': 'Fresh from the Market',
      'usp.fresh.desc': 'Daily, seasonal ingredients prepped and cut on site.',
      'usp.fast.title': 'Fast & Friendly',
      'usp.fast.desc': 'Easy ordering and a smiling service – dine in or takeout.',
      'usp.kosher.title': 'Healthy & Balanced',
      'usp.kosher.desc': 'Vegetarian and vegan options with the right balance of flavors.',
      'cta.banner.title': 'Craving something fresh?',
      'cta.banner.desc': 'Build your perfect salad and order with ease — we’ll start preparing it right away.',
      'cta.banner.button': 'Order Now',
      'contact.title': 'Contact Us',
      'contact.desc': 'We would love to hear from you! Fill out the form and we will get back to you as soon as possible.',
      'contact.name_label': 'Full Name',
      'contact.phone_label': 'Phone',
      'contact.email_label': 'Email',
      'contact.message_label': 'Message',
      'contact.phone_placeholder': '050-0000000',
      'contact.email_placeholder': 'example@email.com',
      'contact.submit': 'Send Message',
      'contact.validation_error': 'Please fill in all required fields.',
      'contact.whatsapp_success': 'Thank you! WhatsApp will open with the message details for sending.',
      'contact.wa_greeting': 'Hello, new inquiry from the website:',
      'contact.wa_name_label': 'Name: ',
      'contact.wa_phone_label': 'Phone: ',
      'contact.wa_email_label': 'Email: ',
      'contact.wa_message_label': 'Message: ',
      'footer.text': '© 2025 Home Restaurant – All rights reserved'
    }
  };

  // Menu keys for search data (language-agnostic keys)
  const MENU_KEYS = [
    { key: 'item.pancakes', categoryKey: 'cat.breakfast' },
    { key: 'item.omelette', categoryKey: 'cat.breakfast' },
    { key: 'item.shakshuka', categoryKey: 'cat.breakfast' },
    { key: 'item.caesar', categoryKey: 'cat.salads' },
    { key: 'item.greek', categoryKey: 'cat.salads' },
    { key: 'item.green', categoryKey: 'cat.salads' },
    { key: 'item.pizza', categoryKey: 'cat.taboon' },
    { key: 'item.zaatar', categoryKey: 'cat.taboon' },
    { key: 'item.focaccia', categoryKey: 'cat.taboon' },
    { key: 'item.samb_cheese', categoryKey: 'cat.sambusak' },
    { key: 'item.samb_spinach', categoryKey: 'cat.sambusak' },
    { key: 'item.samb_potato', categoryKey: 'cat.sambusak' },
    { key: 'item.latte', categoryKey: 'cat.drinks' },
    { key: 'item.mint_tea', categoryKey: 'cat.drinks' },
    { key: 'item.orange_juice', categoryKey: 'cat.drinks' }
  ];

  // Elements used across features
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('searchResults');

  // Helpers
  const getText = (lang, key) => (i18n[lang] && i18n[lang][key]) || (i18n.he && i18n.he[key]) || key;
  const getMenuItemsForLang = (lang) => MENU_KEYS.map(m => ({ name: getText(lang, m.key), category: getText(lang, m.categoryKey) }));
  const setActiveLangBtn = (lang) => {
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
  };
  const normalizeText = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '');

  // Force default language to Hebrew on load
  let currentLang = localStorage.getItem('lang') || 'he';
  let menuItems = getMenuItemsForLang(currentLang);
  let messages = {
    validation: getText(currentLang, 'contact.validation_error'),
    whatsappSuccess: getText(currentLang, 'contact.whatsapp_success')
  };

  const applyTranslations = (lang) => {
    document.documentElement.lang = (lang === 'ar') ? 'ar' : 'he';
    document.documentElement.dir = 'rtl';
    document.title = getText(lang, 'page.title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const t = getText(lang, key);
      if (typeof t === 'string') el.textContent = t;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const t = getText(lang, key);
      if (typeof t === 'string') el.setAttribute('placeholder', t);
    });

    // New: translate aria-labels where needed
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const t = getText(lang, key);
      if (typeof t === 'string') el.setAttribute('aria-label', t);
    });

    // Update meta descriptions/titles for SEO on language switch
    const metaDesc = document.getElementById('metaDescription');
    if (metaDesc) metaDesc.setAttribute('content', getText(lang, 'meta.description'));
    const ogTitle = document.getElementById('metaOgTitle');
    if (ogTitle) ogTitle.setAttribute('content', getText(lang, 'page.title'));
    const ogDesc = document.getElementById('metaOgDesc');
    if (ogDesc) ogDesc.setAttribute('content', getText(lang, 'meta.description'));
    const twTitle = document.getElementById('metaTwTitle');
    if (twTitle) twTitle.setAttribute('content', getText(lang, 'page.title'));
    const twDesc = document.getElementById('metaTwDesc');
    if (twDesc) twDesc.setAttribute('content', getText(lang, 'meta.description'));

    // Update cached messages and menu items
    messages.validation = getText(lang, 'contact.validation_error');
    messages.whatsappSuccess = getText(lang, 'contact.whatsapp_success');
    menuItems = getMenuItemsForLang(lang);

    // Clear search results on language change
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.add('hidden');
    }

    // Persist and highlight active language
    localStorage.setItem('lang', lang);
    setActiveLangBtn(lang);

    // Update gallery modal arrow icons to match RTL/LTR expectations
    const pBtn = document.querySelector('.modal .nav-prev');
    const nBtn = document.querySelector('.modal .nav-next');
    if (pBtn && nBtn) {
      const isRtl = (lang === 'he' || lang === 'ar');
      // In RTL: previous shows a right chevron, next shows a left chevron
      pBtn.textContent = isRtl ? '\u203A' : '\u2039';
      nBtn.textContent = isRtl ? '\u2039' : '\u203A';
    }
  };

  // Initialize language switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang && lang !== currentLang) {
        currentLang = lang;
        applyTranslations(currentLang);
      }
    });
  });
  // First-time apply
  applyTranslations(currentLang);

  /**
   * Search functionality – now language aware and diacritics-insensitive
   */
  if (searchInput && resultsContainer) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (query === '') {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
      }
      const nQuery = normalizeText(query);
      const matches = menuItems.filter(item => normalizeText(item.name).includes(nQuery));
      if (matches.length > 0) {
        const list = document.createElement('ul');
        matches.forEach(match => {
          const li = document.createElement('li');
          li.textContent = `${match.name} – ${match.category}`;
          list.appendChild(li);
        });
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(list);
      } else {
        resultsContainer.innerHTML = `<p>${getText(currentLang, 'search.no_results')}</p>`;
      }
      resultsContainer.classList.remove('hidden');
    });
  }

  /**
   * Contact form submission
   */
  const contactForm = document.getElementById('contactForm');
  const contactStatus = document.getElementById('contactMessageStatus');
  const WHATSAPP_NUMBER = '972537700285'; // 053-770-0285 in international format without leading 0

  // Set the floating Call button to dial the restaurant
  const callButton = document.getElementById('callButton');
  if (callButton) {
    callButton.setAttribute('href', `tel:048641967`);
  }
  // Also keep the top CTA WhatsApp button in sync if present
  const topWhatsappCta = document.getElementById('topWhatsappCta');
  if (topWhatsappCta) {
    topWhatsappCta.setAttribute('href', `https://wa.me/${WHATSAPP_NUMBER}`);
  }
  // Sync any element marked with data-wa-link
  document.querySelectorAll('[data-wa-link]').forEach(el => {
    el.setAttribute('href', `https://wa.me/${WHATSAPP_NUMBER}`);
  });

  if (contactForm && contactStatus) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const phone = document.getElementById('contactPhone').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const message = document.getElementById('contactMessage').value.trim();

      if (!name || !phone || !email || !message) {
        contactStatus.style.color = '#c75232';
        contactStatus.textContent = messages.validation;
        return;
      }

      const waMessage = `${getText(currentLang, 'contact.wa_greeting')}\n${getText(currentLang, 'contact.wa_name_label')}${name}\n${getText(currentLang, 'contact.wa_phone_label')}${phone}\n${getText(currentLang, 'contact.wa_email_label')}${email}\n${getText(currentLang, 'contact.wa_message_label')}${message}`.replace(/\\n/g, '\n');
      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

      contactStatus.style.color = '#008000';
      contactStatus.textContent = messages.whatsappSuccess;
      window.open(waUrl, '_blank');

      contactForm.reset();
    });
  }

  /**
   * Accessibility toggle (removed button support)
   */
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const applyHighContrastState = (on) => {
    document.body.classList.toggle('high-contrast', on);
    if (accessibilityToggle) accessibilityToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('highContrast', on ? '1' : '0');
  };

  if (accessibilityToggle) {
    // Initialize state from storage only if toggle exists
    const savedHC = localStorage.getItem('highContrast') === '1';
    applyHighContrastState(savedHC);

    accessibilityToggle.addEventListener('click', () => {
      const isOn = document.body.classList.contains('high-contrast');
      applyHighContrastState(!isOn);
    });
  } else {
    // Ensure site is in normal mode when no toggle is present
    document.body.classList.remove('high-contrast');
    localStorage.removeItem('highContrast');
  }

  /**
   * Gallery modal: clicking an image opens it in a full‑screen modal.
   */
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImg');
  const closeBtn = modal ? modal.querySelector('.close') : null;
  const prevBtn = modal ? modal.querySelector('.nav-prev') : null;
  const nextBtn = modal ? modal.querySelector('.nav-next') : null;

  let currentIndex = -1;
  const galleryImages = document.querySelectorAll('.gallery-grid img');
  const galleryArray = Array.from(galleryImages || []);

  const showImageByIndex = (idx) => {
    if (!modal || !modalImg || !galleryArray.length) return;
    const len = galleryArray.length;
    currentIndex = ((idx % len) + len) % len; // wrap around
    const img = galleryArray[currentIndex];
    modalImg.src = img.src;
    modalImg.alt = img.alt || '';
  };

  const openModal = (src, alt, index) => {
    if (!modal || !modalImg) return;
    // Set index by provided index or by matching src
    if (typeof index === 'number' && index >= 0) {
      showImageByIndex(index);
    } else {
      const found = galleryArray.findIndex(i => i.src === src);
      showImageByIndex(found >= 0 ? found : 0);
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (galleryImages.length && modal) {
    galleryArray.forEach((img, idx) => {
      img.addEventListener('click', () => openModal(img.src, img.alt, idx));
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showImageByIndex(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showImageByIndex(currentIndex + 1);
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!modal) return;
    const isOpen = modal.style.display !== 'none' && modal.getAttribute('aria-hidden') === 'false';
    if (!isOpen) return;
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'ArrowRight') {
      showImageByIndex(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      showImageByIndex(currentIndex - 1);
    }
  });

  /**
   * Modern UI interactions
   */
  // Sticky nav shadow + translucency on scroll
  const mainNav = document.querySelector('.main-nav');
  const applyNavState = () => {
    if (!mainNav) return;
    if (window.scrollY > 10) {
      mainNav.classList.add('scrolled');
    } else {
      mainNav.classList.remove('scrolled');
    }
  };
  applyNavState();
  window.addEventListener('scroll', applyNavState);

  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const navList = document.getElementById('navList');
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      const open = navList.classList.toggle('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.main-nav a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        menuToggle.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Reveal on scroll animations (respect reduced motion)
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (!prefersReduced && revealEls.length) {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }
});
