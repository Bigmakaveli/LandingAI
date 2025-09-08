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
      'hero.brand': 'קערה',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'לתפריט',
      'cta.contact': 'צור קשר',
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
      'about.p1': 'המסעדה הביתית שלנו נולדה מתוך אהבה גדולה לבישול ביתי ומסורות משפחתיות. בשנת 2005 החליט מייסד המסעדה, שף יוסי בן‑ציון, לפתוח מקום שיזכיר לכל אחד ואחת את הטעמים של בית אמא. יוסי גדל בבית שבו סירי המרק תמיד היו על האש והריחות נעו בין מאפים חמים לקפה טרי. לאחר שנים רבות בתחום הקולינריה, הוא החליט להחזיר את הבישול הפשוט והטעים למרכז הבמה.',
      'about.p2': 'אנו מתמחים במאכלים ביתיים עם טוויסט מודרני. מקפידים להשתמש בחומרי גלם טריים מהשוק המקומי ומבשלים ללא קיצורי דרך, בדיוק כפי שעשו הסבתות שלנו. מעבר למטבח, המשימה שלנו היא ליצור תחושה של חמימות, ביתיות ונוחות לכל מי שנכנס בדלת. מהרגע שתשבו לשולחן תרגישו שאתם חלק ממשפחה גדולה ומתוקה.',
      'founder.caption': 'המייסד שלנו, שף יוסי בן‑ציון',
      'services.title': 'שירותים נוספים',
      'services.p1': 'לא רק אוכל טוב מחכה לכם אצלנו – אנו שמחים להציע גם שירותי כביסה מקצועיים בתוך מתחם המסעדה. תוכלו להביא את הבגדים שלכם לכיבוס בזמן שאתם מתפנקים בארוחה, ולקבל אותם נקיים וריחניים כשתסיימו. השירות מתבצע על ידי צוות מנוסה ושימוש במכונות מתקדמות, כך שתוכלו להיות רגועים שהבגדים בידיים טובות.',
      'services.p2': 'השירות פועל בכל ימי השבוע בשעות פתיחת המסעדה. אם יש לכם שאלות או בקשות מיוחדות, צוות הצוות שלנו ישמח לענות ולעזור.',
      'gallery.title': 'גלריה',
      'gallery.desc': 'קצת מהאווירה והטעמים שלנו כדי שתוכלו להרגיש בבית עוד לפני שאתם מגיעים.',
      'gallery.prev': 'תמונה קודמת',
      'gallery.next': 'תמונה הבאה',
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
      'hero.brand': 'קערה',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'إلى القائمة',
      'cta.contact': 'تواصل',
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
      'about.p1': 'وُلد مطعمنا المنزلي من حب كبير للطبخ المنزلي والتقاليد العائلية. في عام 2005 قرر مؤسس المطعم، الشيف يوسي بن-ציון، افتتاح مكان يذكّر كل واحد وكل واحدة بنكهات بيت الأم. نشأ يوسي في بيت كانت قدور الشوربة فيه دائماً على النار وكانت الروائح تتنقل بين مخبوزات ساخنة وقهوة طازجة. بعد سنوات عديدة في مجال الطهي، قرر أن يعيد الطبخ البسيط واللذيذ إلى الواجهة.',
      'about.p2': 'نتخصص في أطباق منزلية بلمسة عصرية. نحرص على استخدام مكونات طازجة من السوق المحلي ونطهو دون طرق مختصرة، تماماً كما كانت تفعل جداتنا. أبعد من المطبخ، مهمتنا هي خلق شعور بالدفء والبيت لكل من يدخل. من اللحظة التي تجلس فيها إلى الطاولة ستشعر أنك جزء من عائلة كبيرة ولطيفة.',
      'founder.caption': 'مؤسسنا، الشيف يوسي بن-ציון',
      'services.title': 'خدمات إضافية',
      'services.p1': 'ليس الطعام الجيد فقط ما ينتظركم لدينا – بل يسعدنا أيضاً أن نقدّم خدمات غسيل احترافية داخل المطعم. يمكنكم إحضار ملابسكم للغسيل أثناء استمتاعكم بوجبتكم، وستتسلّمونها نظيفةً وعطرةً عند الانتهاء. تُدار الخدمة بواسطة طاقم خبير وباستخدام آلات متقدّمة، لتكونوا مطمئنين أن الملابس بأيدٍ أمينة.',
      'services.p2': 'تعمل الخدمة طوال أيام الأسبوع خلال ساعات عمل المطعم. إذا كانت لديكم أسئلة أو طلبات خاصة، يسعد فريقنا بالإجابة والمساعدة.',
      'gallery.title': 'معرض الصور',
      'gallery.desc': 'بعض الأجواء والنكهات لدينا لتشعروا بالبيت قبل أن تصلوا.',
      'gallery.prev': 'الصورة السابقة',
      'gallery.next': 'الصورة التالية',
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
      'hero.brand': 'The Bowl',
      'hero.tagline': "Salad is not a meal, it's a lifestyle",
      'cta.menu': 'To Menu',
      'cta.contact': 'Contact Us',
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
      'about.p1': 'Our home restaurant was born out of a great love for home cooking and family traditions. In 2005, the restaurant\'s founder, Chef Yossi Ben-Zion, decided to open a place that would remind everyone of the flavors of home. Yossi grew up in a house where the soup pots were always on the fire and the smells moved between hot pastries and fresh coffee. After many years in the culinary field, he decided to bring simple and delicious cooking back to the forefront.',
      'about.p2': 'We specialize in homemade dishes with a modern twist. We make sure to use fresh ingredients from the local market and cook without shortcuts, just as our grandmothers did. Beyond the kitchen, our mission is to create a sense of warmth, homeliness, and comfort for everyone who enters. From the moment you sit at the table, you will feel like part of a big and sweet family.',
      'founder.caption': 'Our Founder, Chef Yossi Ben-Zion',
      'services.title': 'Additional Services',
      'services.p1': 'Not only good food awaits you with us – we are also happy to offer professional laundry services within the restaurant complex. You can bring your clothes for washing while you enjoy a meal, and receive them clean and fragrant when you finish. The service is carried out by an experienced team using advanced machines, so you can be sure that the clothes are in good hands.',
      'services.p2': 'The service operates every day of the week during the restaurant\'s opening hours. If you have any questions or special requests, our team will be happy to answer and help.',
      'gallery.title': 'Gallery',
      'gallery.desc': 'Some of our atmosphere and flavors so you can feel at home before you even arrive.',
      'gallery.prev': 'Previous Image',
      'gallery.next': 'Next Image',
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
  const WHATSAPP_NUMBER = '972525359582'; // 052-5359582 in international format without leading 0

  // Keep the floating WhatsApp button in sync with the same number
  const whatsappButton = document.getElementById('whatsappButton');
  if (whatsappButton) {
    whatsappButton.setAttribute('href', `https://wa.me/${WHATSAPP_NUMBER}`);
  }

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
