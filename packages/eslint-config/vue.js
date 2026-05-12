import base from './base.js'
import pluginVue from 'eslint-plugin-vue'
import parserVue from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

export default [
    ...base,
    {
        files: ['**/*.vue'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: parserVue,
            parserOptions: {
                parser: tsParser,
            },
        },
        plugins: { vue: pluginVue },
        rules: {
            ...pluginVue.configs['flat/recommended'].rules,
            'vue/multi-word-component-names': 'off',
        },
    },
    // Regras TS também valem pra .vue
    {
        files: ['**/*.vue'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
]