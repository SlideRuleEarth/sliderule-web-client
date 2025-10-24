/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    parser: '@typescript-eslint/parser',
    sourceType: 'module',
    project: ['./tsconfig.app.json', './tsconfig.vitest.json'],
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.vue']
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Catch async functions called without await
    '@typescript-eslint/no-floating-promises': 'error',
    // Warn about async functions that don't use await
    'require-await': 'warn',
    // Require functions that return promises to be marked async
    '@typescript-eslint/promise-function-async': 'warn',
    // Allow unused vars that start with _
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }]
  },
  overrides: [
    {
      files: ['tests/**/*.{ts,tsx,js,jsx}'],
      env: {
        node: true
      }
    }
  ]
}
