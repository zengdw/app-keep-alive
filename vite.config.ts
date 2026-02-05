import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare()
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	server: {
		port: 5173,
		proxy: {
			// 代理API请求到Cloudflare Worker开发服务器
			'/api': {
				target: 'http://localhost:8787',
				changeOrigin: true,
				secure: false
			}
		}
	},
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		sourcemap: true
	}
})
