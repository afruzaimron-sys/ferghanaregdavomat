const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const pg = require('../database/pg');
const { getFargonaDateTimeString } = require('../utils/fargona');

const OFERTA_JSON_FILE = path.join(__dirname, '../database/oferta_agreements.json');

function loadJsonAgreements() {
    try {
        if (fs.existsSync(OFERTA_JSON_FILE)) {
            return JSON.parse(fs.readFileSync(OFERTA_JSON_FILE, 'utf8') || '[]');
        }
    } catch (e) {
        console.error("Error loading oferta agreements JSON:", e.message);
    }
    return [];
}

function saveJsonAgreements(list) {
    try {
        fs.writeFileSync(OFERTA_JSON_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving oferta agreements JSON:", e.message);
    }
}

async function recordAgreement({ fio, phone, district, school, ip, userAgent }) {
    const cleanFio = (fio || '').trim();
    const cleanPhone = (phone || '').trim().replace(/[^\d+]/g, '');
    const cleanDist = (district || '').trim();
    const cleanSchool = (school || '').trim();
    const cleanIp = (ip || '').replace('::ffff:', '').trim();
    const cleanAgent = (userAgent || '').substring(0, 255);
    const createdAt = new Date().toISOString();

    let savedId = Date.now();

    // 1. Save to PostgreSQL if available
    try {
        const res = await pg.query(
            `INSERT INTO oferta_agreements (fio, phone, district, school, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id, created_at`,
            [cleanFio, cleanPhone, cleanDist, cleanSchool, cleanIp, cleanAgent]
        );
        if (res.rows && res.rows[0]) {
            savedId = res.rows[0].id;
        }
    } catch (dbErr) {
        console.warn("⚠️ PostgreSQL oferta record error, using JSON store fallback:", dbErr.message);
    }

    // 2. Save to local JSON backup
    try {
        const list = loadJsonAgreements();
        list.unshift({
            id: savedId,
            fio: cleanFio,
            phone: cleanPhone,
            district: cleanDist,
            school: cleanSchool,
            ip_address: cleanIp,
            user_agent: cleanAgent,
            created_at: createdAt
        });
        saveJsonAgreements(list);
    } catch (jsonErr) {
        console.error("JSON backup save error:", jsonErr.message);
    }

    return { id: savedId, success: true };
}

async function getAgreements() {
    try {
        const res = await pg.query(`SELECT * FROM oferta_agreements ORDER BY id DESC LIMIT 2000`);
        if (res.rows && res.rows.length > 0) {
            return res.rows;
        }
    } catch (e) {
        console.warn("PostgreSQL getAgreements failed, falling back to JSON:", e.message);
    }
    return loadJsonAgreements();
}

async function exportOfertaAgreementsToExcel(res) {
    const agreements = await getAgreements();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Davomat Monitoring Tizimi";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Oferta Roziliklari", {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', paperSize: 9 }
    });

    // 1. Header Banner
    sheet.mergeCells('A1:G1');
    const titleCell1 = sheet.getCell('A1');
    titleCell1.value = "FARG'ONA VILOYATI MAKTABGACHA VA MAKTAB TA'LIMI BOSHQARMASI";
    titleCell1.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:G2');
    const titleCell2 = sheet.getCell('A2');
    titleCell2.value = "DAVOMAT MONITORING TIZIMI — OMMAVIY OFERTA SHARTLARIGA ROZILIK BILDIRGANLAR RO'YXATI";
    titleCell2.font = { bold: true, size: 11, color: { argb: 'FFFFD700' } };
    titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getRow(2).height = 25;

    sheet.mergeCells('A3:G3');
    const dateStr = getFargonaDateTimeString();
    const titleCell3 = sheet.getCell('A3');
    titleCell3.value = `Hisobot shakllantirilgan vaqt: ${dateStr} | Jami tasdiqlar: ${agreements.length} ta`;
    titleCell3.font = { italic: true, size: 9.5, color: { argb: 'FF94A3B8' } };
    titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getRow(3).height = 20;

    sheet.addRow([]);

    // 2. Table Column Headers
    const headers = [
        "№",
        "Mas'ul Shaxs (F.I.SH)",
        "Telefon Raqami",
        "Hudud (Tuman/Shahar)",
        "Maktab",
        "Rozilik Berilgan Vaqt",
        "IP Manzil"
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF312E81' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    // 3. Rows
    agreements.forEach((item, idx) => {
        let createdFormatted = item.created_at || '-';
        try {
            const d = new Date(item.created_at);
            if (!isNaN(d.getTime())) {
                createdFormatted = d.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
            }
        } catch (e) {}

        const row = sheet.addRow([
            idx + 1,
            item.fio || '-',
            item.phone || '-',
            item.district || '-',
            item.school || '-',
            createdFormatted,
            item.ip_address || '-'
        ]);
        row.height = 22;

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell((cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNumber === 1 || colNumber === 3 || colNumber === 6 || colNumber === 7) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }

            if (colNumber === 2) {
                cell.font = { bold: true, color: { argb: 'FF1E293B' }, size: 9.5 };
            } else if (colNumber === 3) {
                cell.font = { color: { argb: 'FF2563EB' }, bold: true, size: 9.5 };
            }
        });
    });

    // Auto column widths
    sheet.columns = [
        { width: 7 },
        { width: 34 },
        { width: 20 },
        { width: 24 },
        { width: 20 },
        { width: 24 },
        { width: 18 }
    ];

    const todayDate = new Date().toISOString().split('T')[0];
    const fileName = `Oferta_Roziliklari_${todayDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
    return true;
}

module.exports = {
    recordAgreement,
    getAgreements,
    exportOfertaAgreementsToExcel
};
