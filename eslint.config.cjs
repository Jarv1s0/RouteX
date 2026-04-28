const js = require('@eslint/js')
const react = require('eslint-plugin-react')
const tseslint = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const reactLanguageOptions = react.configs.recommended.languageOptions ?? {}

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-tauri/**',
      '**/out/**',
      '**/extra/**',
      '**/.tmp-*/**'
    ]
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx,cjs,mjs,cts,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        AbortController: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        FormData: 'readonly',
        Image: 'readonly',
        MutationObserver: 'readonly',
        Notification: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        __dirname: 'readonly',
        cancelAnimationFrame: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        module: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        process: 'readonly',
        queueMicrotask: 'readonly',
        require: 'readonly',
        requestAnimationFrame: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
        window: 'readonly'
      }
    }
  },

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: react
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    languageOptions: {
      ...reactLanguageOptions,
      globals: {
        ...(reactLanguageOptions.globals ?? {}),
        AbortController: 'readonly',
        CustomEvent: 'readonly',
        FormData: 'readonly',
        Image: 'readonly',
        MutationObserver: 'readonly',
        Notification: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        cancelAnimationFrame: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        crypto: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        queueMicrotask: 'readonly',
        requestAnimationFrame: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
        window: 'readonly'
      }
    }
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off'
    }
  },

  {
    files: ['**/*.cjs', '**/*.mjs', '**/tailwind.config.js', '**/postcss.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },

  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },

  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: [
      'src/renderer/src/api/desktop.ts',
      'src/renderer/src/utils/ipc-core.ts',
      'src/renderer/src/utils/ipc-channels.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@renderer/utils/ipc',
              message: '请改为按领域引用对应的 *-ipc 模块。'
            }
          ],
          patterns: [
            {
              group: ['**/utils/ipc', '**/utils/ipc.ts'],
              message: '请改为按领域引用对应的 *-ipc 模块。'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportExpression[source.type='Literal'][source.value='@renderer/utils/ipc']",
          message: '请改为动态导入对应的 *-ipc 模块。'
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.property.name='electron'][property.name='ipcRenderer']",
          message: '请改用 @renderer/utils/ipc-channels 或对应的 *-ipc 封装。'
        }
      ]
    }
  }
]
