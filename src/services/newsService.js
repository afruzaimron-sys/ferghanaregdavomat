const https = require('https');

let newsCache = {
    data: [],
    lastFetched: 0
};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetch and parse recent posts from public Telegram channel https://t.me/s/FarVMMTB
 */
function fetchTelegramNews() {
    return new Promise((resolve) => {
        const req = https.get('https://t.me/s/FarVMMTB', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 8000
        }, (res) => {
            if (res.statusCode !== 200) {
                console.warn(`[NewsService] Telegram returned status ${res.statusCode}`);
                return resolve(newsCache.data.length ? newsCache.data : getFallbackNews());
            }

            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                try {
                    const parts = html.split('<div class="tgme_widget_message_wrap');
                    const posts = [];

                    for (let i = 1; i < parts.length; i++) {
                        const part = parts[i];
                        const linkMatch = part.match(/href="(https:\/\/t\.me\/[^\/]+\/(\d+))"/);
                        const textMatch = part.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                        const photoMatch = part.match(/background-image:url\('([^']+)'\)/);
                        const timeMatch = part.match(/<time datetime="([^"]+)"[^>]*>([^<]+)<\/time>/);

                        let cleanText = '';
                        if (textMatch) {
                            cleanText = textMatch[1]
                                .replace(/<br\s*\/?>/gi, '\n')
                                .replace(/<[^>]+>/g, '')
                                .replace(/&#33;/g, '!')
                                .replace(/&#39;/g, "'")
                                .replace(/&quot;/g, '"')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .trim();
                        }

                        // Extract clean title from first non-empty line
                        let title = '';
                        if (cleanText) {
                            const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
                            if (lines.length > 0) {
                                title = lines[0].replace(/^[#\s🔰📢📌🔹▫️▪️✨🚀📚🎮]+/, '').trim();
                                if (title.length < 5 && lines.length > 1) {
                                    title = (lines[0] + ' ' + lines[1]).replace(/^[#\s🔰📢📌🔹▫️▪️✨🚀📚🎮]+/, '').trim();
                                }
                            }
                        }

                        if (!title && photoMatch) {
                            title = "Farg'ona viloyati MMTB rasmiy xabari";
                        }

                        if (linkMatch && (cleanText || photoMatch)) {
                            // Ensure title is max 120 chars for clean display
                            let displayTitle = title;
                            if (displayTitle.length > 110) {
                                displayTitle = displayTitle.substring(0, 107) + '...';
                            }

                            posts.push({
                                id: linkMatch[2],
                                url: linkMatch[1],
                                channelUrl: `https://t.me/FarVMMTB/${linkMatch[2]}`,
                                photo: photoMatch ? photoMatch[1] : null,
                                title: displayTitle || "Farg'ona viloyati MMTB yangiligi",
                                text: cleanText ? cleanText.substring(0, 320) + (cleanText.length > 320 ? '...' : '') : '',
                                fullText: cleanText,
                                date: timeMatch ? timeMatch[1] : new Date().toISOString(),
                                timeFormatted: timeMatch ? timeMatch[2] : ''
                            });
                        }
                    }

                    // Telegram lists oldest to newest, reverse so newest is first
                    posts.reverse();

                    // Only take top 12 posts with valid content
                    const recentPosts = posts.slice(0, 12);
                    if (recentPosts.length > 0) {
                        newsCache = {
                            data: recentPosts,
                            lastFetched: Date.now()
                        };
                        resolve(recentPosts);
                    } else {
                        resolve(newsCache.data.length ? newsCache.data : getFallbackNews());
                    }
                } catch (parseErr) {
                    console.error('[NewsService] Parse error:', parseErr.message);
                    resolve(newsCache.data.length ? newsCache.data : getFallbackNews());
                }
            });
        });

        req.on('error', (err) => {
            console.warn('[NewsService] Network error fetching news:', err.message);
            resolve(newsCache.data.length ? newsCache.data : getFallbackNews());
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(newsCache.data.length ? newsCache.data : getFallbackNews());
        });
    });
}

function getFallbackNews() {
    return [
        {
            id: "channel",
            url: "https://t.me/FarVMMTB",
            channelUrl: "https://t.me/FarVMMTB",
            photo: "assets/logo.png",
            title: "Farg'ona viloyati Maktabgacha va maktab ta'limi boshqarmasi rasmiy axborot kanali",
            text: "Viloyat ta'lim sohasidagi eng so'nggi yangiliklar, qaror va farmoyishlar, maktab hayoti hamda o'quv jarayonlariga oid rasmiy xabarlarni kuzatib boring.",
            date: new Date().toISOString(),
            timeFormatted: "Bugun"
        }
    ];
}

async function getLatestNews(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && newsCache.data.length > 0 && (now - newsCache.lastFetched) < CACHE_TTL_MS) {
        return newsCache.data;
    }
    return await fetchTelegramNews();
}

module.exports = {
    getLatestNews
};
