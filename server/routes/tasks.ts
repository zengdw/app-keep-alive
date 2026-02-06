import { Environment, ApiResponse, Task, KeepaliveConfig, NotificationConfig } from '../types/index.js';
import { AuthService } from '../services/auth.service.js';
import { TaskService } from '../services/task.service.js';

/**
 * 任务路由处理器
 */
export class TaskRoutes {
  /**
   * 创建任务
   */
  static async create(request: Request, env: Environment): Promise<Response> {
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

      const body = await request.json() as {
        name: string;
        type: 'keepalive' | 'notification';
        schedule: string;
        config: KeepaliveConfig | NotificationConfig;
        enabled?: boolean;
      };

      // 验证必填字段
      if (!body.name || !body.type || !body.schedule || !body.config) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少必填字段'
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await TaskService.createTask(env, body, user.id);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '创建任务失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 获取任务列表
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
      const type = url.searchParams.get('type') as 'keepalive' | 'notification' | null;
      const enabled = url.searchParams.get('enabled');

      const filter: any = {};
      if (type) filter.type = type;
      if (enabled !== null) filter.enabled = enabled === 'true';

      const result = await TaskService.listTasks(env, filter);
      
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
        data: result.data
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取任务列表失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 获取单个任务
   */
  static async get(request: Request, env: Environment, taskId: string): Promise<Response> {
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

      const result = await TaskService.getTask(env, taskId);
      
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
          error: '任务不存在'
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
        error: '获取任务失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 更新任务
   */
  static async update(request: Request, env: Environment, taskId: string): Promise<Response> {
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

      const body = await request.json() as Partial<Task>;

      const result = await TaskService.updateTask(env, taskId, body, user.id);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: result.error === '任务不存在' ? 404 : 400,
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
        error: '更新任务失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 删除任务
   */
  static async delete(request: Request, env: Environment, taskId: string): Promise<Response> {
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

      const result = await TaskService.deleteTask(env, taskId, user.id);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: result.error === '任务不存在' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: '任务已删除'
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除任务失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 切换任务状态
   */
  static async toggle(request: Request, env: Environment, taskId: string): Promise<Response> {
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

      const result = await TaskService.toggleTaskStatus(env, taskId, user.id);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: result.error === '任务不存在' ? 404 : 400,
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
        error: '切换任务状态失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 获取任务统计
   */
  static async statistics(request: Request, env: Environment, taskId: string): Promise<Response> {
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

      const result = await TaskService.getTaskStatistics(env, taskId);
      
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
        data: result.data
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取任务统计失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
