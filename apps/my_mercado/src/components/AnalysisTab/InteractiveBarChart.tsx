import React, { useState } from 'react'

export interface BarChartPoint {
    month: string
    label: string
    total: number
}

interface InteractiveBarChartProps {
    data: BarChartPoint[]
    height?: number
    barGradient?: string
    valuePrefix?: string
    unitLabel?: string
}

export const InteractiveBarChart: React.FC<InteractiveBarChartProps> = ({
    data,
    height = 150,
    barGradient = 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
    unitLabel = '',
}) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    if (!data || data.length === 0) return null

    const maxVal = Math.max(...data.map((d) => d.total), 1)

    return (
        <div className="interactive-chart-container" style={{ position: 'relative', width: '100%' }}>
            <div className="interactive-chart-bars" style={{ height: `${height}px`, display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '12px 0 4px 0' }}>
                {data.map((point, index) => {
                    const barHeightPct = (point.total / maxVal) * 100
                    const isHovered = hoveredIndex === index

                    return (
                        <div
                            key={point.month}
                            className="interactive-bar-col"
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                height: '100%',
                                justifyContent: 'flex-end',
                                position: 'relative',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Floating Tooltip */}
                            {isHovered && (
                                <div
                                    className="interactive-chart-tooltip"
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        marginBottom: '6px',
                                        background: 'rgba(15, 23, 42, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.72rem',
                                        color: '#ffffff',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                                        zIndex: 10,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold' }}>{point.label} {unitLabel}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Mês: {point.month}</div>
                                </div>
                            )}

                            <div className="interactive-bar-val-label" style={{ fontSize: '0.65rem', color: isHovered ? 'var(--text-primary)' : 'var(--text-tertiary)', marginBottom: '4px', fontWeight: isHovered ? 'bold' : 'normal' }}>
                                {point.label}
                            </div>

                            <div
                                className="interactive-bar-fill"
                                style={{
                                    width: '100%',
                                    maxWidth: '36px',
                                    height: `${Math.max(barHeightPct, 6)}%`,
                                    background: barGradient,
                                    borderRadius: '6px 6px 0 0',
                                    transition: 'all 0.25s ease',
                                    opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                                    transform: isHovered ? 'scaleY(1.04)' : 'scaleY(1)',
                                    transformOrigin: 'bottom',
                                    boxShadow: isHovered ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                                }}
                            />

                            <div className="interactive-bar-month" style={{ fontSize: '0.7rem', color: isHovered ? 'var(--primary)' : 'var(--text-tertiary)', marginTop: '6px' }}>
                                {point.month}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default InteractiveBarChart
