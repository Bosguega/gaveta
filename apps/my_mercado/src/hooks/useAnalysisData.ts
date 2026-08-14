import { useState, useMemo, useCallback } from 'react'
import { useAllReceiptsQuery } from './queries/useReceiptsQuery'
import type { Receipt, ReceiptItem } from '../types/domain'
import { parseBRL } from '../utils/currency'
import { calculateItemTotal } from '../utils/analytics'
import { normalizeCategory } from '../utils/categoryNormalizer'

/* ─── Types ─────────────────────────────────────────── */

export interface MonthlySummary {
    totalSpent: number
    totalItems: number
    totalProductLines: number
    totalReceipts: number
    avgTicket: number
    periodLabel: string
}

export interface MoMComparison {
    spentDiff: number
    spentPercent: number
    ticketDiff: number
    ticketPercent: number
    itemsDiff: number
    itemsPercent: number
    hasPreviousMonth: boolean
    previousMonthLabel: string
}

export interface CategorySummary {
    name: string
    amount: number
    percent: number
    color: string
}

export interface ProductRank {
    name: string
    qty: number
    total: number
}

export interface MonthlyTotal {
    month: string
    label: string
    total: number
}

export interface EstablishmentSpending {
    name: string
    amount: number
    percent: number
    color: string
}

export interface InsightItem {
    id: string
    type: 'info' | 'warning' | 'success'
    title: string
    description: string
    icon: 'trending' | 'store' | 'category' | 'sparkles' | 'alert'
}

export interface PriceHighlight {
    productName: string
    oldPrice: number
    currentPrice: number
    percentChange: number
    direction: 'up' | 'down'
}

export interface ProductEstablishmentPrice {
    establishmentName: string
    avgPrice: number
    count: number
    minPrice: number
    maxPrice: number
}

export interface AnalysisFilters {
    /** "YYYY-MM" ou null (null = último mês disponível) */
    month?: string | null
    /** Nome exato do produto ou null */
    product?: string | null
    /** Nome exato da categoria ou null (null = todas) */
    category?: string | null
    /** Nome do estabelecimento ou null (null = todos) */
    establishment?: string | null
}

export interface AnalysisResolved {
    /** Mês efetivamente usado (sempre "YYYY-MM" válido dentro de availableMonths) */
    month: string
    /** Produto selecionado que existe no mês atual, ou null se inválido/não selecionado */
    product: string | null
    /** Categoria selecionada que existe no mês atual, ou null se inválida/não selecionada */
    category: string | null
    /** Estabelecimento selecionado que existe no mês atual, ou null se inválido/não selecionado */
    establishment: string | null
}

export interface AnalysisEngine {
    monthlySummary: MonthlySummary | null
    momComparison: MoMComparison | null
    categories: CategorySummary[]
    topProducts: ProductRank[]
    priceEvolution: MonthlyTotal[]
    /** Quantidade comprada do produto selecionado por mês (últimos 6 meses) */
    quantityEvolution: MonthlyTotal[]
    totalEvolution: MonthlyTotal[]
    establishmentSpending: EstablishmentSpending[]
    availableMonths: { value: string; label: string }[]
    availableEstablishments: string[]
    insights: InsightItem[]
    priceHighlights: PriceHighlight[]
    productEstablishmentPrices: ProductEstablishmentPrice[]
    isLoading: boolean

    /** O que o usuário pediu (pode ser inválido) */
    filters: AnalysisFilters
    /** O que foi aplicado (sempre coerente com os dados) */
    resolved: AnalysisResolved

    /** Atualiza um filtro. Se o filtro invalida o outro, ele é resetado. */
    setFilter: (name: keyof AnalysisFilters, value: string | null) => void
}

/* ─── Helpers (unchanged from original) ─────────────── */

const CATEGORY_COLORS: Record<string, string> = {
    Alimentos: '#10b981',
    Limpeza: '#3b82f6',
    Higiene: '#8b5cf6',
    Bebidas: '#f59e0b',
    Carnes: '#ef4444',
    Hortifrúti: '#22c55e',
    Padaria: '#d97706',
    Laticínios: '#06b6d4',
    Congelados: '#0ea5e9',
    Enlatados: '#a855f7',
    'Não perecível': '#64748b',
}

const FALLBACK_COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
    '#22c55e', '#d97706', '#06b6d4', '#0ea5e9', '#a855f7',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b',
]

