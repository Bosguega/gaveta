import { useEffect, useRef, useState } from "react";

interface PerformanceMetrics {
    // Core Web Vitals
    fcp: number | null; // First Contentful Paint
    lcp: number | null; // Largest Contentful Paint
    fid: number | null; // First Input Delay
    cls: number | null; // Cumulative Layout Shift
    ttfb: number | null; // Time to First Byte

    // Custom metrics
    renderTime: number | null;
    memoryUsage: number | null;
    jsHeapSize: number | null;
}

interface PerformanceEntry {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
}

export function usePerformanceMonitor() {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        fcp: null,
        lcp: null,
        fid: null,
        cls: null,
        ttfb: null,
        renderTime: null,
        memoryUsage: null,
        jsHeapSize: null,
    });

    const observerRef = useRef<PerformanceObserver | null>(null);

    useEffect(() => {
        // Verificar suporte a Performance API
        if (typeof window === "undefined" || !window.performance) {
            return;
        }

        // Coletar métricas iniciais
        collectInitialMetrics();

        // Observar Core Web Vitals
        observeWebVitals();

        // Atualizar métricas periodicamente
        const interval = setInterval(updateRuntimeMetrics, 5000);

        return () => {
            clearInterval(interval);
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    const collectInitialMetrics = () => {
        // TTFB
        const navigation = performance.getEntriesByType(
            "navigation"
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
            setMetrics((prev) => ({
                ...prev,
                ttfb: navigation.responseStart - navigation.requestStart,
            }));
        }

        // FCP
        const paintEntries = performance.getEntriesByType("paint");
        const fcpEntry = paintEntries.find(
            (entry) => entry.name === "first-contentful-paint"
        );
        if (fcpEntry) {
            setMetrics((prev) => ({ ...prev, fcp: fcpEntry.startTime }));
        }
    };

    const observeWebVitals = () => {
        try {
            // LCP
            observerRef.current = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                    setMetrics((prev) => ({ ...prev, lcp: lastEntry.startTime }));
                }
            });
            observerRef.current.observe({ entryTypes: ["largest-contentful-paint"] });

            // FID
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries() as PerformanceEntry[];
                entries.forEach((entry) => {
                    if (entry.entryType === "first-input") {
                        setMetrics((prev) => ({
                            ...prev,
                            fid: entry.duration,
                        }));
                    }
                });
            });
            fidObserver.observe({ entryTypes: ["first-input"] });

            // CLS
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                list.getEntries().forEach((entry: any) => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        setMetrics((prev) => ({ ...prev, cls: clsValue }));
                    }
                });
            });
            clsObserver.observe({ entryTypes: ["layout-shift"] });
        } catch (error) {
            console.warn("Performance Observer não suportado:", error);
        }
    };

    const updateRuntimeMetrics = () => {
        // Memory usage (se disponível)
        if ("memory" in performance) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const memory = (performance as any).memory;
            setMetrics((prev) => ({
                ...prev,
                memoryUsage: memory.usedJSHeapSize,
                jsHeapSize: memory.totalJSHeapSize,
            }));
        }

        // Render time (custom)
        const renderStart = performance.now();
        requestAnimationFrame(() => {
            const renderTime = performance.now() - renderStart;
            setMetrics((prev) => ({ ...prev, renderTime }));
        });
    };

    const getScore = (): "good" | "needs-improvement" | "poor" => {
        const { fcp, lcp, fid, cls } = metrics;

        if (!fcp || !lcp || !fid || !cls) {
            return "needs-improvement";
        }

        // Baseado nos thresholds do Google
        const isGood =
            fcp < 1800 && lcp < 2500 && fid < 100 && cls < 0.1;
        const isPoor =
            fcp > 3000 || lcp > 4000 || fid > 300 || cls > 0.25;

        if (isGood) return "good";
        if (isPoor) return "poor";
        return "needs-improvement";
    };

    const formatMetric = (value: number | null, unit: string = "ms"): string => {
        if (value === null) return "N/A";
        if (unit === "ms") return `${Math.round(value)}ms`;
        if (unit === "bytes") return `${(value / 1024 / 1024).toFixed(2)}MB`;
        return value.toFixed(2);
    };

    return {
        metrics,
        score: getScore(),
        formatMetric,
    };
}
