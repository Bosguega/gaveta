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

export interface AnalysisFilters {
    /** "YYYY-MM" ou null (null = último mês disponível) */
    month: string | null
    /** Nome exato do produto ou null */
    product: string | null
    /** Nome exato da categoria ou null (null = todas) */
    category: string | null
}

export interface AnalysisResolved {
    /** Mês efetivamente usado (sempre "YYYY-MM" válido dentro de availableMonths) */
    month: string
    /** Produto selecionado que existe no mês atual, ou null se inválido/não selecionado */
    product: string | null
    /** Categoria selecionada que existe no mês atual, ou null se inválida/não selecionada */
    category: string | null
}

export interface AnalysisEngine {
    monthlySummary: MonthlySummary | null
    categories: CategorySummary[]
    topProducts: ProductRank[]
    priceEvolution: MonthlyTotal[]
    totalEvolution: MonthlyTotal[]
    establishmentSpending: EstablishmentSpending[]
    availableMonths: { value: string; label: string }[]
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

    const monthReceipts = receiptDates
        .filter((item) => item.yearMonth === resolvedMonth)
        .map((item) => item.receipt)

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
        // Defesa em profundidade: normaliza categoria para a grafia canonica
        // mesmo que algum caminho de leitura nao tenha normalizado.
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

    // ── Resolved category (NO silent fallback) ──
    const requestedCategory = filters.category ?? null
    const resolvedCategory =
        requestedCategory !== null && categories.some((c) => c.name === requestedCategory)
            ? requestedCategory
            : null

    // ── Products ranking (filtrado pela categoria selecionada, se houver) ──
    const productMap = new Map<string, { qty: number; total: number }>()
    for (const item of allItems) {
        // Se uma categoria esta selecionada, ignora items de outras categorias
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

    // ── Resolved product (NO silent fallback) ──
    const resolvedProduct =
        filters.product !== null && topProducts.some((p) => p.name === filters.product)
            ? filters.product
            : null

    // ── Price evolution (only when a product is resolved) ──
    const priceEvolution: MonthlyTotal[] = []

    if (resolvedProduct) {
        for (const yearMonth of uniqueMonths) {
            let totalUnitPrice = 0
            let count = 0

            for (const { receipt } of receiptDates.filter((item) => item.yearMonth === yearMonth)) {
                for (const item of receipt.items ?? []) {
                    if (getProductKey(item) === resolvedProduct) {
                        totalUnitPrice += parseBRL(item.paid_price ?? item.price)
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
            }
        }
    }

    // ── Total evolution ──
    const totalEvolution = uniqueMonths.map((yearMonth) => {
        let monthTotal = 0

        for (const { receipt } of receiptDates.filter((item) => item.yearMonth === yearMonth)) {
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

    return {
        monthlySummary,
        categories,
        topProducts,
        priceEvolution,
        totalEvolution,
        establishmentSpending,
        availableMonths: computedAvailableMonths,
        isLoading,
        filters,
        resolved: {
            month: resolvedMonth,
            product: resolvedProduct,
            category: resolvedCategory,
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
    })

    const setFilter = useCallback(
        (name: keyof AnalysisFilters, value: string | null) => {
            setFiltersState((prev) => {
                const next = { ...prev, [name]: value }

                // Changing the month resets the product filter
                if (name === 'month') {
                    next.product = null
                }

                // Changing the category also resets the product filter
                // (o produto filtrado pode nao existir na nova categoria)
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