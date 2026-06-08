import { useMemo } from 'react'
import { useAllReceiptsQuery } from './queries/useReceiptsQuery'
import type { Receipt, ReceiptItem } from '../types/domain'

// =========================
// Tipos de retorno
// =========================

export interface MonthlySummary {
    totalSpent: number
    totalItems: number
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

// =========================
// Cores para categorias
// =========================

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

// =========================
// Utilitários de data
// =========================

function getYearMonth(dateStr: string): string | null {
    if (!dateStr) return null

    // Tentar formato ISO "YYYY-MM-DD"
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}`
    }

    // Tentar formato BR "DD/MM/YYYY ..."
    const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}`
    }

    // Fallback para Date()
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    return null
}

function formatMonthLabel(yearMonth: string): string {
    const [year, month] = yearMonth.split('-')
    const m = parseInt(month, 10)
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    return `${months[m - 1]}/${year}`
}

function formatShortMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-')
    const m = parseInt(month, 10)
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${months[m - 1]}/${year.slice(2)}`
}

function getCurrentYearMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// =========================
// Hook principal
// =========================

/**
 * Hook que processa receipts do banco e retorna dados agregados para análise.
 * @param selectedMonth - Mês selecionado no formato "YYYY-MM" (ex: "2026-06")
 */
export function useAnalysisData(selectedMonth: string | null): AnalysisData {
    const { data: receipts = [], isLoading } = useAllReceiptsQuery(true)

    return useMemo(() => {
        // Extrair todos os meses disponíveis dos receipts
        const receiptDates: { yearMonth: string; receipt: Receipt }[] = []
        for (const r of receipts) {
            const ym = getYearMonth(r.date)
            if (ym) {
                receiptDates.push({ yearMonth: ym, receipt: r })
            }
        }

        // Meses únicos ordenados
        const uniqueMonths = [...new Set(receiptDates.map((x) => x.yearMonth))].sort()
        const availableMonths = uniqueMonths.map((ym) => ({
            value: ym,
            label: formatMonthLabel(ym),
        }))

        // Determinar o mês efetivo: se o selectedMonth for válido e existe nos dados, usa ele.
        // Senão, usa o último mês com dados. Se não houver dados, usa o mês atual.
        const effectiveMonth =
            selectedMonth && uniqueMonths.includes(selectedMonth)
                ? selectedMonth
                : availableMonths.length > 0
                    ? uniqueMonths[uniqueMonths.length - 1]
                    : getCurrentYearMonth()

        // Filtrar receipts do mês efetivo
        const monthReceipts = receiptDates
            .filter((x) => x.yearMonth === effectiveMonth)
            .map((x) => x.receipt)

        // --- Resumo Mensal ---
        let totalSpent = 0
        let totalItems = 0
        const allItems: ReceiptItem[] = []

        for (const receipt of monthReceipts) {
            if (receipt.items) {
                for (const item of receipt.items) {
                    totalSpent += item.total ?? item.price * item.quantity
                    totalItems += item.quantity
                    allItems.push(item)
                }
            }
        }

        const totalReceipts = monthReceipts.length
        const avgTicket = totalReceipts > 0 ? totalSpent / totalReceipts : 0

        const monthlySummary: MonthlySummary = {
            totalSpent,
            totalItems,
            totalReceipts,
            avgTicket,
            periodLabel: formatMonthLabel(effectiveMonth),
        }

        // --- Categorias ---
        const categoryMap = new Map<string, number>()
        for (const item of allItems) {
            const cat = item.category || 'Sem categoria'
            const value = item.total ?? item.price * item.quantity
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + value)
        }

        const categoryEntries = [...categoryMap.entries()]
            .map(([name, amount]) => ({
                name,
                amount,
                percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
                color: getCategoryColor(name),
            }))
            .sort((a, b) => b.amount - a.amount)

        // --- Produtos Mais Comprados ---
        const productMap = new Map<string, { qty: number; total: number }>()
        for (const item of allItems) {
            const key = item.normalized_name || item.name
            const current = productMap.get(key) || { qty: 0, total: 0 }
            current.qty += item.quantity
            current.total += item.total ?? item.price * item.quantity
            productMap.set(key, current)
        }

        const topProducts: ProductRank[] = [...productMap.entries()]
            .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
            .sort((a, b) => b.qty - a.qty)

        // --- Produto mais frequente (para evolução de preços) ---
        const topProductName = topProducts.length > 0 ? topProducts[0].name : null

        // --- Evolução de Preços do produto mais frequente ---
        const priceEvolution: MonthlyTotal[] = []
        if (topProductName) {
            for (const ym of uniqueMonths) {
                const monthReceiptsForProduct = receiptDates.filter((x) => x.yearMonth === ym)
                let totalPrice = 0
                let count = 0
                for (const { receipt } of monthReceiptsForProduct) {
                    if (receipt.items) {
                        for (const item of receipt.items) {
                            const key = item.normalized_name || item.name
                            if (key === topProductName) {
                                totalPrice += item.price
                                count++
                            }
                        }
                    }
                }
                if (count > 0) {
                    priceEvolution.push({
                        month: formatShortMonth(ym),
                        label: `R$ ${(totalPrice / count).toFixed(2).replace('.', ',')}`,
                        total: totalPrice / count,
                    })
                }
            }
        }

        // --- Evolução de Gastos Totais por Mês ---
        const totalEvolution: MonthlyTotal[] = []
        for (const ym of uniqueMonths) {
            const monthReceiptsTotal = receiptDates.filter((x) => x.yearMonth === ym)
            let monthTotal = 0
            for (const { receipt } of monthReceiptsTotal) {
                if (receipt.items) {
                    for (const item of receipt.items) {
                        monthTotal += item.total ?? item.price * item.quantity
                    }
                }
            }
            totalEvolution.push({
                month: formatShortMonth(ym),
                label: `R$ ${monthTotal.toFixed(2).replace('.', ',')}`,
                total: monthTotal,
            })
        }

        return {
            monthlySummary: totalReceipts > 0 ? monthlySummary : null,
            categories: categoryEntries,
            topProducts,
            priceEvolution,
            totalEvolution,
            availableMonths,
            isLoading,
            priceEvolutionProduct: topProductName,
        }
    }, [receipts, selectedMonth, isLoading])
}