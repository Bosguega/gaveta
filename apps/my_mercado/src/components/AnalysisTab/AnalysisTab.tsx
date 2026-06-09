import { BarChart3, TrendingUp, ShoppingBag, ArrowLeft, PieChart, Package, DollarSign } from 'lucide-react'
import { useAnalysisData } from '../../hooks/useAnalysisData'
import { formatBRL } from '../../utils/currency'
import type { Receipt } from '../../types/domain'
import './AnalysisTab.css'

interface AnalysisTabProps {
    onClose: () => void
    receipts?: Receipt[]
    scopeLabel?: string
}

const PRICE_CHART_HEIGHT = 130
const TOTAL_CHART_HEIGHT = 140

function formatMoney(value: number): string {
    return `R$ ${formatBRL(value)}`
}

function formatQuantity(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

export function AnalysisTab({ onClose, receipts, scopeLabel = 'Dados gerais' }: AnalysisTabProps) {
    const {
        monthlySummary,
        categories,
        topProducts,
        priceEvolution,
        totalEvolution,
        availableMonths,
        isLoading,
        resolved,
        setFilter,
    } = useAnalysisData(receipts)

    /**
     * Toggle de categoria: clica de novo na mesma para limpar.
     * Como a UI so permite clicar em categorias validas do mes,
     * o toggle aqui e sempre sobre a `resolved.category`.
     */
    const handleCategoryClick = (categoryName: string) => {
        setFilter('category', resolved.category === categoryName ? null : categoryName)
    }

    const priceChartMax =
        priceEvolution.length > 0
            ? Math.max(...priceEvolution.map((point) => point.total))
            : 1

    const totalChartMax =
        totalEvolution.length > 0
            ? Math.max(...totalEvolution.map((point) => point.total))
            : 1

    const grandTotal = totalEvolution.reduce((acc, current) => acc + current.total, 0)

    return (
        <div className="analysis-container">
            <div className="analysis-header">
                <div className="analysis-header-left">
                    <button className="analysis-back-btn" onClick={onClose} aria-label="Voltar">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>
                            <BarChart3 size={22} color="var(--primary)" />
                            Análises
                        </h2>
                        <div className="analysis-scope">{scopeLabel}</div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="analysis-loading">
                    <p>Carregando dados...</p>
                </div>
            ) : (
                <>
                    {availableMonths.length > 0 && (
                        <div className="analysis-month-selector">
                            <label htmlFor="month-select">Mês:</label>
                            <select
                                id="month-select"
                                className="month-select"
                                value={resolved.month}
                                onChange={(event) => setFilter('month', event.target.value)}
                            >
                                {availableMonths.map((month) => (
                                    <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {availableMonths.length === 0 ? (
                        <div className="analysis-empty analysis-empty-large">
                            <p>Nenhum dado disponível. Adicione notas fiscais para ver análises.</p>
                        </div>
                    ) : (
                        <div className="analysis-grid">
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
                                            {formatMoney(monthlySummary.totalSpent)}
                                        </div>
                                        <div className="summary-period">{monthlySummary.periodLabel}</div>

                                        <div className="summary-stats">
                                            <div className="summary-stat">
                                                <div className="summary-stat-label">Produtos lançados</div>
                                                <div className="summary-stat-value">{monthlySummary.totalProductLines}</div>
                                                <div className="summary-stat-sub">
                                                    qtd. total: {formatQuantity(monthlySummary.totalItems)}
                                                </div>
                                            </div>
                                            <div className="summary-stat">
                                                <div className="summary-stat-label">Ticket médio</div>
                                                <div className="summary-stat-value">
                                                    {formatMoney(monthlySummary.avgTicket)}
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

                            <div className="analysis-card analysis-card-products">
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
                                    <div className="categories-scroll">
                                        {categories.map((category) => {
                                            const isSelected = resolved.category === category.name
                                            return (
                                                <button
                                                    type="button"
                                                    key={category.name}
                                                    className={`category-item category-item-button ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => handleCategoryClick(category.name)}
                                                    aria-pressed={isSelected}
                                                    title={
                                                        isSelected
                                                            ? 'Clique para limpar o filtro'
                                                            : 'Filtrar produtos desta categoria'
                                                    }
                                                >
                                                    <div
                                                        className="category-dot"
                                                        style={{ background: category.color }}
                                                    />
                                                    <div className="category-info">
                                                        <div className="category-name">{category.name}</div>
                                                        <div className="category-bar">
                                                            <div
                                                                className="category-bar-fill"
                                                                style={{
                                                                    width: `${category.percent}%`,
                                                                    background: category.color,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="category-amount">
                                                            {formatMoney(category.amount)}
                                                        </div>
                                                        <div className="category-percent">{category.percent}%</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Nenhuma categoria neste mês.</p>
                                    </div>
                                )}
                            </div>

                            <div className="analysis-card analysis-card-ranked">
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

                                {resolved.category && (
                                    <div className="top-products-filter-label">
                                        Filtrando por: <strong>{resolved.category}</strong>{' '}
                                        <button
                                            type="button"
                                            className="top-products-filter-clear"
                                            onClick={() => setFilter('category', null)}
                                            aria-label="Limpar filtro de categoria"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}

                                {topProducts.length > 0 ? (
                                    <div className="products-scroll">
                                        {topProducts.map((product, index) => (
                                            <button
                                                type="button"
                                                className={`product-item product-item-button ${product.name === resolved.product ? 'is-selected' : ''}`}
                                                key={product.name}
                                                onClick={() => setFilter('product', product.name)}
                                            >
                                                <div
                                                    className={`product-rank ${index === 0 ? 'top-1' : ''}${index === 1 ? 'top-2' : ''}${index === 2 ? 'top-3' : ''}`}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div className="product-info">
                                                    <div className="product-name">{product.name}</div>
                                                    <div className="product-qty">
                                                        {formatQuantity(product.qty)}x comprado
                                                    </div>
                                                </div>
                                                <div className="product-total">
                                                    {formatMoney(product.total)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="analysis-empty">
                                        <p>Nenhum produto neste mês.</p>
                                    </div>
                                )}
                            </div>

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

                                {priceEvolution.length > 0 && resolved.product ? (
                                    <>
                                        <div className="price-evolution-product">
                                            Produto: {resolved.product}
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
                                                {formatMoney(grandTotal)}
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