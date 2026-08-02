/**
 * Metadata — extracted information from model filenames.
 * Produced by MetadataParser. All fields are optional and tolerant.
 */

export interface Metadata {
    baseModel?: string;
    variant?: string;
    precision?: string;
    quantization?: string;
    scaled?: boolean;
    loraType?: string;
    version?: string;
    extra?: string[];
}