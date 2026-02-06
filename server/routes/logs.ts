import { Environment, ApiResponse, LogFilter } from '../types/index.js';
import { AuthService } from '../services/auth.service.js';
import { DatabaseUtils } from '../utils/database.js';

/**
 * 日志路由处理器
 */
export class LogRoutes {
  /**
   * 获取执行日志列表
   */
  static async list(request: Request, env: Environment): Promise<Response> {
    try {
      // 认证检查
      const user = await AuthService.authenticateRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: '未授权'
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const taskId = url.searchParams.get('taskId');
      const status = url.searchParams.get('status') as 'success' | 'failure' | null;
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // 如果指定了taskId，获取该任务的日志
      if (taskId) {
        const result = await DatabaseUtils.getExecutionLogsByTaskId(env, taskId, limit, offset);
        
        if (!result.success) {
          return new Response(JSON.stringify({
            success: false,
            error: result.error
          } as ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 如果指定了状态筛选
        let logs = result.data || [];
        if (status) {
          logs = logs.filter(log => log.status === status);
        }

        return new Response(JSON.stringify({
          success: true,
          data: logs
        } as ApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 获取所有日志
      const result = await DatabaseUtils.getAllExecutionLogs(env, limit, offset);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 如果指定了状态筛选
      let logs = result.data || [];
      if (status) {
        logs = logs.filter(log => log.status === status);
      }

      return new Response(JSON.stringify({
        success: true,
        data: logs
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取日志列表失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 获取单个日志详情
   */
  static async get(request: Request, env: Environment, logId: string): Promise<Response> {
    try {
      // 认证检查
      const user = await AuthService.authenticateRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: '未授权'
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await DatabaseUtils.getExecutionLogById(env, logId);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!result.data) {
        return new Response(JSON.stringify({
          success: false,
          error: '日志不存在'
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取日志详情失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 清理旧日志
   */
  static async cleanup(request: Request, env: Environment): Promise<Response> {
    try {
      // 认证检查
      const user = await AuthService.authenticateRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: '未授权'
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 只有管理员可以清理日志
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({
          success: false,
          error: '权限不足'
        } as ApiResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json() as { days: number };
      const days = body.days || 30;

      // 计算截止日期
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await DatabaseUtils.deleteOldExecutionLogs(env, cutoffDate.toISOString());
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `已清理 ${days} 天前的日志`
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '清理日志失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
