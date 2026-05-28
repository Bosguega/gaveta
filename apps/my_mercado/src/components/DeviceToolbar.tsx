import { useDeviceUI } from '../hooks/useDeviceUI'

export function DeviceToolbar() {
    const { mode, setMode } = useDeviceUI()
    const isDev = import.meta.env.DEV

    if (!isDev) return null

    const buttons: { mode: 'mobile' | 'tablet' | 'desktop' | 'auto'; icon: string; label: string }[] = [
        { mode: 'mobile', icon: '📱', label: 'Mobile (375px)' },
        { mode: 'tablet', icon: '📲', label: 'Tablet (768px)' },
        { mode: 'desktop', icon: '🖥', label: 'Desktop' },
        { mode: 'auto', icon: '🔄', label: 'Auto' },
    ]

    return (
        <div style={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            display: 'flex',
            gap: 4,
            padding: 8,
            background: '#1e1e1e',
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 9999,
        }}>
            {buttons.map((btn) => (
                <button
                    key={btn.mode}
                    onClick={() => setMode(btn.mode)}
                    title={btn.label}
                    style={{
                        padding: '6px 10px',
                        border: `1px solid ${mode === btn.mode ? '#3b82f6' : '#444'}`,
                        borderRadius: 6,
                        background: mode === btn.mode ? '#3b82f6' : 'transparent',
                        color: mode === btn.mode ? '#fff' : '#ccc',
                        fontSize: 16,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    {btn.icon}
                </button>
            ))}
        </div>
    )
}