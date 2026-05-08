import { useState } from "react";
import { Activity, /* X, */ ChevronDown, ChevronUp } from "lucide-react";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

export function PerformancePanel() {
    const [isExpanded, setIsExpanded] = useState(false);
    const { metrics, score, formatMetric } = usePerformanceMonitor();

    // Só mostrar em desenvolvimento
    if (import.meta.env.PROD) {
        return null;
    }

    const scoreColors = {
        good: "#10b981",
        "needs-improvement": "#f59e0b",
        poor: "#ef4444",
    };

    const scoreLabels = {
        good: "Bom",
        "needs-improvement": "Precisa Melhorar",
        poor: "Ruim",
    };

    return (
        <div className="fixed bottom-[80px] right-4 z-[9999] font-mono text-xs">
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`bg-slate-900/95 border border-white/10 px-3 py-2 text-white cursor-pointer flex items-center gap-2 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${isExpanded ? "rounded-t-lg" : "rounded-lg"}`}
            >
                <Activity size={16} color={scoreColors[score]} />
                <span style={{ color: scoreColors[score] }}>
                    {scoreLabels[score]}
                </span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* Expanded Panel */}
            {isExpanded && (
                <div className="bg-slate-900/95 border border-white/10 border-t-0 rounded-b-lg p-3 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] min-w-[280px]">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                        <span className="text-white font-bold">
                            Core Web Vitals
                        </span>
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: scoreColors[score] }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        {/* FCP */}
                        <div className="flex justify-between">
                            <span className="text-slate-400">FCP:</span>
                            <span
                                style={{
                                    color:
                                        metrics.fcp && metrics.fcp < 1800
                                            ? "#10b981"
                                            : metrics.fcp && metrics.fcp < 3000
                                                ? "#f59e0b"
                                                : "#ef4444",
                                }}
                            >
                                {formatMetric(metrics.fcp)}
                            </span>
                        </div>

                        {/* LCP */}
                        <div className="flex justify-between">
                            <span className="text-slate-400">LCP:</span>
                            <span
                                style={{
                                    color:
                                        metrics.lcp && metrics.lcp < 2500
                                            ? "#10b981"
                                            : metrics.lcp && metrics.lcp < 4000
                                                ? "#f59e0b"
                                                : "#ef4444",
                                }}
                            >
                                {formatMetric(metrics.lcp)}
                            </span>
                        </div>

                        {/* FID */}
                        <div className="flex justify-between">
                            <span className="text-slate-400">FID:</span>
                            <span
                                style={{
                                    color:
                                        metrics.fid && metrics.fid < 100
                                            ? "#10b981"
                                            : metrics.fid && metrics.fid < 300
                                                ? "#f59e0b"
                                                : "#ef4444",
                                }}
                            >
                                {formatMetric(metrics.fid)}
                            </span>
                        </div>

                        {/* CLS */}
                        <div className="flex justify-between">
                            <span className="text-slate-400">CLS:</span>
                            <span
                                style={{
                                    color:
                                        metrics.cls && metrics.cls < 0.1
                                            ? "#10b981"
                                            : metrics.cls && metrics.cls < 0.25
                                                ? "#f59e0b"
                                                : "#ef4444",
                                }}
                            >
                                {metrics.cls !== null ? metrics.cls.toFixed(3) : "N/A"}
                            </span>
                        </div>

                        {/* TTFB */}
                        <div className="flex justify-between">
                            <span className="text-slate-400">TTFB:</span>
                            <span className="text-slate-200">
                                {formatMetric(metrics.ttfb)}
                            </span>
                        </div>

                        {/* Memory */}
                        {metrics.memoryUsage !== null && (
                            <div className="flex justify-between mt-2 pt-2 border-t border-white/10">
                                <span className="text-slate-400">Memória:</span>
                                <span className="text-slate-200">
                                    {formatMetric(metrics.memoryUsage, "bytes")}
                                </span>
                            </div>
                        )}

                        {/* Render Time */}
                        {metrics.renderTime !== null && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Render:</span>
                                <span className="text-slate-200">
                                    {formatMetric(metrics.renderTime)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
