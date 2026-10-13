const topicsConfig = require('../config/topics');
const TOPICS = topicsConfig.getTopics();

/**
 * Normalizes string for comparison (removes all apostrophe variants: ', curly, modifier marks, etc.)
 */
function normalizeKey(str) {
    if (!str) return '';
    return str.toString()
        .replace(/[\u0027\u2019\u2018\u0060\u02bb\u02bc\u201c\u201d\ufffd\?]/g, '')
        .replace(/['’‘`ʻʼ"”]/g, '')
        .replace(/[-\s_]/g, '')
        .trim()
        .toLowerCase()
        .replace(/shahri$/, 'shahar')
        .replace(/tumani$/, 'tuman');
}

/**
 * Finds topic ID by district name (robust matching)
 */
function getTopicId(districtName) {
    if (!districtName) return null;

    const normName = normalizeKey(districtName);
    const keys = Object.keys(TOPICS);

    // 0. Test rejimi tekshiruvi
    if (normName.includes('test') || normName.includes('sinov')) {
        return TOPICS["test sinov rejimi"] || TOPICS["Test rejimi"] || 11220;
    }

    // 1. Direct match
    if (TOPICS[districtName]) return TOPICS[districtName];

    // 2. Normalized match (ignores all apostrophe types, hyphens, spaces)
    const foundKey = keys.find(k => normalizeKey(k) === normName);
    if (foundKey) return TOPICS[foundKey];

    // 3. Partial match (Backup)
    const partialKey = keys.find(k => normalizeKey(k).includes(normName) || normName.includes(normalizeKey(k)));
    if (partialKey) return TOPICS[partialKey];

    return null;
}

/**
 * Transliterates Cyrillic Uzbek text to Latin
 */
function cyrillicToLatin(text) {
    if (!text) return '';
    const map = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z',
        'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
        'с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
        'ъ':'','ь':'','э':'e','ю':'yu','я':'ya','ў':'o','қ':'q','ғ':'g','ҳ':'h'
    };
    return text.toLowerCase().split('').map(char => map[char] || char).join('');
}

/**
 * Normalizes school name for robust comparison
 * Handles: Cyrillic ('мактаб', 'идум'), parentheses ('(So‘x tumani)'),
 * apostrophes, spaces, hyphens, and leading zeros.
 */
function normalizeSchool(str) {
    if (!str) return '';
    let s = str.toString().toLowerCase();
    // Remove parentheses and their content (e.g. '(So‘x tumani)')
    s = s.replace(/\s*\([^)]*\)/g, '');
    // Cyrillic to Latin
    s = cyrillicToLatin(s);
    // Remove all apostrophes and special marks
    s = s.replace(/[\u0027\u2019\u2018\u0060\u02bb\u02bc\u201c\u201d\ufffd\?]/g, '');
    s = s.replace(/['’‘`ʻʼ"”]/g, '');
    // Remove spaces, hyphens, underscores, dots
    s = s.replace(/[-\s_.]+/g, '');
    // Remove leading zeros before digits (e.g. '01maktab' -> '1maktab')
    s = s.replace(/^0+([1-9])/, '$1');
    // Normalize suffixes
    s = s.replace(/maktabi$/, 'maktab');
    s = s.replace(/idumi$/, 'idum');
    return s.trim();
}

module.exports = {
    normalizeKey,
    normalizeSchool,
    cyrillicToLatin,
    getTopicId,
    TOPICS
};