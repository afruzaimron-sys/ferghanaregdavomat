const { Scenes, Markup } = require('telegraf');
const db = require('../database/db');
const sqlite = require('../database/pg');

async function getBroadcastRecipients() {
    let uids = [];
    try {
        const pgRes = await sqlite.query("SELECT telegram_id FROM tg_users");
        if (pgRes && pgRes.rows && pgRes.rows.length > 0) {
            uids = pgRes.rows.map(r => r.telegram_id);
        }
    } catch (e) {
        console.warn("[BROADCAST SCENE] PG query error, fallback to db:", e.message);
    }

    if (!uids.length) {
        uids = Object.keys(db.users_db || {});
    }

    // Clean 'parent_' prefix and remove duplicates & invalid IDs
    const cleanUids = [...new Set(uids.map(u => String(u).replace(/^parent_/, '').trim()).filter(u => u && !isNaN(u)))];
    return cleanUids;
}

const broadcastScene = new Scenes.WizardScene(
    'broadcast_wizard',
    // 1. Ask for message
    async (ctx) => {
        await ctx.reply("📢 <b>E'lon yuborish rejimi</b>\n\nBarcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing yoki rasm/video tashlang.\n\n(Bekor qilish uchun /cancel ni bosing)", { parse_mode: 'HTML' });
        return ctx.wizard.next();
    },
    // 2. Confirm message
    async (ctx) => {
        if (!ctx.message || ctx.message.text === '/cancel') {
            await ctx.reply("Bekor qilindi.", Markup.removeKeyboard());
            return ctx.scene.leave();
        }

        // Store message info to session
        ctx.scene.session.messageToBroadcast = {
            message_id: ctx.message.message_id,
            chat_id: ctx.chat.id
        };

        const users = await getBroadcastRecipients();
        ctx.scene.session.recipientUids = users;

        await ctx.reply(`Ushbu xabar <b>${users.length}</b> ta foydalanuvchiga yuboriladi. Tasdiqlaysizmi?`, {
            parse_mode: 'HTML',
            ...Markup.keyboard([["✅ YUBORISH", "❌ BEKOR QILISH"]]).oneTime().resize()
        });
        return ctx.wizard.next();
    },
    // 3. Send
    async (ctx) => {
        if (!ctx.message || ctx.message.text !== "✅ YUBORISH") {
            await ctx.reply("E'lon yuborish bekor qilindi.", Markup.removeKeyboard());
            return ctx.scene.leave();
        }

        const msgInfo = ctx.scene.session && ctx.scene.session.messageToBroadcast;
        if (!msgInfo || !msgInfo.chat_id || !msgInfo.message_id) {
            await ctx.reply("⚠️ Xabar ma'lumotlari topilmadi yoki sessiya tugagan. Iltimos, /broadcast ni qaytadan boshlang.", Markup.removeKeyboard());
            return ctx.scene.leave();
        }

        let users = ctx.scene.session.recipientUids;
        if (!users || !users.length) {
            users = await getBroadcastRecipients();
        }

        let sent = 0;
        let blocked = 0;
        let startTime = Date.now();

        await ctx.reply(`🚀 Jami <b>${users.length}</b> ta foydalanuvchiga yuborish boshlandi...`, {
            parse_mode: 'HTML',
            ...Markup.removeKeyboard()
        });

        for (const uid of users) {
            let success = false;
            let attempts = 0;

            while (attempts < 2 && !success) {
                attempts++;
                try {
                    await ctx.telegram.copyMessage(uid, msgInfo.chat_id, msgInfo.message_id);
                    sent++;
                    success = true;
                } catch (e) {
                    // Telegram Flood Control (429)
                    if (e.response && e.response.error_code === 429) {
                        const waitSec = (e.response.parameters && e.response.parameters.retry_after) || 3;
                        await new Promise(r => setTimeout(r, (waitSec + 1) * 1000));
                        continue;
                    }
                    if (e.response && e.response.error_code === 401) {
                        await ctx.reply("❌ Bot tokeni yaroqsiz (401 Unauthorized). BotFather'dan yangi token oling.");
                        return ctx.scene.leave();
                    }
                    // Blocked, deactivated or chat not found
                    blocked++;
                    break;
                }
            }
            // Safe interval to avoid rate limit
            await new Promise(r => setTimeout(r, 60));
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        try {
            await ctx.reply(`✅ <b>Hisobot:</b>\n\n🟢 Yuborildi: ${sent} ta\n🔴 Yetib bormadi (blok): ${blocked} ta\n⏱ Vaqt: ${duration} s`, { parse_mode: 'HTML' });
        } catch (repErr) {
            await ctx.reply(`✅ Yuborildi: ${sent} ta | Blok/Xato: ${blocked} ta`);
        }

        return ctx.scene.leave();
    }
);

module.exports = broadcastScene;
