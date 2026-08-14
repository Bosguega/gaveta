import React from 'react'
import { Sparkles, TrendingUp, Store, PieChart, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { InsightItem, PriceHighlight, ProductEstablishmentPrice } from '../../hooks/useAnalysisData'
import { formatBRL } from '../../utils/currency'

interface InsightsCardProps {
    insights: InsightItem[]
    priceHighlights: PriceHighlight[]
    productEstablishmentPrices?: ProductEstablishmentPrice[]
    selectedProduct?: string | null
}

export const InsightsCard: React.FC<InsightsCardProps> = ({
    insights,
    priceHighlights,
    productEstablishmentPrices = [],
    selectedProduct,
}) => {
    const getIcon = (type: InsightItem['icon']) => {
        switch (type) {
            case 'trending':
                return <TrendingUp size={16} className="insight-icon text-primary-purple" />
            case 'store':
                return <Store size={16} className="insight-icon text-primary-pink" />
            case 'category':
                return <PieChart size={16} className="insight-icon text-primary-blue" />
            case 'alert':
                return <AlertTriangle size={16} className="insight-icon text-primary-orange" />
            case 'sparkles':
            default:
                return <Sparkles size={16} className="insight-icon text-primary-green" />
        }
    }

    return (
        <div className="analysis-card analysis-card-full insights-container-card">
            <div className="analysis-card-header">
                <span className="analysis-card-title">
                    <Sparkles size={16} />
                    Insights Inteligentes & Destaques
                </span>
                <div
                    className="analysis-card-icon"
                    style={{ background: 'rgba(139, 92, 246, 0.12)' }}
                >
                    <Sparkles size={18} className="text-primary-purple" />
                </div>
            </div>

            {/* Smart Insights List */}
            {insights.length > 0 && (
                <div className="insights-grid">
                    {insights.map((insight) => (
                        <div key={insight.id} className={`insight-chip-item insight-type-${insight.type}`}>
                            <div className="insight-chip-header">
                                {getIcon(insight.icon)}
                                <span className="insight-chip-title">{insight.title}</span>
                            </div>
                            <p className="insight-chip-desc">{insight.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Price Inflation / Drop Highlights */}
            {priceHighlights.length > 0 && (
                <div className="price-highlights-section">
                    <div className="price-highlights-heading">
                        Destaques de Variação de Preços (Mês vs. Mês Anterior)
                    </div>
                    <div className="price-highlights-grid">
                        {priceHighlights.map((item) => {
                            const isUp = item.direction === 'up'
                            return (
                                <div key={item.productName} className={`price-highlight-card ${isUp ? 'is-up' : 'is-down'}`}>
                                    <div className="ph-product-name">{item.productName}</div>
                                    <div className="ph-price-row">
                                        <span className="ph-old-price">R$ {formatBRL(item.oldPrice)}</span>
                                        <span className="ph-arrow">→</span>
                                        <span className="ph-new-price">R$ {formatBRL(item.currentPrice)}</span>
                                        <span className={`ph-badge ${isUp ? 'badge-up' : 'badge-down'}`}>
                                            {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                            {isUp ? '+' : ''}{item.percentChange}%
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Selected Product Establishment Price Comparison */}
            {selectedProduct && productEstablishmentPrices.length > 0 && (
                <div className="product-est-prices-section">
                    <div className="price-highlights-heading">
                        Onde comprar <strong>{selectedProduct}</strong> mais barato?
                    </div>
                    <div className="product-est-prices-list">
                        {productEstablishmentPrices.map((item, idx) => (
                            <div key={item.establishmentName} className={`est-price-item ${idx === 0 ? 'best-price' : ''}`}>
                                <div className="est-name-col">
                                    <Store size={14} style={{ opacity: 0.7 }} />
                                    <span>{item.establishmentName}</span>
                                    {idx === 0 && <span className="best-price-badge">Melhor Preço</span>}
                                </div>
                                <div className="est-price-col">
                                    <span className="est-avg-price">Média: R$ {formatBRL(item.avgPrice)}</span>
                                    <span className="est-range">
                                        Min: R$ {formatBRL(item.minPrice)} / Max: R$ {formatBRL(item.maxPrice)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default InsightsCard
