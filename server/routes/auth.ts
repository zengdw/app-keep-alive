import { Environment, ApiResponse, LoginCredentials } from '../types/index.js';
import { AuthService } from '../services/auth.service.js';

/**
 * 认证路由处理器
 */
export class AuthRoutes {
  /**
   * 处理登录请求
   */
  static async login(request: Request, env: Environment): Promise<Response> {
    try {
      const body = await request.json() as LoginCredentials;
      
      if (!body.username || !body.password) {
        return new Response(JSON.stringify({
          success: false,
          error: '用户名和密码不能为空'
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await AuthService.authenticate(env, body.username, body.password);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token: result.token,
          user: result.user
        }
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '登录请求处理失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 处理注册请求
   */
  static async register(request: Request, env: Environment): Promise<Response> {
    try {
      const body = await request.json() as { username: string; password: string; role?: 'admin' | 'user' };
      
      if (!body.username || !body.password) {
        return new Response(JSON.stringify({
          success: false,
          error: '用户名和密码不能为空'
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await AuthService.register(env, body.username, body.password, body.role);
      
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
        data: {
          token: result.token,
          user: result.user
        }
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '注册请求处理失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 处理令牌刷新请求
   */
  static async refresh(request: Request, env: Environment): Promise<Response> {
    try {
      const token = AuthService.extractTokenFromRequest(request);
      
      if (!token) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少认证令牌'
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const newToken = await AuthService.refreshToken(env, token);
      
      if (!newToken) {
        return new Response(JSON.stringify({
          success: false,
          error: '令牌刷新失败'
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: { token: newToken }
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '令牌刷新请求处理失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 处理获取当前用户信息请求
   */
  static async me(request: Request, env: Environment): Promise<Response> {
    try {
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

      return new Response(JSON.stringify({
        success: true,
        data: { user }
      } as ApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: '获取用户信息失败'
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