function getCategoryColor(name: string): string {
    return CATEGORY_COLORS[name] || FALLBACK_COLORS[name.length % FALLBACK_COLORS.length]
}

function getYearMonth(dateStr: string): string | null {
    if (!dateStr) return null

    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}`
    }

    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}`
    }

    const date = new Date(dateStr)
    if (!Number.isNaN(date.getTime())) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    return null
}

function formatMonthLabel(yearMonth: string): string {
    const [year, month] = yearMonth.split('-')
    const monthIndex = Number.parseInt(month, 10) - 1
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    return `${months[monthIndex]}/${year}`
}

function formatShortMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-')
    const monthIndex = Number.parseInt(month, 10) - 1
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${months[monthIndex]}/${year.slice(2)}`
}

function getCurrentYearMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getProductKey(item: ReceiptItem): string {
    return item.normalized_name || item.name
}

/** Unidades de medida (peso/volume) — contam como 1 ocorrência */
const MEASURE_UNITS = new Set(['KG', 'G', 'ML', 'L'])

/** Retorna a quantidade contável: se for unidade, usa quantity; se for medida, conta 1. */
function getCountableQty(item: ReceiptItem): number {
    const unit = (item.unit || 'UN').toUpperCase()
    if (MEASURE_UNITS.has(unit)) return 1
    return Math.round(item.quantity) || 1
}

/* ─── Pure engine (no side effects, no fallback product) ─────── */

export function buildAnalysisEngine(
    receipts: Receipt[],
    filters: AnalysisFilters,
    isLoading: boolean,
): AnalysisEngine {
    const receiptDates: { yearMonth: string; receipt: Receipt }[] = []

    for (const receipt of receipts) {
        const yearMonth = getYearMonth(receipt.date)
        if (yearMonth) {
            receiptDates.push({ yearMonth, receipt })
        }
    }

    const uniqueMonths = [...new Set(receiptDates.map((item) => item.yearMonth))].sort()
    const computedAvailableMonths = uniqueMonths.map((yearMonth) => ({
        value: yearMonth,
        label: formatMonthLabel(yearMonth),
    }))

    // ── Resolved month ──
    const resolvedMonth =
        filters.month && uniqueMonths.includes(filters.month)
            ? filters.month
            : uniqueMonths[uniqueMonths.length - 1] ?? getCurrentYearMonth()

    // ── Available Establishments in month ──
    const monthAllReceipts = receiptDates
        .filter((item) => item.yearMonth === resolvedMonth)
        .map((item) => item.receipt)

    const availableEstablishments = [...new Set(
        monthAllReceipts
            .map((r) => r.establishment_display || r.establishment)
            .filter((name): name is string => Boolean(name))
    )].sort()

    // ── Resolved Establishment ──
    const requestedEst = filters.establishment ?? null
    const resolvedEstablishment =
        requestedEst !== null && availableEstablishments.includes(requestedEst)
            ? requestedEst
            : null

    // ── Filtered Month Receipts (considering establishment filter if present) ──
    const monthReceipts = monthAllReceipts.filter((receipt) => {
        if (!resolvedEstablishment) return true
        const estName = receipt.establishment_display || receipt.establishment
        return estName === resolvedEstablishment
    })

    // ── Monthly computation ──
    let totalSpent = 0
    let totalItems = 0
    const allItems: ReceiptItem[] = []

    for (const receipt of monthReceipts) {
        for (const item of receipt.items ?? []) {
            totalSpent += calculateItemTotal(item, parseBRL)
            totalItems += getCountableQty(item)
            allItems.push(item)
        }
    }

    const totalReceipts = monthReceipts.length
    const monthlySummary: MonthlySummary | null = totalReceipts > 0
        ? {
            totalSpent,
            totalItems,
            totalProductLines: allItems.length,
            totalReceipts,
            avgTicket: totalReceipts > 0 ? totalSpent / totalReceipts : 0,
            periodLabel: formatMonthLabel(resolvedMonth),
        }
        : null

    // ── MoM Comparison (Month over Month) ──
    let momComparison: MoMComparison | null = null
    const resolvedMonthIdx = uniqueMonths.indexOf(resolvedMonth)
    if (resolvedMonthIdx > 0) {
        const prevMonth = uniqueMonths[resolvedMonthIdx - 1]
        const prevReceipts = receiptDates
            .filter((item) => item.yearMonth === prevMonth)
            .map((item) => item.receipt)
            .filter((receipt) => {
                if (!resolvedEstablishment) return true
                const estName = receipt.establishment_display || receipt.establishment
                return estName === resolvedEstablishment
            })

        let prevSpent = 0
        let prevItems = 0
        for (const receipt of prevReceipts) {
            for (const item of receipt.items ?? []) {
                prevSpent += calculateItemTotal(item, parseBRL)
                prevItems += getCountableQty(item)
            }
        }
        const prevReceiptsCount = prevReceipts.length
        const prevAvgTicket = prevReceiptsCount > 0 ? prevSpent / prevReceiptsCount : 0

        const spentDiff = totalSpent - prevSpent
        const spentPercent = prevSpent > 0 ? (spentDiff / prevSpent) * 100 : 0

        const ticketDiff = (monthlySummary?.avgTicket ?? 0) - prevAvgTicket
        const ticketPercent = prevAvgTicket > 0 ? (ticketDiff / prevAvgTicket) * 100 : 0

        const itemsDiff = totalItems - prevItems
        const itemsPercent = prevItems > 0 ? (itemsDiff / prevItems) * 100 : 0

        momComparison = {
            spentDiff,
            spentPercent: Math.round(spentPercent * 10) / 10,
            ticketDiff,
            ticketPercent: Math.round(ticketPercent * 10) / 10,
            itemsDiff,
            itemsPercent: Math.round(itemsPercent * 10) / 10,
            hasPreviousMonth: true,
            previousMonthLabel: formatShortMonth(prevMonth),
        }
    }

    // ── Establishment spending ──
    const establishmentMap = new Map<string, number>()
    for (const receipt of monthReceipts) {
        const estName = receipt.establishment_display || receipt.establishment
        if (estName) {
            let receiptTotal = 0
            for (const item of receipt.items ?? []) {
                receiptTotal += calculateItemTotal(item, parseBRL)
            }
            establishmentMap.set(estName, (establishmentMap.get(estName) || 0) + receiptTotal)
        }
    }

    const establishmentSpending = [...establishmentMap.entries()]
        .map(([name, amount]) => ({
            name,
            amount,
            percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
            color: getCategoryColor(name),
        }))
        .sort((a, b) => b.amount - a.amount)

    // ── Categories ──
    const categoryMap = new Map<string, number>()
    for (const item of allItems) {
        const category = normalizeCategory(item.category)
        categoryMap.set(
            category,
            (categoryMap.get(category) || 0) + calculateItemTotal(item, parseBRL),
        )
    }

    const categories = [...categoryMap.entries()]
        .map(([name, amount]) => ({
            name,
            amount,
            percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
            color: getCategoryColor(name),
        }))
        .sort((a, b) => b.amount - a.amount)

    // ── Resolved category ──
    const requestedCategory = filters.category ?? null
    const resolvedCategory =
        requestedCategory !== null && categories.some((c) => c.name === requestedCategory)
            ? requestedCategory
            : null

    // ── Products ranking ──
    const productMap = new Map<string, { qty: number; total: number }>()
    for (const item of allItems) {
        if (resolvedCategory !== null && normalizeCategory(item.category) !== resolvedCategory) {
            continue
        }
        const key = getProductKey(item)
        const current = productMap.get(key) || { qty: 0, total: 0 }
        current.qty += getCountableQty(item)
        current.total += calculateItemTotal(item, parseBRL)
        productMap.set(key, current)
    }

    const topProducts = [...productMap.entries()]
        .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
        .sort((a, b) => b.qty - a.qty || b.total - a.total)

    // ── Resolved product ──
    const resolvedProduct =
        filters.product != null && topProducts.some((p) => p.name === filters.product)
            ? filters.product
            : null

    // ── Price & quantity evolution (last 6 months) ──
    const evolutionMonths = uniqueMonths.slice(-6)
    const priceEvolution: MonthlyTotal[] = []
    const quantityEvolution: MonthlyTotal[] = []

    if (resolvedProduct) {
        for (const yearMonth of evolutionMonths) {
            let totalUnitPrice = 0
            let count = 0
            let totalQty = 0

            for (const { receipt } of receiptDates.filter((item) => item.yearMonth === yearMonth)) {
                if (resolvedEstablishment) {
                    const estName = receipt.establishment_display || receipt.establishment
                    if (estName !== resolvedEstablishment) continue
                }
                for (const item of receipt.items ?? []) {
                    if (getProductKey(item) === resolvedProduct) {
                        totalUnitPrice += parseBRL(item.paid_price ?? item.price)
                        totalQty += getCountableQty(item)
                        count += 1
                    }
                }
            }

            if (count > 0) {
                const averagePrice = totalUnitPrice / count
                priceEvolution.push({
                    month: formatShortMonth(yearMonth),
                    label: `R$ ${averagePrice.toFixed(2).replace('.', ',')}`,
                    total: averagePrice,
                })
                quantityEvolution.push({
                    month: formatShortMonth(yearMonth),
                    label: `${totalQty}`,
                    total: totalQty,
                })
            }
        }
    }

    // ── Total evolution (last 6 months) ──
    const totalEvolution = evolutionMonths.map((yearMonth) => {
        let monthTotal = 0

        for (const { receipt } of receiptDates.filter((item) => item.yearMonth === yearMonth)) {
            if (resolvedEstablishment) {
                const estName = receipt.establishment_display || receipt.establishment
                if (estName !== resolvedEstablishment) continue
            }
            for (const item of receipt.items ?? []) {
                monthTotal += calculateItemTotal(item, parseBRL)
            }
        }

        return {
            month: formatShortMonth(yearMonth),
            label: `R$ ${monthTotal.toFixed(2).replace('.', ',')}`,
            total: monthTotal,
        }
    })

    // ── Product price breakdown across establishments ──
    const productEstablishmentPrices: ProductEstablishmentPrice[] = []
    if (resolvedProduct) {
        const estPriceMap = new Map<string, { totalUnitPrice: number; count: number; prices: number[] }>()
        for (const { receipt } of receiptDates) {
            const estName = receipt.establishment_display || receipt.establishment || 'Outros'
            for (const item of receipt.items ?? []) {
                if (getProductKey(item) === resolvedProduct) {
                    const unitPrice = parseBRL(item.paid_price ?? item.price)
                    if (unitPrice > 0) {
                        const current = estPriceMap.get(estName) || { totalUnitPrice: 0, count: 0, prices: [] }
                        current.totalUnitPrice += unitPrice
                        current.count += 1
                        current.prices.push(unitPrice)
                        estPriceMap.set(estName, current)
                    }
                }
            }
        }

        for (const [estName, data] of estPriceMap.entries()) {
            productEstablishmentPrices.push({
                establishmentName: estName,
                avgPrice: data.totalUnitPrice / data.count,
                count: data.count,
                minPrice: Math.min(...data.prices),
                maxPrice: Math.max(...data.prices),
            })
        }
        productEstablishmentPrices.sort((a, b) => a.avgPrice - b.avgPrice)
    }

    // ── Price Highlights (Inflation / Price Drops across recent 2 months) ──
    const priceHighlights: PriceHighlight[] = []
    if (resolvedMonthIdx > 0) {
        const prevMonth = uniqueMonths[resolvedMonthIdx - 1]
        const currentItemsMap = new Map<string, number[]>()
        const prevItemsMap = new Map<string, number[]>()

        for (const { receipt } of receiptDates.filter((i) => i.yearMonth === resolvedMonth)) {
            for (const item of receipt.items ?? []) {
                const key = getProductKey(item)
                const price = parseBRL(item.paid_price ?? item.price)
                if (price > 0) {
                    const list = currentItemsMap.get(key) || []
                    list.push(price)
                    currentItemsMap.set(key, list)
                }
            }
        }

        for (const { receipt } of receiptDates.filter((i) => i.yearMonth === prevMonth)) {
            for (const item of receipt.items ?? []) {
                const key = getProductKey(item)
                const price = parseBRL(item.paid_price ?? item.price)
                if (price > 0) {
                    const list = prevItemsMap.get(key) || []
                    list.push(price)
                    prevItemsMap.set(key, list)
                }
            }
        }

        for (const [productName, currentPrices] of currentItemsMap.entries()) {
            const prevPrices = prevItemsMap.get(productName)
            if (prevPrices && prevPrices.length > 0) {
                const avgCurrent = currentPrices.reduce((a, b) => a + b, 0) / currentPrices.length
                const avgPrev = prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length
                const diff = avgCurrent - avgPrev
                const percentChange = ((avgCurrent - avgPrev) / avgPrev) * 100

                if (Math.abs(percentChange) >= 3 && Math.abs(diff) >= 0.2) {
                    priceHighlights.push({
                        productName,
                        oldPrice: avgPrev,
                        currentPrice: avgCurrent,
                        percentChange: Math.round(percentChange * 10) / 10,
                        direction: percentChange > 0 ? 'up' : 'down',
                    })
                }
            }
        }
        priceHighlights.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
    }

    // ── Smart Insights Generation ──
    const insights: InsightItem[] = []
    if (categories.length > 0) {
        const topCat = categories[0]
        insights.push({
            id: 'top-category',
            type: 'info',
            title: 'Categoria Dominante',
            description: `A categoria ${topCat.name} representou ${topCat.percent}% (R$ ${topCat.amount.toFixed(2).replace('.', ',')}) do seu orçamento este mês.`,
            icon: 'category',
        })
    }

    if (establishmentSpending.length > 0) {
        const topEst = establishmentSpending[0]
        insights.push({
            id: 'top-store',
            type: 'info',
            title: 'Estabelecimento Principal',
            description: `Seu local de compras mais frequentado foi ${topEst.name}, onde concentrou ${topEst.percent}% dos seus gastos.`,
            icon: 'store',
        })
    }

    if (momComparison && momComparison.hasPreviousMonth) {
        if (momComparison.spentPercent > 8) {
            insights.push({
                id: 'mom-warning',
                type: 'warning',
                title: 'Alerta de Aumento de Gastos',
                description: `Seus gastos aumentaram +${momComparison.spentPercent}% em relação a ${momComparison.previousMonthLabel} (+R$ ${momComparison.spentDiff.toFixed(2).replace('.', ',')}).`,
                icon: 'alert',
            })
        } else if (momComparison.spentPercent < -5) {
            insights.push({
                id: 'mom-success',
                type: 'success',
                title: 'Economia no Período',
                description: `Você economizou ${Math.abs(momComparison.spentPercent)}% em relação a ${momComparison.previousMonthLabel} (R$ ${Math.abs(momComparison.spentDiff).toFixed(2).replace('.', ',')} a menos).`,
                icon: 'sparkles',
            })
        }
    }

    if (topProducts.length > 0) {
        const topProd = topProducts[0]
        insights.push({
            id: 'top-product',
            type: 'info',
            title: 'Item Mais Comprado',
            description: `${topProd.name} foi o produto mais adquirido no período, com ${topProd.qty} unidades compradas.`,
            icon: 'trending',
        })
    }

    return {
        monthlySummary,
        momComparison,
        categories,
        topProducts,
        priceEvolution,
        quantityEvolution,
        totalEvolution,
        establishmentSpending,
        availableMonths: computedAvailableMonths,
        availableEstablishments,
        insights,
        priceHighlights: priceHighlights.slice(0, 4),
        productEstablishmentPrices,
        isLoading,
        filters,
        resolved: {
            month: resolvedMonth,
            product: resolvedProduct,
            category: resolvedCategory,
            establishment: resolvedEstablishment,
        },
        setFilter: () => {
            // Will be overridden in the hook
        },
    }
}

/* ─── Hook ──────────────────────────────────────────── */

export function useAnalysisData(
    providedReceipts?: Receipt[],
): AnalysisEngine {
    const shouldFetchReceipts = providedReceipts === undefined
    const { data: fetchedReceipts = [], isLoading } = useAllReceiptsQuery(shouldFetchReceipts)
    const receipts = providedReceipts ?? fetchedReceipts

    const [filters, setFiltersState] = useState<AnalysisFilters>({
        month: null,
        product: null,
        category: null,
        establishment: null,
    })

    const setFilter = useCallback(
        (name: keyof AnalysisFilters, value: string | null) => {
            setFiltersState((prev) => {
                const next = { ...prev, [name]: value }

                // Changing the month resets product filter
                if (name === 'month') {
                    next.product = null
                }

                // Changing category resets product filter
                if (name === 'category') {
                    next.product = null
                }

                return next
            })
        },
        [],
    )

    const engine = useMemo(
        () => buildAnalysisEngine(receipts, filters, shouldFetchReceipts && isLoading),
        [receipts, filters, shouldFetchReceipts, isLoading],
    )

    return {
        ...engine,
        setFilter,
    }
}