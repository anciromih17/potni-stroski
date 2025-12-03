import { useState, useEffect, useRef, useCallback } from 'react';
import { extractReportDataFromPdfText } from '../helpers';

async function pdfToText(file) {
    return await file.text();
}

export default function useFilesProcessor(initialFiles = []) {
    const [files, setFiles] = useState(initialFiles);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const debouncedTimer = useRef(null);
    const latestFilesRef = useRef(files);
    latestFilesRef.current = files;

    const parseFile = useCallback(async (fileObj) => {
        try {
            const text = await pdfToText(fileObj.file);
            const parsed = extractReportDataFromPdfText(text || '');
            return {
                fileName: fileObj.name || (fileObj.file && fileObj.file.name) || 'unknown',
                ...parsed
            };
        } catch (err) {
            console.error('parseFile error', fileObj, err);
            return {
                fileName: fileObj.name || (fileObj.file && fileObj.file.name) || 'unknown',
                start_dt: '',
                end_dt: '',
                route: '',
                mid_raw: '',
                mid_value: 0,
                price_per_km_raw: '',
                price_per_km: 0,
                final_raw: '',
                final_val: 0
            };
        }
    }, []);

    const parseAllFiles = useCallback(async (fileList) => {
        setLoading(true);
        try {
            const toParse = Array.from(fileList || []);
            const promises = toParse.map(f => parseFile(f));
            const results = await Promise.all(promises);
            const builtRows = results.map(r => ({
                fileName: r.fileName,
                start_dt: r.start_dt || '',
                end_dt: r.end_dt || '',
                route: r.route || '',
                kilometers: typeof r.mid_value === 'number' ? r.mid_value : (r.mid_value ? Number(String(r.mid_value).replace(',', '.')) : 0),
                value: typeof r.final_val === 'number' ? r.final_val : (r.final_val ? Number(String(r.final_val).replace(',', '.')) : 0)
            }));
            const sum = builtRows.reduce((s, row) => s + (Number(row.value) || 0), 0);
            setRows(builtRows);
            setTotal(Math.round(sum * 100) / 100);
            setLoading(false);
            return { rows: builtRows, total: Math.round(sum * 100) / 100 };
        } catch (err) {
            console.error('parseAllFiles', err);
            setLoading(false);
            return { rows: [], total: 0 };
        }
    }, [parseFile]);

    useEffect(() => {
        if (debouncedTimer.current) clearTimeout(debouncedTimer.current);
        debouncedTimer.current = setTimeout(() => {
            parseAllFiles(latestFilesRef.current);
        }, 250);
        return () => {
            if (debouncedTimer.current) clearTimeout(debouncedTimer.current);
        };
    }, [files, parseAllFiles]);

    const addFiles = useCallback((newFiles) => {
        setFiles(prev => {
            const merged = [...prev, ...newFiles];
            return merged;
        });
    }, []);

    const removeFile = useCallback((fileIdOrName) => {
        setFiles(prev => prev.filter(f => (f.id ? f.id !== fileIdOrName : f.name !== fileIdOrName)));
    }, []);

    const clearFiles = useCallback(() => {
        setFiles([]);
        setRows([]);
        setTotal(0);
    }, []);

    const refresh = useCallback(() => {
        parseAllFiles(latestFilesRef.current);
    }, [parseAllFiles]);

    return {
        files,
        setFiles,
        addFiles,
        removeFile,
        clearFiles,
        rows,
        total,
        loading,
        refresh
    };
}