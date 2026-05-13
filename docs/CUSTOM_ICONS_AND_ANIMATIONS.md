# الأيقونات المخصصة والحركات — شرح تفصيلي

هذا المستند يشرح **الأيقونات الخاصة** بالمشروع (صور مخصصة + مكوّنات مركبة)، **أسماءها**، **أين تُستخدم**، و**الحركات/الانتقالات** (transitions وanimations) المستخدمة في الواجهة.

---

## 1. نظرة عامة

النظام يستخدم:
- **أيقونات من Lucide** (مثل Store, Users, Car) للعناصر العامة.
- **أيقونات مخصصة** من مجلد `public/icons` — صور PNG تُعرض عبر **قناع (mask)** ليتلون بلون النص أو الذهبي.
- **أيقونة مركبة (SVG + عناصر)** — HomeMainIcon (مربع ونقطة) للصفحة الرئيسية.
- في حال فشل تحميل الصورة: **أيقونة ارتداد (fallback)** من Lucide.

---

## 2. أيقونة الضرائب (TaxIcon)

| الخاصية | القيمة |
|---------|--------|
| **الاسم في الكود** | TaxIcon |
| **الملف** | `src/components/Icons/TaxIcon.tsx` |
| **الصورة** | `/icons/tax-icon.png` (يُفترض وجودها في `public/icons/`) |
| **الارتداد عند الفشل** | أيقونة `Percent` من Lucide |

### الخصائص (Props)

- `size` — حجم الأيقونة (افتراضي 24).
- `className` — كلاسات Tailwind.
- `golden` — إن كان `true` تُطبَّق على الأيقونة لون البراند الذهبي `#A37A3F` بدل لون النص (currentColor).

### أين تُستخدم

| المكان | الاستخدام |
|--------|------------|
| **Sidebar** | عنصر "الضرائب" في القائمة الجانبية (رابط إلى `/dashboard/entities`) |
| **Entities.tsx** | صفحة قائمة الكيانات: أيقونة كبيرة عند عدم وجود كيانات، وأيقونة صغيرة بجانب "الضرائب" في البطاقة |
| **EntityProfile** | بروفايل الكيان: أيقونة ذهبية كبيرة في الهيدر |
| **Services.tsx** | صفحة الخدمات: زر "الضرائب" في شبكة الخدمات |
| **Archive** | تبويب الأرشيف: أيقونة تبويب "الضرائب" (كيانات مؤرشفة) |
| **Documents** | صفحة المستندات: أيقونة قسم "الضرائب" في شجرة المجلدات |

---

## 3. أيقونة المشغل (WorkshopIcon)

| الخاصية | القيمة |
|---------|--------|
| **الاسم في الكود** | WorkshopIcon |
| **الملف** | `src/components/Icons/WorkshopIcon.tsx` |
| **الصورة** | `/icons/Sewing-factory.png` |
| **الارتداد عند الفشل** | أيقونة `Scissors` من Lucide |

### الخصائص

- `size`, `className`, `golden` — نفس منطق TaxIcon.

### أين تُستخدم

- **نوع الفرع (branchType = workshop):** عندما يكون الفرع من نوع "مشغل" تُستخدم WorkshopIcon بدل أيقونة المتجر أو المكتب.
- **المواقع:** قائمة الأفرع (Branches)، بروفايل الفرع (BranchProfile)، قائمة الموظفين (Employees)، بروفايل الموظف (EmployeeProfile) — في عرض نوع الفرع أو فرع العمل (أيقونة بجانب اسم الفرع).

---

## 4. أيقونة الرئيسية (HomeMainIcon)

| الخاصية | القيمة |
|---------|--------|
| **الاسم في الكود** | HomeMainIcon |
| **الملف** | مُصدَّرة من `src/components/Layout/BottomNav.tsx` |
| **النوع** | مركبة من Lucide: `Square` + دائرة داخلية (نقطة) — تمثيل "صفحة رئيسية" |

### الخصائص

- `size` (افتراضي 34)، `className`.
- الدائرة الداخلية بحجم 35% من حجم المربع.

### أين تُستخدم

| المكان | الاستخدام |
|--------|------------|
| **BottomNav** | زر "الرئيسية" في الشريط السفلي (موبايل) — بحجم 40، لون أبيض |
| **Sidebar** | عنصر "الصفحة الرئيسية" في القائمة الجانبية (ديسكتوب) — بحجم 20 |

---

## 5. أيقونات الوظائف (Profession Icons)

**الملف:** `src/components/Icons/ProfessionIcons.tsx`  
**الثوابت:** `src/constants/professions.ts` — قائمة الوظائف مع ربط كل وظيفة بأيقونتها.

كل أيقونة: **صورة من `public/icons`** + **أيقونة Lucide ارتداد** عند فشل تحميل الصورة. العرض يتم عبر **قناع (mask)** بلون النص (currentColor).

### الجدول الكامل لأيقونات الوظائف

