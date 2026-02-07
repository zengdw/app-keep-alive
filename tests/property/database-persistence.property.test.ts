import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseUtils } from '../../server/utils/database.js';
import { UserModel } from '../../server/models/user.model.js';
import { TaskModel } from '../../server/models/task.model.js';
import { ExecutionLogModel } from '../../server/models/execution-log.model.js';
import { NotificationSettingsModel } from '../../server/models/notification-settings.model.js';
import type { User, Task, ExecutionLog, NotificationSettings, Environment } from '../../server/types/index.js';

/**
 * 创建内存数据库环境用于测试
 */
function createTestEnvironment(): { env: Environment; db: Database.Database } {
  // 创建内存 SQLite 数据库
  const sqliteDb = new Database(':memory:');
  
  // 读取并执行迁移脚本
  const migrationPath = join(process.cwd(), 'migrations', '0001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  
  // 执行迁移（跳过最后的 INSERT 语句，因为我们会在测试中创建数据）
  const statements = migration.split(';').filter(s => s.trim() && !s.includes('INSERT INTO users'));
  statements.forEach(stmt => {
    if (stmt.trim()) {
      sqliteDb.exec(stmt);
    }
  });

  // 创建 D1 兼容的接口
  const db = {
    prepare: (query: string) => {
      const stmt = sqliteDb.prepare(query);
      const bindings: any[] = [];
      
      return {
        bind: (...args: any[]) => {
          bindings.push(...args);
          return {
            run: async () => {
              try {
                const result = stmt.run(...bindings);
                return { 
                  success: true, 
                  meta: { changes: result.changes }
                };
              } catch (error) {
                throw error;
              }
            },
            first: async () => {
              try {
                const result = stmt.get(...bindings);
                return result || null;
              } catch (error) {
                throw error;
              }
            },
            all: async () => {
              try {
                const results = stmt.all(...bindings);
                return { results };
              } catch (error) {
                throw error;
              }
            }
          };
        },
        run: async () => {
          try {
            const result = stmt.run();
            return { 
              success: true, 
              meta: { changes: result.changes }
            };
          } catch (error) {
            throw error;
          }
        },
        first: async () => {
          try {
            const result = stmt.get();
            return result || null;
          } catch (error) {
            throw error;
          }
        },
        all: async () => {
          try {
            const results = stmt.all();
            return { results };
          } catch (error) {
            throw error;
          }
        }
      };
    }
  };

  return {
    env: {
      DB: db as any,
      ENVIRONMENT: 'test'
    } as Environment,
    db: sqliteDb
  };
}

/**
 * Feature: app-keepalive-system, Property 18: 数据持久化一致性
 * 
 * 对于任何数据库写入操作（创建、更新任务或记录日志），
 * 数据应该正确持久化到数据库，并且在系统重启后仍然可用
 * 
 * 验证需求: 7.1, 7.2, 7.3
 */
describe('属性测试: 数据持久化一致性', () => {
  let env: Environment;
  let sqliteDb: Database.Database;

  beforeEach(() => {
    const testEnv = createTestEnvironment();
    env = testEnv.env;
    sqliteDb = testEnv.db;
  });

  afterEach(() => {
    if (sqliteDb) {
      sqliteDb.close();
    }
  });

  /**
   * 生成有效的日期字符串 (使用时间戳避免无效日期)
   */
  const validDateArbitrary = fc.integer({ 
    min: new Date('2020-01-01').getTime(), 
    max: new Date('2025-12-31').getTime() 
  }).map(timestamp => new Date(timestamp).toISOString());

  /**
   * 生成有效的用户数据
   */
  const userArbitrary = fc.record({
    id: fc.uuid(),
    username: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
    password_hash: fc.string({ minLength: 8, maxLength: 100 }).filter(s => {
      // 确保不是只有空格,且去除空格后仍然至少8个字符
      const trimmed = s.trim();
      return trimmed.length >= 8 && /[a-zA-Z0-9]/.test(s);
    }),
    role: fc.constantFrom('admin' as const, 'user' as const),
    created_at: validDateArbitrary,
    updated_at: validDateArbitrary
  });

  /**
   * 生成有效的保活任务配置
   */
  const keepaliveConfigArbitrary = fc.record({
    url: fc.webUrl(),
    method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
    headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
    body: fc.option(fc.string(), { nil: undefined }),
    timeout: fc.integer({ min: 1000, max: 300000 })
  });

  /**
   * 生成有效的通知任务配置
   */
  const notificationConfigArbitrary = fc.record({
    message: fc.string({ minLength: 1, maxLength: 1000 }),
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    priority: fc.option(fc.constantFrom('low', 'normal', 'high'), { nil: undefined }),
    notifyxConfig: fc.record({
      apiKey: fc.string({ minLength: 10, maxLength: 100 }),
      channelId: fc.string({ minLength: 5, maxLength: 50 }),
      message: fc.string({ minLength: 1, maxLength: 1000 }),
      title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      priority: fc.option(fc.constantFrom('low', 'normal', 'high'), { nil: undefined }),
      recipients: fc.option(fc.array(fc.string()), { nil: undefined })
    })
  });

  /**
   * 生成有效的任务数据 (需要提供 userId)
   */
  const taskArbitraryWithUser = (userId: string) => fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    type: fc.constantFrom('keepalive' as const, 'notification' as const),
    schedule: fc.constantFrom('*/5 * * * *', '0 0 * * *', '30 2 * * 1', '0 */6 * * *'),
    enabled: fc.boolean(),
    created_by: fc.constant(userId),
    created_at: validDateArbitrary,
    updated_at: validDateArbitrary,
    last_executed: fc.option(validDateArbitrary, { nil: undefined }),
    last_status: fc.option(fc.constantFrom('success' as const, 'failure' as const), { nil: undefined })
  }).chain(baseTask => {
    if (baseTask.type === 'keepalive') {
      return keepaliveConfigArbitrary.map(config => ({ ...baseTask, config }));
    } else {
      return notificationConfigArbitrary.map(config => ({ ...baseTask, config }));
    }
  });

  /**
   * 生成有效的执行日志数据 (需要提供 taskId)
   */
  const executionLogArbitraryWithTask = (taskId: string) => fc.record({
    id: fc.uuid(),
    task_id: fc.constant(taskId),
    execution_time: validDateArbitrary,
    status: fc.constantFrom('success' as const, 'failure' as const),
    response_time: fc.option(fc.integer({ min: 0, max: 300000 }), { nil: undefined }),
    status_code: fc.option(fc.integer({ min: 100, max: 599 }), { nil: undefined }),
    error_message: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }), // 减少长度
    details: fc.option(fc.string({ maxLength: 100 }).map(s => JSON.stringify({ message: s })), { nil: undefined }) // 简化JSON
  });

  /**
   * 生成有效的通知设置数据 (需要提供 userId)
   */
  const notificationSettingsArbitraryWithUser = (userId: string) => fc.record({
    id: fc.uuid(),
    user_id: fc.constant(userId),
    email_enabled: fc.boolean(),
    email_address: fc.option(fc.emailAddress(), { nil: undefined }),
    email_api_key: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
    webhook_enabled: fc.boolean(),
    webhook_url: fc.option(fc.webUrl(), { nil: undefined }),
    notifyx_enabled: fc.boolean(),
    notifyx_api_key: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
    failure_threshold: fc.integer({ min: 1, max: 100 }),
    created_at: validDateArbitrary,
    updated_at: validDateArbitrary
  });

  it('属性 18.1: 用户数据创建后应该能够被检索', async () => {
    await fc.assert(
      fc.asyncProperty(userArbitrary, async (userData) => {
        // 验证数据有效性
        const validation = UserModel.validate(userData);
        expect(validation.valid).toBe(true);

        // 创建用户
        const createResult = await DatabaseUtils.createUser(env, userData);
        expect(createResult.success).toBe(true);
        expect(createResult.data).toBeDefined();

        // 检索用户
        const getResult = await DatabaseUtils.getUserById(env, userData.id);
        expect(getResult.success).toBe(true);
        expect(getResult.data).toBeDefined();

        // 验证数据一致性
        if (getResult.data) {
          expect(getResult.data.id).toBe(userData.id);
          expect(getResult.data.username).toBe(userData.username);
          expect(getResult.data.role).toBe(userData.role);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('属性 18.2: 任务数据创建后应该能够被检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        taskArbitraryWithUser('dummy-user-id'), // 先生成任务模板
        async (userData, taskTemplate) => {
          // 先创建用户(满足外键约束)
          const userResult = await DatabaseUtils.createUser(env, userData);
          expect(userResult.success).toBe(true);

          // 使用实际的用户ID创建任务数据
          const taskData = { ...taskTemplate, created_by: userData.id };
          
          // 验证数据有效性
          const validation = TaskModel.validate(taskData);
          expect(validation.valid).toBe(true);

          // 创建任务
          const createResult = await DatabaseUtils.createTask(env, taskData as Task);
          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();

          // 检索任务
          const getResult = await DatabaseUtils.getTaskById(env, taskData.id);
          expect(getResult.success).toBe(true);
          expect(getResult.data).toBeDefined();

          // 验证数据一致性
          if (getResult.data) {
            expect(getResult.data.id).toBe(taskData.id);
            expect(getResult.data.name).toBe(taskData.name);
            expect(getResult.data.type).toBe(taskData.type);
            expect(getResult.data.enabled).toBe(taskData.enabled);
          }

          // 清理数据
          await DatabaseUtils.deleteTask(env, taskData.id);
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 18.3: 执行日志创建后应该能够被检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        taskArbitraryWithUser('dummy-user-id'),
        executionLogArbitraryWithTask('dummy-task-id'),
        async (userData, taskTemplate, logTemplate) => {
          // 先创建用户
          const userResult = await DatabaseUtils.createUser(env, userData);
          expect(userResult.success).toBe(true);

          // 创建任务
          const taskData = { ...taskTemplate, created_by: userData.id };
          const taskResult = await DatabaseUtils.createTask(env, taskData as Task);
          expect(taskResult.success).toBe(true);

          // 创建日志数据
          const logData = { ...logTemplate, task_id: taskData.id };
          
          // 验证数据有效性
          const validation = ExecutionLogModel.validate(logData);
          expect(validation.valid).toBe(true);

          // 创建日志
          const createResult = await DatabaseUtils.createExecutionLog(env, logData as ExecutionLog);
          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();

          // 检索日志
          const getResult = await DatabaseUtils.getExecutionLogById(env, logData.id);
          expect(getResult.success).toBe(true);
          expect(getResult.data).toBeDefined();

          // 验证数据一致性
          if (getResult.data) {
            expect(getResult.data.id).toBe(logData.id);
            expect(getResult.data.task_id).toBe(logData.task_id);
            expect(getResult.data.status).toBe(logData.status);
          }

          // 清理数据
          await DatabaseUtils.deleteTask(env, taskData.id);
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 50 } // 减少运行次数
    );
  }, 30000); // 增加超时时间到30秒

  it('属性 18.4: 通知设置创建后应该能够被检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        notificationSettingsArbitraryWithUser('dummy-user-id'),
        async (userData, settingsTemplate) => {
          // 先创建用户
          const userResult = await DatabaseUtils.createUser(env, userData);
          expect(userResult.success).toBe(true);

          // 创建通知设置数据
          const settingsData = { ...settingsTemplate, user_id: userData.id };
          
          // 验证数据有效性
          const validation = NotificationSettingsModel.validate(settingsData);
          expect(validation.valid).toBe(true);

          // 创建通知设置
          const createResult = await DatabaseUtils.createNotificationSettings(env, settingsData as NotificationSettings);
          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();

          // 检索通知设置
          const getResult = await DatabaseUtils.getNotificationSettingsByUserId(env, settingsData.user_id);
          expect(getResult.success).toBe(true);
          expect(getResult.data).toBeDefined();

          // 验证数据一致性
          if (getResult.data) {
            expect(getResult.data.user_id).toBe(settingsData.user_id);
            expect(getResult.data.failure_threshold).toBe(settingsData.failure_threshold);
          }

          // 清理数据
          await DatabaseUtils.deleteNotificationSettings(env, userData.id);
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 50 } // 减少运行次数
    );
  }, 30000); // 增加超时时间到30秒

  it('属性 18.5: 用户更新后数据应该保持一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        fc.record({
          username: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
          role: fc.constantFrom('admin' as const, 'user' as const)
        }),
        async (userData, updateData) => {
          // 创建用户
          const createResult = await DatabaseUtils.createUser(env, userData);
          expect(createResult.success).toBe(true);

          // 更新用户
          const updateResult = await DatabaseUtils.updateUser(env, userData.id, updateData);
          expect(updateResult.success).toBe(true);

          // 检索更新后的用户
          const getResult = await DatabaseUtils.getUserById(env, userData.id);
          expect(getResult.success).toBe(true);

          // 验证更新的字段已改变
          if (getResult.data) {
            expect(getResult.data.username).toBe(updateData.username);
            expect(getResult.data.role).toBe(updateData.role);
            // 验证未更新的字段保持不变
            expect(getResult.data.id).toBe(userData.id);
          }

          // 清理数据
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 18.6: 任务更新后数据应该保持一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        taskArbitraryWithUser('dummy-user-id'),
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          enabled: fc.boolean()
        }),
        async (userData, taskTemplate, updateData) => {
          // 先创建用户
          const userResult = await DatabaseUtils.createUser(env, userData);
          expect(userResult.success).toBe(true);

          // 创建任务
          const taskData = { ...taskTemplate, created_by: userData.id };
          const createResult = await DatabaseUtils.createTask(env, taskData as Task);
          expect(createResult.success).toBe(true);

          // 更新任务
          const updateResult = await DatabaseUtils.updateTask(env, taskData.id, updateData);
          expect(updateResult.success).toBe(true);

          // 检索更新后的任务
          const getResult = await DatabaseUtils.getTaskById(env, taskData.id);
          expect(getResult.success).toBe(true);

          // 验证更新的字段已改变
          if (getResult.data) {
            expect(getResult.data.name).toBe(updateData.name);
            expect(getResult.data.enabled).toBe(updateData.enabled);
            // 验证未更新的字段保持不变
            expect(getResult.data.id).toBe(taskData.id);
            expect(getResult.data.type).toBe(taskData.type);
          }

          // 清理数据
          await DatabaseUtils.deleteTask(env, taskData.id);
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 增加超时时间到30秒

  it('属性 18.7: 删除操作后数据应该不可检索', async () => {
    await fc.assert(
      fc.asyncProperty(userArbitrary, async (userData) => {
        // 创建用户
        const createResult = await DatabaseUtils.createUser(env, userData);
        expect(createResult.success).toBe(true);

        // 删除用户
        const deleteResult = await DatabaseUtils.deleteUser(env, userData.id);
        expect(deleteResult.success).toBe(true);

        // 尝试检索已删除的用户
        const getResult = await DatabaseUtils.getUserById(env, userData.id);
        expect(getResult.success).toBe(true);
        expect(getResult.data).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('属性 18.8: 数据库操作失败时应该返回错误信息', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          username: fc.string({ minLength: 1, maxLength: 2 }), // 故意使用无效的用户名
          password_hash: fc.string(),
          role: fc.constantFrom('admin' as const, 'user' as const),
          created_at: validDateArbitrary,
          updated_at: validDateArbitrary
        }),
        async (invalidUserData) => {
          // 尝试创建无效用户
          const result = await DatabaseUtils.createUser(env, invalidUserData as User);
          
          // 应该返回失败结果
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
