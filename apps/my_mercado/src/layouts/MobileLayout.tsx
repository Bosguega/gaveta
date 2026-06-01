import { Suspense } from 'react'
import {
    Scan,
    History as HistoryIcon,
    ListChecks,
    Search,
    Settings as SettingsIcon,
} from 'lucide-react'
import type { AppTab } from '../types/ui'
import { TabSkeleton } from '../components/Skeleton'
import { lazyWithRetry } from '../utils/lazyWithRetry'

const ScannerTab = lazyWithRetry(() => import('../components/ScannerTab'))
const ShoppingListTab = lazyWithRetry(() => import('../components/ShoppingListTab'))
const HistoryTab = lazyWithRetry(() => import('../components/HistoryTab'))
const SearchTab = lazyWithRetry(() => import('../components/SearchTab'))
const SettingsTab = lazyWithRetry(() => import('../components/SettingsTab'))

interface MobileLayoutProps {
    tab: AppTab
    onTabChange: (tab: AppTab) => void
    onOpenAiConfig: () => void
}

export function MobileLayout({ tab, onTabChange, onOpenAiConfig }: MobileLayoutProps) {
    return (
        <div className="app-container">
            <header className="header">
                <div style={{ flex: 1 }}>
                    <h1>My Mercado</h1>
                    <p>Economize comparando preços.</p>
                </div>
            </header>

            <main style={{ minHeight: '60vh' }}>
                <Suspense fallback={<TabSkeleton />}>
                    {tab === 'scan' && <ScannerTab />}
                    {tab === 'shopping' && <ShoppingListTab />}
                    {tab === 'history' && <HistoryTab />}
                    {tab === 'search' && <SearchTab />}
                    {tab === 'settings' && <SettingsTab onOpenAiConfig={onOpenAiConfig} />}
                </Suspense>
            </main>

            <nav className="bottom-nav" role="navigation" aria-label="Navegação principal">
                <button
                    className={`nav-item ${tab === 'scan' ? 'active' : ''}`}
                    onClick={() => onTabChange('scan')}
                    aria-label="Escanear nota fiscal"
                    aria-current={tab === 'scan' ? 'page' : undefined}
                >
                    <Scan size={22} aria-hidden />
                    <span style={{ marginTop: '2px' }}>Escanear</span>
                </button>
                <button
                    className={`nav-item ${tab === 'shopping' ? 'active' : ''}`}
                    onClick={() => onTabChange('shopping')}
                    aria-label="Lista de compras"
                    aria-current={tab === 'shopping' ? 'page' : undefined}
                >
                    <ListChecks size={22} aria-hidden />
                    <span style={{ marginTop: '2px' }}>Lista</span>
                </button>
                <button
                    className={`nav-item ${tab === 'history' ? 'active' : ''}`}
                    onClick={() => onTabChange('history')}
                    aria-label="Histórico de compras"
                    aria-current={tab === 'history' ? 'page' : undefined}
                >
                    <HistoryIcon size={22} aria-hidden />
                    <span style={{ marginTop: '2px' }}>Histórico</span>
                </button>
                <button
                    className={`nav-item ${tab === 'search' ? 'active' : ''}`}
                    onClick={() => onTabChange('search')}
                    aria-label="Buscar preços"
                    aria-current={tab === 'search' ? 'page' : undefined}
                >
                    <Search size={22} aria-hidden />
                    <span style={{ marginTop: '2px' }}>Preços</span>
                </button>
                <button
                    className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
                    onClick={() => onTabChange('settings')}
                    aria-label="Configurações"
                    aria-current={tab === 'settings' ? 'page' : undefined}
                >
                    <SettingsIcon size={22} aria-hidden />
                    <span style={{ marginTop: '2px' }}>Ajustes</span>
                </button>
            </nav>
        </div>
    )
}