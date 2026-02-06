import { ApiResponse } from '../types/index.js';

/**
 * 响应工具类
 * 提供标准化的响应格式和CORS支持
 */
export class ResponseUtils {
  /**
   * CORS头配置
   */
  private static readonly CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  /**
   * 添加CORS头到响应
   */
  static addCorsHeaders(headers: Headers): Headers {
    const newHeaders = new Headers(headers);
    Object.entries(this.CORS_HEADERS).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    return newHeaders;
  }

  /**
   * 创建JSON响应
   */
  static json(data: ApiResponse, status: number = 200): Response {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const corsHeaders = this.addCorsHeaders(headers);
    
    return new Response(JSON.stringify(data), {
      status,
      headers: corsHeaders
    });
  }

  /**
   * 创建成功响应
   */
  static success(data?: any, message?: string): Response {
    return this.json({
      success: true,
      data,
      message
    }, 200);
  }

  /**
   * 创建错误响应
   */
  static error(error: string, status: number = 400): Response {
    return this.json({
      success: false,
      error
    }, status);
  }

  /**
   * 创建未授权响应
   */
  static unauthorized(error: string = '未授权'): Response {
    return this.error(error, 401);
  }

  /**
   * 创建禁止访问响应
   */
  static forbidden(error: string = '权限不足'): Response {
    return this.error(error, 403);
  }

  /**
   * 创建未找到响应
   */
  static notFound(error: string = '资源不存在'): Response {
    return this.error(error, 404);
  }

  /**
   * 创建服务器错误响应
   */
  static serverError(error: string = '服务器内部错误'): Response {
    return this.error(error, 500);
  }

  /**
   * 处理OPTIONS预检请求
   */
  static options(): Response {
    const headers = this.addCorsHeaders(new Headers());
    return new Response(null, {
      status: 204,
      headers
    });
  }

  /**
   * 验证请求体
   */
  static async validateJsonBody(request: Request): Promise<{ valid: boolean; data?: any; error?: string }> {
    try {
      const contentType = request.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return { valid: false, error: '请求Content-Type必须是application/json' };
      }

      const data = await request.json();
      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: '无效的JSON格式' };
    }
  }

  /**
   * 提取查询参数
   */
  static getQueryParams(request: Request): URLSearchParams {
    const url = new URL(request.url);
    return url.searchParams;
  }

  /**
   * 提取路径参数
   */
  static extractPathParam(pathname: string, pattern: RegExp, index: number = 1): string | null {
    const match = pathname.match(pattern);
    return match ? match[index] : null;
  }
}
