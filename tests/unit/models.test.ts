import { describe, it, expect } from 'vitest';
import { UserModel } from '../../server/models/user.model.js';
import { TaskModel } from '../../server/models/task.model.js';
import { ExecutionLogModel } from '../../server/models/execution-log.model.js';
import { NotificationSettingsModel } from '../../server/models/notification-settings.model.js';

describe('数据模型测试', () => {
  describe('用户模型验证', () => {
    it('应该验证有效的用户名', () => {
      expect(UserModel.validateUsername('validuser')).toBe(true);
      expect(UserModel.validateUsername('user123')).toBe(true);
      expect(UserModel.validateUsername('test_user')).toBe(true);
    });

    it('应该拒绝无效的用户名', () => {
      expect(UserModel.validateUsername('ab')).toBe(false); // 太短
      expect(UserModel.validateUsername('a'.repeat(21))).toBe(false); // 太长
      expect(UserModel.validateUsername('user@name')).toBe(false); // 包含特殊字符
      expect(UserModel.validateUsername('')).toBe(false); // 空字符串
    });

    it('应该验证有效的密码', () => {
      expect(UserModel.validatePassword('Password123')).toBe(true);
      expect(UserModel.validatePassword('Test1234')).toBe(true);
    });

    it('应该拒绝无效的密码', () => {
      expect(UserModel.validatePassword('short1')).toBe(false); // 太短
      expect(UserModel.validatePassword('NoNumbers')).toBe(false); // 没有数字
      expect(UserModel.validatePassword('12345678')).toBe(false); // 没有字母
      expect(UserModel.validatePassword('')).toBe(false); // 空字符串
    });

    it('应该验证有效的用户角色', () => {
      expect(UserModel.validateRole('admin')).toBe(true);
      expect(UserModel.validateRole('user')).toBe(true);
    });

    it('应该拒绝无效的用户角色', () => {
      expect(UserModel.validateRole('superadmin')).toBe(false);
      expect(UserModel.validateRole('guest')).toBe(false);
      expect(UserModel.validateRole('')).toBe(false);
    });

    it('应该验证完整的用户数据', () => {
      const validUser = {
        username: 'testuser',
        password_hash: 'hashed_password',
        role: 'user' as const
      };
      
      const validation = UserModel.validate(validUser);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该拒绝无效的用户数据', () => {
      const invalidUser = {
        username: 'ab', // 太短
        password_hash: '',
        role: 'invalid' as any
      };
      
      const validation = UserModel.validate(invalidUser);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('任务模型验证', () => {
    it('应该验证有效的任务名称', () => {
      expect(TaskModel.validateName('测试任务')).toBe(true);
      expect(TaskModel.validateName('Test Task')).toBe(true);
      expect(TaskModel.validateName('a')).toBe(true);
    });

    it('应该拒绝无效的任务名称', () => {
      expect(TaskModel.validateName('')).toBe(false);
      expect(TaskModel.validateName('   ')).toBe(false);
      expect(TaskModel.validateName('a'.repeat(101))).toBe(false);
    });

    it('应该验证有效的任务类型', () => {
      expect(TaskModel.validateType('keepalive')).toBe(true);
      expect(TaskModel.validateType('notification')).toBe(true);
    });

    it('应该拒绝无效的任务类型', () => {
      expect(TaskModel.validateType('invalid')).toBe(false);
      expect(TaskModel.validateType('')).toBe(false);
    });

    it('应该验证有效的Cron表达式', () => {
      expect(TaskModel.validateSchedule('*/5 * * * *')).toBe(true);
      expect(TaskModel.validateSchedule('0 0 * * *')).toBe(true);
      expect(TaskModel.validateSchedule('30 2 * * 1')).toBe(true);
    });

    it('应该拒绝无效的Cron表达式', () => {
      expect(TaskModel.validateSchedule('invalid')).toBe(false);
      expect(TaskModel.validateSchedule('')).toBe(false);
      expect(TaskModel.validateSchedule('* * * *')).toBe(false); // 缺少字段
    });

    it('应该验证有效的保活任务配置', () => {
      const config = {
        url: 'https://example.com',
        method: 'GET' as const,
        timeout: 30000
      };
      
      const validation = TaskModel.validateKeepaliveConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该拒绝无效的保活任务配置', () => {
      const config = {
        url: 'invalid-url',
        method: 'INVALID' as any,
        timeout: -1
      };
      
      const validation = TaskModel.validateKeepaliveConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('应该验证有效的通知任务配置', () => {
      const config = {
        message: '测试通知',
        priority: 'normal' as const,
        notifyxConfig: {
          apiKey: 'test-key',
          channelId: 'test-channel',
          message: '测试消息'
        }
      };
      
      const validation = TaskModel.validateNotificationConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('执行日志模型验证', () => {
    it('应该验证有效的任务ID', () => {
      expect(ExecutionLogModel.validateTaskId('task-123')).toBe(true);
      expect(ExecutionLogModel.validateTaskId('abc')).toBe(true);
    });

    it('应该拒绝无效的任务ID', () => {
      expect(ExecutionLogModel.validateTaskId('')).toBe(false);
      expect(ExecutionLogModel.validateTaskId('   ')).toBe(false);
    });

    it('应该验证有效的执行状态', () => {
      expect(ExecutionLogModel.validateStatus('success')).toBe(true);
      expect(ExecutionLogModel.validateStatus('failure')).toBe(true);
    });

    it('应该拒绝无效的执行状态', () => {
      expect(ExecutionLogModel.validateStatus('pending')).toBe(false);
      expect(ExecutionLogModel.validateStatus('')).toBe(false);
    });

    it('应该验证有效的响应时间', () => {
      expect(ExecutionLogModel.validateResponseTime(0)).toBe(true);
      expect(ExecutionLogModel.validateResponseTime(1000)).toBe(true);
      expect(ExecutionLogModel.validateResponseTime(30000)).toBe(true);
    });

    it('应该拒绝无效的响应时间', () => {
      expect(ExecutionLogModel.validateResponseTime(-1)).toBe(false);
      expect(ExecutionLogModel.validateResponseTime(300001)).toBe(false);
    });

    it('应该验证有效的HTTP状态码', () => {
      expect(ExecutionLogModel.validateStatusCode(200)).toBe(true);
      expect(ExecutionLogModel.validateStatusCode(404)).toBe(true);
      expect(ExecutionLogModel.validateStatusCode(500)).toBe(true);
    });

    it('应该拒绝无效的HTTP状态码', () => {
      expect(ExecutionLogModel.validateStatusCode(99)).toBe(false);
      expect(ExecutionLogModel.validateStatusCode(600)).toBe(false);
    });
  });

  describe('通知设置模型验证', () => {
    it('应该验证有效的邮箱地址', () => {
      expect(NotificationSettingsModel.validateEmail('test@example.com')).toBe(true);
      expect(NotificationSettingsModel.validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('应该拒绝无效的邮箱地址', () => {
      expect(NotificationSettingsModel.validateEmail('invalid')).toBe(false);
      expect(NotificationSettingsModel.validateEmail('test@')).toBe(false);
      expect(NotificationSettingsModel.validateEmail('@example.com')).toBe(false);
      expect(NotificationSettingsModel.validateEmail('')).toBe(false);
    });

    it('应该验证有效的Webhook URL', () => {
      expect(NotificationSettingsModel.validateWebhookUrl('https://example.com/webhook')).toBe(true);
      expect(NotificationSettingsModel.validateWebhookUrl('http://localhost:3000/hook')).toBe(true);
    });

    it('应该拒绝无效的Webhook URL', () => {
      expect(NotificationSettingsModel.validateWebhookUrl('ftp://example.com')).toBe(false);
      expect(NotificationSettingsModel.validateWebhookUrl('invalid-url')).toBe(false);
      expect(NotificationSettingsModel.validateWebhookUrl('')).toBe(false);
    });

    it('应该验证有效的失败阈值', () => {
      expect(NotificationSettingsModel.validateFailureThreshold(1)).toBe(true);
      expect(NotificationSettingsModel.validateFailureThreshold(50)).toBe(true);
      expect(NotificationSettingsModel.validateFailureThreshold(100)).toBe(true);
    });

    it('应该拒绝无效的失败阈值', () => {
      expect(NotificationSettingsModel.validateFailureThreshold(0)).toBe(false);
      expect(NotificationSettingsModel.validateFailureThreshold(101)).toBe(false);
      expect(NotificationSettingsModel.validateFailureThreshold(-1)).toBe(false);
    });

    it('应该验证有效的邮件 API 密钥', () => {
      expect(NotificationSettingsModel.validateEmailApiKey('re_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(NotificationSettingsModel.validateEmailApiKey('sk_test_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true);
    });

    it('应该拒绝无效的邮件 API 密钥', () => {
      expect(NotificationSettingsModel.validateEmailApiKey('short')).toBe(false);
      expect(NotificationSettingsModel.validateEmailApiKey('')).toBe(false);
      expect(NotificationSettingsModel.validateEmailApiKey('a'.repeat(501))).toBe(false);
    });

    it('应该验证完整的通知设置数据', () => {
      const validSettings = {
        user_id: 'user-123',
        email_enabled: true,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz',
        failure_threshold: 3
      };
      
      const validation = NotificationSettingsModel.validate(validSettings);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该拒绝启用邮件但缺少邮箱地址的设置', () => {
      const invalidSettings = {
        user_id: 'user-123',
        email_enabled: true,
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz'
      };
      
      const validation = NotificationSettingsModel.validate(invalidSettings);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('邮箱地址'))).toBe(true);
    });
  });

  describe('用户模型转换和序列化', () => {
    it('应该正确创建用户对象', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password',
        role: 'user' as const
      };
      
      const user = UserModel.create(userData);
      
      expect(user.id).toBe(userData.id);
      expect(user.username).toBe(userData.username);
      expect(user.password_hash).toBe(userData.password_hash);
      expect(user.role).toBe(userData.role);
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
    });

    it('应该使用默认角色创建用户', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password'
      };
      
      const user = UserModel.create(userData);
      expect(user.role).toBe('user');
    });

    it('应该正确更新用户对象', () => {
      const existingUser = UserModel.create({
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password'
      });
      
      // 等待1毫秒确保时间戳不同
      const originalUpdatedAt = existingUser.updated_at;
      
      const updatedUser = UserModel.update(existingUser, {
        role: 'admin'
      });
      
      expect(updatedUser.id).toBe(existingUser.id);
      expect(updatedUser.username).toBe(existingUser.username);
      expect(updatedUser.role).toBe('admin');
      expect(updatedUser.updated_at).toBeDefined();
      // 验证updated_at字段存在且是有效的ISO日期字符串
      expect(new Date(updatedUser.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdatedAt).getTime());
    });

    it('应该从数据库行创建用户对象', () => {
      const row = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const user = UserModel.fromDatabaseRow(row);
      
      expect(user.id).toBe(row.id);
      expect(user.username).toBe(row.username);
      expect(user.role).toBe(row.role);
    });

    it('应该转换为数据库插入格式', () => {
      const user = UserModel.create({
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password',
        role: 'admin'
      });
      
      const dbData = UserModel.toDatabaseInsert(user);
      
      expect(dbData.id).toBe(user.id);
      expect(dbData.username).toBe(user.username);
      expect(dbData.password_hash).toBe(user.password_hash);
      expect(dbData.role).toBe(user.role);
    });
  });

  describe('任务模型转换和序列化', () => {
    it('应该正确创建保活任务对象', () => {
      const taskData = {
        id: 'task-123',
        name: '测试保活任务',
        type: 'keepalive' as const,
        schedule: '*/5 * * * *',
        config: {
          url: 'https://example.com',
          method: 'GET' as const,
          timeout: 30000
        },
        created_by: 'user-123'
      };
      
      const task = TaskModel.create(taskData);
      
      expect(task.id).toBe(taskData.id);
      expect(task.name).toBe(taskData.name);
      expect(task.type).toBe(taskData.type);
      expect(task.enabled).toBe(true);
      expect(task.created_at).toBeDefined();
    });

    it('应该正确创建通知任务对象', () => {
      const taskData = {
        id: 'task-456',
        name: '测试通知任务',
        type: 'notification' as const,
        schedule: '0 9 * * *',
        config: {
          message: '测试通知',
          priority: 'normal' as const,
          notifyxConfig: {
            apiKey: 'test-key',
            channelId: 'test-channel',
            message: '测试消息'
          }
        },
        created_by: 'user-123',
        enabled: false
      };
      
      const task = TaskModel.create(taskData);
      
      expect(task.enabled).toBe(false);
      expect(task.config).toEqual(taskData.config);
    });

    it('应该正确更新任务对象', () => {
      const existingTask = TaskModel.create({
        id: 'task-123',
        name: '原任务名',
        type: 'keepalive',
        schedule: '*/5 * * * *',
        config: {
          url: 'https://example.com',
          method: 'GET',
          timeout: 30000
        },
        created_by: 'user-123'
      });
      
      const updatedTask = TaskModel.update(existingTask, {
        name: '新任务名',
        enabled: false
      });
      
      expect(updatedTask.name).toBe('新任务名');
      expect(updatedTask.enabled).toBe(false);
      expect(updatedTask.id).toBe(existingTask.id);
    });

    it('应该从数据库行创建任务对象', () => {
      const row = {
        id: 'task-123',
        name: '测试任务',
        type: 'keepalive',
        schedule: '*/5 * * * *',
        config: JSON.stringify({
          url: 'https://example.com',
          method: 'GET',
          timeout: 30000
        }),
        enabled: 1,
        created_by: 'user-123',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        last_executed: '2024-01-01T01:00:00.000Z',
        last_status: 'success'
      };
      
      const task = TaskModel.fromDatabaseRow(row);
      
      expect(task.id).toBe(row.id);
      expect(task.enabled).toBe(true);
      expect(task.config).toEqual(JSON.parse(row.config));
      expect(task.last_executed).toBe(row.last_executed);
    });

    it('应该转换为数据库插入格式', () => {
      const task = TaskModel.create({
        id: 'task-123',
        name: '测试任务',
        type: 'keepalive',
        schedule: '*/5 * * * *',
        config: {
          url: 'https://example.com',
          method: 'GET',
          timeout: 30000
        },
        created_by: 'user-123'
      });
      
      const dbData = TaskModel.toDatabaseInsert(task);
      
      expect(dbData.id).toBe(task.id);
      expect(dbData.config).toBe(JSON.stringify(task.config));
      expect(dbData.enabled).toBe(1);
      expect(dbData.last_executed).toBe(null);
    });
  });

  describe('执行日志模型转换和序列化', () => {
    it('应该正确创建执行日志对象', () => {
      const logData = {
        id: 'log-123',
        task_id: 'task-123',
        status: 'success' as const,
        response_time: 1500,
        status_code: 200
      };
      
      const log = ExecutionLogModel.create(logData);
      
      expect(log.id).toBe(logData.id);
      expect(log.task_id).toBe(logData.task_id);
      expect(log.status).toBe(logData.status);
      expect(log.execution_time).toBeDefined();
    });

    it('应该正确创建成功日志', () => {
      const log = ExecutionLogModel.createSuccessLog(
        'task-123',
        1500,
        200,
        { message: '请求成功' }
      );
      
      expect(log.status).toBe('success');
      expect(log.response_time).toBe(1500);
      expect(log.status_code).toBe(200);
      expect(log.details).toBeDefined();
    });

    it('应该正确创建失败日志', () => {
      const log = ExecutionLogModel.createFailureLog(
        'task-123',
        '连接超时',
        0,
        { error: 'ETIMEDOUT' }
      );
      
      expect(log.status).toBe('failure');
      expect(log.error_message).toBe('连接超时');
      expect(log.details).toBeDefined();
    });

    it('应该从数据库行创建执行日志对象', () => {
      const row = {
        id: 'log-123',
        task_id: 'task-123',
        execution_time: '2024-01-01T00:00:00.000Z',
        status: 'success',
        response_time: 1500,
        status_code: 200,
        error_message: null,
        details: JSON.stringify({ message: '成功' })
      };
      
      const log = ExecutionLogModel.fromDatabaseRow(row);
      
      expect(log.id).toBe(row.id);
      expect(log.status).toBe(row.status);
      expect(log.response_time).toBe(row.response_time);
    });

    it('应该转换为数据库插入格式', () => {
      const log = ExecutionLogModel.createSuccessLog('task-123', 1500, 200);
      const dbData = ExecutionLogModel.toDatabaseInsert(log);
      
      expect(dbData.id).toBe(log.id);
      expect(dbData.task_id).toBe(log.task_id);
      expect(dbData.status).toBe(log.status);
      expect(dbData.response_time).toBe(log.response_time);
    });

    it('应该验证有效的详细信息JSON', () => {
      const validDetails = JSON.stringify({ key: 'value' });
      expect(ExecutionLogModel.validateDetails(validDetails)).toBe(true);
    });

    it('应该拒绝无效的详细信息JSON', () => {
      expect(ExecutionLogModel.validateDetails('invalid json')).toBe(false);
      expect(ExecutionLogModel.validateDetails('a'.repeat(10001))).toBe(false);
    });
  });

  describe('通知设置模型转换和序列化', () => {
    it('应该正确创建通知设置对象', () => {
      const settingsData = {
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: true,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz',
        failure_threshold: 5
      };
      
      const settings = NotificationSettingsModel.create(settingsData);
      
      expect(settings.id).toBe(settingsData.id);
      expect(settings.user_id).toBe(settingsData.user_id);
      expect(settings.email_enabled).toBe(true);
      expect(settings.failure_threshold).toBe(5);
      expect(settings.created_at).toBeDefined();
    });

    it('应该使用默认值创建通知设置', () => {
      const settingsData = {
        id: 'settings-123',
        user_id: 'user-123'
      };
      
      const settings = NotificationSettingsModel.create(settingsData);
      
      expect(settings.email_enabled).toBe(false);
      expect(settings.webhook_enabled).toBe(false);
      expect(settings.failure_threshold).toBe(3);
    });

    it('应该正确更新通知设置对象', () => {
      const existingSettings = NotificationSettingsModel.create({
        id: 'settings-123',
        user_id: 'user-123'
      });
      
      const originalUpdatedAt = existingSettings.updated_at;
      
      const updatedSettings = NotificationSettingsModel.update(existingSettings, {
        email_enabled: true,
        email_address: 'new@example.com',
        email_api_key: 're_newapikey1234567890abcdefghijklmnopqrstuvwxyz'
      });
      
      expect(updatedSettings.email_enabled).toBe(true);
      expect(updatedSettings.email_address).toBe('new@example.com');
      expect(updatedSettings.updated_at).toBeDefined();
      // 验证updated_at字段存在且是有效的ISO日期字符串
      expect(new Date(updatedSettings.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdatedAt).getTime());
    });

    it('应该从数据库行创建通知设置对象', () => {
      const row = {
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: 1,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz',
        webhook_enabled: 0,
        webhook_url: null,
        notifyx_enabled: 0,
        notifyx_api_key: null,
        failure_threshold: 3,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const settings = NotificationSettingsModel.fromDatabaseRow(row);
      
      expect(settings.email_enabled).toBe(true);
      expect(settings.webhook_enabled).toBe(false);
      expect(settings.email_address).toBe(row.email_address);
    });

    it('应该转换为数据库插入格式', () => {
      const settings = NotificationSettingsModel.create({
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: true,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz'
      });
      
      const dbData = NotificationSettingsModel.toDatabaseInsert(settings);
      
      expect(dbData.email_enabled).toBe(1);
      expect(dbData.webhook_enabled).toBe(0);
      expect(dbData.email_address).toBe(settings.email_address);
    });

    it('应该正确判断是否需要发送通知', () => {
      const settings = NotificationSettingsModel.create({
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: true,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz',
        failure_threshold: 3
      });
      
      expect(NotificationSettingsModel.shouldSendNotification(settings, 2)).toBe(false);
      expect(NotificationSettingsModel.shouldSendNotification(settings, 3)).toBe(true);
      expect(NotificationSettingsModel.shouldSendNotification(settings, 5)).toBe(true);
    });

    it('应该正确获取可用的通知渠道', () => {
      const settings = NotificationSettingsModel.create({
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: true,
        email_address: 'test@example.com',
        email_api_key: 're_1234567890abcdefghijklmnopqrstuvwxyz',
        webhook_enabled: true,
        webhook_url: 'https://example.com/webhook'
      });
      
      const channels = NotificationSettingsModel.getAvailableChannels(settings);
      
      expect(channels).toContain('email');
      expect(channels).toContain('webhook');
      expect(channels).not.toContain('notifyx');
    });

    it('应该在通知渠道未配置完整时返回空列表', () => {
      const settings = NotificationSettingsModel.create({
        id: 'settings-123',
        user_id: 'user-123',
        email_enabled: true
        // 缺少 email_address 和 email_api_key
      });
      
      const channels = NotificationSettingsModel.getAvailableChannels(settings);
      expect(channels).toHaveLength(0);
    });
  });
});
