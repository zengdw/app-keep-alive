import { Environment } from '../types';

/**
 * 数据库连接和查询工具函数
 */
export class DatabaseService {
  private db: D1Database;

  constructor(env: Environment) {
    this.db = env.DB;
  }

  /**
   * 执行查询并返回结果
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return result.results as T[];
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`数据库查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行查询并返回单个结果
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return result as T | null;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`数据库查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行插入、更新或删除操作
   */
  async execute(sql: string, params: any[] = []): Promise<D1Result> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return result;
    } catch (error) {
      console.error('Database execute error:', error);
      throw new Error(`数据库操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行事务
   */
  async transaction(queries: Array<{ sql: string; params?: any[] }>): Promise<D1Result[]> {
    try {
      const statements = queries.map(({ sql, params = [] }) => 
        this.db.prepare(sql).bind(...params)
      );
      const results = await this.db.batch(statements);
      return results;
    } catch (error) {
      console.error('Database transaction error:', error);
      throw new Error(`数据库事务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 检查数据库连接
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * 生成UUID
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * 获取当前时间戳
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
}

/**
 * 创建数据库服务实例
 */
export function createDatabaseService(env: Environment): DatabaseService {
  return new DatabaseService(env);
}