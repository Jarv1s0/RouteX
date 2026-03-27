const js = require('@eslint/js')
const react = require('eslint-plugin-react')
const { configs } = require('@electron-toolkit/eslint-config-ts')

module.exports = [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/extra/**']
  },

  js.configs.recommended,
  ...configs.recommended,

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
      ...react.configs.recommended.languageOptions
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
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: [
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
