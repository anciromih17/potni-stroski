const originalEnv = { ...process.env };

const mockQuery = jest.fn();
const mockPool = jest.fn(() => ({ query: mockQuery }));

jest.mock('pg', () => ({
    Pool: mockPool,
}));

function loadDbModule() {
    return require('./db');
}

beforeEach(() => {
    jest.resetModules();
    mockQuery.mockReset();
    mockPool.mockClear();
    process.env = { ...originalEnv };
});

afterAll(() => {
    process.env = originalEnv;
});

describe('db module', () => {
    test('uporabi privzeti connectionString, če DATABASE_URL ni nastavljen', () => {
        delete process.env.DATABASE_URL;

        const { pool } = loadDbModule();

        expect(mockPool).toHaveBeenCalledTimes(1);
        expect(mockPool).toHaveBeenCalledWith({
            connectionString:
                'postgresql://postgres:postgres@localhost:5432/potni_stroski',
        });
        expect(pool.query).toBe(mockQuery);
    });

    test('uporabi DATABASE_URL, če je nastavljen', () => {
        process.env.DATABASE_URL = 'postgresql://user:pass@host:1234/db';

        loadDbModule();

        expect(mockPool).toHaveBeenCalledTimes(1);
        expect(mockPool).toHaveBeenCalledWith({
            connectionString: 'postgresql://user:pass@host:1234/db',
        });
    });

    test('init izvede CREATE TABLE IF NOT EXISTS reports po uspešni povezavi', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const { init } = loadDbModule();

        await init();

        const sqlCalls = mockQuery.mock.calls.map(([sql]) => String(sql));

        expect(sqlCalls.some((sql) => sql.includes('SELECT 1'))).toBe(true);
        expect(
            sqlCalls.some((sql) =>
                sql.includes('CREATE TABLE IF NOT EXISTS reports'),
            ),
        ).toBe(true);
    });

    test('init propagira napako, če CREATE TABLE poizvedba pade', async () => {
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT 1')) {
                return { rows: [] };
            }
            if (text.includes('CREATE TABLE')) {
                throw new Error('schema error');
            }
            return { rows: [] };
        });

        const { init } = loadDbModule();

        await expect(init()).rejects.toThrow('schema error');
    });

    test('pool export je objekt z metodo query', () => {
        const { pool } = loadDbModule();

        expect(pool).toBeDefined();
        expect(typeof pool.query).toBe('function');
    });
});
