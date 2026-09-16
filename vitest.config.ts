import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Solo las funciones puras: lo que habla con Firebase o con Next se prueba
// de punta a punta, no con dobles.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts'],
  },
})
