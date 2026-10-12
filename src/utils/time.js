const { Markup } = require('telegraf');

const EARLY_MESSAGES = [
    "🌑 Hali yulduzlar so'nmagan, siz esa ishlamoqchisiz? Qoyil! Lekin 08:00 ni kuting.",
    "☕️ Tonggi qahva vaqti! Bot esa 08:00 da ishga tushadi. Ungacha tetiklashib oling.",
    "🥱 Bot hali 'Zaryadka' olyapti. Iltimos, 08:00 da keling.",
    "🏃‍♂️ G‘ayratingizga tasanno! Lekin hisobot qabul qilish 08:00 dan boshlanadi.",
    "🔒 Tizim eshiklari 08:00 da ochiladi. Hozircha sabr qiling.",
    "🧘‍♂️ Biroz meditatsiya qiling. Ishga hali erta (08:00).",
    "📢 Diqqat! Tizim 08:00 da faollashadi. Ungacha yangiliklarni o'qib turing."
];

const LATE_MESSAGES = [
    "🌙 Kech bo'ldi, endi dam oling! Bot ham charchadi.",
    "⛔️ Ish vaqti tugadi. Ertaga xudo xohlasa davom etamiz.",
    "🚶‍♂️ Uyga ketavering, bugungi hisobotlar yopildi.",
    "🦉 Kechasi ishlash sog'liqqa zarar. Ertaga 08:00 da kutamiz!",
    "📉 Buxgalteriya yopildi, kassa tugadi. Ertaga keling.",
    "🎬 Bugungi spektakl tugadi. Pardalar yopildi!",
    "🔋 Botning quvvati tugadi. Ertalabgacha zaryad oladi."
];

const { getUzbMoment } = require('./fargona');
const config = require('../config/config');
const db = require('../database/db');

function checkTime(ctx, isPro) {
    const uid = ctx.from && ctx.from.id;
    // Admins always have access without time restriction
    const isAdmin = uid && config.ALL_ADMINS && config.ALL_ADMINS.map(Number).includes(Number(uid));
    if (isAdmin) {
        return true;
    }

    const channelLink = Markup.inlineKeyboard([
        [Markup.button.url("📰 Boshqarma Yangiliklari", "https://t.me/FarVMMTB")]
    ]);

    // 1. Texnik ishlar (Maintenance mode)
    if (db.settings && db.settings.maintenance_mode) {
        ctx.replyWithHTML(
            `🛠 <b>Texnik ishlar olib borilmoqda!</b>\n\n` +
            `Tizimda profilaktika va texnik ishlar olib borilayotganligi sababli xizmat vaqtincha to'xtatilgan. ` +
            `Iltimos, birozdan so'ng qayta urinib ko'ring.\n\n` +
            `<i>Boshqarma yangiliklari:</i>`,
            channelLink
        );
        return false;
    }

    // 2. Ta'til rejimi (Vacation mode)
    if (db.settings && db.settings.vacation_mode) {
        ctx.replyWithHTML(
            `🏖 <b>Ta'til rejimi faol!</b>\n\n` +
            `Tizimda rasmiy ta'til rejimi e'lon qilinganligi sababli davomat qabul qilinmaydi. ` +
            `Ta'til yakunlangach tizim yana odatiy rejimda ish boshlaydi.\n\n` +
            `<i>Boshqarma yangiliklari:</i>`,
            channelLink
        );
        return false;
    }

    // 3. Davomat vaqt cheklovi (00:01 - 17:00, Yakshanba dam olish kuni)
    // Agar attendance_time_lock o'chirilgan bo'lsa (false), 24/7 ochiq
    const isLockActive = db.settings && db.settings.attendance_time_lock === true;
    if (!isLockActive) {
        return true;
    }

    // Tashkent (UTC+5) vaqti
    const uzb = getUzbMoment();
    const day = uzb.day(); // 0 = Yakshanba
    const h = uzb.hours();
    const m = uzb.minutes();

    // Yakshanba kuni dam olish kuni
    if (day === 0) {
        ctx.replyWithHTML(
            `😴 <b>Bugun yakshanba — dam olish kuni!</b>\n\n` +
            `Davomat qabul qilinmaydi. Dam olish kuningiz maroqli o'tsin!\n\n` +
            `<i>Boshqarma yangiliklari:</i>`,
            channelLink
        );
        return false;
    }

    // Soat 00:01 dan oldin
    if (h === 0 && m < 1) {
        ctx.replyWithHTML(
            `🌑 <b>Hali erta!</b>\n\nDavomat qabul qilish soat <b>00:01</b> dan boshlanadi. Iltimos, biroz kuting.\n\n` +
            `<i>Boshqarma yangiliklari:</i>`,
            channelLink
        );
        return false;
    }

    // Soat 17:00 dan keyin
    if (h > 17 || (h === 17 && m > 0)) {
        const msg = LATE_MESSAGES[Math.floor(Math.random() * LATE_MESSAGES.length)];
        ctx.replyWithHTML(
            `⛔️ <b>${msg}</b>\n\n` +
            `Davomat qabul qilish har kuni soat <b>00:01 dan 17:00 gacha</b> belgilangan. ` +
            `Ertaga soat 00:01 dan boshlab qayta kiritishingiz mumkin.\n\n` +
            `<i>Boshqarma yangiliklari:</i>`,
            channelLink
        );
        return false;
    }

    return true;
}

module.exports = { checkTime };
