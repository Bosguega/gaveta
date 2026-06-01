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

interface DesktopLayoutProps {
    tab: AppTab
    onTabChange: (tab: AppTab) => void
    onOpenAiConfig: () => void
}

const tabs: { key: AppTab; icon: React.ReactNode; label: string }[] = [
    { key: 'scan', icon: <Scan size={20} />, label: 'Escanear' },
    { key: 'shopping', icon: <ListChecks size={20} />, label: 'Lista' },
    { key: 'history', icon: <HistoryIcon size={20} />, label: 'Histórico' },
    { key: 'search', icon: <Search size={20} />, label: 'Preços' },
    { key: 'settings', icon: <SettingsIcon size={20} />, label: 'Ajustes' },
]

export function DesktopLayout({ tab, onTabChange, onOpenAiConfig }: DesktopLayoutProps) {
    return (
        <div className="desktop-layout">
            <aside className="desktop-sidebar">
                <div className="desktop-sidebar-header">
                    <h1>My Mercado</h1>
                    <p>Economize comparando preços.</p>
                </div>
                <nav className="desktop-nav">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            className={`desktop-nav-item ${tab === t.key ? 'active' : ''}`}
                            onClick={() => onTabChange(t.key)}
                        >
                            {t.icon}
                            <span>{t.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="desktop-content">
                <Suspense fallback={<TabSkeleton />}>
                    {tab === 'scan' && <ScannerTab />}
                    {tab === 'shopping' && <ShoppingListTab />}
                    {tab === 'history' && <HistoryTab />}
                    {tab === 'search' && <SearchTab />}
                    {tab === 'settings' && <SettingsTab onOpenAiConfig={onOpenAiConfig} />}
                </Suspense>
            </main>
        </div>
    )
}