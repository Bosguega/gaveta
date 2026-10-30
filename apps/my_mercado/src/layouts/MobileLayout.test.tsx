import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobileLayout } from './MobileLayout'
import { useScannerStore } from '../stores/useScannerStore'

vi.mock('../utils/lazyWithRetry', () => ({
  lazyWithRetry: () => () => <div data-testid="lazy-tab-content" />,
}))

describe('MobileLayout', () => {
  beforeEach(() => {
    act(() => {
      useScannerStore.getState().resetScannerState()
    })
  })

  it('exibe o menu inferior normalmente quando isScannerEntryActive é false na aba scan', () => {
    render(<MobileLayout tab="scan" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)

    const nav = screen.getByRole('navigation', { name: /Navegação principal/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Escanear nota fiscal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Histórico de compras/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buscar preços/i })).toBeInTheDocument()
  })

  it('oculta o menu inferior quando abrir a tela com as entradas para escanear', () => {
    act(() => {
      useScannerStore.getState().setIsScannerEntryActive(true)
    })

    render(<MobileLayout tab="scan" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)

    expect(screen.queryByRole('navigation', { name: /Navegação principal/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Escanear nota fiscal/i })).not.toBeInTheDocument()
  })

  it('exibe o menu inferior novamente quando sair da tela de entradas', () => {
    const { rerender } = render(<MobileLayout tab="scan" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)

    // Abre tela de entradas
    act(() => {
      useScannerStore.getState().setIsScannerEntryActive(true)
    })
    rerender(<MobileLayout tab="scan" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)
    expect(screen.queryByRole('navigation', { name: /Navegação principal/i })).not.toBeInTheDocument()

    // Sai da tela de entradas (ex: ao clicar em voltar)
    act(() => {
      useScannerStore.getState().setIsScannerEntryActive(false)
    })
    rerender(<MobileLayout tab="scan" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: /Navegação principal/i })).toBeInTheDocument()
  })

  it('mantém o menu inferior visível em outras abas mesmo se isScannerEntryActive fosse true', () => {
    act(() => {
      useScannerStore.getState().setIsScannerEntryActive(true)
    })

    render(<MobileLayout tab="history" onTabChange={vi.fn()} onOpenAiConfig={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: /Navegação principal/i })).toBeInTheDocument()
  })
})
