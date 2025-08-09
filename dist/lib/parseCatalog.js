"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCatalogCSV = parseCatalogCSV;
function parseCatalogCSV(raw) {
    const rows = raw.split('\n').map(r => r.trim()).filter(Boolean);
    if (rows.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
    }
    const headers = rows[0].split(',').map(h => h.trim());
    const data = rows.slice(1).map((row, index) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        values.push(current.trim());
        while (values.length < headers.length) {
            values.push('');
        }
        const rowData = {};
        headers.forEach((header, i) => {
            let value = values[i] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (value !== '') {
                rowData[header] = value;
            }
        });
        return rowData;
    });
    return data;
}
