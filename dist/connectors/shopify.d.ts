export interface ShopifyConnectorConfig {
    shopDomain: string;
    adminToken: string;
    apiVersion: string;
}
export interface ShopifyProduct {
    id: string;
    title: string;
    vendor: string;
    productType: string;
    handle: string;
    tags: string[];
    status: string;
    bodyHtml: string;
    images: {
        nodes: Array<{
            url: string;
        }>;
    };
    variants: {
        nodes: Array<{
            id: string;
            title: string;
            sku: string;
            price: string;
            availableForSale: boolean;
            inventoryQuantity: number | null;
            selectedOptions: Array<{
                name: string;
                value: string;
            }>;
        }>;
    };
}
export interface SyncSummary {
    org_slug: string;
    seen: number;
    inserted: number;
    updated: number;
    unchanged: number;
    errors: number;
    error_details?: Array<{
        product_id: string;
        error: string;
    }>;
}
export declare function getOrgSlugFromDomain(shopDomain: string): string;
export declare function syncShopifyCatalog(config: ShopifyConnectorConfig): Promise<SyncSummary>;
export declare function createShopifyCheckoutLink(params: {
    shopDomain: string;
    variantId: string;
    qty?: number;
}): string;
