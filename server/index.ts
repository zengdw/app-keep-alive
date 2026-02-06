import { Environment } from './types/index.js';
import { DatabaseUtils } from './utils/database.js';
import { CronService } from './services/cron.service.js';

export default {
	async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);
			
			// 健康检查端点
			if (url.pathname === '/api/health') {
				const healthCheck = await DatabaseUtils.healthCheck(env);
				return new Response(JSON.stringify({
					status: healthCheck.healthy ? 'healthy' : 'unhealthy',
					timestamp: new Date().toISOString(),
					environment: env.ENVIRONMENT,
					database: healthCheck.details,
					errors: healthCheck.errors
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
		console.log('Cron触发器执行于:', new Date().toISOString());
		
		try {
			// 处理所有定时任务
			const result = await CronService.handleScheduledEvent(env);
			
			if (result.success) {
				console.log(`定时任务处理成功，执行了 ${result.processed} 个任务`);
			} else {
				console.error('定时任务处理失败:', result.errors);
			}
			
			if (result.errors.length > 0) {
				console.warn('部分任务执行出错:', result.errors);
			}
		} catch (error) {
			console.error('定时任务处理异常:', error);
		}
	}
} satisfies ExportedHandler<Environment>;
