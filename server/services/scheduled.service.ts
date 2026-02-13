import { Environment, Task } from '../types/index.js';
import { TaskService } from './task.service.js';
import { DatabaseUtils } from '../utils/database.js';

/**
 * 定时任务服务类
 * 处理定时任务调度逻辑
 */
export class ScheduledService {
  /**
   * 处理定时触发事件
   * @param env 环境变量
   * @returns 处理结果
   */
  static async handleScheduledEvent(env: Environment): Promise<{
    success: boolean;
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // 获取所有启用的任务
      const tasksResult = await DatabaseUtils.getAllTasks(env, { enabled: true });

      if (!tasksResult.success || !tasksResult.data) {
        errors.push('获取任务列表失败');
        return { success: false, processed: 0, errors };
      }

      const tasks = tasksResult.data;
      console.log(`找到 ${tasks.length} 个启用的任务`);

      // 筛选需要执行的任务
      const tasksToExecute = await this.filterTasksToExecute(env, tasks);
      console.log(`需要执行 ${tasksToExecute.length} 个任务`);

      // 执行任务
      for (const task of tasksToExecute) {
        try {
          await TaskService.executeTask(env, task);
          processed++;
        } catch (error) {
          const errorMsg = `执行任务 ${task.name} (${task.id}) 失败: ${error instanceof Error ? error.message : '未知错误'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`定时任务处理完成，成功执行 ${processed} 个任务`);
      return { success: true, processed, errors };
    } catch (error) {
      const errorMsg = `定时任务处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, processed, errors };
    }
  }

  /**
   * 筛选需要执行的任务
   * @param env 环境变量
   * @param tasks 任务列表
   * @returns 需要执行的任务列表
   */
  private static async filterTasksToExecute(env: Environment, tasks: Task[]): Promise<Task[]> {
    const results = await Promise.all(tasks.map(async (task) => {
      // 只执行启用的任务
      if (!task.enabled) {
        return false;
      }

      // 检查是否有自定义执行规则
      const config = task.config as any; // Temporary cast to access optional executionRule
      if (config.executionRule) {
        return await this.checkExecutionRule(env, config.executionRule, task);
      }
      return false;
    }));

    return tasks.filter((_, index) => results[index]);
  }

  /**
   * 检查是否满足自定义执行规则
   * @param env 环境变量
   * @param rule 执行规则
   * @param task 任务对象
   * @returns 是否需要执行
   */
  private static async checkExecutionRule(env: Environment, rule: any, task: Task): Promise<boolean> {
    const now = new Date();
    // Use endDate as the target execution date (Next Due Date)
    const targetDate = new Date(rule.endDate);

    // Check if we are within the reminder advance window
    if (rule.reminderAdvanceValue && rule.reminderAdvanceUnit) {
      const advanceMs = this.getAdvanceMs(rule.reminderAdvanceValue, rule.reminderAdvanceUnit);
      const startTime = targetDate.getTime() - advanceMs;

      if (now.getTime() >= startTime) {
        // Fetch notification settings to check allowed time slots
        const settingsResult = await DatabaseUtils.getNotificationSettingsByUserId(env, task.created_by);

        if (settingsResult.success && settingsResult.data && settingsResult.data.allowed_time_slots) {
          const allowedSlots = settingsResult.data.allowed_time_slots.split(',').map(s => parseInt(s.trim(), 10));
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();

          // Allow execution only if current hour is in allowed slots AND it is the top of the hour (minute 0).
          // This prevents execution every minute during the allowed hour.
          if (allowedSlots.includes(currentHour) && currentMinute === 0) {
            return true;
          }
          return false;
        }

        return true;
      }
      return false;
    }

    // Standard check: is it time yet?
    return now >= targetDate;
  }

  private static getAdvanceMs(value: number, unit: 'day' | 'hour'): number {
    return value * (unit === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
  }

}