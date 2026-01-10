import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadReportToServer } from './api';

class FakeFormData {
    constructor() {
        this.fields = [];
    }
    append(key, value, filename) {
        this.fields.push({ key, value, filename });
    }
}

beforeEach(() => {
    globalThis.FormData = FakeFormData;
    globalThis.fetch = vi.fn();
});

describe('uploadReportToServer', () => {
    it('uses provided serverUrl as base and calls /api/reports', async () => {
        const mockResponse = {
            ok: true,
            json: () => Promise.resolve({ ok: true })
        };
        globalThis.fetch.mockResolvedValueOnce(mockResponse);

        const blob = new Blob(['test'], { type: 'application/pdf' });
        const result = await uploadReportToServer({
            blob,
            filename: 'test.pdf',
            folder: 'TestFolder',
            totalValue: 100,
            totalKm: 200,
            serverUrl: 'http://example.com/'
        });

        expect(result).toEqual({ ok: true });
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('http://example.com/api/reports');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FakeFormData);
    });

    it('falls back to default http://localhost:5000 when serverUrl is empty', async () => {
        const mockResponse = {
            ok: true,
            json: () => Promise.resolve({ ok: true })
        };
        globalThis.fetch.mockResolvedValueOnce(mockResponse);

        const blob = new Blob(['test'], { type: 'application/pdf' });
        await uploadReportToServer({
            blob,
            filename: 'test.pdf',
            folder: '',
            totalValue: undefined,
            totalKm: undefined,
            serverUrl: ''
        });

        const [url] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('http://localhost:5000/api/reports');
    });

    it('throws a helpful error when response is not ok and JSON contains error', async () => {
        const mockResponse = {
            ok: false,
            statusText: 'Bad Request',
            json: () => Promise.resolve({ error: 'Upload failed!' })
        };
        globalThis.fetch.mockResolvedValueOnce(mockResponse);

        const blob = new Blob(['test'], { type: 'application/pdf' });

        await expect(
            uploadReportToServer({
                blob,
                filename: 'test.pdf',
                folder: 'x',
                totalValue: 1,
                totalKm: 2,
                serverUrl: 'http://example.com'
            })
        ).rejects.toThrow('Upload failed!');
    });

    it('falls back to statusText if JSON parsing fails', async () => {
        const mockResponse = {
            ok: false,
            statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('bad json'))
        };
        globalThis.fetch.mockResolvedValueOnce(mockResponse);

        const blob = new Blob(['test'], { type: 'application/pdf' });

        await expect(
            uploadReportToServer({
                blob,
                filename: 'test.pdf',
                folder: 'x',
                totalValue: 1,
                totalKm: 2,
                serverUrl: 'http://example.com'
            })
        ).rejects.toThrow('Internal Server Error');
    });
});
