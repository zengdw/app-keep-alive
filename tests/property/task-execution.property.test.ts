import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TaskService } from '../../server/services/task.service.js';
import type { Environment, Task, KeepaliveConfig, NotificationConfig } from '../../server/types/index.js';

/**
 * 创建内存数据库环境用于测试
 */
function createTestEnvironment(): { env: Environment; db: Database.Database } {
  const sqliteDb = new Database(':memory:');
  const migrationPath = join(process.cwd(), 'migrations', '0001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  const statements = migration.split(';').filter(s => s.trim() && !s.includes('INSERT INTO users'));
  statements.forEach(stmt => {
    if (stmt.trim()) {
      sqliteDb.exec(stmt);
    }
  });

  const db = {
    prepare: (query: string) => {
      const stmt = sqliteDb.prepare(query);
      const bindings: any[] = [];
      return {
        bind: (...args: any[]) => {
          bindings.push(...args);
          return {
            run: async () => {
              const result = stmt.run(...bindings);
              return { success: true, meta: { changes: result.changes } };
            },
            first: async () => stmt.get(...bindings) || null,
            all: async () => ({ results: stmt.all(...bindings) })
          };
        },
        run: async () => {
          const result = stmt.run();
          return { success: true, meta: { changes: result.changes } };
        },
        first: async () => stmt.get() || null,
        all: async () => ({ results: stmt.all() })
      };
    }
  };

  return {
    env: {
      DB: db as any,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'test_secret_key_for_property_testing_12345678'
    } as Environment,
    db: sqliteDb
  };
}

/**
 * 创建测试用户
 */
async function createTestUser(env: Environment, username: string): Promise<string> {
  const userId = crypto.randomUUID();
  const passwordHash = 'test_hash_' + username;
  
  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).bind(userId, username, passwordHash, 'user').run();
  
  return userId;
}

// 生成器定义
const taskNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const cronScheduleArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 1, max: 31 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 0, max: 6 })
).map(([minute, hour, day, month, weekday]) => 
  `${minute} ${hour} ${day} ${month} ${weekday}`
);

const httpMethodArbitrary = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');

const urlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

const keepaliveConfigArbitrary: fc.Arbitrary<KeepaliveConfig> = fc.record({
  url: urlArbitrary,
  method: httpMethodArbitrary,
  headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
  body: fc.option(fc.string(), { nil: undefined }),
  timeout: fc.integer({ min: 1000, max: 60000 })
});

const notificationConfigArbitrary: fc.Arbitrary<NotificationConfig> = fc.record({
  message: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
  title: fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined }),
  priority: fc.option(fc.constantFrom('low' as const, 'normal' as const, 'high' as const), { nil: undefined }),
  notifyxConfig: fc.record({
    apiKey: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0),
    message: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
    title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
  })
});

/**
 * Feature: app-keepalive-system, Property 6: HTTP请求配置一致性
 * 
 * 对于任何保活任务，执行时发送的HTTP请求应该使用任务配置中指定的URL、方法、头部和请求体
 * 
 * 验证需求: 2.2
 */
