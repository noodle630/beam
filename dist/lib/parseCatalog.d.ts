export interface ProductRow {
    [key: string]: any;
}
export declare function parseCatalogCSV(raw: string): ProductRow[];
