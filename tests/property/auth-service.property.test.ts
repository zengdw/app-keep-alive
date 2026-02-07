import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AuthService } from '../../server/services/auth.service.js';
import { DatabaseUtils } from '../../server/utils/database.js';
import type { Environment } from '../../server/types/index.js';

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
 * Feature: app-keepalive-system, Property 10: 用户认证正确性
 * 
 * 对于任何用户凭据，认证系统应该正确验证凭据的有效性，
 * 对有效凭据授予访问权限，对无效凭据拒绝访问
 * 
 * 验证需求: 4.1, 4.2, 4.3
 */
describe('属性测试: 用户认证正确性', () => {
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

  // 使用随机数和时间戳确保唯一性
  const uniqueUsernameArbitrary = fc.integer({ min: 1000, max: 9999 }).map(n => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `u${n}${timestamp}${random}`.substring(0, 20);
  });
  const validPasswordArbitrary = fc.string({ minLength: 8, maxLength: 20 })
    .filter(s => /^[a-zA-Z0-9]+$/.test(s) && /[a-zA-Z]/.test(s) && /[0-9]/.test(s));
  const validRoleArbitrary = fc.constantFrom('admin' as const, 'user' as const);

  it('属性 10.1: 使用正确的凭据应该成功认证', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);
          expect(registerResult.token).toBeDefined();

          const authResult = await AuthService.authenticate(env, username, password);
          expect(authResult.success).toBe(true);
          expect(authResult.token).toBeDefined();
          expect(authResult.user?.username).toBe(username);
          expect(authResult.user?.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 10.2: 使用错误的密码应该拒绝认证', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, correctPassword, wrongPassword, role) => {
          fc.pre(correctPassword !== wrongPassword);
          const registerResult = await AuthService.register(env, username, correctPassword, role);
          expect(registerResult.success).toBe(true);

          const authResult = await AuthService.authenticate(env, username, wrongPassword);
          expect(authResult.success).toBe(false);
          expect(authResult.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 10.3: 使用不存在的用户名应该拒绝认证', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        async (username, password) => {
          const authResult = await AuthService.authenticate(env, username, password);
          expect(authResult.success).toBe(false);
          expect(authResult.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 10.4: 空用户名或密码应该拒绝认证', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', ' ', '  '),
        fc.constantFrom('', ' ', '  '),
        async (emptyUsername, emptyPassword) => {
          const authResult = await AuthService.authenticate(env, emptyUsername, emptyPassword);
          expect(authResult.success).toBe(false);
          expect(authResult.error).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('属性 10.5: 认证成功后返回的令牌应该有效', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          const authResult = await AuthService.authenticate(env, username, password);
          expect(authResult.success).toBe(true);

          if (authResult.token) {
            const user = await AuthService.validateToken(env, authResult.token);
            expect(user).toBeDefined();
            expect(user?.username).toBe(username);
            expect(user?.role).toBe(role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: app-keepalive-system, Property 11: 会话管理一致性
 * 
 * 对于任何用户会话，系统应该正确处理会话的创建、验证、过期和清除操作
 * 
 * 验证需求: 4.4, 4.5
 */
describe('属性测试: 会话管理一致性', () => {
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

  // 使用随机数和时间戳确保唯一性
  const uniqueUsernameArbitrary = fc.integer({ min: 1000, max: 9999 }).map(n => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `u${n}${timestamp}${random}`.substring(0, 20);
  });
  const validPasswordArbitrary = fc.string({ minLength: 8, maxLength: 20 })
    .filter(s => /^[a-zA-Z0-9]+$/.test(s) && /[a-zA-Z]/.test(s) && /[0-9]/.test(s));
  const validRoleArbitrary = fc.constantFrom('admin' as const, 'user' as const);

  it('属性 11.1: 生成的令牌应该能够被验证', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          if (registerResult.token) {
            const user = await AuthService.validateToken(env, registerResult.token);
            expect(user).toBeDefined();
            expect(user?.username).toBe(username);
            expect(user?.role).toBe(role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.2: 无效的令牌应该被拒绝', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (invalidToken) => {
          const user = await AuthService.validateToken(env, invalidToken);
          expect(user).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.3: 过期的令牌应该被拒绝', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          const userResult = await DatabaseUtils.getUserByUsername(env, username);
          if (userResult.data) {
            const expiredToken = await AuthService.generateToken(userResult.data, -1, env.JWT_SECRET);
            await new Promise(resolve => setTimeout(resolve, 100));
            const user = await AuthService.validateToken(env, expiredToken);
            expect(user).toBeNull();
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  it('属性 11.4: 刷新令牌应该生成新的有效令牌', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);
          expect(registerResult.token).toBeDefined();

          if (registerResult.token) {
            const newToken = await AuthService.refreshToken(env, registerResult.token);
            expect(newToken).not.toBeNull();
            expect(newToken).toBeDefined();
            
            if (newToken) {
              expect(newToken).not.toBe(registerResult.token);
              
              const user = await AuthService.validateToken(env, newToken);
              expect(user).not.toBeNull();
              expect(user).toBeDefined();
              
              if (user) {
                expect(user.username).toBe(username);
                expect(user.role).toBe(role);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.5: 从请求头中提取的令牌应该能够被验证', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          if (registerResult.token) {
            const request = new Request('https://example.com', {
              headers: { 'Authorization': `Bearer ${registerResult.token}` }
            });

            const extractedToken = AuthService.extractTokenFromRequest(request);
            expect(extractedToken).toBe(registerResult.token);

            if (extractedToken) {
              const user = await AuthService.validateToken(env, extractedToken);
              expect(user).toBeDefined();
              expect(user?.username).toBe(username);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.6: 使用错误密钥签名的令牌应该被拒绝', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        fc.string({ minLength: 20, maxLength: 50 }),
        async (username, password, role, wrongSecret) => {
          fc.pre(wrongSecret !== env.JWT_SECRET);

          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          const userResult = await DatabaseUtils.getUserByUsername(env, username);
          if (userResult.data) {
            const tokenWithWrongSecret = await AuthService.generateToken(
              userResult.data,
              3600,
              wrongSecret
            );
            const user = await AuthService.validateToken(env, tokenWithWrongSecret);
            expect(user).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.7: 认证请求应该正确处理会话', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueUsernameArbitrary,
        validPasswordArbitrary,
        validRoleArbitrary,
        async (username, password, role) => {
          const registerResult = await AuthService.register(env, username, password, role);
          expect(registerResult.success).toBe(true);

          if (registerResult.token) {
            const validRequest = new Request('https://example.com', {
              headers: { 'Authorization': `Bearer ${registerResult.token}` }
            });

            const user = await AuthService.authenticateRequest(env, validRequest);
            expect(user).toBeDefined();
            expect(user?.username).toBe(username);

            const invalidRequest = new Request('https://example.com');
            const noUser = await AuthService.authenticateRequest(env, invalidRequest);
            expect(noUser).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 11.8: 密码哈希应该是确定性的', async () => {
    await fc.assert(
      fc.asyncProperty(
        validPasswordArbitrary,
        async (password) => {
          const hash1 = await AuthService.hashPassword(password);
          const hash2 = await AuthService.hashPassword(password);
          expect(hash1).toBe(hash2);
          
          const isValid = await AuthService.verifyPassword(password, hash1);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
