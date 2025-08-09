"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMappingRules = loadMappingRules;
exports.mapCsvRowToProduct = mapCsvRowToProduct;
exports.getDefaultMappingRules = getDefaultMappingRules;
const supabase_1 = require("./supabase");
const CORE_FIELDS = new Set([
    'title', 'brand', 'category', 'price', 'currency', 'quantity', 'image_urls',
    'sku', 'global_id_type', 'global_id_value', 'merchant_product_id',
    'merchant_variant_id', 'condition', 'description'
]);
function normalizeHeader(header) {
    return header
        .replace(/^\uFEFF/, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
function normalizeAttributeKey(key) {
    return key
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_\s]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}
function autoSplitImageUrls(value) {
    if (!value || typeof value !== 'string')
        return [];
    let delimiter = '|';
    if (value.includes('|')) {
        delimiter = '|';
    }
    else if (value.includes(',')) {
        delimiter = ',';
    }
    else {
        return [value.trim()].filter(Boolean);
    }
    return value
        .split(delimiter)
        .map(url => url.trim())
        .filter(Boolean);
}
async function loadMappingRules(orgSlug) {
    const { data, error } = await supabase_1.supabase
        .from('field_mappings')
        .select('*')
        .eq('org_slug', orgSlug)
        .eq('source', 'csv');
    if (error) {
        console.error('Error loading mapping rules:', error);
        return [];
    }
    return data.map(row => ({
        sourceField: row.source_field,
        internalField: row.internal_field,
        transform: row.transform_spec ? JSON.parse(row.transform_spec) : undefined
    }));
}
function applyTransform(value, transform) {
    if (value === null || value === undefined)
        return value;
    let result = value;
    switch (transform.op) {
        case 'trim':
            result = String(result).trim();
            break;
        case 'lower':
            result = String(result).toLowerCase();
            break;
        case 'upper':
            result = String(result).toUpperCase();
            break;
        case 'regex':
            if (transform.args?.pattern) {
                const regex = new RegExp(transform.args.pattern, transform.args.flags || '');
                const match = String(result).match(regex);
                result = match ? (transform.args.group ? match[transform.args.group] : match[0]) : result;
            }
            break;
        case 'split':
            const delimiter = transform.args?.delimiter || ',';
            result = String(result)
                .split(delimiter)
                .map(s => s.trim())
                .filter(Boolean);
            break;
        case 'join':
            const joinDelimiter = transform.args?.delimiter || ',';
            result = Array.isArray(result) ? result.join(joinDelimiter) : String(result);
            break;
        case 'to_number':
            const num = parseFloat(String(result).replace(/[^0-9.-]/g, ''));
            result = isNaN(num) ? 0 : num;
            break;
        default:
            break;
    }
    return result;
}
function normalizeCondition(value) {
    const normalized = value.toLowerCase().trim();
    switch (normalized) {
        case 'new':
        case 'brand new':
            return 'new';
        case 'used':
        case 'pre-owned':
            return 'used';
        case 'refurbished':
        case 'renewed':
            return 'refurbished';
        case 'open box':
        case 'open-box':
        case 'openbox':
            return 'open_box';
        default:
            return 'other';
    }
}
function isNumericString(value) {
    return /^-?[\d,]+(\.\d+)?$/.test(value);
}
async function mapCsvRowToProduct(rawRow, orgSlug, mappingRules) {
    const rules = mappingRules || await loadMappingRules(orgSlug);
    const normalizedHeaders = new Map();
    const headerMap = [];
    for (const originalHeader of Object.keys(rawRow)) {
        const normalized = normalizeHeader(originalHeader);
        normalizedHeaders.set(normalized, originalHeader);
        headerMap.push(`"${originalHeader}" → "${normalized}"`);
    }
    if (process.env.DEBUG_INGEST) {
        console.log('Header map:', headerMap.join(', '));
    }
    const product = {
        org_slug: orgSlug,
        attributes: {},
        source: 'csv',
        source_updated_at: new Date().toISOString()
    };
    const mappedHeaders = new Set();
    for (const rule of rules) {
        const normalizedSourceField = normalizeHeader(rule.sourceField);
        const originalHeader = normalizedHeaders.get(normalizedSourceField);
        if (originalHeader) {
            const sourceValue = rawRow[originalHeader];
            mappedHeaders.add(originalHeader);
            if (process.env.DEBUG_INGEST) {
                console.log(`🔍 Matched rule: "${rule.sourceField}" → ${rule.internalField}`);
            }
            if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                let mappedValue = sourceValue;
                if (rule.transform) {
                    mappedValue = applyTransform(sourceValue, rule.transform);
                    if (process.env.DEBUG_INGEST) {
                        console.log(`   Transformed: ${sourceValue} → ${mappedValue}`);
                    }
                }
                if (rule.internalField === 'image_urls') {
                    if (Array.isArray(mappedValue)) {
                        mappedValue = mappedValue.filter(Boolean);
                    }
                    else {
                        mappedValue = autoSplitImageUrls(String(mappedValue));
                    }
                }
                if (rule.internalField === 'condition') {
                    mappedValue = normalizeCondition(String(mappedValue));
                }
                if (CORE_FIELDS.has(rule.internalField)) {
                    product[rule.internalField] = mappedValue;
                    if (process.env.DEBUG_INGEST) {
                        console.log(`   ✅ Set core field product.${rule.internalField} = ${mappedValue}`);
                    }
                }
                else if (rule.internalField.startsWith('attributes.')) {
                    const attrKey = rule.internalField.replace('attributes.', '');
                    product.attributes[attrKey] = mappedValue;
                    if (process.env.DEBUG_INGEST) {
                        console.log(`   ✅ Set attribute ${attrKey} = ${mappedValue}`);
                    }
                }
                else {
                    product.attributes[rule.internalField] = mappedValue;
                    if (process.env.DEBUG_INGEST) {
                        console.log(`   ✅ Set attribute ${rule.internalField} = ${mappedValue}`);
                    }
                }
            }
        }
    }
    for (const [originalHeader, value] of Object.entries(rawRow)) {
        if (!mappedHeaders.has(originalHeader) && value !== undefined && value !== null && value !== '') {
            let attributeValue = value;
            if (typeof value === 'string' && isNumericString(value)) {
                const numValue = parseFloat(value.replace(/[,$]/g, ''));
                if (!isNaN(numValue)) {
                    attributeValue = numValue;
                }
            }
            const normalizedKey = normalizeAttributeKey(originalHeader);
            product.attributes[normalizedKey] = attributeValue;
            if (process.env.DEBUG_INGEST) {
                console.log(`   📦 Unmapped field ${originalHeader} → attributes.${normalizedKey} = ${attributeValue}`);
            }
        }
    }
    return product;
}
function getDefaultMappingRules() {
    return [
        { sourceField: 'Product Name', internalField: 'title' },
        { sourceField: 'Title', internalField: 'title' },
        { sourceField: 'Name', internalField: 'title' },
        { sourceField: 'MSRP', internalField: 'price', transform: { op: 'to_number' } },
        { sourceField: 'Price', internalField: 'price', transform: { op: 'to_number' } },
        { sourceField: 'Cost', internalField: 'price', transform: { op: 'to_number' } },
        { sourceField: 'Images', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: '|' } } },
        { sourceField: 'Image URLs', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: '|' } } },
        { sourceField: 'SKU', internalField: 'sku' },
        { sourceField: 'Brand', internalField: 'brand' },
        { sourceField: 'Category', internalField: 'category' },
        { sourceField: 'Description', internalField: 'description' },
        { sourceField: 'Quantity', internalField: 'quantity', transform: { op: 'to_number' } },
        { sourceField: 'Stock', internalField: 'quantity', transform: { op: 'to_number' } },
        { sourceField: 'Currency', internalField: 'currency' },
        { sourceField: 'Condition', internalField: 'condition' }
    ];
}
