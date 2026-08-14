import { useState } from 'react'
import {
    BarChart3,
    TrendingUp,
    ShoppingBag,
    ArrowLeft,
    PieChart,
    Package,
    DollarSign,
    Store,
    Printer,
    Trophy,
    Medal,
    ArrowUpRight,
    ArrowDownRight,
    ChevronDown,
    ChevronUp,
    Filter,
} from 'lucide-react'
import { useAnalysisData } from '../../hooks/useAnalysisData'
import { formatBRL } from '../../utils/currency'
import type { Receipt } from '../../types/domain'
import DonutChart from './DonutChart'
import InteractiveBarChart from './InteractiveBarChart'
import InsightsCard from './InsightsCard'
import './AnalysisTab.css'

interface AnalysisTabProps {
    onClose: () => void
    receipts?: Receipt[]
    scopeLabel?: string
}

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
        momComparison,
        categories,
        topProducts,
        priceEvolution,
        quantityEvolution,
        totalEvolution,
        establishmentSpending,
        availableMonths,
        availableEstablishments,
        insights,
        priceHighlights,
        productEstablishmentPrices,
        isLoading,
        resolved,
        setFilter,
    } = useAnalysisData(receipts)

    const [showQuantity, setShowQuantity] = useState(false)
    const [viewModeCategories, setViewModeCategories] = useState<'donut' | 'list'>('donut')
    const [viewModeStores, setViewModeStores] = useState<'donut' | 'list'>('list')
    const [expandProducts, setExpandProducts] = useState(false)

    const activeEvolution = showQuantity ? quantityEvolution : priceEvolution
    const grandTotal = totalEvolution.reduce((acc, current) => acc + current.total, 0)

    const handleCategoryClick = (categoryName: string) => {
        setFilter('category', resolved.category === categoryName ? null : categoryName)
    }

    const handlePrintReport = () => {
        window.print()
    }

    const visibleProducts = expandProducts ? topProducts : topProducts.slice(0, 5)

    return (
        <div className="analysis-container">
            {/* Header com ações */}
            <div className="analysis-header no-print">
                <div className="analysis-header-left">
                    <button className="analysis-back-btn" onClick={onClose} aria-label="Voltar">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>
                            <BarChart3 size={22} color="var(--primary)" />
                            Análises & Insights
                        </h2>
                        <div className="analysis-scope">{scopeLabel}</div>
                    </div>
                </div>

                <div className="analysis-header-actions">
                    <button
                        type="button"
                        className="analysis-action-btn"
                        onClick={handlePrintReport}
                        title="Imprimir ou Exportar PDF"
                    >
                        <Printer size={18} />
                        <span className="btn-label">Exportar</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="analysis-loading">
                    <p>Carregando análises...</p>
                </div>
            ) : availableMonths.length === 0 ? (
                <div className="analysis-empty analysis-empty-large">
                    <p>Nenhum dado disponível. Adicione notas fiscais para ver análises detalhadas.</p>
                </div>
            ) : (
                <>
                    {/* Barra de Filtros Globais */}
                    <div className="analysis-filter-bar no-print">
                        <div className="filter-group">
                            <label htmlFor="month-select">Mês:</label>
                            <select
                                id="month-select"
                                className="month-select"
                                value={resolved.month}
                                onChange={(e) => setFilter('month', e.target.value)}
                            >
                                {availableMonths.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {availableEstablishments.length > 0 && (
                            <div className="filter-group">
                                <label htmlFor="est-select">Mercado:</label>
                                <select
                                    id="est-select"
                                    className="month-select"
                                    value={resolved.establishment ?? ''}
                                    onChange={(e) => setFilter('establishment', e.target.value || null)}
                                >
                                    <option value="">Todos os estabelecimentos</option>
                                    {availableEstablishments.map((est) => (
                                        <option key={est} value={est}>
                                            {est}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Barra de Chips de Filtros Ativos */}
                    {(resolved.category || resolved.product || resolved.establishment) && (
                        <div className="analysis-active-chips no-print">
                            <span className="chips-label">
                                <Filter size={14} /> Filtros aplicados:
                            </span>
                            {resolved.establishment && (
                                <span className="active-chip">
                                    Mercado: <strong>{resolved.establishment}</strong>
                                    <button type="button" onClick={() => setFilter('establishment', null)}>×</button>
                                </span>
                            )}
                            {resolved.category && (
                                <span className="active-chip">
                                    Categoria: <strong>{resolved.category}</strong>
                                    <button type="button" onClick={() => setFilter('category', null)}>×</button>
                                </span>
                            )}
                            {resolved.product && (
                                <span className="active-chip">
                                    Produto: <strong>{resolved.product}</strong>
                                    <button type="button" onClick={() => setFilter('product', null)}>×</button>
                                </span>
                            )}
                        </div>
                    )}

                    <div className="analysis-grid">
                        {/* KPI Cards / Resumo Mensal com Comparativo MoM */}
                        <div className="analysis-card analysis-card-full summary-kpi-container">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <TrendingUp size={16} />
                                    Resumo do Período ({monthlySummary?.periodLabel})
                                </span>
                                <div
                                    className="analysis-card-icon"
                                    style={{ background: 'rgba(16, 185, 129, 0.12)' }}
                                >
                                    <TrendingUp size={18} className="text-primary-green" />
                                </div>
                            </div>

                            {monthlySummary ? (
                                <div className="kpi-cards-grid">
                                    {/* KPI 1: Gasto Total */}
                                    <div className="kpi-widget">
                                        <div className="kpi-widget-label">Gasto Total</div>
                                        <div className="kpi-widget-value">{formatMoney(monthlySummary.totalSpent)}</div>
                                        {momComparison?.hasPreviousMonth && (
                                            <div className={`mom-badge ${momComparison.spentPercent > 0 ? 'is-up' : 'is-down'}`}>
                                                {momComparison.spentPercent > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                {momComparison.spentPercent > 0 ? '+' : ''}{momComparison.spentPercent}% vs. {momComparison.previousMonthLabel}
                                            </div>
                                        )}
                                    </div>

                                    {/* KPI 2: Ticket Médio */}
                                    <div className="kpi-widget">
                                        <div className="kpi-widget-label">Ticket Médio por Nota</div>
                                        <div className="kpi-widget-value">{formatMoney(monthlySummary.avgTicket)}</div>
                                        {momComparison?.hasPreviousMonth && (
                                            <div className={`mom-badge ${momComparison.ticketPercent > 0 ? 'is-up' : 'is-down'}`}>
                                                {momComparison.ticketPercent > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                {momComparison.ticketPercent > 0 ? '+' : ''}{momComparison.ticketPercent}% vs. {momComparison.previousMonthLabel}
                                            </div>
                                        )}
                                    </div>

                                    {/* KPI 3: Total de Notas e Linhas */}
                                    <div className="kpi-widget">
                                        <div className="kpi-widget-label">Notas Fiscais / Itens</div>
                                        <div className="kpi-widget-value">
                                            {monthlySummary.totalReceipts} <span className="kpi-widget-subtext">notas ({monthlySummary.totalProductLines} prods.)</span>
                                        </div>
                                        <div className="kpi-widget-foot">
                                            Qtd. total comprada: {formatQuantity(monthlySummary.totalItems)} un.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="analysis-empty">
                                    <p>Nenhum dado para este período.</p>
                                </div>
                            )}
                        </div>

                        {/* Card Categorias (Com toggle Donut / Lista) */}
                        <div className="analysis-card">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <PieChart size={16} />
                                    Categorias
                                </span>
                                <div className="card-header-actions">
                                    <button
                                        type="button"
                                        className="card-toggle-view"
                                        onClick={() => setViewModeCategories(v => v === 'donut' ? 'list' : 'donut')}
                                    >
                                        {viewModeCategories === 'donut' ? 'Ver Lista' : 'Ver Gráfico'}
                                    </button>
                                    <div className="analysis-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                                        <PieChart size={18} className="text-primary-blue" />
                                    </div>
                                </div>
                            </div>

                            {categories.length > 0 ? (
                                viewModeCategories === 'donut' ? (
                                    <div className="donut-section">
                                        <DonutChart
                                            data={categories.map((c) => ({
                                                name: c.name,
                                                value: c.amount,
                                                percent: c.percent,
                                                color: c.color,
                                            }))}
                                            centerLabel="Total Categorias"
                                            centerValue={`${categories.length} cat.`}
                                            onSelectSegment={handleCategoryClick}
                                        />
                                        <div className="donut-legend-grid">
                                            {categories.slice(0, 6).map((c) => (
                                                <button
                                                    type="button"
                                                    key={c.name}
                                                    className={`donut-legend-item ${resolved.category === c.name ? 'is-selected' : ''}`}
                                                    onClick={() => handleCategoryClick(c.name)}
                                                >
                                                    <span className="dot" style={{ background: c.color }} />
                                                    <span className="name">{c.name}</span>
                                                    <span className="pct">{c.percent}%</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="categories-scroll">
                                        {categories.map((category) => {
                                            const isSelected = resolved.category === category.name
                                            return (
                                                <button
                                                    type="button"
                                                    key={category.name}
                                                    className={`category-item category-item-button ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => handleCategoryClick(category.name)}
                                                >
                                                    <div className="category-dot" style={{ background: category.color }} />
                                                    <div className="category-info">
                                                        <div className="category-name">{category.name}</div>
                                                        <div className="category-bar">
                                                            <div
                                                                className="category-bar-fill"
                                                                style={{ width: `${category.percent}%`, background: category.color }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="category-amount">{formatMoney(category.amount)}</div>
                                                        <div className="category-percent">{category.percent}%</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )
                            ) : (
                                <div className="analysis-empty">
                                    <p>Nenhuma categoria neste mês.</p>
                                </div>
                            )}
                        </div>

                        {/* Card Ranking de Produtos Mais Comprados */}
                        <div className="analysis-card analysis-card-ranked">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <Package size={16} />
                                    Produtos Mais Comprados
                                </span>
                                <div className="analysis-card-icon" style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
                                    <Package size={18} className="text-primary-purple" />
                                </div>
                            </div>

                            {topProducts.length > 0 ? (
                                <>
                                    <div className="products-scroll">
                                        {visibleProducts.map((product, index) => (
                                            <button
                                                type="button"
                                                className={`product-item product-item-button ${product.name === resolved.product ? 'is-selected' : ''}`}
                                                key={product.name}
                                                onClick={() => setFilter('product', product.name)}
                                            >
                                                <div
                                                    className={`product-rank ${index === 0 ? 'top-1' : ''}${index === 1 ? 'top-2' : ''}${index === 2 ? 'top-3' : ''}`}
                                                >
                                                    {index === 0 ? <Trophy size={13} color="#fbbf24" /> : index === 1 ? <Medal size={13} color="#94a3b8" /> : index === 2 ? <Medal size={13} color="#b45309" /> : index + 1}
                                                </div>
                                                <div className="product-info">
                                                    <div className="product-name">{product.name}</div>
                                                    <div className="product-qty">{formatQuantity(product.qty)}x comprado</div>
                                                </div>
                                                <div className="product-total">{formatMoney(product.total)}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {topProducts.length > 5 && (
                                        <button
                                            type="button"
                                            className="expand-products-btn"
                                            onClick={() => setExpandProducts((v) => !v)}
                                        >
                                            {expandProducts ? (
                                                <>Mostrar Menos <ChevronUp size={14} /></>
                                            ) : (
                                                <>Ver todos os {topProducts.length} produtos <ChevronDown size={14} /></>
                                            )}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="analysis-empty">
                                    <p>Nenhum produto encontrado com os filtros atuais.</p>
                                </div>
                            )}
                        </div>

                        {/* Card Gastos por Estabelecimento */}
                        <div className="analysis-card">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <Store size={16} />
                                    Gastos por Estabelecimento
                                </span>
                                <div className="card-header-actions">
                                    <button
                                        type="button"
                                        className="card-toggle-view"
                                        onClick={() => setViewModeStores(v => v === 'donut' ? 'list' : 'donut')}
                                    >
                                        {viewModeStores === 'donut' ? 'Ver Lista' : 'Ver Gráfico'}
                                    </button>
                                    <div className="analysis-card-icon" style={{ background: 'rgba(236, 72, 153, 0.12)' }}>
                                        <Store size={18} className="text-primary-pink" />
                                    </div>
                                </div>
                            </div>

                            {establishmentSpending.length > 0 ? (
                                viewModeStores === 'donut' ? (
                                    <div className="donut-section">
                                        <DonutChart
                                            data={establishmentSpending.map((e) => ({
                                                name: e.name,
                                                value: e.amount,
                                                percent: e.percent,
                                                color: e.color,
                                            }))}
                                            centerLabel="Mercados"
                                            centerValue={`${establishmentSpending.length} loj.`}
                                        />
                                    </div>
                                ) : (
                                    <div className="categories-scroll">
                                        {establishmentSpending.map((est) => (
                                            <div key={est.name} className="category-item">
                                                <div className="category-dot" style={{ background: est.color }} />
                                                <div className="category-info">
                                                    <div className="category-name">{est.name}</div>
                                                    <div className="category-bar">
                                                        <div
                                                            className="category-bar-fill"
                                                            style={{ width: `${est.percent}%`, background: est.color }}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="category-amount">{formatMoney(est.amount)}</div>
                                                    <div className="category-percent">{est.percent}%</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="analysis-empty">
                                    <p>Nenhum estabelecimento neste mês.</p>
                                </div>
                            )}
                        </div>

                        {/* Card Evolução de Preços / Quantidades de Produto */}
                        <div className="analysis-card">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <ShoppingBag size={16} />
                                    {showQuantity ? 'Quantidade por Mês' : 'Evolução de Preço'}
                                </span>
                                <div className="analysis-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
                                    <ShoppingBag size={18} className="text-primary-orange" />
                                </div>
                            </div>

                            {activeEvolution.length > 0 && resolved.product ? (
                                <>
                                    <div className="price-evolution-product">
                                        Produto selecionado: <strong>{resolved.product}</strong>
                                    </div>
                                    <button
                                        type="button"
                                        className="price-toggle"
                                        onClick={() => setShowQuantity((prev) => !prev)}
                                        aria-pressed={showQuantity}
                                    >
                                        {showQuantity ? 'Ver evolução de preços' : 'Ver quantidade comprada'}
                                    </button>

                                    <InteractiveBarChart
                                        data={activeEvolution}
                                        height={140}
                                        barGradient={
                                            showQuantity
                                                ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
                                                : 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                                        }
                                        unitLabel={showQuantity ? 'un.' : ''}
                                    />
                                </>
                            ) : (
                                <div className="analysis-empty">
                                    <p>Clique em um produto da lista acima para ver o histórico de preços.</p>
                                </div>
                            )}
                        </div>

                        {/* Card Insights Inteligentes e Comparador */}
                        <InsightsCard
                            insights={insights}
                            priceHighlights={priceHighlights}
                            productEstablishmentPrices={productEstablishmentPrices}
                            selectedProduct={resolved.product}
                        />

                        {/* Card Evolução de Gastos Totais */}
                        <div className="analysis-card analysis-card-full">
                            <div className="analysis-card-header">
                                <span className="analysis-card-title">
                                    <DollarSign size={16} />
                                    Histórico de Gastos Totais (Últimos Mêses)
                                </span>
                                <div className="analysis-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                                    <DollarSign size={18} className="text-primary-red" />
                                </div>
                            </div>

                            {totalEvolution.length > 0 ? (
                                <>
                                    <div className="total-evolution-summary">
                                        <span className="label">Total acumulado no período:</span>
                                        <span className="value">{formatMoney(grandTotal)}</span>
                                    </div>

                                    <InteractiveBarChart
                                        data={totalEvolution}
                                        height={150}
                                        barGradient="linear-gradient(180deg, #10b981 0%, #059669 100%)"
                                    />
                                </>
                            ) : (
                                <div className="analysis-empty">
                                    <p>Sem dados de gastos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default AnalysisTab