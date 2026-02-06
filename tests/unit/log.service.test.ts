import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogService } from '../../server/services/log.service.js';
import { DatabaseUtils } from '../../server/utils/database.js';
import type { Environment } from '../../server/types/index.js';

// Mock DatabaseUtils
vi.mock('../../server/utils/database.js', () => ({
  DatabaseUtils: {
    createExecutionLog: vi.fn(),
    getExecutionLogById: vi.fn(),
    getExecutionLogsByTaskId: vi.fn(),
    getAllExecutionLogs: vi.fn(),
    getExecutionLogs: vi.fn(),
    deleteOldExecutionLogs: vi.fn(),
    getTaskById: vi.fn(),
  }
}));

describe('LogService', () => {
  let mockEnv: Environment;

  beforeEach(() => {
    mockEnv = {
      DB: {} as any,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'test-secret'
    };
    vi.clearAllMocks();
  });

  describe('logExecution', () => {
    it('应该成功记录执行日志', async () => {
      vi.mocked(DatabaseUtils.createExecutionLog).mockResolvedValue({
        success: true,
        data: {
          id: 'log-1',
          task_id: 'task-1',
          execution_time: new Date().toISOString(),
          status: 'success',
          response_time: 100,
          status_code: 200
        }
      });

      const result = await LogService.logExecution(
        mockEnv,
        'task-1',
        'success',
        100,
        200
      );

      expect(result.success).toBe(true);
      expect(DatabaseUtils.createExecutionLog).toHaveBeenCalled();
    });

    it('应该处理记录失败的情况', async () => {
      vi.mocked(DatabaseUtils.createExecutionLog).mockResolvedValue({
        success: false,
        error: '数据库错误'
      });

      const result = await LogService.logExecution(
        mockEnv,
        'task-1',
        'failure',
        100,
        500,
        '任务执行失败'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('数据库错误');
    });
  });

  describe('getExecutionLogs', () => {
    it('应该成功获取执行日志列表', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          task_id: 'task-1',
          execution_time: new Date().toISOString(),
          status: 'success' as const,
          response_time: 100,
          status_code: 200
        }
      ];

      vi.mocked(DatabaseUtils.getExecutionLogs).mockResolvedValue({
        success: true,
        data: mockLogs
      });

      const result = await LogService.getExecutionLogs(mockEnv, {
        taskId: 'task-1',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogs);
    });

    it('应该支持按任务类型筛选', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          task_id: 'task-1',
          execution_time: new Date().toISOString(),
          status: 'success' as const,
          response_time: 100,
          status_code: 200
        }
      ];

      vi.mocked(DatabaseUtils.getExecutionLogs).mockResolvedValue({
        success: true,
        data: mockLogs
      });

      vi.mocked(DatabaseUtils.getTaskById).mockResolvedValue({
        success: true,
        data: {
          id: 'task-1',
          name: '测试任务',
          type: 'keepalive',
          schedule: '*/5 * * * *',
          config: { url: 'https://example.com', method: 'GET', timeout: 30000 },
          enabled: true,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });

      const result = await LogService.getExecutionLogs(mockEnv, {
        taskType: 'keepalive',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
    });
  });

  describe('logError', () => {
    it('应该成功记录错误日志', async () => {
      vi.mocked(DatabaseUtils.createExecutionLog).mockResolvedValue({
        success: true,
        data: {
          id: 'error-log-1',
          task_id: 'system_error',
          execution_time: new Date().toISOString(),
          status: 'failure',
          error_message: '[DATABASE_ERROR] 连接失败'
        }
      });

      const result = await LogService.logError(
        mockEnv,
        'DATABASE_ERROR',
        '连接失败',
        'Error stack trace',
        { connection: 'db1' }
      );

      expect(result.success).toBe(true);
      expect(DatabaseUtils.createExecutionLog).toHaveBeenCalled();
    });
  });

  describe('getErrorLogs', () => {
    it('应该成功获取错误日志列表', async () => {
      const mockErrorLogs = [
        {
          id: 'error-1',
          task_id: 'system_error',
          execution_time: new Date().toISOString(),
          status: 'failure' as const,
          error_message: '[DATABASE_ERROR] 连接失败',
          details: JSON.stringify({
            error_type: 'DATABASE_ERROR',
            stack_trace: 'Error stack',
            context: { connection: 'db1' }
          })
        }
      ];

      vi.mocked(DatabaseUtils.getExecutionLogsByTaskId).mockResolvedValue({
        success: true,
        data: mockErrorLogs
      });

      const result = await LogService.getErrorLogs(mockEnv, 10, 0);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].error_type).toBe('DATABASE_ERROR');
    });
  });

  describe('logAudit', () => {
    it('应该成功记录审计日志', async () => {
      vi.mocked(DatabaseUtils.createExecutionLog).mockResolvedValue({
        success: true,
        data: {
          id: 'audit-1',
          task_id: 'audit_log',
          execution_time: new Date().toISOString(),
          status: 'success'
        }
      });

      const result = await LogService.logAudit(
        mockEnv,
        'user-1',
        'create_task',
        'task',
        'task-1',
        { name: '测试任务' }
      );

      expect(result.success).toBe(true);
      expect(DatabaseUtils.createExecutionLog).toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('应该成功获取审计日志列表', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          task_id: 'audit_log',
          execution_time: new Date().toISOString(),
          status: 'success' as const,
          details: JSON.stringify({
            user_id: 'user-1',
            action: 'create_task',
            resource_type: 'task',
            resource_id: 'task-1',
            audit_details: { name: '测试任务' }
          })
        }
      ];

      vi.mocked(DatabaseUtils.getExecutionLogsByTaskId).mockResolvedValue({
        success: true,
        data: mockAuditLogs
      });

      const result = await LogService.getAuditLogs(mockEnv, undefined, 10, 0);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].action).toBe('create_task');
    });

    it('应该支持按用户ID筛选', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          task_id: 'audit_log',
          execution_time: new Date().toISOString(),
          status: 'success' as const,
          details: JSON.stringify({
            user_id: 'user-1',
            action: 'create_task',
            resource_type: 'task',
            resource_id: 'task-1'
          })
        },
        {
          id: 'audit-2',
          task_id: 'audit_log',
          execution_time: new Date().toISOString(),
          status: 'success' as const,
          details: JSON.stringify({
            user_id: 'user-2',
            action: 'delete_task',
            resource_type: 'task',
            resource_id: 'task-2'
          })
        }
      ];

      vi.mocked(DatabaseUtils.getExecutionLogsByTaskId).mockResolvedValue({
        success: true,
        data: mockAuditLogs
      });

      const result = await LogService.getAuditLogs(mockEnv, 'user-1', 10, 0);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].user_id).toBe('user-1');
    });
  });

  describe('cleanupOldLogs', () => {
    it('应该成功清理旧日志', async () => {
      vi.mocked(DatabaseUtils.deleteOldExecutionLogs).mockResolvedValue({
        success: true,
        data: 50
      });

      const result = await LogService.cleanupOldLogs(mockEnv, 30);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(50);
      expect(DatabaseUtils.deleteOldExecutionLogs).toHaveBeenCalled();
    });

    it('应该处理清理失败的情况', async () => {
      vi.mocked(DatabaseUtils.deleteOldExecutionLogs).mockResolvedValue({
        success: false,
        error: '数据库错误'
      });

      const result = await LogService.cleanupOldLogs(mockEnv, 30);

      expect(result.success).toBe(false);
      expect(result.error).toContain('数据库错误');
    });
  });

  describe('getLogStatistics', () => {
    it('应该成功获取日志统计信息', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          task_id: 'task-1',
          execution_time: '2026-02-06T10:00:00Z',
          status: 'success' as const,
          response_time: 100
        },
        {
          id: 'log-2',
          task_id: 'system_error',
          execution_time: '2026-02-06T11:00:00Z',
          status: 'failure' as const
        },
        {
          id: 'log-3',
          task_id: 'audit_log',
          execution_time: '2026-02-06T12:00:00Z',
          status: 'success' as const
        }
      ];

      vi.mocked(DatabaseUtils.getAllExecutionLogs).mockResolvedValue({
        success: true,
        data: mockLogs
      });

      const result = await LogService.getLogStatistics(mockEnv);

      expect(result.success).toBe(true);
      expect(result.data?.totalLogs).toBe(3);
      expect(result.data?.executionLogs).toBe(1);
      expect(result.data?.errorLogs).toBe(1);
      expect(result.data?.auditLogs).toBe(1);
      expect(result.data?.successCount).toBe(2);
      expect(result.data?.failureCount).toBe(1);
    });
  });

  describe('rotateLogsAutomatically', () => {
    it('应该在日志数量超过限制时自动清理', async () => {
      // Mock统计信息显示日志过多
      vi.mocked(DatabaseUtils.getAllExecutionLogs).mockResolvedValue({
        success: true,
        data: Array(15000).fill({
          id: 'log-1',
          task_id: 'task-1',
          execution_time: new Date().toISOString(),
          status: 'success' as const
        })
      });

      vi.mocked(DatabaseUtils.deleteOldExecutionLogs).mockResolvedValue({
        success: true,
        data: 5000
      });

      const result = await LogService.rotateLogsAutomatically(mockEnv, 30, 10000);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThan(0);
      expect(DatabaseUtils.deleteOldExecutionLogs).toHaveBeenCalled();
    });

    it('应该在日志数量未超过限制时不清理', async () => {
      // Mock统计信息显示日志数量正常
      vi.mocked(DatabaseUtils.getAllExecutionLogs).mockResolvedValue({
        success: true,
        data: Array(5000).fill({
          id: 'log-1',
          task_id: 'task-1',
          execution_time: new Date().toISOString(),
          status: 'success' as const
        })
      });

      const result = await LogService.rotateLogsAutomatically(mockEnv, 30, 10000);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(DatabaseUtils.deleteOldExecutionLogs).not.toHaveBeenCalled();
    });
  });
});
