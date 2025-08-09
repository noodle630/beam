import { NormalizedProduct } from '../types/mapping';
export interface UpsertResult {
    action: 'inserted' | 'updated' | 'unchanged';
    productId: string;
    matchedOn?: string;
}
export interface UpsertSummary {
    seen: number;
    inserted: number;
    updated: number;
    unchanged: number;
    errors: number;
    error_details: Array<{
        product_id: string;
        error: string;
    }>;
}
export declare function upsertProduct(product: NormalizedProduct): Promise<UpsertResult>;
export declare function batchUpsertProducts(products: NormalizedProduct[]): Promise<UpsertSummary>;
