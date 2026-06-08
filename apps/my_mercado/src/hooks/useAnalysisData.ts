import { useMemo } from 'react'
import { useAllReceiptsQuery } from './queries/useReceiptsQuery'
import type { Receipt, ReceiptItem } from '../types/domain'
import { parseBRL } from '../utils/currency'
import { calculateItemTotal } from '../utils/analytics'

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

export interface AnalysisData {
    /** Resumo do mês selecionado */
    monthlySummary: MonthlySummary | null
    /** Gastos por categoria no mês */
    categories: CategorySummary[]
    /** Produtos mais comprados no mês */
    topProducts: ProductRank[]
    /** Evolução de preços do produto mais frequente do mês */
    priceEvolution: MonthlyTotal[]
    /** Evolução de gastos totais por mês */
    totalEvolution: MonthlyTotal[]
    /** Lista de meses disponíveis { value: "YYYY-MM", label: "Junho/2026" } */
    availableMonths: { value: string; label: string }[]
    /** Se os dados estão carregando */
    isLoading: boolean
    /** Nome do produto usado na evolução de preços */
    priceEvolutionProduct: string | null
}

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

export function buildAnalysisData(
    receipts: Receipt[],
    selectedMonth: string | null,
    isLoading = false,
    selectedPriceProduct: string | null = null,
): AnalysisData {
    const receiptDates: { yearMonth: string; receipt: Receipt }[] = []

    for (const receipt of receipts) {
        const yearMonth = getYearMonth(receipt.date)
        if (yearMonth) {
            receiptDates.push({ yearMonth, receipt })
        }
    }

    const uniqueMonths = [...new Set(receiptDates.map((item) => item.yearMonth))].sort()
    const availableMonths = uniqueMonths.map((yearMonth) => ({
        value: yearMonth,
        label: formatMonthLabel(yearMonth),
    }))

    const effectiveMonth =
        selectedMonth && uniqueMonths.includes(selectedMonth)
            ? selectedMonth
            : uniqueMonths[uniqueMonths.length - 1] ?? getCurrentYearMonth()

    const monthReceipts = receiptDates
        .filter((item) => item.yearMonth === effectiveMonth)
        .map((item) => item.receipt)

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
    const monthlySummary: MonthlySummary = {
        totalSpent,
        totalItems,
        totalProductLines: allItems.length,
        totalReceipts,
        avgTicket: totalReceipts > 0 ? totalSpent / totalReceipts : 0,
        periodLabel: formatMonthLabel(effectiveMonth),
    }

    const categoryMap = new Map<string, number>()
    for (const item of allItems) {
        const category = item.category || 'Sem categoria'
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

    const productMap = new Map<string, { qty: number; total: number }>()
    for (const item of allItems) {
        const key = getProductKey(item)
        const current = productMap.get(key) || { qty: 0, total: 0 }
        current.qty += getCountableQty(item)
        current.total += calculateItemTotal(item, parseBRL)
        productMap.set(key, current)
    }

    const topProducts = [...productMap.entries()]
        .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
        .sort((a, b) => b.qty - a.qty || b.total - a.total)

    const selectedProductExists =
        selectedPriceProduct !== null &&
        topProducts.some((product) => product.name === selectedPriceProduct)
    const topProductName = selectedProductExists
        ? selectedPriceProduct
        : topProducts[0]?.name ?? null
    const priceEvolution: MonthlyTotal[] = []

    if (topProductName) {
        for (const yearMonth of uniqueMonths) {
            let totalUnitPrice = 0
            let count = 0

            for (const { receipt } of receiptDates.filter((item) => item.yearMonth === yearMonth)) {
                for (const item of receipt.items ?? []) {
                    if (getProductKey(item) === topProductName) {
                        totalUnitPrice += parseBRL(item.price)
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
        monthlySummary: totalReceipts > 0 ? monthlySummary : null,
        categories,
        topProducts,
        priceEvolution,
        totalEvolution,
        availableMonths,
        isLoading,
        priceEvolutionProduct: topProductName,
    }
}

/**
 * Hook que processa receipts do banco e retorna dados agregados para análise.
 * @param selectedMonth - Mês selecionado no formato "YYYY-MM" (ex: "2026-06")
 * @param providedReceipts - Receipts opcionais para analisar um recorte já filtrado.
 */
export function useAnalysisData(
    selectedMonth: string | null,
    providedReceipts?: Receipt[],
    selectedPriceProduct?: string | null,
): AnalysisData {
    const shouldFetchReceipts = providedReceipts === undefined
    const { data: fetchedReceipts = [], isLoading } = useAllReceiptsQuery(shouldFetchReceipts)
    const receipts = providedReceipts ?? fetchedReceipts

    return useMemo(
        () => buildAnalysisData(
            receipts,
            selectedMonth,
            shouldFetchReceipts && isLoading,
            selectedPriceProduct ?? null,
        ),
        [receipts, selectedMonth, shouldFetchReceipts, isLoading, selectedPriceProduct],
    )
}
