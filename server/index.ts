import { Environment } from './types';
import { createDatabaseService } from './utils/database';

export default {
	async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);
			
			// 创建数据库服务
			const db = createDatabaseService(env);
			
			// 健康检查端点
			if (url.pathname === '/api/health') {
				const isHealthy = await db.healthCheck();
				return new Response(JSON.stringify({
					status: isHealthy ? 'healthy' : 'unhealthy',
					timestamp: new Date().toISOString(),
					environment: env.ENVIRONMENT
				}), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// API路由
			if (url.pathname.startsWith("/api/")) {
				return new Response(JSON.stringify({
					message: 'STMS API Server',
					version: '1.0.0',
					timestamp: new Date().toISOString(),
					path: url.pathname
				}), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// 404 for other routes
			return new Response(null, { status: 404 });
		} catch (error) {
			console.error('Worker error:', error);
			return new Response(JSON.stringify({
				error: '服务器内部错误',
				message: error instanceof Error ? error.message : '未知错误'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	},

	async scheduled(controller: ScheduledController, env: Environment, ctx: ExecutionContext): Promise<void> {
		console.log('Cron trigger executed at:', new Date().toISOString());
		// TODO: 实现定时任务处理逻辑
	}
} satisfies ExportedHandler<Environment>;