| المفتاح (key) | التسمية العربية | ملف الصورة | أيقونة الارتداد (Lucide) | المكوّن المُصدَّر |
|---------------|------------------|------------|---------------------------|---------------------|
| admin | إداري | `/icons/manger.png` | Briefcase | AdminIcon |
| driver | سائق | `/icons/driver.png` | Car | DriverIcon |
| salesman | بائع | `/icons/enterpreneur.png` | ShoppingCart | SalesmanIcon |
| cutter | قصاص | `/icons/cutting.png` | Scissors | CutterIcon |
| tailor | خياط | `/icons/tailor.png` | Shirt | TailorIcon |
| ironing | كوي | `/icons/man-ironing.png` | Flame | IroningIcon |
| maintenance | تشطيب | `/icons/packing.png` | Wrench | FinishingIcon |
| other | أخرى | `/icons/prof-other.png` | CircleDot | OtherProfessionIcon |

**ملاحظة:** اسم ملف الإداري في الكود `manger.png` (كما في README — يُفترض أن الملف في public بهذا الاسم).

### خريطة الاستخدام: PROFESSION_ICON_MAP

- `PROFESSION_ICON_MAP[key]` يعيد المكوّن المناسب لكل مفتاح وظيفة.
- تُستخدم في: **اختيار الوظيفة** في نموذج الموظف (AddEmployeeModal, UpdateStatusModal)، وعرض **وظيفة الموظف** في القوائم والبروفايل.

### أين تُستخدم أيقونات الوظائف

| المكان | الاستخدام |
|--------|------------|
| **constants/professions.ts** | ربط كل خيار وظيفة (إداري، بائع، قصاص، …) بالأيقونة لعرضها في نماذج اختيار الوظيفة |
| **Employees.tsx** | بطاقات وجدول الموظفين: عرض أيقونة الوظيفة الأولى من `professionKeys` بجانب "الوظيفة" (اسم الوظيفة) |
| **AddEmployeeModal / UpdateStatusModal** | عرض أيقونة بجانب كل خيار وظيفة عند الاختيار |

- **سائق (driver):** مدعوم في البيانات والـ icon map؛ لا يظهر في قائمة PROFESSIONS للاختيار المباشر (يُستخدم للبيانات القديمة أو عند الجمع مع وظيفة ثانية).

---

## 6. الحركات والانتقالات (Transitions & Animations)

### 6.1 ظهور الصفحة (animate-in)

- **الكلاس:** `animate-in fade-in duration-200`
- **الاستخدام:** في بروفايل الكيان (EntityProfile)، بروفايل الموظف (EmployeeProfile)، بروفايل الفرع (BranchProfile) — لظهور المحتوى الرئيسي للصفحة بانتقال خفيف.
- **المصدر:** من مكتبة tailwindcss-animate أو مشابه — fade-in مع مدة 200ms.

### 6.2 انتقالات الألوان (transition-colors)

- **الاستخدام العام:** أغلب الأزرار والروابط والعناصر القابلة للنقر تستخدم `transition-colors` مع `hover:` أو `active:` لتغيير لون الخلفية أو النص عند التمرير أو الضغط.
- **أمثلة:** الشريط الجانبي، القائمة السفلية، التبويبات، أزرار "تحديد كمقروء"، أزرار الأرشفة والحذف، البطاقات (hover:border-primary-gold).

### 6.3 انتقالات شاملة (transition-all)

- **الاستخدام:** البطاقات في القوائم (موظفون، أفرع، مركبات، سكن، كيانات) — `transition-all` مع `hover:border-primary-gold/50 hover:shadow-sm` لتحريك الحد والظل معاً.
- **أزرار الخدمات (Services):** `hover:bg-primary-gold/90 hover:shadow-lg active:scale-[0.98]` — مع ضغط خفيف (scale) عند النقر.

### 6.4 دوران التحميل (animate-spin)

- **الكلاس:** `animate-spin`
- **الاستخدام:** أيقونة Loader2 في صفحة الأرشيف وصفحة المستندات أثناء التحميل؛ زر الاستعادة عند تنفيذ الاستعادة.
- **الغرض:** إظهار حالة "جاري التحميل".

### 6.5 حجم اللمس والنقر (active:scale)

- **مثال:** `active:scale-[0.98]` في أزرار صفحة الخدمات — تقليل بسيط للحجم عند الضغط ل feedback بصري.

---

## 7. ملخص الملفات والأيقونات

| الأيقونة | الملف/المسار | الصورة (public/icons) | الارتداد |
|----------|--------------|------------------------|----------|
| TaxIcon | Icons/TaxIcon.tsx | tax-icon.png | Percent |
| WorkshopIcon | Icons/WorkshopIcon.tsx | Sewing-factory.png | Scissors |
| HomeMainIcon | Layout/BottomNav.tsx | — (مركبة) | — |
| AdminIcon … OtherProfessionIcon | Icons/ProfessionIcons.tsx | manger, driver, enterpreneur, cutting, tailor, man-ironing, packing, prof-other | Briefcase, Car, ShoppingCart, Scissors, Shirt, Flame, Wrench, CircleDot |

---

## 8. ملخص الحركات

| النوع | الكلاس/النمط | الاستخدام |
|-------|----------------|-----------|
| ظهور الصفحة | animate-in fade-in duration-200 | بروفايلات (كيان، موظف، فرع) |
| لون عند التمرير | transition-colors + hover: | أزرار، روابط، تبويبات، قوائم |
| حد وظل البطاقة | transition-all + hover:border + hover:shadow | بطاقات الموظفين، الأفرع، المركبات، السكن، الكيانات |
| ضغط الزر | active:scale-[0.98] | أزرار الخدمات |
| دوران التحميل | animate-spin على Loader2 | الأرشيف، المستندات، أزرار الاستعادة |
