# @bosguega/eslint-config

Config compartilhada de ESLint para apps do monorepo.

## Uso

### React

```js
// eslint.config.js
import config from '@bosguega/eslint-config/react'

export default [
    ...config,
    // overrides opcionais
]
```

### Vue

```js
// eslint.config.js
import config from '@bosguega/eslint-config/vue'

export default [
    ...config,
    // overrides opcionais
]
```

## Peer dependencies

O app precisa ter `eslint` e `typescript` instalados.
O resto é resolvido pelo package.

## Estrutura

```
packages/eslint-config/
├── base.js   # regras universais (TS, best practices)
├── react.js  # base + React
├── vue.js    # base + Vue
└── package.json