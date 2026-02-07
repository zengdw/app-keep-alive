import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TaskService } from '../../server/services/task.service.js';
import { DatabaseUtils } from '../../server/utils/database.js';
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

const taskTypeArbitrary = fc.constantFrom('keepalive' as const, 'notification' as const);

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
  message: fc.string({ minLength: 1, maxLength: 1000 }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  priority: fc.option(fc.constantFrom('low' as const, 'normal' as const, 'high' as const), { nil: undefined }),
  notifyxConfig: fc.record({
    apiKey: fc.string({ minLength: 10, maxLength: 50 }),
    channelId: fc.string({ minLength: 5, maxLength: 30 }),
    message: fc.string({ minLength: 1, maxLength: 1000 })
  })
});

/**
 * Feature: app-keepalive-system, Property 1: 任务创建完整性
 * 
 * 对于任何有效的任务配置（保活或通知类型），创建任务应该将所有必需字段正确保存到数据库，
 * 并且创建的任务应该包含所有提供的配置信息
 * 
 * 验证需求: 1.1, 1.2
 */
describe('属性测试: 任务创建完整性', () => {
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

  it('属性 1.1: 创建保活任务应该保存所有必需字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.boolean(),
        async (name, schedule, config, enabled) => {
          const result = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled },
            testUserId
          );

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          
          if (result.data) {
            expect(result.data.name).toBe(name);
            expect(result.data.type).toBe('keepalive');
            expect(result.data.schedule).toBe(schedule);
            expect(result.data.enabled).toBe(enabled);
            expect(result.data.created_by).toBe(testUserId);
            expect(result.data.id).toBeDefined();
            expect(result.data.created_at).toBeDefined();
            expect(result.data.updated_at).toBeDefined();
            
            // 验证配置完整性
            const savedConfig = result.data.config as KeepaliveConfig;
            expect(savedConfig.url).toBe(config.url);
            expect(savedConfig.method).toBe(config.method);
            expect(savedConfig.timeout).toBe(config.timeout);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('属性 1.2: 创建通知任务应该保存所有必需字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        notificationConfigArbitrary,
        fc.boolean(),
        async (name, schedule, config, enabled) => {
          const result = await TaskService.createTask(
            env,
            { name, type: 'notification', schedule, config, enabled },
            testUserId
          );

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          
          if (result.data) {
            expect(result.data.name).toBe(name);
            expect(result.data.type).toBe('notification');
            expect(result.data.schedule).toBe(schedule);
            expect(result.data.enabled).toBe(enabled);
            expect(result.data.created_by).toBe(testUserId);
            expect(result.data.id).toBeDefined();
            expect(result.data.created_at).toBeDefined();
            expect(result.data.updated_at).toBeDefined();
            
            // 验证配置完整性
            const savedConfig = result.data.config as NotificationConfig;
            expect(savedConfig.message).toBe(config.message);
            expect(savedConfig.notifyxConfig.apiKey).toBe(config.notifyxConfig.apiKey);
            expect(savedConfig.notifyxConfig.channelId).toBe(config.notifyxConfig.channelId);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 1.3: 创建的任务应该能够从数据库中检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskTypeArbitrary,
        cronScheduleArbitrary,
        async (name, type, schedule) => {
          const config = type === 'keepalive' 
            ? await fc.sample(keepaliveConfigArbitrary, 1)[0]
            : await fc.sample(notificationConfigArbitrary, 1)[0];
            
          const createResult = await TaskService.createTask(
            env,
            { name, type, schedule, config: config as any, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            const getResult = await TaskService.getTask(env, createResult.data.id);
            
            expect(getResult.success).toBe(true);
            expect(getResult.data).toBeDefined();
            expect(getResult.data?.id).toBe(createResult.data.id);
            expect(getResult.data?.name).toBe(name);
            expect(getResult.data?.type).toBe(type);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Feature: app-keepalive-system, Property 2: 任务更新一致性
 * 
 * 对于任何现有任务和有效的更新配置，更新操作应该只修改指定的字段，
 * 保持其他字段不变，并正确更新时间戳
 * 
 * 验证需求: 1.3
 */
describe('属性测试: 任务更新一致性', () => {
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

  it('属性 2.1: 更新任务名称应该只修改名称字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (originalName, newName, schedule, config) => {
          fc.pre(originalName !== newName);
          
          const createResult = await TaskService.createTask(
            env,
            { name: originalName, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            const originalTask = createResult.data;
            
            const updateResult = await TaskService.updateTask(
              env,
              originalTask.id,
              { name: newName },
              testUserId
            );

            expect(updateResult.success).toBe(true);
            expect(updateResult.data).toBeDefined();
            
            if (updateResult.data) {
              expect(updateResult.data.name).toBe(newName);
              expect(updateResult.data.type).toBe(originalTask.type);
              expect(updateResult.data.schedule).toBe(originalTask.schedule);
              expect(updateResult.data.enabled).toBe(originalTask.enabled);
              expect(updateResult.data.created_by).toBe(originalTask.created_by);
              expect(updateResult.data.created_at).toBe(originalTask.created_at);
              expect(updateResult.data.updated_at).not.toBe(originalTask.updated_at);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 2.2: 更新任务启用状态应该只修改enabled字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        fc.boolean(),
        async (name, schedule, config, initialEnabled) => {
          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: initialEnabled },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const originalTask = createResult.data;
            const newEnabled = !initialEnabled;
            
            const updateResult = await TaskService.updateTask(
              env,
              originalTask.id,
              { enabled: newEnabled },
              testUserId
            );

            expect(updateResult.success).toBe(true);
            
            if (updateResult.data) {
              expect(updateResult.data.enabled).toBe(newEnabled);
              expect(updateResult.data.name).toBe(originalTask.name);
              expect(updateResult.data.type).toBe(originalTask.type);
              expect(updateResult.data.schedule).toBe(originalTask.schedule);
              expect(updateResult.data.created_by).toBe(originalTask.created_by);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 2.3: 更新任务调度应该只修改schedule字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, originalSchedule, newSchedule, config) => {
          fc.pre(originalSchedule !== newSchedule);
          
          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule: originalSchedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const originalTask = createResult.data;
            
            const updateResult = await TaskService.updateTask(
              env,
              originalTask.id,
              { schedule: newSchedule },
              testUserId
            );

            expect(updateResult.success).toBe(true);
            
            if (updateResult.data) {
              expect(updateResult.data.schedule).toBe(newSchedule);
              expect(updateResult.data.name).toBe(originalTask.name);
              expect(updateResult.data.type).toBe(originalTask.type);
              expect(updateResult.data.enabled).toBe(originalTask.enabled);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 2.4: 非创建者不能更新任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (originalName, newName, schedule, config) => {
          const createResult = await TaskService.createTask(
            env,
            { name: originalName, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const otherUserId = await createTestUser(env, `other_${Date.now()}_${Math.random()}`);
            
            const updateResult = await TaskService.updateTask(
              env,
              createResult.data.id,
              { name: newName },
              otherUserId
            );

            expect(updateResult.success).toBe(false);
            expect(updateResult.error).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

/**
 * Feature: app-keepalive-system, Property 3: 任务删除完整性
 * 
 * 对于任何存在的任务，删除操作应该从数据库中完全移除任务记录，
 * 并且后续查询该任务应该返回不存在
 * 
 * 验证需求: 1.4
 */
describe('属性测试: 任务删除完整性', () => {
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

  it('属性 3.1: 删除任务后应该无法再查询到该任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          expect(createResult.data).toBeDefined();
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            
            const deleteResult = await TaskService.deleteTask(env, taskId, testUserId);
            expect(deleteResult.success).toBe(true);
            
            const getResult = await TaskService.getTask(env, taskId);
            expect(getResult.success).toBe(true);
            expect(getResult.data).toBeNull();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 3.2: 删除任务后该任务不应出现在列表中', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const taskId = createResult.data.id;
            
            const deleteResult = await TaskService.deleteTask(env, taskId, testUserId);
            expect(deleteResult.success).toBe(true);
            
            const listResult = await TaskService.listTasks(env);
            expect(listResult.success).toBe(true);
            
            if (listResult.data) {
              const foundTask = listResult.data.find(t => t.id === taskId);
              expect(foundTask).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 3.3: 非创建者不能删除任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          const createResult = await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          expect(createResult.success).toBe(true);
          
          if (createResult.data) {
            const otherUserId = await createTestUser(env, `other_${Date.now()}_${Math.random()}`);
            
            const deleteResult = await TaskService.deleteTask(
              env,
              createResult.data.id,
              otherUserId
            );

            expect(deleteResult.success).toBe(false);
            expect(deleteResult.error).toBeDefined();
            
            const getResult = await TaskService.getTask(env, createResult.data.id);
            expect(getResult.success).toBe(true);
            expect(getResult.data).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 3.4: 删除不存在的任务应该返回错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId) => {
          const deleteResult = await TaskService.deleteTask(env, nonExistentId, testUserId);
          expect(deleteResult.success).toBe(false);
          expect(deleteResult.error).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });
});

/**
 * Feature: app-keepalive-system, Property 4: 任务列表完整性
 * 
 * 对于任何任务筛选条件，列表查询应该返回所有匹配条件的任务，
 * 并且每个返回的任务应该包含所有必需的显示字段
 * 
 * 验证需求: 1.5
 */
describe('属性测试: 任务列表完整性', () => {
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

  it('属性 4.1: 列表应该包含所有创建的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: taskNameArbitrary,
            schedule: cronScheduleArbitrary,
            config: keepaliveConfigArbitrary
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (tasks) => {
          const createdIds: string[] = [];
          
          for (const task of tasks) {
            const result = await TaskService.createTask(
              env,
              { ...task, type: 'keepalive', enabled: true },
              testUserId
            );
            
            if (result.success && result.data) {
              createdIds.push(result.data.id);
            }
          }

          const listResult = await TaskService.listTasks(env);
          expect(listResult.success).toBe(true);
          expect(listResult.data).toBeDefined();
          
          if (listResult.data) {
            for (const id of createdIds) {
              const found = listResult.data.find(t => t.id === id);
              expect(found).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('属性 4.2: 按类型筛选应该只返回匹配类型的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        notificationConfigArbitrary,
        async (name1, name2, schedule, keepaliveConfig, notificationConfig) => {
          fc.pre(name1 !== name2);
          
          await TaskService.createTask(
            env,
            { name: name1, type: 'keepalive', schedule, config: keepaliveConfig, enabled: true },
            testUserId
          );
          
          await TaskService.createTask(
            env,
            { name: name2, type: 'notification', schedule, config: notificationConfig, enabled: true },
            testUserId
          );

          const keepaliveList = await TaskService.listTasks(env, { type: 'keepalive' });
          expect(keepaliveList.success).toBe(true);
          
          if (keepaliveList.data) {
            const allKeepalive = keepaliveList.data.every(t => t.type === 'keepalive');
            expect(allKeepalive).toBe(true);
          }

          const notificationList = await TaskService.listTasks(env, { type: 'notification' });
          expect(notificationList.success).toBe(true);
          
          if (notificationList.data) {
            const allNotification = notificationList.data.every(t => t.type === 'notification');
            expect(allNotification).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 4.3: 按启用状态筛选应该只返回匹配状态的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name1, name2, schedule, config) => {
          fc.pre(name1 !== name2);
          
          await TaskService.createTask(
            env,
            { name: name1, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );
          
          await TaskService.createTask(
            env,
            { name: name2, type: 'keepalive', schedule, config, enabled: false },
            testUserId
          );

          const enabledList = await TaskService.listTasks(env, { enabled: true });
          expect(enabledList.success).toBe(true);
          
          if (enabledList.data) {
            const allEnabled = enabledList.data.every(t => t.enabled === true);
            expect(allEnabled).toBe(true);
          }

          const disabledList = await TaskService.listTasks(env, { enabled: false });
          expect(disabledList.success).toBe(true);
          
          if (disabledList.data) {
            const allDisabled = disabledList.data.every(t => t.enabled === false);
            expect(allDisabled).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 4.4: 按创建者筛选应该只返回该用户创建的任务', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name1, name2, schedule, config) => {
          fc.pre(name1 !== name2);
          
          const user1Id = testUserId;
          const user2Id = await createTestUser(env, `user2_${Date.now()}_${Math.random()}`);
          
          await TaskService.createTask(
            env,
            { name: name1, type: 'keepalive', schedule, config, enabled: true },
            user1Id
          );
          
          await TaskService.createTask(
            env,
            { name: name2, type: 'keepalive', schedule, config, enabled: true },
            user2Id
          );

          const user1List = await TaskService.listTasks(env, { created_by: user1Id });
          expect(user1List.success).toBe(true);
          
          if (user1List.data) {
            const allUser1 = user1List.data.every(t => t.created_by === user1Id);
            expect(allUser1).toBe(true);
          }

          const user2List = await TaskService.listTasks(env, { created_by: user2Id });
          expect(user2List.success).toBe(true);
          
          if (user2List.data) {
            const allUser2 = user2List.data.every(t => t.created_by === user2Id);
            expect(allUser2).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('属性 4.5: 列表中的每个任务应该包含所有必需字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskNameArbitrary,
        cronScheduleArbitrary,
        keepaliveConfigArbitrary,
        async (name, schedule, config) => {
          await TaskService.createTask(
            env,
            { name, type: 'keepalive', schedule, config, enabled: true },
            testUserId
          );

          const listResult = await TaskService.listTasks(env);
          expect(listResult.success).toBe(true);
          expect(listResult.data).toBeDefined();
          
          if (listResult.data && listResult.data.length > 0) {
            for (const task of listResult.data) {
              expect(task.id).toBeDefined();
              expect(task.name).toBeDefined();
              expect(task.type).toBeDefined();
              expect(task.schedule).toBeDefined();
              expect(task.config).toBeDefined();
              expect(task.enabled).toBeDefined();
              expect(task.created_by).toBeDefined();
              expect(task.created_at).toBeDefined();
              expect(task.updated_at).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
