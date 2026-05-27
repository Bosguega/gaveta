# @bosguega/device-ui

**device-ui não é uma solução de responsividade.**

É um seletor de modo de UI que permite ter **layouts diferentes por plataforma** (mobile/tablet/desktop) enquanto compartilha a lógica do app.

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

O core só responde a uma pergunta: **"Qual modo foi escolhido?"**

## Estrutura

```
@bosguega/device-ui-core     Core agnóstico (TypeScript puro)
@bosguega/device-ui-vue      Adapter Vue (composables + componentes)
```

## Uso (Vue)

```vue
<script setup lang="ts">
import { useDeviceUI } from '@bosguega/device-ui-vue'
import MobileLayout from './MobileLayout.vue'
import DesktopLayout from './DesktopLayout.vue'

const { mode } = useDeviceUI()
</script>

<template>
  <MobileLayout v-if="mode === 'mobile'" />
  <DesktopLayout v-else />
</template>
```

### Toolbar de desenvolvimento

Adicione `DeviceToolbar` em algum lugar do app (ou no `App.vue`):

```vue
<script setup lang="ts">
import { DeviceToolbar } from '@bosguega/device-ui-vue'
</script>

<template>
  <DeviceToolbar />
  <router-view />
</template>
```

Ela aparece automaticamente apenas em `import.meta.env.DEV`.

### Frame de viewport opcional

```vue
<script setup lang="ts">
import { DeviceFrame } from '@bosguega/device-ui-vue'
</script>

<template>
  <DeviceFrame>
    <MobileLayout />
  </DeviceFrame>
</template>
```

Quando o modo é `mobile`, o conteúdo é limitado a 375px centralizado.  
Quando `tablet`, a 768px.  
Quando `desktop` ou `auto`, sem restrição.

Os valores podem ser customizados via prop `widths`:

```vue
<DeviceFrame :widths="{ mobile: 320, tablet: 600 }">
  <slot />
</DeviceFrame>
```

## O que NÃO está no escopo

- Detecção automática de dispositivo
- Breakpoints CSS / responsividade
- Emulação de navegador / user-agent
- Sistema de design
- Editor visual
- Plugins / extensões
- Suporte a SSR (o core usa localStorage)
- Animações, transições, safe areas, orientation

O package faz uma coisa só. E faz pequena.

## Desenvolvimento

```bash
pnpm install
pnpm --filter @bosguega/device-ui-core build
pnpm --filter @bosguega/device-ui-vue build
```

## Licença

MIT