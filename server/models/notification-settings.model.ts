import { NotificationSettings } from '../types/index.js';

/**
 * 通知设置模型类
 * 提供通知设置数据的验证和操作方法
 */
export class NotificationSettingsModel {
  /**
   * 验证用户ID
   * @param userId 用户ID
   * @returns 是否有效
   */
  static validateUserId(userId: string): boolean {
    return !!(userId && typeof userId === 'string' && userId.trim().length > 0);
  }

  /**
   * 验证邮箱地址
   * @param email 邮箱地址
   * @returns 是否有效
   */
  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * 验证Webhook URL
   * @param url Webhook URL
   * @returns 是否有效
   */
  static validateWebhookUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 验证失败阈值
   * @param threshold 失败阈值
   * @returns 是否有效
   */
  static validateFailureThreshold(threshold: number): boolean {
    return typeof threshold === 'number' && threshold >= 1 && threshold <= 100;
  }

  /**
   * 验证通知设置数据完整性
   * @param settingsData 通知设置数据
   * @returns 验证结果
   */
  static validate(settingsData: Partial<NotificationSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证用户ID
    if (settingsData.user_id !== undefined && !this.validateUserId(settingsData.user_id)) {
      errors.push('用户ID不能为空');
    }

    // 验证邮箱设置
    if (settingsData.email_enabled === true) {
      if (!settingsData.email_address) {
        errors.push('启用邮件通知时必须提供邮箱地址');
      } else if (!this.validateEmail(settingsData.email_address)) {
        errors.push('邮箱地址格式无效');
      }
    }

    // 验证Webhook设置
    if (settingsData.webhook_enabled === true) {
      if (!settingsData.webhook_url) {
        errors.push('启用Webhook通知时必须提供Webhook URL');
      } else if (!this.validateWebhookUrl(settingsData.webhook_url)) {
        errors.push('Webhook URL格式无效');
      }
    }

    // 验证失败阈值
    if (settingsData.failure_threshold !== undefined && !this.validateFailureThreshold(settingsData.failure_threshold)) {
      errors.push('失败阈值必须是1-100之间的数字');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 创建新通知设置对象
   * @param settingsData 通知设置数据
   * @returns 通知设置对象
   */
  static create(settingsData: {
    id: string;
    user_id: string;
    email_enabled?: boolean;
    email_address?: string;
    webhook_enabled?: boolean;
    webhook_url?: string;
    failure_threshold?: number;
  }): NotificationSettings {
    const now = new Date().toISOString();
    return {
      id: settingsData.id,
      user_id: settingsData.user_id,
      email_enabled: settingsData.email_enabled || false,
      email_address: settingsData.email_address,
      webhook_enabled: settingsData.webhook_enabled || false,
      webhook_url: settingsData.webhook_url,
      failure_threshold: settingsData.failure_threshold || 3,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 更新通知设置对象
   * @param existingSettings 现有通知设置
   * @param updateData 更新数据
   * @returns 更新后的通知设置对象
   */
  static update(existingSettings: NotificationSettings, updateData: Partial<NotificationSettings>): NotificationSettings {
    return {
      ...existingSettings,
      ...updateData,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * 从数据库行创建通知设置对象
   * @param row 数据库行
   * @returns 通知设置对象
   */
  static fromDatabaseRow(row: any): NotificationSettings {
    return {
      id: row.id,
      user_id: row.user_id,
      email_enabled: Boolean(row.email_enabled),
      email_address: row.email_address || undefined,
      webhook_enabled: Boolean(row.webhook_enabled),
      webhook_url: row.webhook_url || undefined,
      failure_threshold: row.failure_threshold,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * 转换为数据库插入格式
   * @param settings 通知设置对象
   * @returns 数据库插入数据
   */
  static toDatabaseInsert(settings: NotificationSettings): Record<string, any> {
    return {
      id: settings.id,
      user_id: settings.user_id,
      email_enabled: settings.email_enabled ? 1 : 0,
      email_address: settings.email_address || null,
      webhook_enabled: settings.webhook_enabled ? 1 : 0,
      webhook_url: settings.webhook_url || null,
      failure_threshold: settings.failure_threshold,
      created_at: settings.created_at,
      updated_at: settings.updated_at
    };
  }

  /**
   * 检查是否需要发送通知
   * @param settings 通知设置
   * @param failureCount 失败次数
   * @returns 是否需要发送通知
   */
  static shouldSendNotification(settings: NotificationSettings, failureCount: number): boolean {
    return failureCount >= settings.failure_threshold && (settings.email_enabled || settings.webhook_enabled);
  }

  /**
   * 获取可用的通知渠道
   * @param settings 通知设置
   * @returns 可用的通知渠道列表
   */
  static getAvailableChannels(settings: NotificationSettings): string[] {
    const channels: string[] = [];
    
    if (settings.email_enabled && settings.email_address) {
      channels.push('email');
    }
    
    if (settings.webhook_enabled && settings.webhook_url) {
      channels.push('webhook');
    }
    
    return channels;
  }
}