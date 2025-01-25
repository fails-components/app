import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import topLevelAwait from 'vite-plugin-top-level-await'

const ENV_PREFIX = 'REACT_APP_'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build'
    },
    plugins: [
      react(),
      eslint({
        exclude: [
          'node_modules/**',
          '../jupyterfails/packages/jupyterreactedit/lib/**/*.js' // Adjust this path if needed
        ]
      }),
      topLevelAwait()
    ],
    worker: {
      format: 'module'
    },
    server: {
      port: 1001,
      hmr: {
        protocol: 'ws',
        port: 1001,
        host: 'localhost'
      },
      allowedHosts: ['.ngrok.app']
    },
    base: process?.env?.PUBLIC_URL ? process.env.PUBLIC_URL : '/static/app/',
    optimizeDeps: {},
    envPrefix: ENV_PREFIX
  }
})
