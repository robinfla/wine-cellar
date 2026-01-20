import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Enforce no semicolons (per AGENTS.md)
    'semi': ['error', 'never'],
    // Enforce single quotes (per AGENTS.md)
    'quotes': ['error', 'single', { avoidEscape: true }],
    // Enforce trailing commas in multiline (per AGENTS.md)
    'comma-dangle': ['error', 'always-multiline'],
    // Enforce 2-space indentation (per AGENTS.md)
    'indent': ['error', 2],
    // Allow console in server-side code and warn elsewhere
    'no-console': 'warn',
    // Vue specific
    'vue/multi-word-component-names': 'off',
    'vue/no-multiple-template-root': 'off',
    // Relax some TypeScript rules for gradual adoption
    '@typescript-eslint/no-explicit-any': 'warn',
  },
})
