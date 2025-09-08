/* eslint.config.mjs — API */
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // 共通の除外
  { ignores: ['node_modules', 'dist'] },

  // JSの基本推奨
  js.configs.recommended,

  // Node環境のグローバル（process など）を有効化
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // TypeScriptファイルに適用
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      // TypeScriptではno-undefを無効化するのが一般的（型チェックが担保するため）
      'no-undef': 'off',
    },
  },
];
