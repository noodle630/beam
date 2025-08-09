export interface FindProductsParams {
    org_slug?: string;
    shop_domain?: string;
    query?: string;
    brand?: string | string[];
    category?: string | string[];
    condition?: string | string[];
    price_min?: number;
    price_max?: number;
    attributes?: Record<string, any>;
    limit?: number;
}
export interface ProductCard {
    product_id: string;
    title: string;
    brand?: string;
    category?: string;
    price?: number;
    currency?: string;
    image?: string | null;
    url?: string | null;
}
export interface ProductDetails {
    product_id: string;
    title: string;
    brand?: string;
    category?: string;
    price?: number;
    currency?: string;
    quantity?: number;
    image_urls?: string[];
    sku?: string;
    attributes?: Record<string, any>;
    source?: string;
}
export interface CheckoutLinkResponse {
    checkout_url: string | null;
}
export declare function validateOrgIdentifier(params: any): string;
export declare function validateProductId(productId: any): string;
export declare function validateFindProductsParams(params: any): FindProductsParams & {
    org_slug: string;
};
export declare function findProducts(params: FindProductsParams): Promise<ProductCard[]>;
export declare function getProductDetails(productId: string, orgSlug: string): Promise<ProductDetails>;
export declare function createCheckoutLink(productId: string, orgSlug: string, variant?: string, qty?: number, shopDomain?: string): Promise<CheckoutLinkResponse>;
