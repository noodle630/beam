import { MappingRule, NormalizedProduct } from '../types/mapping';
export declare function loadMappingRules(orgSlug: string): Promise<MappingRule[]>;
export declare function mapCsvRowToProduct(rawRow: Record<string, any>, orgSlug: string, mappingRules?: MappingRule[]): Promise<NormalizedProduct>;
export declare function getDefaultMappingRules(): MappingRule[];
