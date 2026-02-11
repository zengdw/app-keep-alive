import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { systemApi } from '@/api/client'
import type { SystemStatus } from '@/types'

export const useSystemStore = defineStore('system', () => {
  // 状态
  const status = ref<SystemStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取系统状态
  async function fetchStatus(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await systemApi.getStatus()

      if (response.success && response.data) {
        status.value = response.data
      } else {
        error.value = response.error || '获取系统状态失败'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取系统状态失败'
    } finally {
      loading.value = false
    }
  }

  // 清除错误
  function clearError(): void {
    error.value = null
  }

  // 计算属性
  const totalExecutions = computed(() => {
    return status.value?.executions?.total || 0
  })

  return {
    // 状态
    status,
    loading,
    error,
    // 计算属性
    totalExecutions,
    // 方法
    fetchStatus,
    clearError
  }
})
