// 设置状态管理
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { settingsApi } from '@/api/client'

export const useSettingsStore = defineStore('settings', () => {
    // 状态
    const notificationSettings = ref<any>(null)
    const enabledChannels = ref<string[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // 获取通知设置
    async function fetchSettings(): Promise<void> {
        loading.value = true
        error.value = null

        try {
            const response = await settingsApi.getNotificationSettings()

            if (response.success) {
                notificationSettings.value = response.data || null
            } else {
                error.value = response.error || '获取通知设置失败'
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : '获取通知设置失败'
        } finally {
            loading.value = false
        }
    }

    // 更新通知设置
    async function updateSettings(data: any): Promise<boolean> {
        loading.value = true
        error.value = null

        try {
            const response = await settingsApi.updateNotificationSettings(data)

            if (response.success) {
                notificationSettings.value = response.data || data
                return true
            } else {
                error.value = response.error || '更新通知设置失败'
                return false
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : '更新通知设置失败'
            return false
        } finally {
            loading.value = false
        }
    }

    // 修改密码
    async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
        loading.value = true
        error.value = null

        try {
            const response = await settingsApi.changePassword({ oldPassword, newPassword })

            if (response.success) {
                return { success: true }
            } else {
                return { success: false, error: response.error || '修改密码失败' }
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '修改密码失败'
            return { success: false, error: errMsg }
        } finally {
            loading.value = false
        }
    }

    // 获取已启用的通知渠道
    async function fetchEnabledChannels(): Promise<void> {
        try {
            const response = await settingsApi.getEnabledChannels()

            if (response.success && response.data) {
                enabledChannels.value = response.data
            } else {
                enabledChannels.value = []
            }
        } catch {
            enabledChannels.value = []
        }
    }

    // 清除错误
    function clearError(): void {
        error.value = null
    }

    return {
        notificationSettings,
        enabledChannels,
        loading,
        error,
        fetchSettings,
        updateSettings,
        changePassword,
        fetchEnabledChannels,
        clearError
    }
})
