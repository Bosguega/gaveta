import React, { useState } from 'react'

export interface DonutSegment {
    name: string
    value: number
    percent: number
    color: string
}

interface DonutChartProps {
    data: DonutSegment[]
    size?: number
    strokeWidth?: number
    centerLabel?: string
    centerValue?: string
    onSelectSegment?: (name: string) => void
    selectedIndex?: number | null
}

export const DonutChart: React.FC<DonutChartProps> = ({
    data,
    size = 200,
    strokeWidth = 28,
    centerLabel,
    centerValue,
    onSelectSegment,
    selectedIndex,
}) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    if (!data || data.length === 0) {
        return null
    }

    const total = data.reduce((acc, item) => acc + item.value, 0)
    if (total === 0) return null

    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const center = size / 2

    let accumulatedAngle = 0

    const activeItem = hoveredIndex !== null ? data[hoveredIndex] : selectedIndex != null && selectedIndex >= 0 ? data[selectedIndex] : null

    return (
        <div className="donut-chart-wrapper" style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {data.map((item, index) => {
                    const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`
                    const strokeDashoffset = -accumulatedAngle
                    accumulatedAngle += (item.value / total) * circumference

                    const isHovered = hoveredIndex === index
                    const isSelected = selectedIndex === index

                    return (
                        <circle
                            key={item.name}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth={isHovered || isSelected ? strokeWidth + 4 : strokeWidth}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            style={{
                                cursor: 'pointer',
                                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                                opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                            }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => onSelectSegment?.(item.name)}
                        />
                    )
                })}
            </svg>
            <div
                className="donut-center-text"
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    width: radius * 1.4,
                }}
            >
                {activeItem ? (
                    <>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                            {activeItem.name}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {activeItem.percent}%
                        </div>
                    </>
                ) : (
                    <>
                        {centerLabel && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                {centerLabel}
                            </div>
                        )}
                        {centerValue && (
                            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                {centerValue}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default DonutChart
