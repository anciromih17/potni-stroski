const { sumNumeric, validateReportPayload } = require('./reportUtils');

describe('sumNumeric', () => {
    test('vrne 0 za neveljaven input', () => {
        expect(sumNumeric(null)).toBe(0);
        expect(sumNumeric(undefined)).toBe(0);
        expect(sumNumeric('abc')).toBe(0);
    });

    test('sešteje števila v polju', () => {
        expect(sumNumeric([1, 2, 3])).toBe(6);
    });

    test('ignorira neveljavne vrednosti in parsa stringe', () => {
        expect(sumNumeric([1, '2', '3.5', 'a', null])).toBe(6.5);
    });

    test('upošteva tudi vejico kot decimalni separator', () => {
        expect(sumNumeric(['1,5', '2,5'])).toBe(4);
    });
});

describe('validateReportPayload', () => {
    test('vrne napako, če payload ni objekt', () => {
        expect(validateReportPayload(null)).toEqual(['Payload must be an object']);
        expect(validateReportPayload('x')).toEqual(['Payload must be an object']);
    });

    test('zahteva filename in pdf', () => {
        const errors = validateReportPayload({
            folder: 'Test',
            total_value: 10,
            total_km: 20,
        });

        expect(errors).toContain('Filename is required');
        expect(errors).toContain('PDF buffer is required');
    });

    test('zavrne neštevilčen total_value', () => {
        const errors = validateReportPayload({
            filename: 'test.pdf',
            total_value: 'abc',
            total_km: 10,
            pdf: Buffer.from('test'),
        });

        expect(errors).toContain('total_value must be a number');
    });

    test('zavrne neštevilčen total_km', () => {
        const errors = validateReportPayload({
            filename: 'test.pdf',
            total_value: 10,
            total_km: 'abc',
            pdf: Buffer.from('test'),
        });

        expect(errors).toContain('total_km must be a number');
    });

    test('vrne prazno polje napak za veljaven payload', () => {
        const errors = validateReportPayload({
            filename: 'test.pdf',
            folder: 'Test',
            total_value: 123.45,
            total_km: 678,
            pdf: Buffer.from('test'),
        });

        expect(errors).toEqual([]);
    });
});
