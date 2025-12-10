function sumNumeric(values) {
    if (!Array.isArray(values)) return 0;
    return values.reduce((sum, value) => {
        const num = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
        if (Number.isNaN(num)) return sum;
        return sum + num;
    }, 0);
}

function validateReportPayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object') {
        return ['Payload must be an object'];
    }

    const { filename, folder, total_value, total_km, pdf } = payload;

    if (!filename || typeof filename !== 'string') {
        errors.push('Filename is required');
    }

    if (total_value != null && Number.isNaN(Number(total_value))) {
        errors.push('total_value must be a number');
    }

    if (total_km != null && Number.isNaN(Number(total_km))) {
        errors.push('total_km must be a number');
    }

    if (!pdf) {
        errors.push('PDF buffer is required');
    }

    return errors;
}

module.exports = { sumNumeric, validateReportPayload };
