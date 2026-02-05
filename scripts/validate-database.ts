/**
 * 数据库和模型验证脚本
 * 验证数据库架构和TypeScript模型的完整性
 */

import { UserModel, TaskModel, ExecutionLogModel, NotificationSettingsModel } from '../server/models/index.js';

/**
 * 验证用户模型
 */
function validateUserModel(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // 测试用户名验证
    if (!UserModel.validateUsername('testuser')) {
      errors.push('用户名验证失败');
    }
    
    if (UserModel.validateUsername('ab')) {
      errors.push('短用户名应该验证失败');
    }
    
    // 测试密码验证
    if (!UserModel.validatePassword('password123')) {
      errors.push('密码验证失败');
    }
    
    if (UserModel.validatePassword('123')) {
      errors.push('弱密码应该验证失败');
    }
    
    // 测试角色验证
    if (!UserModel.validateRole('admin')) {
      errors.push('管理员角色验证失败');
    }
    
    if (UserModel.validateRole('invalid')) {
      errors.push('无效角色应该验证失败');
    }
    
    // 测试用户创建
    const user = UserModel.create({
      id: 'test-user-1',
      username: 'testuser',
      password_hash: 'hashed_password',
      role: 'user'
    });
    
    if (!user.id || !user.username || !user.created_at) {
      errors.push('用户创建失败');
    }
    
    console.log('✓ 用户模型验证通过');
  } catch (error) {
    errors.push(`用户模型验证异常: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  return { success: errors.length === 0, errors };
}

/**
 * 验证任务模型
 */
function validateTaskModel(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // 测试任务名称验证
    if (!TaskModel.validateName('测试任务')) {
      errors.push('任务名称验证失败');
    }
    
    if (TaskModel.validateName('')) {
      errors.push('空任务名称应该验证失败');
    }
    
    // 测试任务类型验证
    if (!TaskModel.validateType('keepalive')) {
      errors.push('保活任务类型验证失败');
    }
    
    if (TaskModel.validateType('invalid')) {
      errors.push('无效任务类型应该验证失败');
    }
    
    // 测试Cron表达式验证
    if (!TaskModel.validateSchedule('0 */5 * * *')) {
      errors.push('Cron表达式验证失败');
    }
    
    if (TaskModel.validateSchedule('invalid cron')) {
      errors.push('无效Cron表达式应该验证失败');
    }
    
    // 测试保活配置验证
    const keepaliveConfig = {
      url: 'https://example.com',
      method: 'GET',
      timeout: 30000
    };
    
    const keepaliveValidation = TaskModel.validateKeepaliveConfig(keepaliveConfig);
    if (!keepaliveValidation.valid) {
      errors.push(`保活配置验证失败: ${keepaliveValidation.errors.join(', ')}`);
    }
    
    // 测试通知配置验证
    const notificationConfig = {
      message: '测试通知',
      priority: 'normal',
      notifyxConfig: {
        apiKey: 'test-api-key',
        channelId: 'test-channel',
        message: '测试通知'
      }
    };
    
    const notificationValidation = TaskModel.validateNotificationConfig(notificationConfig);
    if (!notificationValidation.valid) {
      errors.push(`通知配置验证失败: ${notificationValidation.errors.join(', ')}`);
    }
    
    // 测试任务创建
    const task = TaskModel.create({
      id: 'test-task-1',
      name: '测试保活任务',
      type: 'keepalive',
      schedule: '0 */5 * * *',
      config: keepaliveConfig,
      created_by: 'test-user-1'
    });
    
    if (!task.id || !task.name || !task.created_at) {
      errors.push('任务创建失败');
    }
    
    console.log('✓ 任务模型验证通过');
  } catch (error) {
    errors.push(`任务模型验证异常: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  return { success: errors.length === 0, errors };
}

/**
 * 验证执行日志模型
 */
function validateExecutionLogModel(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // 测试任务ID验证
    if (!ExecutionLogModel.validateTaskId('test-task-1')) {
      errors.push('任务ID验证失败');
    }
    
    if (ExecutionLogModel.validateTaskId('')) {
      errors.push('空任务ID应该验证失败');
    }
    
    // 测试状态验证
    if (!ExecutionLogModel.validateStatus('success')) {
      errors.push('成功状态验证失败');
    }
    
    if (ExecutionLogModel.validateStatus('invalid')) {
      errors.push('无效状态应该验证失败');
    }
    
    // 测试响应时间验证
    if (!ExecutionLogModel.validateResponseTime(1000)) {
      errors.push('响应时间验证失败');
    }
    
    if (ExecutionLogModel.validateResponseTime(-1)) {
      errors.push('负响应时间应该验证失败');
    }
    
    // 测试状态码验证
    if (!ExecutionLogModel.validateStatusCode(200)) {
      errors.push('HTTP状态码验证失败');
    }
    
    if (ExecutionLogModel.validateStatusCode(999)) {
      errors.push('无效状态码应该验证失败');
    }
    
    // 测试日志创建
    const successLog = ExecutionLogModel.createSuccessLog('test-task-1', 1000, 200, { test: 'data' });
    if (!successLog.id || successLog.status !== 'success') {
      errors.push('成功日志创建失败');
    }
    
    const failureLog = ExecutionLogModel.createFailureLog('test-task-1', '连接超时', 0, { error: 'timeout' });
    if (!failureLog.id || failureLog.status !== 'failure') {
      errors.push('失败日志创建失败');
    }
    
    console.log('✓ 执行日志模型验证通过');
  } catch (error) {
    errors.push(`执行日志模型验证异常: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  return { success: errors.length === 0, errors };
}

/**
 * 验证通知设置模型
 */
function validateNotificationSettingsModel(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // 测试用户ID验证
    if (!NotificationSettingsModel.validateUserId('test-user-1')) {
      errors.push('用户ID验证失败');
    }
    
    if (NotificationSettingsModel.validateUserId('')) {
      errors.push('空用户ID应该验证失败');
    }
    
    // 测试邮箱验证
    if (!NotificationSettingsModel.validateEmail('test@example.com')) {
      errors.push('邮箱验证失败');
    }
    
    if (NotificationSettingsModel.validateEmail('invalid-email')) {
      errors.push('无效邮箱应该验证失败');
    }
    
    // 测试Webhook URL验证
    if (!NotificationSettingsModel.validateWebhookUrl('https://example.com/webhook')) {
      errors.push('Webhook URL验证失败');
    }
    
    if (NotificationSettingsModel.validateWebhookUrl('invalid-url')) {
      errors.push('无效Webhook URL应该验证失败');
    }
    
    // 测试失败阈值验证
    if (!NotificationSettingsModel.validateFailureThreshold(3)) {
      errors.push('失败阈值验证失败');
    }
    
    if (NotificationSettingsModel.validateFailureThreshold(0)) {
      errors.push('零失败阈值应该验证失败');
    }
    
    // 测试通知设置创建
    const settings = NotificationSettingsModel.create({
      id: 'test-settings-1',
      user_id: 'test-user-1',
      email_enabled: true,
      email_address: 'test@example.com',
      failure_threshold: 3
    });
    
    if (!settings.id || !settings.user_id || !settings.created_at) {
      errors.push('通知设置创建失败');
    }
    
    console.log('✓ 通知设置模型验证通过');
  } catch (error) {
    errors.push(`通知设置模型验证异常: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  return { success: errors.length === 0, errors };
}

/**
 * 主验证函数
 */
function main() {
  console.log('开始验证数据库架构和模型完整性...\n');
  
  const results = [
    validateUserModel(),
    validateTaskModel(),
    validateExecutionLogModel(),
    validateNotificationSettingsModel()
  ];
  
  const allErrors = results.flatMap(result => result.errors);
  const allSuccess = results.every(result => result.success);
  
  console.log('\n=== 验证结果 ===');
  
  if (allSuccess) {
    console.log('✅ 所有模型验证通过！');
  } else {
    console.log('❌ 模型验证失败：');
    allErrors.forEach(error => console.log(`  - ${error}`));
  }
  
  console.log(`\n总计: ${results.length} 个模型，${allSuccess ? '全部通过' : `${allErrors.length} 个错误`}`);
  
  process.exit(allSuccess ? 0 : 1);
}

// 运行验证
main();