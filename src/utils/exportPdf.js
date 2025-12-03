import jsPDF from 'jspdf';
import 'jspdf-autotable';

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

async function ensureFontEmbedded(doc, fontUrl = '/fonts/DejaVuSans.ttf') {
    try {
        const resp = await fetch(fontUrl);
        if (!resp.ok) throw new Error('Font fetch failed: ' + resp.status);
        const ab = await resp.arrayBuffer();
        const b64 = arrayBufferToBase64(ab);
        doc.addFileToVFS('DejaVuSans.ttf', b64);
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'bold');
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'italic');
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'bolditalic');
        return true;
    } catch (err) {
        console.warn('Could not load embedded font, falling back to default. Error:', err);
        return false;
    }
}

function formatNumberLocale(num) {
    try {
        return Number(num).toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
        return String(num);
    }
}

function buildHead() {
    return [[
        { content: '#', styles: { halign: 'center' } },
        { content: 'PDF datoteka' },
        { content: 'Začetek' },
        { content: 'Konec' },
        { content: 'Relacija' },
        { content: 'Kilometri', styles: { halign: 'right' } },
        { content: 'Vrednost (EUR)', styles: { halign: 'right' } }
    ]];
}

function buildBody(rows) {
    return rows.map((r, idx) => [
        { content: String(idx + 1) },
        { content: r.fileName || '' },
        { content: r.start_dt || '' },
        { content: r.end_dt || '' },
        { content: r.route || '' },
        { content: (r.kilometers !== undefined && r.kilometers !== null) ? formatNumberLocale(r.kilometers) : '', styles: { halign: 'right' } },
        { content: typeof r.value === 'number' ? formatNumberLocale(r.value) + ' €' : (r.value ? String(r.value) : ''), styles: { halign: 'right' } }
    ]);
}

function renderTableTry({ rows, title, fileName, fontEmbedded, fontName = 'DejaVuSans', orientation = 'portrait', fontSize = 9, cellPadding = 6, wrap = true }) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation });
    const margin = { left: 36, right: 36, top: 48, bottom: 36 };
    const titleHeight = 20;
    const footerHeight = 18;
    const pageSize = doc.internal.pageSize;
    const pageWidth = pageSize.width;
    const pageHeight = pageSize.height;

    try {
        if (fontEmbedded) doc.setFont(fontName, 'normal');
    } catch (e) { }

    doc.setFontSize(Math.max(10, fontSize + 2));
    try { if (fontEmbedded) doc.setFont(fontName, 'bold'); } catch (e) { }
    doc.text(title, margin.left, margin.top - 6);
    try { if (fontEmbedded) doc.setFont(fontName, 'normal'); } catch (e) { }
    doc.setFontSize(fontSize);

    const head = buildHead();
    const bodyRows = buildBody(rows);

    const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const totalKm = rows.reduce((s, r) => s + (Number(r.kilometers) || 0), 0);
    bodyRows.push([
        { content: '', colSpan: 4, styles: { halign: 'right', textColor: [0, 0, 0] } },
        { content: 'SKUPAJ', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatNumberLocale(totalKm), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNumberLocale(totalValue) + ' €', styles: { halign: 'right', fontStyle: 'bold' } }
    ]);

    const colStyles = {
        0: { cellWidth: 20 },
        1: { cellWidth: 110 },
        2: { cellWidth: 85 },
        3: { cellWidth: 85 },
        4: { cellWidth: Math.max(120, (pageWidth - margin.left - margin.right - (20 + 110 + 85 + 85 + 60 + 80))), halign: 'left' },
        5: { cellWidth: 60, halign: 'right' },
        6: { cellWidth: 80, halign: 'right' }
    };

    const overflowMode = wrap ? 'linebreak' : 'ellipsize';

    doc.autoTable({
        startY: margin.top + titleHeight,
        head,
        body: bodyRows,
        styles: {
            font: fontEmbedded ? fontName : undefined,
            fontSize,
            cellPadding,
            overflow: overflowMode,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [34, 40, 49],
            textColor: 255,
            fontStyle: 'bold'
        },
        theme: 'grid',
        columnStyles: colStyles,
        tableWidth: pageWidth - margin.left - margin.right,
        margin: { left: margin.left, right: margin.right },
        didDrawPage: function () {
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(Math.max(8, fontSize - 1));
            try { if (fontEmbedded) doc.setFont(fontName, 'normal'); } catch (e) { }
            doc.text(`Stran ${doc.internal.getNumberOfPages()}`, margin.left, pageHeight - footerHeight + 6);
        },
        willDrawCell: function (data) {
            const isLastRow = data.row.index === bodyRows.length - 1;
            if (isLastRow) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 240, 240];
            }
        },
        pageBreak: 'auto'
    });

    return { doc, pages: doc.internal.getNumberOfPages() };
}

export async function exportReportToPdf(rows = [], options = {}) {
    const title = options.title || 'Seznam potnih nalogov';
    const fileName = options.fileName || `potni_nalogi_${new Date().toISOString().slice(0, 10)}.pdf`;
    const fontUrl = options.fontUrl || '/fonts/DejaVuSans.ttf';

    const preparedRows = (rows || []).map(r => ({
        fileName: r.fileName || '',
        start_dt: r.start_dt || '',
        end_dt: r.end_dt || '',
        route: r.route || '',
        kilometers: Number(r.kilometers || 0),
        value: Number(r.value || 0)
    }));

    const tmpDoc = new jsPDF({ unit: 'pt', format: 'a4' });
    const fontEmbedded = await ensureFontEmbedded(tmpDoc, fontUrl);

    const attempts = [
        { orientation: 'portrait', fontSize: 9, cellPadding: 6, wrap: true },
        { orientation: 'landscape', fontSize: 9, cellPadding: 6, wrap: true },
        { orientation: 'landscape', fontSize: 8, cellPadding: 5, wrap: true },
        { orientation: 'landscape', fontSize: 8, cellPadding: 4, wrap: false },
        { orientation: 'landscape', fontSize: 7, cellPadding: 3, wrap: false },
        { orientation: 'landscape', fontSize: 6, cellPadding: 2, wrap: false }
    ];

    let finalDoc = null;
    let finalPages = 0;
    for (const at of attempts) {
        const { doc, pages } = renderTableTry({
            rows: preparedRows,
            title,
            fileName,
            fontEmbedded,
            fontName: 'DejaVuSans',
            orientation: at.orientation,
            fontSize: at.fontSize,
            cellPadding: at.cellPadding,
            wrap: at.wrap
        });
        finalDoc = doc;
        finalPages = pages;
        if (pages === 1) break;
    }

    if (!finalDoc) {
        const fallbackDoc = new jsPDF({ unit: 'pt', format: 'a4' });
        fallbackDoc.text('Napaka pri generiranju tabele', 40, 40);
        fallbackDoc.save(fileName);
        return;
    }

    if (finalPages > 1) {
        console.warn('Could not fit table on a single page. Exporting best-effort document with', finalPages, 'pages.');
    }

    finalDoc.save(fileName);
}