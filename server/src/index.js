require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { pool, init } = require('./db');

const upload = multer();
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

(async () => {
    try {
        await init();
        console.log('Database initialized');

        app.get('/api/health', (_, res) => res.json({ ok: true }));

        app.post('/api/reports', upload.single('file'), async (req, res) => {
            try {
                if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

                const filename = req.body.filename || req.file.originalname || 'export.pdf';
                const folder = req.body.folder || null;
                const totalValue = req.body.totalValue ? parseFloat(String(req.body.totalValue).replace(',', '.')) : null;
                const totalKm = req.body.totalKm ? parseFloat(String(req.body.totalKm).replace(',', '.')) : null;

                const pdfBuffer = req.file.buffer;

                const q = `
          INSERT INTO reports (filename, folder, total_value, total_km, pdf)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, filename, folder, total_value, total_km, created_at;
        `;
                const values = [filename, folder, totalValue, totalKm, pdfBuffer];
                const result = await pool.query(q, values);

                res.status(201).json({ report: result.rows[0] });
            } catch (err) {
                console.error('POST /api/reports error', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.get('/api/reports', async (req, res) => {
            try {
                const q = `SELECT id, filename, folder, total_value, total_km, created_at FROM reports ORDER BY created_at DESC LIMIT 200;`;
                const result = await pool.query(q);
                res.json({ reports: result.rows });
            } catch (err) {
                console.error('GET /api/reports error', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.get('/api/reports/:id/file', async (req, res) => {
            try {
                const id = Number(req.params.id);
                const q = `SELECT filename, pdf FROM reports WHERE id = $1;`;
                const result = await pool.query(q, [id]);
                if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

                const row = result.rows[0];
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
                res.send(row.pdf);
            } catch (err) {
                console.error('GET /api/reports/:id/file error', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Server initialization failed', err);
        process.exit(1);
    }
})();