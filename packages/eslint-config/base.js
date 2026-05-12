import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

const tsFiles = ['**/*.{ts,tsx,mts,cts}']

export default [
    { ignores: ['dist', 'build', 'coverage', 'node_modules', '.turbo', '.vite', '.output', '.vercel', '*.min.js'] },

    // JS vanilla
    {
        files: ['**/*.{js,jsx,mjs,cjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
    },

    // TS
    ...tseslint.configs.recommended.map(c => ({ ...c, files: tsFiles })),
    {
        files: tsFiles,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            'no-debugger': 'warn',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-undef': 'off',
        },
    },
]