describe('属性测试: HTTP请求配置一致性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;
  let testUserId: string;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
    testUserId = await createTestUser(env, `user_${Date.now()}_${Math.random()}`);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
    global.fetch = originalFetch;
  });

  it('属性 6.1: 执行保活任务应该使用配置的URL和方法', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          let capturedUrl: string | undefined;
          let capturedMethod: string | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            capturedUrl = url.toString();
            capturedMethod = options?.method || 'GET';
            return new Response('OK', { status: 200 });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            expect(capturedUrl).toBe(config.url);
            expect(capturedMethod).toBe(config.method);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 6.2: 执行保活任务应该使用配置的请求头', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        fc.record({
          url: urlArbitrary,
          method: httpMethodArbitrary,
          headers: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
          timeout: fc.integer({ min: 1000, max: 60000 })
        }),
        async (name, schedule, config) => {
          let capturedHeaders: Record<string, string> | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            capturedHeaders = options?.headers as Record<string, string>;
            return new Response('OK', { status: 200 });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            if (config.headers && capturedHeaders) {
              for (const [key, value] of Object.entries(config.headers)) {
                expect(capturedHeaders[key]).toBe(value);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 6.3: 执行POST/PUT请求应该使用配置的请求体', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        fc.constantFrom('POST', 'PUT'),
        urlArbitrary,
        fc.string({ minLength: 1, maxLength: 500 }),
        async (name, schedule, method, url, body) => {
          let capturedBody: string | undefined;

          global.fetch = vi.fn(async (urlParam: string | URL | Request, options?: RequestInit) => {
            capturedBody = options?.body as string;
            return new Response('OK', { status: 200 });
          }) as any;

          const config: KeepaliveConfig = {
            url,
            method: method as 'POST' | 'PUT',
            body,
            timeout: 30000
          };

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            expect(capturedBody).toBe(body);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 6.4: 执行保活任务应该遵守配置的超时时间', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        fc.record({
          url: urlArbitrary,
          method: httpMethodArbitrary,
          timeout: fc.integer({ min: 1000, max: 10000 })
        }),
        async (name, schedule, config) => {
          let timeoutSignal: AbortSignal | null | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            timeoutSignal = options?.signal;
            return new Response('OK', { status: 200 });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            expect(timeoutSignal).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Feature: app-keepalive-system, Property 7: 通知发送配置一致性
 * 
 * 对于任何通知任务，执行时发送的通知应该使用任务配置中指定的通知方式、接收者和内容
 * 
 * 验证需求: 3.2
 */
describe('属性测试: 通知发送配置一致性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;
  let testUserId: string;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
    testUserId = await createTestUser(env, `user_${Date.now()}_${Math.random()}`);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
    global.fetch = originalFetch;
  });

  it('属性 7.1: 执行通知任务应该使用配置的NotifyX API密钥', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        async (name, schedule, config) => {
          let capturedUrl: string | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            capturedUrl = url.toString();
            return new Response(JSON.stringify({ success: true }), { 
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeNotificationTask(env, createResult.data);
            
            // NotifyX API URL 包含 API 密钥
            expect(capturedUrl).toContain(config.notifyxConfig.apiKey);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 7.2: 执行通知任务应该使用配置的消息内容', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        async (name, schedule, config) => {
          let capturedContent: string | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            const body = options?.body ? JSON.parse(options.body as string) : {};
            capturedContent = body.content;
            return new Response(JSON.stringify({ success: true }), { 
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeNotificationTask(env, createResult.data);
            
            // 验证发送的内容是任务配置中的 message
            expect(capturedContent).toBe(config.message);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 7.3: 执行通知任务应该使用配置的标题', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        async (name, schedule, config) => {
          let capturedTitle: string | undefined;

          global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
            const body = options?.body ? JSON.parse(options.body as string) : {};
            capturedTitle = body.title;
            return new Response(JSON.stringify({ success: true }), { 
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            await TaskService.executeNotificationTask(env, createResult.data);
            
            // 验证发送的标题，如果配置中有 title 则使用，否则使用默认值
            const expectedTitle = config.title || '系统通知';
            expect(capturedTitle).toBe(expectedTitle);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Feature: app-keepalive-system, Property 8: 执行日志记录完整性
 * 
 * 对于任何任务执行（成功或失败），系统应该记录包含执行时间、状态、响应信息和错误详情的完整日志条目
 * 
 * 验证需求: 2.3, 2.4, 3.3, 3.4, 5.1, 5.2
 */
describe('属性测试: 执行日志记录完整性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;
  let testUserId: string;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
    testUserId = await createTestUser(env, `user_${Date.now()}_${Math.random()}`);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
    global.fetch = originalFetch;
  });

  it('属性 8.1: 成功的保活任务执行应该记录完整的成功日志', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.integer({ min: 200, max: 299 }),
        async (name, schedule, config, statusCode) => {
          global.fetch = vi.fn(async () => {
            return new Response('OK', { status: statusCode });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.task_id).toBe(taskId);
            expect(logsResult.status).toBe('success');
            expect(logsResult.status_code).toBe(statusCode);
            expect(logsResult.response_time).toBeDefined();
            expect(logsResult.execution_time).toBeDefined();
            expect(logsResult.error_message).toBeNull();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.2: 失败的保活任务执行应该记录完整的失败日志', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.integer({ min: 400, max: 599 }),
        async (name, schedule, config, statusCode) => {
          global.fetch = vi.fn(async () => {
            return new Response('Error', { status: statusCode, statusText: 'Error Response' });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.task_id).toBe(taskId);
            expect(logsResult.status).toBe('failure');
            expect(logsResult.status_code).toBe(statusCode);
            expect(logsResult.response_time).toBeDefined();
            expect(logsResult.execution_time).toBeDefined();
            expect(logsResult.error_message).toBeDefined();
            expect(logsResult.error_message).toContain(statusCode.toString());
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.3: 网络错误的保活任务应该记录错误详情', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.constantFrom('Network error', 'Connection timeout', 'DNS resolution failed'),
        async (name, schedule, config, errorMessage) => {
          global.fetch = vi.fn(async () => {
            throw new Error(errorMessage);
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.task_id).toBe(taskId);
            expect(logsResult.status).toBe('failure');
            expect(logsResult.error_message).toBeDefined();
            expect(logsResult.error_message).toContain(errorMessage);
            expect(logsResult.execution_time).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.4: 成功的通知任务执行应该记录完整的成功日志', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        async (name, schedule, config) => {
          global.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ success: true }), { 
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeNotificationTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.task_id).toBe(taskId);
            expect(logsResult.status).toBe('success');
            expect(logsResult.status_code).toBe(200);
            expect(logsResult.response_time).toBeDefined();
            expect(logsResult.execution_time).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.5: 失败的通知任务执行应该记录完整的失败日志', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        async (name, schedule, config) => {
          global.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ success: false, error: 'API error' }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeNotificationTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.task_id).toBe(taskId);
            expect(logsResult.status).toBe('failure');
            expect(logsResult.response_time).toBeDefined();
            expect(logsResult.execution_time).toBeDefined();
            expect(logsResult.error_message).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.6: 任务执行后应该更新任务的最后执行状态', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.boolean(),
        async (name, schedule, config, shouldSucceed) => {
          global.fetch = vi.fn(async () => {
            if (shouldSucceed) {
              return new Response('OK', { status: 200 });
            } else {
              return new Response('Error', { status: 500 });
            }
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            // 查询任务状态
            const taskResult = await env.DB.prepare(
              'SELECT * FROM tasks WHERE id = ?'
            ).bind(taskId).first();

            expect(taskResult).toBeDefined();
            expect(taskResult.last_executed).toBeDefined();
            expect(taskResult.last_status).toBe(shouldSucceed ? 'success' : 'failure');
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 8.7: 多次执行应该记录多条日志', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.integer({ min: 2, max: 5 }),
        async (name, schedule, config, executionCount) => {
          global.fetch = vi.fn(async () => {
            return new Response('OK', { status: 200 });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            
            // 执行多次
            for (let i = 0; i < executionCount; i++) {
              await TaskService.executeKeepaliveTask(env, createResult.data);
              // 添加小延迟确保时间戳不同
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // 查询所有执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC'
            ).bind(taskId).all();

            expect(logsResult.results).toBeDefined();
            expect(logsResult.results.length).toBe(executionCount);
            
            // 验证每条日志都有必需字段
            for (const log of logsResult.results) {
              expect(log.task_id).toBe(taskId);
              expect(log.status).toBeDefined();
              expect(log.execution_time).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('属性 8.8: 执行日志应该包含响应时间信息', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          global.fetch = vi.fn(async () => {
            // 模拟一些延迟
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return new Response('OK', { status: 200 });
          }) as any;

          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            await TaskService.executeKeepaliveTask(env, createResult.data);
            
            // 查询执行日志
            const logsResult = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(taskId).first();

            expect(logsResult).toBeDefined();
            expect(logsResult.response_time).toBeDefined();
            expect(typeof logsResult.response_time).toBe('number');
            expect(logsResult.response_time).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
