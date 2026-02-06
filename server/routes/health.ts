import { Environment, ApiResponse } from '../types/index.js';
import { DatabaseUtils } from '../utils/database.js';

/**
 * 健康检查路由处理器
 */
export class HealthRoutes {
  /**
   * 健康检查端点
   */
  static async check(request: Request, env: Environment): Promise<Response> {
    try {
      const healthCheck = await DatabaseUtils.healthCheck(env);
      
      const response: ApiResponse = {
        success: healthCheck.healthy,
        data: {
          status: healthCheck.healthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT,
          database: healthCheck.details,
          errors: healthCheck.errors
        }
      };

      return new Response(JSON.stringify(response), {
        status: healthCheck.healthy ? 200 : 503,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : '未知错误'
        }
      } as ApiResponse), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 系统状态端点
   */
  static async status(request: Request, env: Environment): Promise<Response> {
    try {
      // 获取任务统计
      const tasksResult = await DatabaseUtils.getAllTasks(env);
      const tasks = tasksResult.data || [];
      
      const activeTasks = tasks.filter(t => t.enabled).length;
      const totalTasks = tasks.length;
      const keepaliveTasks = tasks.filter(t => t.type === 'keepalive').length;
      const notificationTasks = tasks.filter(t => t.type === 'notification').length;

      // 获取最近的执行日志
      const logsResult = await DatabaseUtils.getAllExecutionLogs(env, 10);
      const recentLogs = logsResult.data || [];
      
      const recentSuccesses = recentLogs.filter(l => l.status === 'success').length;
      const recentFailures = recentLogs.filter(l => l.status === 'failure').length;

      const response: ApiResponse = {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          tasks: {
            total: totalTasks,
            active: activeTasks,
            keepalive: keepaliveTasks,
            notification: notificationTasks
          },
          recentExecutions: {
            total: recentLogs.length,
            successes: recentSuccesses,
            failures: recentFailures
          }
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取系统状态失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 版本信息端点
   */
  static async version(request: Request, env: Environment): Promise<Response> {
    const response: ApiResponse = {
      success: true,
      data: {
        name: 'STMS API',
        version: '1.0.0',
        description: '定时任务管理系统',
        environment: env.ENVIRONMENT
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
