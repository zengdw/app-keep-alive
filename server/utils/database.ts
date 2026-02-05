import { Environment } from '../types/index.js';

/**
 * 数据库工具类
 * 提供数据库连接和基础操作方法
 */
export class DatabaseUtils {
  /**
   * 测试数据库连接
   * @param env 环境变量
   * @returns 连接测试结果
   */
  static async testConnection(env: Environment): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await env.DB.prepare('SELECT 1 as test').first();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }

  /**
   * 检查表是否存在
   * @param env 环境变量
   * @param tableName 表名
   * @returns 表是否存在
   */
  static async tableExists(env: Environment, tableName: string): Promise<boolean> {
    try {
      const result = await env.DB.prepare(
        'SELECT name FROM sqlite_master WHERE type="table" AND name=?'
      ).bind(tableName).first();
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * 获取表的行数
   * @param env 环境变量
   * @param tableName 表名
   * @returns 行数
   */
  static async getTableRowCount(env: Environment, tableName: string): Promise<number> {
    try {
      const result = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
      return (result as any)?.count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 验证数据库架构完整性
   * @param env 环境变量
   * @returns 验证结果
   */
  static async validateSchema(env: Environment): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const requiredTables = ['users', 'tasks', 'execution_logs', 'notification_settings'];

    try {
      // 检查所有必需的表是否存在
      for (const table of requiredTables) {
        const exists = await this.tableExists(env, table);
        if (!exists) {
          errors.push(`表 ${table} 不存在`);
        }
      }

      // 检查索引是否存在
      const indexResult = await env.DB.prepare(
        'SELECT name FROM sqlite_master WHERE type="index" AND name LIKE "idx_%"'
      ).all();
      
      const expectedIndexes = [
        'idx_tasks_type',
        'idx_tasks_enabled', 
        'idx_tasks_created_by',
        'idx_execution_logs_task_id',
        'idx_execution_logs_execution_time',
        'idx_execution_logs_status'
      ];

      const existingIndexes = indexResult.results.map((row: any) => row.name);
      
      for (const expectedIndex of expectedIndexes) {
        if (!existingIndexes.includes(expectedIndex)) {
          errors.push(`索引 ${expectedIndex} 不存在`);
        }
      }

    } catch (error) {
      errors.push(`数据库架构验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行数据库健康检查
   * @param env 环境变量
   * @returns 健康检查结果
   */
  static async healthCheck(env: Environment): Promise<{
    healthy: boolean;
    details: {
      connection: boolean;
      schema: boolean;
      tables: Record<string, number>;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let connectionHealthy = false;
    let schemaHealthy = false;
    const tables: Record<string, number> = {};

    // 测试连接
    const connectionTest = await this.testConnection(env);
    connectionHealthy = connectionTest.success;
    if (!connectionHealthy && connectionTest.error) {
      errors.push(`数据库连接失败: ${connectionTest.error}`);
    }

    // 验证架构
    if (connectionHealthy) {
      const schemaValidation = await this.validateSchema(env);
      schemaHealthy = schemaValidation.valid;
      if (!schemaHealthy) {
        errors.push(...schemaValidation.errors);
      }

      // 获取表行数
      const tableNames = ['users', 'tasks', 'execution_logs', 'notification_settings'];
      for (const tableName of tableNames) {
        tables[tableName] = await this.getTableRowCount(env, tableName);
      }
    }

    return {
      healthy: connectionHealthy && schemaHealthy,
      details: {
        connection: connectionHealthy,
        schema: schemaHealthy,
        tables
      },
      errors
    };
  }
}