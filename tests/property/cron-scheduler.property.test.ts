import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CronService } from '../../server/services/cron.service.js';
import { TaskService } from '../../server/services/task.service.js';
import type { Environment, KeepaliveConfig, NotificationConfig } from '../../server/types/index.js';

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

/**
 * 生成匹配当前时间的Cron表达式
 */
function generateMatchingCronExpression(date: Date): string {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  
  return `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
}

/**
 * 生成不匹配当前时间的Cron表达式
 */
function generateNonMatchingCronExpression(date: Date): string {
  const minute = (date.getMinutes() + 1) % 60;
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  
  return `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
}

/**
 * Feature: app-keepalive-system, Property 5: 定时触发准确性
 * 
 * 对于任何启用的任务，当到达其预设的执行时间时，
 * 调度器应该触发相应的执行操作（HTTP请求或通知发送）
 * 
 * 验证需求: 2.1, 3.1
 */
describe('属性测试: 定时触发准确性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;
  let testUserId: string;

  beforeEach(async () => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
    testUserId = await createTestUser(env, `user_${Date.now()}_${Math.random()}`);
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
  });

  it('属性 5.1: 启用的保活任务在匹配时间应该被触发执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          // 使用简单的配置避免实际HTTP请求
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建启用的保活任务，调度时间匹配当前时间
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config, 
              enabled: true 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            // 执行调度器（会尝试执行任务，但会快速失败）
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理（即使任务执行失败）
            expect(result.success).toBe(true);
            
            // 验证任务被尝试执行（通过检查执行日志）
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(createResult.data.id).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 5.2: 启用的通知任务在匹配时间应该被触发执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          // 使用简单的配置避免实际NotifyX调用
          const config: NotificationConfig = {
            message: 'Test message',
            notifyxConfig: {
              apiKey: 'test_key',
              channelId: 'test_channel',
              message: 'Test message'
            }
          };
          
          // 创建启用的通知任务，调度时间匹配当前时间
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'notification', 
              schedule: matchingSchedule, 
              config, 
              enabled: true 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            // 执行调度器（会尝试执行任务，但会快速失败）
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理（即使任务执行失败）
            expect(result.success).toBe(true);
            
            // 验证任务被尝试执行（通过检查执行日志）
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY execution_time DESC LIMIT 1'
            ).bind(createResult.data.id).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 5.3: 调度时间不匹配的任务不应该被触发', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const nonMatchingSchedule = generateNonMatchingCronExpression(now);
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建启用的任务，但调度时间不匹配当前时间
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'keepalive', 
              schedule: nonMatchingSchedule, 
              config, 
              enabled: true 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            // 执行调度器
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理
            expect(result.success).toBe(true);
            
            // 验证任务没有被执行（没有执行日志）
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(createResult.data.id).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBe(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 5.4: 调度器应该处理多个匹配时间的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskNameArbitrary, { minLength: 2, maxLength: 5 }),
        async (names) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          const createdTaskIds: string[] = [];
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建多个启用的任务，都匹配当前时间
          for (const name of names) {
            const createResult = await TaskService.createTask(
              env,
              { 
                name, 
                type: 'keepalive', 
                schedule: matchingSchedule, 
                config, 
                enabled: true 
              },
              testUserId
            );
            
            if (createResult.success && createResult.data) {
              createdTaskIds.push(createResult.data.id);
            }
          }

          // 执行调度器
          const result = await CronService.handleScheduledEvent(env);
          
          // 验证调度器成功处理
          expect(result.success).toBe(true);
          expect(result.processed).toBe(createdTaskIds.length);
          
          // 验证所有任务都被尝试执行
          for (const taskId of createdTaskIds) {
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(taskId).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('属性 5.5: 调度器应该正确处理混合类型的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        async (name1, name2) => {
          fc.pre(name1 !== name2);
          
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          const keepaliveConfig: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          const notificationConfig: NotificationConfig = {
            message: 'Test message',
            notifyxConfig: {
              apiKey: 'test_key',
              channelId: 'test_channel',
              message: 'Test message'
            }
          };
          
          // 创建保活任务
          const keepaliveResult = await TaskService.createTask(
            env,
            { 
              name: name1, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config: keepaliveConfig, 
              enabled: true 
            },
            testUserId
          );
          
          // 创建通知任务
          const notificationResult = await TaskService.createTask(
            env,
            { 
              name: name2, 
              type: 'notification', 
              schedule: matchingSchedule, 
              config: notificationConfig, 
              enabled: true 
            },
            testUserId
          );

          expect(keepaliveResult.success).toBe(true);
          expect(notificationResult.success).toBe(true);
          
          if (keepaliveResult.data && notificationResult.data) {
            // 执行调度器
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            
            // 验证两个任务都被尝试执行
            const keepaliveLogs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(keepaliveResult.data.id).all();
            
            const notificationLogs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(notificationResult.data.id).all();
            
            expect(keepaliveLogs.results.length).toBeGreaterThan(0);
            expect(notificationLogs.results.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Feature: app-keepalive-system, Property 9: 任务状态控制有效性
 * 
 * 对于任何被禁用的任务，调度器应该跳过该任务的执行，
 * 不发送HTTP请求或通知
 * 
 * 验证需求: 2.5, 3.5
 */
describe('属性测试: 任务状态控制有效性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;
  let testUserId: string;

  beforeEach(async () => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
    testUserId = await createTestUser(env, `user_${Date.now()}_${Math.random()}`);
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
  });

  it('属性 9.1: 禁用的保活任务不应该被执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建禁用的保活任务
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config, 
              enabled: false 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            // 执行调度器
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理
            expect(result.success).toBe(true);
            
            // 验证任务没有被执行（没有执行日志）
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(createResult.data.id).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBe(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 9.2: 禁用的通知任务不应该被执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          const config: NotificationConfig = {
            message: 'Test message',
            notifyxConfig: {
              apiKey: 'test_key',
              channelId: 'test_channel',
              message: 'Test message'
            }
          };
          
          // 创建禁用的通知任务
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'notification', 
              schedule: matchingSchedule, 
              config, 
              enabled: false 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            // 执行调度器
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理
            expect(result.success).toBe(true);
            
            // 验证任务没有被执行（没有执行日志）
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(createResult.data.id).all();
            
            expect(logs.results).toBeDefined();
            expect(logs.results.length).toBe(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 9.3: 启用状态切换应该影响任务执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        async (name) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建启用的任务
          const createResult = await TaskService.createTask(
            env,
            { 
              name, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config, 
              enabled: true 
            },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            
            // 第一次执行调度器，任务应该被执行
            const result1 = await CronService.handleScheduledEvent(env);
            expect(result1.success).toBe(true);
            
            const logs1 = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(taskId).all();
            
            const initialLogCount = logs1.results.length;
            expect(initialLogCount).toBeGreaterThan(0);
            
            // 禁用任务
            await TaskService.updateTask(
              env,
              taskId,
              { enabled: false },
              testUserId
            );
            
            // 第二次执行调度器，任务不应该被执行
            const result2 = await CronService.handleScheduledEvent(env);
            expect(result2.success).toBe(true);
            
            const logs2 = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(taskId).all();
            
            // 日志数量应该保持不变
            expect(logs2.results.length).toBe(initialLogCount);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 9.4: 调度器应该只处理启用的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: taskNameArbitrary,
            enabled: fc.boolean()
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (tasks) => {
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          const taskInfos: Array<{ id: string; enabled: boolean }> = [];
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建多个任务，有些启用有些禁用
          for (const task of tasks) {
            const createResult = await TaskService.createTask(
              env,
              { 
                name: task.name, 
                type: 'keepalive', 
                schedule: matchingSchedule, 
                config, 
                enabled: task.enabled 
              },
              testUserId
            );
            
            if (createResult.success && createResult.data) {
              taskInfos.push({
                id: createResult.data.id,
                enabled: task.enabled
              });
            }
          }

          // 执行调度器
          const result = await CronService.handleScheduledEvent(env);
          
          // 验证调度器成功处理
          expect(result.success).toBe(true);
          
          // 计算应该被执行的任务数量
          const enabledCount = taskInfos.filter(t => t.enabled).length;
          expect(result.processed).toBe(enabledCount);
          
          // 验证只有启用的任务被执行
          for (const taskInfo of taskInfos) {
            const logs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(taskInfo.id).all();
            
            if (taskInfo.enabled) {
              expect(logs.results.length).toBeGreaterThan(0);
            } else {
              expect(logs.results.length).toBe(0);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('属性 9.5: 禁用任务不应该影响其他启用任务的执行', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        async (name1, name2) => {
          fc.pre(name1 !== name2);
          
          const now = new Date();
          const matchingSchedule = generateMatchingCronExpression(now);
          
          const config: KeepaliveConfig = {
            url: 'http://localhost:9999/test',
            method: 'GET',
            timeout: 1000
          };
          
          // 创建一个启用的任务
          const enabledResult = await TaskService.createTask(
            env,
            { 
              name: name1, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config, 
              enabled: true 
            },
            testUserId
          );
          
          // 创建一个禁用的任务
          const disabledResult = await TaskService.createTask(
            env,
            { 
              name: name2, 
              type: 'keepalive', 
              schedule: matchingSchedule, 
              config, 
              enabled: false 
            },
            testUserId
          );

          expect(enabledResult.success).toBe(true);
          expect(disabledResult.success).toBe(true);
          
          if (enabledResult.data && disabledResult.data) {
            // 执行调度器
            const result = await CronService.handleScheduledEvent(env);
            
            // 验证调度器成功处理
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            
            // 验证启用的任务被执行
            const enabledLogs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(enabledResult.data.id).all();
            
            expect(enabledLogs.results.length).toBeGreaterThan(0);
            
            // 验证禁用的任务没有被执行
            const disabledLogs = await env.DB.prepare(
              'SELECT * FROM execution_logs WHERE task_id = ?'
            ).bind(disabledResult.data.id).all();
            
            expect(disabledLogs.results.length).toBe(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
