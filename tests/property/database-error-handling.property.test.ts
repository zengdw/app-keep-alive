import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseUtils } from '../../server/utils/database.js';
import type { User, Task, ExecutionLog, Environment } from '../../server/types/index.js';

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
              return { 
                success: true, 
                meta: { changes: result.changes }
              };
            },
            first: async () => {
              const result = stmt.get(...bindings);
              return result || null;
            },
            all: async () => {
              const results = stmt.all(...bindings);
              return { results };
            }
          };
        },
        run: async () => {
          const result = stmt.run();
          return { 
            success: true, 
            meta: { changes: result.changes }
          };
        },
        first: async () => {
          const result = stmt.get();
          return result || null;
        },
        all: async () => {
          const results = stmt.all();
          return { results };
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
 * 创建会抛出错误的数据库环境
 */
function createFailingDatabaseEnvironment(errorMessage: string): Environment {
  const db = {
    prepare: () => {
      return {
        bind: () => ({
          run: async () => { throw new Error(errorMessage); },
          first: async () => { throw new Error(errorMessage); },
          all: async () => { throw new Error(errorMessage); }
        }),
        run: async () => { throw new Error(errorMessage); },
        first: async () => { throw new Error(errorMessage); },
        all: async () => { throw new Error(errorMessage); }
      };
    }
  };

  return {
    DB: db as any,
    ENVIRONMENT: 'test'
  } as Environment;
}

/**
 * Feature: app-keepalive-system, Property 19: 数据库错误处理
 * 
 * 对于任何数据库操作失败，系统应该记录错误信息并提供适当的错误响应，
 * 不会导致系统崩溃
 * 
 * 验证需求: 7.4
 */
describe('属性测试: 数据库错误处理', () => {
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

  const validDateArbitrary = fc.integer({ 
    min: new Date('2020-01-01').getTime(), 
    max: new Date('2025-12-31').getTime() 
  }).map(timestamp => new Date(timestamp).toISOString());

  const userArbitrary = fc.record({
    id: fc.uuid(),
    username: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
    password_hash: fc.string({ minLength: 8, maxLength: 100 }).filter(s => {
      const trimmed = s.trim();
      return trimmed.length >= 8 && /[a-zA-Z0-9]/.test(s);
    }),
    role: fc.constantFrom('admin' as const, 'user' as const),
    created_at: validDateArbitrary,
    updated_at: validDateArbitrary
  });

  it('属性 19.1: 数据库连接失败时应该返回错误而不崩溃', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'SQLITE_BUSY: database is locked',
          'SQLITE_IOERR: disk I/O error',
          'SQLITE_CORRUPT: database disk image is malformed',
          'Connection timeout'
        ),
        async (errorMessage) => {
          const failingEnv = createFailingDatabaseEnvironment(errorMessage);
          
          const result = await DatabaseUtils.testConnection(failingEnv);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error).toContain('数据库操作失败');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 19.2: 创建用户失败时应该返回错误信息', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        fc.constantFrom(
          'UNIQUE constraint failed',
          'NOT NULL constraint failed',
          'FOREIGN KEY constraint failed'
        ),
        async (userData, errorType) => {
          const failingEnv = createFailingDatabaseEnvironment(errorType);
          
          const result = await DatabaseUtils.createUser(failingEnv, userData);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 19.3: 查询不存在的用户应该返回null而不是错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId) => {
          const result = await DatabaseUtils.getUserById(env, nonExistentId);
          
          expect(result.success).toBe(true);
          expect(result.data).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 19.4: 更新不存在的用户应该返回错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.record({
          username: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/)
        }),
        async (nonExistentId, updateData) => {
          const result = await DatabaseUtils.updateUser(env, nonExistentId, updateData);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('用户不存在');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 19.5: 删除不存在的用户应该成功（幂等性）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId) => {
          const result = await DatabaseUtils.deleteUser(env, nonExistentId);
          
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 19.6: 无效的用户数据应该被验证拒绝', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          username: fc.string({ minLength: 1, maxLength: 2 }), // 太短
          password_hash: fc.string({ minLength: 1, maxLength: 5 }), // 太短
          role: fc.constantFrom('admin' as const, 'user' as const),
          created_at: validDateArbitrary,
          updated_at: validDateArbitrary
        }),
        async (invalidUserData) => {
          const result = await DatabaseUtils.createUser(env, invalidUserData as User);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 19.7: 数据库查询失败时应该返回错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(
          'Query timeout',
          'Database locked',
          'Connection lost'
        ),
        async (userId, errorMessage) => {
          const failingEnv = createFailingDatabaseEnvironment(errorMessage);
          
          const result = await DatabaseUtils.getUserById(failingEnv, userId);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 19.8: 重复创建相同ID的用户应该失败', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (userData) => {
          const firstResult = await DatabaseUtils.createUser(env, userData);
          expect(firstResult.success).toBe(true);
          
          const secondResult = await DatabaseUtils.createUser(env, userData);
          
          expect(secondResult.success).toBe(false);
          expect(secondResult.error).toBeDefined();
          
          await DatabaseUtils.deleteUser(env, userData.id);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 19.9: 数据库操作重试机制应该在临时失败后恢复', async () => {
    let attemptCount = 0;
    const maxAttempts = 2;
    
    const intermittentFailureEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => {
              attemptCount++;
              if (attemptCount < maxAttempts) {
                throw new Error('Temporary failure');
              }
              return { success: true, meta: { changes: 1 } };
            },
            first: async () => {
              attemptCount++;
              if (attemptCount < maxAttempts) {
                throw new Error('Temporary failure');
              }
              return null;
            },
            all: async () => {
              attemptCount++;
              if (attemptCount < maxAttempts) {
                throw new Error('Temporary failure');
              }
              return { results: [] };
            }
          }),
          run: async () => {
            attemptCount++;
            if (attemptCount < maxAttempts) {
              throw new Error('Temporary failure');
            }
            return { success: true, meta: { changes: 1 } };
          },
          first: async () => {
            attemptCount++;
            if (attemptCount < maxAttempts) {
              throw new Error('Temporary failure');
            }
            return { test: 1 };
          },
          all: async () => {
            attemptCount++;
            if (attemptCount < maxAttempts) {
              throw new Error('Temporary failure');
            }
            return { results: [] };
          }
        })
      } as any,
      ENVIRONMENT: 'test'
    } as Environment;

    attemptCount = 0;
    const result = await DatabaseUtils.testConnection(intermittentFailureEnv);
    
    expect(result.success).toBe(true);
    expect(attemptCount).toBeGreaterThanOrEqual(maxAttempts);
  });

  it('属性 19.10: 持续失败的数据库操作应该在重试后返回错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Persistent connection error',
          'Database unavailable',
          'Network timeout'
        ),
        async (errorMessage) => {
          const persistentFailureEnv = createFailingDatabaseEnvironment(errorMessage);
          
          const result = await DatabaseUtils.testConnection(persistentFailureEnv);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('已重试');
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});
