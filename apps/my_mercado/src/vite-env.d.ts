/// <reference types="vite/client" />

/**
 * Type declarations for BarcodeDetector API (Shape Detection API)
 * Suportado no Chrome (Android, desktop) e Edge
 * https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */
interface BarcodeDetectorOptions {
    formats: string[];
}

interface DetectedBarcode {
    rawValue: string;
    format: string;
    boundingBox: DOMRectReadOnly;
    cornerPoints: { x: number; y: number }[];
}

declare class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    static getSupportedFormats(): Promise<string[]>;
    detect(image: ImageBitmap | HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | Blob | OffscreenCanvas): Promise<DetectedBarcode[]>;
}
