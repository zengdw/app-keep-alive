import { Environment } from '../types/index.js';

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  windowMs: number;  // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
}

/**
 * 速率限制记录
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * 速率限制中间件
 */
export class RateLimitMiddleware {
  /**
   * 默认配置：每分钟60个请求
   */
  private static readonly DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 60 * 1000,  // 1分钟
    maxRequests: 60
  };

  /**
   * 速率限制存储（使用内存存储，生产环境应使用KV或Durable Objects）
   */
  private static limitStore = new Map<string, RateLimitRecord>();

  /**
   * 获取客户端标识符
   */
  private static getClientId(request: Request): string {
    // 优先使用认证令牌
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      return `auth:${authHeader}`;
    }

    // 使用IP地址（Cloudflare Workers中通过CF-Connecting-IP获取）
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               'unknown';
    
    return `ip:${ip}`;
  }

  /**
   * 清理过期记录
   */
  private static cleanupExpiredRecords(): void {
    const now = Date.now();
    for (const [key, record] of this.limitStore.entries()) {
      if (now > record.resetTime) {
        this.limitStore.delete(key);
      }
    }
  }

  /**
   * 检查速率限制
   */
  static checkRateLimit(
    request: Request,
    config: RateLimitConfig = this.DEFAULT_CONFIG
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const clientId = this.getClientId(request);
    const now = Date.now();

    // 定期清理过期记录
    if (Math.random() < 0.01) {  // 1%的概率触发清理
      this.cleanupExpiredRecords();
    }

    // 获取或创建记录
    let record = this.limitStore.get(clientId);

    if (!record || now > record.resetTime) {
      // 创建新记录
      record = {
        count: 1,
        resetTime: now + config.windowMs
      };
      this.limitStore.set(clientId, record);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: record.resetTime
      };
    }

    // 检查是否超过限制
    if (record.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      };
    }

    // 增加计数
    record.count++;

    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * 速率限制中间件
   */
  static middleware(
    config: RateLimitConfig = this.DEFAULT_CONFIG
  ): (request: Request, env: Environment) => Response | null {
    return (request: Request, env: Environment): Response | null => {
      const result = this.checkRateLimit(request, config);

      // 添加速率限制头
      const headers = new Headers({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        // 超过限制，返回429错误
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        headers.set('Retry-After', retryAfter.toString());
        headers.set('Content-Type', 'application/json');

        return new Response(JSON.stringify({
          success: false,
          error: '请求过于频繁，请稍后再试',
          retryAfter
        }), {
          status: 429,
          headers
        });
      }

      // 允许请求继续
      return null;
    };
  }

  /**
   * 为特定路由创建速率限制中间件
   */
  static forRoute(
    windowMs: number,
    maxRequests: number
  ): (request: Request, env: Environment) => Response | null {
    return this.middleware({ windowMs, maxRequests });
  }

  /**
   * 严格的速率限制（用于敏感操作）
   */
  static strict(): (request: Request, env: Environment) => Response | null {
    return this.middleware({
      windowMs: 60 * 1000,  // 1分钟
      maxRequests: 10  // 10个请求
    });
  }

  /**
   * 宽松的速率限制（用于读取操作）
   */
  static lenient(): (request: Request, env: Environment) => Response | null {
    return this.middleware({
      windowMs: 60 * 1000,  // 1分钟
      maxRequests: 120  // 120个请求
    });
  }
}
