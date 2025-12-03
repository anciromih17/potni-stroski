const envServer = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_BACKEND_URL : undefined;
const defaultServer = 'http://localhost:5000';

export async function uploadReportToServer({ blob, filename, folder, totalValue, totalKm, serverUrl = '' }) {
    const base = (serverUrl && String(serverUrl).trim()) || envServer || defaultServer;
    const url = base.replace(/\/$/, '') + '/api/reports';
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('filename', filename);
    fd.append('folder', folder || '');
    fd.append('totalValue', totalValue !== undefined ? String(totalValue) : '');
    fd.append('totalKm', totalKm !== undefined ? String(totalKm) : '');
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Upload failed');
    }
    return res.json();
}