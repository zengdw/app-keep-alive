// 任务状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { taskApi } from '@/api/client'
import type { Task, TaskConfig, TaskFilter } from '@/types'

export const useTasksStore = defineStore('tasks', () => {
  // 状态
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<TaskFilter>({})

  // 计算属性
  const filteredTasks = computed(() => {
    let result = tasks.value

    if (filter.value.type) {
      result = result.filter(task => task.type === filter.value.type)
    }

    if (filter.value.enabled !== undefined) {
      result = result.filter(task => task.enabled === filter.value.enabled)
    }

    if (filter.value.search) {
      const search = filter.value.search.toLowerCase()
      result = result.filter(task =>
        task.name.toLowerCase().includes(search)
      )
    }

    return result
  })

  const keepaliveTasks = computed(() =>
    tasks.value.filter(task => task.type === 'keepalive')
  )

  const notificationTasks = computed(() =>
    tasks.value.filter(task => task.type === 'notification')
  )

  const enabledTasks = computed(() =>
    tasks.value.filter(task => task.enabled)
  )

  const disabledTasks = computed(() =>
    tasks.value.filter(task => !task.enabled)
  )

  // 获取任务列表
  async function fetchTasks(filterOptions?: TaskFilter): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.getTasks(filterOptions)

      if (response.success && response.data) {
        tasks.value = response.data
      } else {
        error.value = response.error || '获取任务列表失败'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取任务列表失败'
    } finally {
      loading.value = false
    }
  }

  // 获取单个任务
  async function fetchTask(id: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.getTask(id)

      if (response.success && response.data) {
        currentTask.value = response.data
      } else {
        error.value = response.error || '获取任务详情失败'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取任务详情失败'
    } finally {
      loading.value = false
    }
  }

  // 创建任务
  async function createTask(task: TaskConfig): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.createTask(task)

      if (response.success && response.data) {
        tasks.value.push(response.data)
        return true
      } else {
        error.value = response.error || '创建任务失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建任务失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 更新任务
  async function updateTask(id: string, task: Partial<TaskConfig>): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.updateTask(id, task)

      if (response.success && response.data) {
        const index = tasks.value.findIndex(t => t.id === id)
        if (index !== -1) {
          tasks.value[index] = response.data
        }
        if (currentTask.value?.id === id) {
          currentTask.value = response.data
        }
        return true
      } else {
        error.value = response.error || '更新任务失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新任务失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 删除任务
  async function deleteTask(id: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.deleteTask(id)

      if (response.success) {
        tasks.value = tasks.value.filter(t => t.id !== id)
        if (currentTask.value?.id === id) {
          currentTask.value = null
        }
        return true
      } else {
        error.value = response.error || '删除任务失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除任务失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 测试任务
  async function testTask(id: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await taskApi.testTask(id)

      if (response.success) {
        return true
      } else {
        error.value = response.error || '测试任务失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '测试任务失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 设置筛选条件
  function setFilter(newFilter: TaskFilter): void {
    filter.value = { ...filter.value, ...newFilter }
  }

  // 清除筛选条件
  function clearFilter(): void {
    filter.value = {}
  }

  // 清除错误
  function clearError(): void {
    error.value = null
  }

  // 清除当前任务
  function clearCurrentTask(): void {
    currentTask.value = null
  }

  return {
    // 状态
    tasks,
    currentTask,
    loading,
    error,
    filter,
    // 计算属性
    filteredTasks,
    keepaliveTasks,
    notificationTasks,
    enabledTasks,
    disabledTasks,
    // 方法
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    testTask,
    setFilter,
    clearFilter,
    clearError,
    clearCurrentTask
  }
})
