import jsPDF from 'jspdf';
import 'jspdf-autotable';

export async function generatePdfBlob(rows = [], options = {}) {
    const title = options.title || 'Seznam potnih nalogov';
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginLeft = 40;
    let currentY = 40;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, marginLeft, currentY);
    currentY += 20;

    const head = [['#', 'PDF datoteka', 'Začetek', 'Konec', 'Relacija', 'Kilometri', 'Vrednost (EUR)']];
    const body = rows.map((r, idx) => [
        idx + 1,
        r.fileName || '',
        r.start_dt || '',
        r.end_dt || '',
        r.route || '',
        (r.kilometers !== undefined && r.kilometers !== null) ? Number(r.kilometers).toFixed(2).replace('.', ',') : '',
        typeof r.value === 'number' ? Number(r.value).toFixed(2).replace('.', ',') + ' €' : (r.value ? String(r.value) : '')
    ]);

    doc.autoTable({
        startY: currentY,
        head,
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 40, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        theme: 'grid',
        margin: { left: marginLeft, right: marginLeft }
    });

    const ab = doc.output('arraybuffer');
    const blob = new Blob([ab], { type: 'application/pdf' });
    return blob;
}