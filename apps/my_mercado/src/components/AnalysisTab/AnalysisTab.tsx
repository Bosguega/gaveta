import { useState } from 'react'
import {
    BarChart3,
    TrendingUp,
    ShoppingBag,
    ArrowLeft,
    PieChart,
    Package,
    DollarSign,
} from 'lucide-react'
import { useAnalysisData } from '../../hooks/useAnalysisData'
import './AnalysisTab.css'

interface AnalysisTabProps {
    onClose: () => void
}

const PRICE_CHART_HEIGHT = 130
const TOTAL_CHART_HEIGHT = 140

export function AnalysisTab({ onClose }: AnalysisTabProps) {
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

    const {
        monthlySummary,
        categories,
        topProducts,
        priceEvolution,
        totalEvolution,
        availableMonths,
        isLoading,
        priceEvolutionProduct,
    } = useAnalysisData(selectedMonth)

    // Determinar o mês efetivo para exibir no select
    const effectiveMonth =
        selectedMonth ??
        availableMonths[availableMonths.length - 1]?.value ??
        ''

    // Máximos para gráficos
    const priceChartMax =
        priceEvolution.length > 0
            ? Math.max(...priceEvolution.map((p) => p.total))
            : 1

    const totalChartMax =
        totalEvolution.length > 0
            ? Math.max(...totalEvolution.map((p) => p.total))
            : 1

    // Total geral (soma de todos os meses) para o card de evolução
    const grandTotal = totalEvolution.reduce((acc, cur) => acc + cur.total, 0)

    return (
        <div className="analysis-container">
            {/* Cabeçalho */}
            <div className="analysis-header">
                <div className="analysis-header-left">
                    <button className="analysis-back-btn" onClick={onClose} aria-label="Voltar">
                        <ArrowLeft size={20} />
                    </button>
                    <h2>
                        <BarChart3 size={22} color="var(--primary)" />
                        Análises
                    </h2>
                </div>
            </div>

            {isLoading ? (
                <div className="analysis-loading">
                    <p>Carregando dados...</p>
                </div>
            ) : (
                <>
                    {/* Seletor de mês */}
                    {availableMonths.length > 0 && (
                        <div className="analysis-month-selector">
                            <label htmlFor="month-select">Mês:</label>
                            <select
                                id="month-select"
                                className="month-select"
                                value={effectiveMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            >
                                {availableMonths.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {availableMonths.length === 0 ? (
                        <div className="analysis-empty" style={{ minHeight: 200 }}>
                            <p>Nenhum dado disponível. Adicione notas fiscais para ver análises.</p>
                        </div>
                    ) : (
                        <div className="analysis-grid">
                            {/* Card 1 — Resumo Mensal */}
                            <div className="analysis-card analysis-card-full">
                                <div className="analysis-card-header">
                                    <span className="analysis-card-title">
                                        <TrendingUp size={16} />
                                        Resumo Mensal
                                    </span>
                                    <div
                                        className="analysis-card-icon"
                                        style={{ background: 'rgba(16, 185, 129, 0.12)' }}
                                    >
                                        <TrendingUp size={18} className="text-primary-green" />
                                    </div>
                                </div>

                                {monthlySummary ? (
                                    <>
                                        <div className="summary-month">
                                            R$ {monthlySummary.totalSpent.toFixed(2).replace('.', ',')}
                                        </div>
                                        <div className="summary-period">{monthlySummary.periodLabel}</div>

                                        <div className="summary-stats">
                                            <div className="summary-stat">
                                                <div className="summary-stat-label">Itens comprados</div>
                                                <div className="summary-stat-value">{monthlySummary.totalItems}</div>
                                                <div className="summary-stat-sub">em {monthlySummary.totalReceipts} notas</div>
                                            </div>
                                            <div className="summary-stat">
                                                <div className="summary-stat-label">Ticket médio</div>
                                                <div className="summary-stat-value">
                                                    R$ {monthlySummary.avgTicket.toFixed(2).replace('.', ',')}
                                                </div>
                                                <div className="summary-stat-sub">por nota</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Nenhum dado para este mês.</p>
                                    </div>
                                )}
                            </div>

                            {/* Card 2 — Categorias */}
                            <div className="analysis-card">
                                <div className="analysis-card-header">
                                    <span className="analysis-card-title">
                                        <PieChart size={16} />
                                        Categorias
                                    </span>
                                    <div
                                        className="analysis-card-icon"
                                        style={{ background: 'rgba(59, 130, 246, 0.12)' }}
                                    >
                                        <PieChart size={18} className="text-primary-blue" />
                                    </div>
                                </div>

                                {categories.length > 0 ? (
                                    categories.map((cat) => (
                                        <div className="category-item" key={cat.name}>
                                            <div
                                                className="category-dot"
                                                style={{ background: cat.color }}
                                            />
                                            <div className="category-info">
                                                <div className="category-name">{cat.name}</div>
                                                <div className="category-bar">
                                                    <div
                                                        className="category-bar-fill"
                                                        style={{
                                                            width: `${cat.percent}%`,
                                                            background: cat.color,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="category-amount">
                                                    R$ {cat.amount.toFixed(2).replace('.', ',')}
                                                </div>
                                                <div className="category-percent">{cat.percent}%</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Nenhuma categoria neste mês.</p>
                                    </div>
                                )}
                            </div>

                            {/* Card 3 — Produtos Mais Comprados */}
                            <div className="analysis-card">
                                <div className="analysis-card-header">
                                    <span className="analysis-card-title">
                                        <Package size={16} />
                                        Produtos Mais Comprados
                                    </span>
                                    <div
                                        className="analysis-card-icon"
                                        style={{ background: 'rgba(139, 92, 246, 0.12)' }}
                                    >
                                        <Package size={18} className="text-primary-purple" />
                                    </div>
                                </div>

                                {topProducts.length > 0 ? (
                                    <div className="products-scroll">
                                        {topProducts.map((product, index) => (
                                            <div className="product-item" key={product.name}>
                                                <div
                                                    className={`product-rank ${index === 0 ? 'top-1' : ''}${index === 1 ? 'top-2' : ''}${index === 2 ? 'top-3' : ''}`}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div className="product-info">
                                                    <div className="product-name">{product.name}</div>
                                                    <div className="product-qty">
                                                        {product.qty}x compras
                                                    </div>
                                                </div>
                                                <div className="product-total">
                                                    R$ {product.total.toFixed(2).replace('.', ',')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Nenhum produto neste mês.</p>
                                    </div>
                                )}
                            </div>

                            {/* Card 4 — Evolução de Preços (produto mais frequente) */}
                            <div className="analysis-card">
                                <div className="analysis-card-header">
                                    <span className="analysis-card-title">
                                        <ShoppingBag size={16} />
                                        Evolução de Preços
                                    </span>
                                    <div
                                        className="analysis-card-icon"
                                        style={{ background: 'rgba(245, 158, 11, 0.12)' }}
                                    >
                                        <ShoppingBag size={18} className="text-primary-orange" />
                                    </div>
                                </div>

                                {priceEvolution.length > 0 && priceEvolutionProduct ? (
                                    <>
                                        <div className="price-evolution-product">
                                            {priceEvolutionProduct}
                                        </div>
                                        <div className="price-chart">
                                            {priceEvolution.map((item) => {
                                                const barHeight =
                                                    (item.total / priceChartMax) * PRICE_CHART_HEIGHT
                                                return (
                                                    <div className="price-bar-wrapper" key={item.month}>
                                                        <div className="price-bar-value">{item.label}</div>
                                                        <div
                                                            className="price-bar"
                                                            style={{
                                                                height: `${Math.max(barHeight, 8)}px`,
                                                                background:
                                                                    'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                                                            }}
                                                        />
                                                        <div className="price-bar-label">{item.month}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Sem dados de evolução de preços.</p>
                                    </div>
                                )}
                            </div>

                            {/* Card 5 — Evolução de Gastos Totais */}
                            <div className="analysis-card analysis-card-full">
                                <div className="analysis-card-header">
                                    <span className="analysis-card-title">
                                        <DollarSign size={16} />
                                        Evolução de Gastos Totais
                                    </span>
                                    <div
                                        className="analysis-card-icon"
                                        style={{ background: 'rgba(239, 68, 68, 0.12)' }}
                                    >
                                        <DollarSign size={18} className="text-primary-red" />
                                    </div>
                                </div>

                                {totalEvolution.length > 0 ? (
                                    <>
                                        <div className="total-evolution-summary">
                                            <span className="label">Total no período:</span>
                                            <span className="value">
                                                R$ {grandTotal.toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                        <div className="price-chart" style={{ height: TOTAL_CHART_HEIGHT }}>
                                            {totalEvolution.map((item) => {
                                                const barHeight =
                                                    (item.total / totalChartMax) * TOTAL_CHART_HEIGHT
                                                return (
                                                    <div className="price-bar-wrapper" key={item.month}>
                                                        <div className="price-bar-value">{item.label}</div>
                                                        <div
                                                            className="price-bar"
                                                            style={{
                                                                height: `${Math.max(barHeight, 8)}px`,
                                                                background:
                                                                    'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                                                            }}
                                                        />
                                                        <div className="price-bar-label">{item.month}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Sem dados de gastos.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default AnalysisTab