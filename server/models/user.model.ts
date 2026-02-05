import { User } from '../types/index.js';

/**
 * 用户模型类
 * 提供用户数据的验证和操作方法
 */
export class UserModel {
  /**
   * 验证用户名格式
   * @param username 用户名
   * @returns 是否有效
   */
  static validateUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }
    // 用户名长度3-20字符，只允许字母、数字和下划线
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  /**
   * 验证密码强度
   * @param password 密码
   * @returns 是否有效
   */
  static validatePassword(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }
    // 密码至少8位，包含字母和数字
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  }

  /**
   * 验证用户角色
   * @param role 角色
   * @returns 是否有效
   */
  static validateRole(role: string): role is 'admin' | 'user' {
    return role === 'admin' || role === 'user';
  }

  /**
   * 验证用户数据完整性
   * @param userData 用户数据
   * @returns 验证结果
   */
  static validate(userData: Partial<User>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (userData.username !== undefined && !this.validateUsername(userData.username)) {
      errors.push('用户名格式无效：长度3-20字符，只允许字母、数字和下划线');
    }

    if (userData.password_hash !== undefined && !userData.password_hash) {
      errors.push('密码哈希不能为空');
    }

    if (userData.role !== undefined && !this.validateRole(userData.role)) {
      errors.push('用户角色必须是 admin 或 user');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 创建新用户对象
   * @param userData 用户数据
   * @returns 用户对象
   */
  static create(userData: {
    id: string;
    username: string;
    password_hash: string;
    role?: 'admin' | 'user';
  }): User {
    const now = new Date().toISOString();
    return {
      id: userData.id,
      username: userData.username,
      password_hash: userData.password_hash,
      role: userData.role || 'user',
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 更新用户对象
   * @param existingUser 现有用户
   * @param updateData 更新数据
   * @returns 更新后的用户对象
   */
  static update(existingUser: User, updateData: Partial<User>): User {
    return {
      ...existingUser,
      ...updateData,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * 从数据库行创建用户对象
   * @param row 数据库行
   * @returns 用户对象
   */
  static fromDatabaseRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * 转换为数据库插入格式
   * @param user 用户对象
   * @returns 数据库插入数据
   */
  static toDatabaseInsert(user: User): Record<string, any> {
    return {
      id: user.id,
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }
}