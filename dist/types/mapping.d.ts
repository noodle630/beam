export type TransformSpec = {
    op: 'to_number' | 'trim' | 'split' | 'join' | 'lower' | 'upper' | 'regex';
    args?: any;
};
export type MappingRule = {
    sourceField: string;
    internalField: string;
    transform?: TransformSpec;
};
export type NormalizedProduct = {
    org_slug: string;
    title?: string;
    description?: string;
    brand?: string;
    condition?: string;
    category?: string;
    price?: number;
    currency?: string;
    quantity?: number;
    image_urls?: string[];
    sku?: string;
    global_id_type?: string;
    global_id_value?: string;
    merchant_product_id?: string;
    merchant_variant_id?: string;
    attributes: Record<string, any>;
    source?: string;
    source_updated_at?: string;
};
