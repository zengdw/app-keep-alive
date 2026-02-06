import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthRoutes } from '../../server/routes/auth.js';
import { TaskRoutes } from '../../server/routes/tasks.js';
import { LogRoutes } from '../../server/routes/logs.js';
import { HealthRoutes } from '../../server/routes/health.js';
import { ResponseUtils } from '../../server/utils/response.js';
import { RateLimitMiddleware } from '../../server/middleware/rate-limit.js';
import { Environment } from '../../server/types/index.js';

describe('API路由测试', () => {
  let mockEnv: Environment;

  beforeEach(() => {
    mockEnv = {
      DB: {} as any,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'test-secret'
    };
  });

  describe('ResponseUtils', () => {
    it('应该创建成功响应', () => {
      const response = ResponseUtils.success({ message: 'test' });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('应该创建错误响应', () => {
      const response = ResponseUtils.error('测试错误', 400);
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('应该创建未授权响应', () => {
      const response = ResponseUtils.unauthorized();
      expect(response.status).toBe(401);
    });

    it('应该创建未找到响应', () => {
      const response = ResponseUtils.notFound();
      expect(response.status).toBe(404);
    });

    it('应该处理OPTIONS预检请求', () => {
      const response = ResponseUtils.options();
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('应该添加CORS头', () => {
      const headers = new Headers();
      const corsHeaders = ResponseUtils.addCorsHeaders(headers);
      expect(corsHeaders.get('Access-Control-Allow-Origin')).toBe('*');
      expect(corsHeaders.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(corsHeaders.get('Access-Control-Allow-Headers')).toBeTruthy();
    });
  });

  describe('RateLimitMiddleware', () => {
    it('应该允许在限制内的请求', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' }
      });

      const middleware = RateLimitMiddleware.middleware({
        windowMs: 60000,
        maxRequests: 10
      });

      const result = middleware(request, mockEnv);
      expect(result).toBeNull(); // null表示允许请求继续
    });

    it('应该拒绝超过限制的请求', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.5' }
      });

      const middleware = RateLimitMiddleware.middleware({
        windowMs: 60000,
        maxRequests: 2
      });

      // 第一次请求
      let result = middleware(request, mockEnv);
      expect(result).toBeNull();

      // 第二次请求
      result = middleware(request, mockEnv);
      expect(result).toBeNull();

      // 第三次请求应该被拒绝
      result = middleware(request, mockEnv);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('应该在响应中包含速率限制头', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.6' }
      });

      const middleware = RateLimitMiddleware.middleware({
        windowMs: 60000,
        maxRequests: 5
      });

      // 发送多个请求直到被限制
      for (let i = 0; i < 6; i++) {
        const result = middleware(request, mockEnv);
        if (result) {
          // 被限制的响应
          expect(result.headers.get('X-RateLimit-Limit')).toBe('5');
          expect(result.headers.get('Retry-After')).toBeTruthy();
        }
      }
    });

    it('应该提供严格的速率限制', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.7' }
      });

      const middleware = RateLimitMiddleware.strict();
      
      // 严格限制应该是10个请求/分钟
      for (let i = 0; i < 10; i++) {
        const result = middleware(request, mockEnv);
        expect(result).toBeNull();
      }

      // 第11个请求应该被拒绝
      const result = middleware(request, mockEnv);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('应该提供宽松的速率限制', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.8' }
      });

      const middleware = RateLimitMiddleware.lenient();
      
      // 宽松限制应该是120个请求/分钟
      for (let i = 0; i < 120; i++) {
        const result = middleware(request, mockEnv);
        expect(result).toBeNull();
      }

      // 第121个请求应该被拒绝
      const result = middleware(request, mockEnv);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });
  });

  describe('HealthRoutes', () => {
    it('应该返回版本信息', async () => {
      const request = new Request('https://example.com/api/version');
      const response = await HealthRoutes.version(request, mockEnv);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('STMS API');
      expect(data.data.version).toBe('1.0.0');
    });
  });

  describe('CORS支持', () => {
    it('所有API响应应该包含CORS头', () => {
      const response = ResponseUtils.success({ test: 'data' });
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    it('OPTIONS请求应该返回正确的CORS头', () => {
      const response = ResponseUtils.options();
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });
  });

  describe('错误处理', () => {
    it('应该返回标准化的错误响应', () => {
      const response = ResponseUtils.error('测试错误', 400);
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('应该处理未授权错误', () => {
      const response = ResponseUtils.unauthorized('无效的令牌');
      expect(response.status).toBe(401);
    });

    it('应该处理禁止访问错误', () => {
      const response = ResponseUtils.forbidden('权限不足');
      expect(response.status).toBe(403);
    });

    it('应该处理服务器错误', () => {
      const response = ResponseUtils.serverError('内部错误');
      expect(response.status).toBe(500);
    });
  });

  describe('请求验证', () => {
    it('应该验证JSON请求体', async () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      const result = await ResponseUtils.validateJsonBody(request);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ test: 'data' });
    });

    it('应该拒绝非JSON请求', async () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text'
      });

      const result = await ResponseUtils.validateJsonBody(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('应该拒绝无效的JSON', async () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const result = await ResponseUtils.validateJsonBody(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
