# @bosguega/device-mode-core

**device-mode-core não é uma solução de responsividade.**

É um state manager minimalista que permite ter **layouts diferentes por plataforma** (mobile/tablet/desktop) enquanto compartilha a lógica do app.

```
MobileUI v-if="mode === 'mobile'" />
DesktopUI v-else />
```

## Filosofia

- Duas UIs diferentes usando o mesmo cérebro
- Lógica compartilhada, composição visual independente
- 0 detecção automática de dispositivo
- 0 breakpoints no core
- 0 iframe, 0 emulação
- 0 dependências de framework

O core só responde a uma pergunta: **"Qual modo foi escolhido?"**

## Instalação

```bash
pnpm add @bosguega/device-mode-core
```

## API

```ts
import { createDeviceStore } from '@bosguega/device-mode-core'
import type { DeviceMode } from '@bosguega/device-mode-core'

const store = createDeviceStore()

store.getMode()              // 'auto' | 'mobile' | 'tablet' | 'desktop'
store.setMode('mobile')      // persiste em localStorage automaticamente

store.subscribe((mode) => {
  console.log('modo mudou:', mode)
})                           // retorna unsubscribe()

store.destroy()              // limpa listeners
```

O modo `'auto'` é apenas um valor — o core não o interpreta. Quem define o que `auto` significa é o consumidor (ex: `matchMedia` no navegador).

## Opções

```ts
createDeviceStore({
  defaultMode: 'desktop',              // padrão: 'auto'
  storageKey: '@meu-app/device-mode',  // padrão: '@bosguega/device-mode:mode'
})
```

> **⚠️ Colisão de localStorage:** Se múltiplos apps rodam no mesmo domínio (ex: subpaths do GitHub Pages), todos compartilham o mesmo `localStorage`. Sempre defina um `storageKey` único por app para evitar que um sobrescreva o modo do outro.

---

## Uso em React

Crie um hook de ~15 linhas no seu projeto:

```tsx
// hooks/useDeviceUI.ts
import { createDeviceStore } from '@bosguega/device-mode-core'
import { useState, useEffect } from 'react'

const store = createDeviceStore({ storageKey: '@meu-app/device-mode' })

export function useDeviceUI() {
  const [mode, setMode] = useState(store.getMode())

  useEffect(() => {
    const unsub = store.subscribe(setMode)
    return unsub
  }, [])

  return {
    mode,
    setMode: store.setMode,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tablet',
    isDesktop: mode === 'desktop',
    isAuto: mode === 'auto',
  }
}
```

```tsx
// App.tsx
import { useDeviceUI } from './hooks/useDeviceUI'
import MobileLayout from './layouts/MobileLayout'
import DesktopLayout from './layouts/DesktopLayout'

function App() {
  const { mode } = useDeviceUI()

  return mode === 'desktop' || mode === 'tablet'
    ? <DesktopLayout />
    : <MobileLayout />
}
```

### Toolbar DEV (opcional)

```tsx
function DeviceToolbar() {
  const { mode, setMode } = useDeviceUI()
  if (!import.meta.env.DEV) return null

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', gap: 4, padding: 8, background: '#1e1e1e', borderRadius: 8, zIndex: 9999 }}>
      {(['mobile', 'tablet', 'desktop', 'auto'] as const).map(m => (
        <button key={m} onClick={() => setMode(m)}
          style={{ background: mode === m ? '#3b82f6' : 'transparent', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
          {m === 'mobile' ? '📱' : m === 'tablet' ? '📲' : m === 'desktop' ? '🖥' : '🔄'}
        </button>
      ))}
    </div>
  )
}
```

### Frame de viewport (opcional)

```tsx
function DeviceFrame({ widths = { mobile: 375, tablet: 768 }, children }) {
  const { mode } = useDeviceUI()
  const maxWidth = (mode === 'auto' || mode === 'desktop') ? null : widths[mode]

  if (!maxWidth) return <>{children}</>

  return (
    <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>
      {children}
    </div>
  )
}
```

---

## Uso em Vue

```ts
// composables/useDeviceUI.ts
import { createDeviceStore } from '@bosguega/device-mode-core'
import { ref, computed, onMounted, onUnmounted } from 'vue'

const store = createDeviceStore({ storageKey: '@meu-app/device-mode' })

export function useDeviceUI() {
  const mode = ref(store.getMode())
  let unsub: (() => void) | null = null

  onMounted(() => { unsub = store.subscribe((m) => { mode.value = m }) })
  onUnmounted(() => { unsub?.() })

  return {
    mode,
    setMode: store.setMode,
    isMobile: computed(() => mode.value === 'mobile'),
    isTablet: computed(() => mode.value === 'tablet'),
    isDesktop: computed(() => mode.value === 'desktop'),
    isAuto: computed(() => mode.value === 'auto'),
  }
}
```

```vue
<script setup lang="ts">
import { useDeviceUI } from './composables/useDeviceUI'
import MobileLayout from './MobileLayout.vue'
import DesktopLayout from './DesktopLayout.vue'

const { mode } = useDeviceUI()
</script>

<template>
  <MobileLayout v-if="mode === 'mobile'" />
  <DesktopLayout v-else />
</template>
```

Exemplos de `DeviceToolbar.vue` e `DeviceFrame.vue` seguem o mesmo padrão — componentes burros que usam o composable.

---

## O que NÃO está no escopo

- Detecção automática de dispositivo
- Breakpoints CSS / responsividade
- Emulação de navegador / user-agent
- Sistema de design
- Editor visual
- Plugins / extensões
- Suporte a SSR (o core usa localStorage)
- Animações, transições, safe areas, orientation
- Adapters específicos por framework (copie o snippet)

O package faz uma coisa só. E faz pequena.

## Desenvolvimento

```bash
pnpm install
pnpm --filter @bosguega/device-mode-core build
```

## Licença

MIT