// 认证状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/client'
import type { User, LoginCredentials } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!user.value && !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  // 登录
  async function login(credentials: LoginCredentials): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await authApi.login(credentials)

      if (response.success && response.data) {
        token.value = response.data.token || null
        user.value = response.data.user || null
        return true
      } else {
        error.value = response.error || '登录失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 注销
  async function logout(): Promise<void> {
    loading.value = true

    try {
      await authApi.logout()
    } finally {
      user.value = null
      token.value = null
      error.value = null
      loading.value = false
    }
  }

  // 验证令牌
  async function validateToken(): Promise<boolean> {
    if (!token.value) return false

    loading.value = true

    try {
      const response = await authApi.validateToken()

      if (response.success && response.data?.valid) {
        user.value = response.data.user || user.value
        return true
      } else {
        user.value = null
        token.value = null
        return false
      }
    } catch {
      user.value = null
      token.value = null
      return false
    } finally {
      loading.value = false
    }
  }

  // 刷新令牌
  async function refreshToken(): Promise<boolean> {
    loading.value = true

    try {
      const response = await authApi.refreshToken()

      if (response.success && response.data?.token) {
        token.value = response.data.token
        return true
      } else {
        return false
      }
    } catch {
      return false
    } finally {
      loading.value = false
    }
  }

  // 清除错误
  function clearError(): void {
    error.value = null
  }

  return {
    // 状态
    user,
    token,
    loading,
    error,
    // 计算属性
    isAuthenticated,
    isAdmin,
    // 方法
    login,
    logout,
    validateToken,
    refreshToken,
    clearError
  }
})
