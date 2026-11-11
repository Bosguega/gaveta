import { Cloud, Cpu } from 'lucide-react'
import type { AIMode } from '@bosguega/ai-core'

interface AiModeIndicatorProps {
    mode: AIMode
    provider: string
    hasAiConfig: boolean
    onClick: () => void
}

export function AiModeIndicator({ mode, provider, hasAiConfig, onClick }: AiModeIndicatorProps) {
    const isLocal = mode === 'local'
    const label = hasAiConfig ? (isLocal ? 'IA Local' : 'IA Online') : 'IA não configurada'
    const detail = hasAiConfig ? provider : 'Configure para começar'
    const Icon = isLocal ? Cpu : Cloud
    const accent = isLocal ? '#22c55e' : '#60a5fa'

    return (
        <button
            type="button"
            onClick={onClick}
            title={`${label} — ${detail}. Clique para configurar.`}
            aria-label={`Configuração de IA: ${label}, ${detail}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.7rem',
                borderRadius: '999px',
                border: `1px solid ${accent}55`,
                background: `${accent}14`,
                color: 'var(--text-color, #e2e8f0)',
                cursor: 'pointer',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
            }}
        >
            <Icon size={16} color={accent} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.7, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {detail}
                </span>
            </span>
        </button>
    )
}
