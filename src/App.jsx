import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { extractReportDataFromPdfText } from './helpers';
import { exportReportToPdf } from './utils/exportPdf';
import { generatePdfBlob } from './utils/generatePdfBlob';
import { uploadReportToServer } from './utils/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.js',
    import.meta.url
).toString();

export default function App() {
    const dirInputRef = useRef(null);
    const singleInputRef = useRef(null);
    const [filesMeta, setFilesMeta] = useState([]);
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [folderName, setFolderName] = useState('');
    const [processing, setProcessing] = useState(false);

    function formatBytes(bytes) {
        if (bytes === 0) return '0 KB';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async function traverseDirectoryHandle(dirHandle, path = '') {
        const files = [];
        for await (const [name, handle] of dirHandle.entries()) {
            const relPath = path ? `${path}/${name}` : name;
            if (handle.kind === 'file') {
                try {
                    const file = await handle.getFile();
                    files.push({ file, relativePath: relPath });
                } catch (err) {
                    console.warn('Could not get file from handle:', relPath, err);
                }
            } else if (handle.kind === 'directory') {
                const sub = await traverseDirectoryHandle(handle, relPath);
                files.push(...sub);
            }
        }
        return files;
    }

    async function openFolderWithDirectoryPicker() {
        try {
            const dirHandle = await window.showDirectoryPicker();
            setFolderName(dirHandle.name || '');
            const rawFiles = await traverseDirectoryHandle(dirHandle, '');
            const pdfs = rawFiles.filter(p => p.file.type === 'application/pdf' || p.file.name.toLowerCase().endsWith('.pdf'));
            const meta = pdfs.map(p => ({ file: p.file, relativePath: p.relativePath, status: 'pending', error: '' }));
            setFilesMeta(meta);
            setItems([]);
            setTotal(0);
            processFiles(meta);
        } catch (e) {
            console.error('Directory picker cancelled or failed', e);
        }
    }

    function openFolderWithInput() {
        if (dirInputRef.current) dirInputRef.current.click();
    }

    function onDirInputChange(e) {
        const fl = Array.from(e.target.files || []);
        const pdfs = fl.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        const meta = pdfs.map(f => ({ file: f, relativePath: f.webkitRelativePath || f.name, status: 'pending', error: '' }));
        if (meta.length > 0) {
            const rp = meta[0].relativePath;
            const parts = rp.split('/');
            if (parts.length > 1) setFolderName(parts[0]);
            else setFolderName('');
        }
        setFilesMeta(meta);
        setItems([]);
        setTotal(0);
        processFiles(meta);
    }

    function openSingleFilePicker() {
        if (singleInputRef.current) singleInputRef.current.click();
    }

    function onSingleFileChange(e) {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const meta = [{ file: f, relativePath: f.name, status: 'pending', error: '' }];
        setFolderName(f.name);
        setFilesMeta(meta);
        setItems([]);
        setTotal(0);
        processFiles(meta);
    }

    async function extractTextFromPdfFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strs = content.items.map(it => it.str);
            text += strs.join(' ') + '\n';
        }
        return text;
    }

    async function processFiles(metaList) {
        setProcessing(true);
        const results = [];
        let sum = 0;
        for (let i = 0; i < metaList.length; i++) {
            const meta = metaList[i];
            const f = meta.file;
            setFilesMeta(prev => {
                const copy = prev.slice();
                if (copy[i]) copy[i] = { ...copy[i], status: 'processing', error: '' };
                return copy;
            });
            try {
                const text = await extractTextFromPdfFile(f);
                const info = extractReportDataFromPdfText(text);
                const row = {
                    file: meta.relativePath || f.name,
                    start_dt: info.start_dt || '—',
                    end_dt: info.end_dt || '—',
                    route: info.route || '—',
                    mid_raw: info.mid_raw || '—',
                    mid_value: info.mid_value || 0.0,
                    raw: info.final_raw || '—',
                    value: info.final_val || 0.0
                };
                results.push(row);
                sum += row.value;
                setFilesMeta(prev => {
                    const copy = prev.slice();
                    if (copy[i]) copy[i] = { ...copy[i], status: 'ok', error: '' };
                    return copy;
                });
            } catch (e) {
                console.error('Error processing file', f.name, e);
                results.push({
                    file: meta.relativePath || f.name,
                    start_dt: '—',
                    end_dt: '—',
                    route: '—',
                    mid_raw: '—',
                    mid_value: 0.0,
                    raw: 'NAPAKA: ' + (e && e.message ? e.message : String(e)),
                    value: 0.0
                });
                setFilesMeta(prev => {
                    const copy = prev.slice();
                    if (copy[i]) copy[i] = { ...copy[i], status: 'error', error: (e && e.message) ? e.message : String(e) };
                    return copy;
                });
            }
            setItems(results.slice());
            setTotal(sum);
        }

        results.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));
        setItems(results);
        setTotal(sum);
        setProcessing(false);
    }

    function removeAt(idx) {
        const nextMeta = filesMeta.slice(); nextMeta.splice(idx, 1); setFilesMeta(nextMeta);
        const nextItems = items.slice(); nextItems.splice(idx, 1); setItems(nextItems);
        setTotal(nextItems.reduce((acc, r) => acc + (r.value || 0), 0));
    }

    function clearAll() {
        setFilesMeta([]); setItems([]); setTotal(0); setFolderName('');
        if (dirInputRef.current) dirInputRef.current.value = '';
        if (singleInputRef.current) singleInputRef.current.value = '';
    }

    async function exportPdf() {
        const rows = items.map(r => ({
            fileName: r.file,
            start_dt: r.start_dt,
            end_dt: r.end_dt,
            route: r.route,
            kilometers: r.mid_value || 0,
            value: r.value || 0
        }));
        const title = `Seznam potnih nalogov - ${folderName || '—'}`;
        const fileName = `potni_nalogi_${(folderName || 'export')}_${new Date().toISOString().replace(/[:.]/g, '')}.pdf`;
        try {
            await exportReportToPdf(rows, { title, fileName });
        } catch (err) {
            console.error('Export failed', err);
            alert('Napaka pri izvozu PDF: ' + (err && err.message ? err.message : String(err)));
        }
    }

    const filteredItems = items;

    async function handleSaveReportToServer() {
        if (!filteredItems.length) {
            alert('Ni podatkov za shranjevanje.');
            return;
        }
        const rows = filteredItems.map(r => ({
            fileName: r.file,
            start_dt: r.start_dt,
            end_dt: r.end_dt,
            route: r.route,
            kilometers: r.mid_value || r.kilometers || 0,
            value: r.value || 0
        }));
        const title = `Seznam potnih nalogov - ${folderName || '—'}`;
        const filename = `potni_nalogi_${(folderName || 'export')}_${new Date().toISOString().replace(/[:.]/g, '')}.pdf`;
        try {
            const blob = await generatePdfBlob(rows, { title, fileName: filename });
            const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
            const totalKm = rows.reduce((s, r) => s + (Number(r.kilometers) || 0), 0);
            const result = await uploadReportToServer({ blob, filename, folder: folderName, totalValue, totalKm });
            alert('Report saved with id: ' + (result && result.report && result.report.id));
        } catch (err) {
            console.error('Save report failed', err);
            alert('Napaka pri shranjevanju na strežnik: ' + (err.message || err));
        }
    }

    return (
        <div className="card">
            <h1>Seštevek potnih nalogov</h1>
            <a href='opis.html'>Preberi si opis programa!</a>
            <p className="hint">Izberi mapo ali posamezen PDF. Za najboljšo izkušnjo uporabi Chrome/Edge.</p>

            <div className="controls">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn"
                        onClick={async () => {
                            if (window.showDirectoryPicker) {
                                await openFolderWithDirectoryPicker();
                            } else {
                                openFolderWithInput();
                            }
                        }}
                    >
                        Izberi mapo…
                    </button>

                    <button className="btn" onClick={() => openSingleFilePicker()}>Izberi PDF</button>

                    <input
                        ref={dirInputRef}
                        type="file"
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        style={{ display: 'none' }}
                        onChange={onDirInputChange}
                        accept="application/pdf"
                    />

                    <input
                        ref={singleInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={onSingleFileChange}
                        accept="application/pdf"
                    />

                    <label style={{ marginLeft: 12 }}>
                        Ime mape / datoteke:
                        <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="npr. DECEMBER_25 ali ime.pdf" style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #343454', background: '#10101a', color: '#e9e9f1' }} />
                    </label>

                    <div style={{ flex: 1 }} />

                    <button className="btn danger" onClick={clearAll}>Počisti vse</button>
                </div>
            </div>

            <div className="filelist" style={{ marginTop: 12 }}>
                <div className="file-head">
                    <div><strong>Izbrane datoteke</strong> <span className="small">{folderName ? `· mapa: ${folderName}` : ''}</span></div>
                    <div className="small">{filesMeta.length} datotek · {formatBytes(filesMeta.reduce((s, f) => s + (f.file.size || 0), 0))}</div>
                </div>

                <div className="rows">
                    {filesMeta.length === 0 ? <div className="file-empty">Ni izbranih datotek.</div> : filesMeta.map((f, idx) => (
                        <div className="row" key={idx}>
                            <div>
                                <div className="name" title={f.relativePath || f.file.name}>{f.relativePath || f.file.name}</div>
                                <div className="small"><span className="chip">PDF</span> · {formatBytes(f.file.size)}</div>
                                {f.error && <div style={{ color: '#fca5a5', marginTop: 6 }}>Napaka: {f.error}</div>}
                            </div>
                            <div className="actions">
                                <div className={`chip status ${f.status}`}>{f.status}</div>
                                <button className="rmv" onClick={() => removeAt(idx)}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={exportPdf} disabled={!items.length || processing}>⬇️ Export v PDF (A4)</button>
                <button className="btn" onClick={handleSaveReportToServer} disabled={!items.length || processing} style={{ marginLeft: 8 }}>💾 Shrani na strežnik</button>
                {processing && <span className="small" style={{ marginLeft: 12 }}>Obdelujem …</span>}
            </div>

            <table className="result-table">
                <thead>
                    <tr><th>PDF datoteka</th><th>Začetek</th><th>Konec</th><th>Relacija</th><th>Kilometri</th><th>Vrednost (EUR)</th></tr>
                </thead>
                <tbody>
                    {items.map((r, i) => (
                        <tr key={i}>
                            <td className="mono">{r.file}</td>
                            <td>{r.start_dt}</td>
                            <td>{r.end_dt}</td>
                            <td>{r.route}</td>
                            <td>{r.mid_value > 0 ? String(r.mid_value).replace('.', ',') : '—'}</td>
                            <td>{Number(r.value || 0).toFixed(2).replace('.', ',')} €</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr><th colSpan="5" className="total">TOTAL</th><th className="total">{Number(total || 0).toFixed(2).replace('.', ',')} €</th></tr>
                </tfoot>
            </table>
        </div>
    );
}