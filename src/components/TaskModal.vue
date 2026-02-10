<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isEdit ? '编辑任务' : '创建任务' }}</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <!-- 基本信息 -->
        <div class="form-group">
          <label for="name">任务名称 *</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            placeholder="请输入任务名称"
            required
          />
        </div>

        <div class="form-group">
          <label for="type">任务类型 *</label>
          <select id="type" v-model="formData.type" required :disabled="isEdit">
            <option value="keepalive">保活任务</option>
            <option value="notification">通知任务</option>
          </select>
        </div>

        <div class="form-group">
          <label for="schedule">执行计划 (Cron表达式) *</label>
          <input
            id="schedule"
            v-model="formData.schedule"
            type="text"
            placeholder="例如: */5 * * * * (每5分钟)"
            required
          />
          <small>格式: 秒 分 时 日 月 周</small>
        </div>

        <div class="form-group">
          <label>
            <input v-model="formData.enabled" type="checkbox" />
            启用任务
          </label>
        </div>

        <!-- 保活任务配置 -->
        <div v-if="formData.type === 'keepalive'" class="config-section">
          <h3>保活任务配置</h3>

          <div class="form-group">
            <label for="url">目标URL *</label>
            <input
              id="url"
              v-model="keepaliveConfig.url"
              type="url"
              placeholder="https://example.com"
              required
            />
          </div>

          <div class="form-group">
            <label for="method">HTTP方法 *</label>
            <select id="method" v-model="keepaliveConfig.method" required>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div class="form-group">
            <label for="timeout">超时时间 (秒) *</label>
            <input
              id="timeout"
              v-model.number="keepaliveConfig.timeout"
              type="number"
              min="1"
              max="300"
              required
            />
          </div>

          <div class="form-group">
            <label for="headers">请求头 (JSON格式)</label>
            <textarea
              id="headers"
              v-model="headersJson"
              placeholder='{"Content-Type": "application/json"}'
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="body">请求体</label>
            <textarea
              id="body"
              v-model="keepaliveConfig.body"
              placeholder="请求体内容"
              rows="3"
            ></textarea>
          </div>
        </div>

        <!-- 通知任务配置 -->
        <div v-if="formData.type === 'notification'" class="config-section">
          <h3>通知任务配置</h3>

          <div class="form-group">
            <label for="title">通知标题</label>
            <input
              id="title"
              v-model="notificationConfig.title"
              type="text"
              placeholder="通知标题"
            />
          </div>

          <div class="form-group">
            <label for="message">通知内容 *</label>
            <textarea
              id="message"
              v-model="notificationConfig.message"
              placeholder="通知内容"
              rows="3"
              required
            ></textarea>
          </div>

          <!-- 通知方式选择 -->
          <h4>通知方式</h4>
          <div v-if="enabledChannels.length === 0" class="channel-hint">
            <p>暂无已启用的通知渠道，请先到 <router-link to="/settings">设置页面</router-link> 配置通知方式。</p>
          </div>
          <div v-else class="channel-list">
            <label v-if="enabledChannels.includes('notifyx')" class="channel-option">
              <input type="checkbox" v-model="selectedChannels" value="notifyx" />
              <span>NotifyX</span>
            </label>
            <label v-if="enabledChannels.includes('email')" class="channel-option">
              <input type="checkbox" v-model="selectedChannels" value="email" />
              <span>邮件通知</span>
            </label>
            <label v-if="enabledChannels.includes('webhook')" class="channel-option">
              <input type="checkbox" v-model="selectedChannels" value="webhook" />
              <span>Webhook</span>
            </label>
          </div>

          <!-- NotifyX 配置（仅在选择了 NotifyX 时显示） -->
          <div v-if="selectedChannels.includes('notifyx')" class="channel-config-section">
            <h4>NotifyX配置</h4>
            <div class="form-group">
              <label for="apiKey">API密钥 *</label>
              <input
                id="apiKey"
                v-model="notificationConfig.notifyxConfig.apiKey"
                type="text"
                placeholder="NotifyX API密钥（留空则使用设置中的密钥）"
              />
              <small>如不填写，将使用设置页面中配置的 API 密钥</small>
            </div>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="modal-footer">
          <button type="button" @click="$emit('close')" class="btn-cancel">
            取消
          </button>
          <button type="submit" class="btn-submit" :disabled="loading">
            {{ loading ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { settingsApi } from '@/api/client'
import type { Task, TaskConfig, KeepaliveConfig, NotificationConfig } from '@/types'

const props = defineProps<{
  task?: Task | null
}>()

const emit = defineEmits<{
  close: []
  save: []
}>()

const tasksStore = useTasksStore()

const isEdit = computed(() => !!props.task)

const formData = ref<TaskConfig>({
  name: '',
  type: 'keepalive',
  schedule: '*/5 * * * *',
  enabled: true,
  config: {} as any
})

const keepaliveConfig = ref<KeepaliveConfig>({
  url: '',
  method: 'GET',
  timeout: 30,
  headers: {},
  body: ''
})

const notificationConfig = ref<NotificationConfig>({
  message: '',
  title: '',
  priority: 'normal',
  notifyxConfig: {
    apiKey: '',
    channelId: '',
    message: ''
  }
})

const headersJson = ref('')
const loading = ref(false)
const error = ref('')
const enabledChannels = ref<string[]>([])
const selectedChannels = ref<string[]>([])

// 加载已启用的通知渠道
onMounted(async () => {
  try {
    const response = await settingsApi.getEnabledChannels()
    if (response.success && response.data) {
      enabledChannels.value = response.data
    }
  } catch {
    // 静默失败
  }
})

// 如果是编辑模式，填充表单
watch(
  () => props.task,
  (task) => {
    if (task) {
      formData.value = {
        name: task.name,
        type: task.type,
        schedule: task.schedule,
        enabled: task.enabled,
        config: task.config
      }

      if (task.type === 'keepalive') {
        const config = task.config as KeepaliveConfig
        keepaliveConfig.value = { ...config }
        if (config.headers) {
          headersJson.value = JSON.stringify(config.headers, null, 2)
        }
      } else {
        const config = task.config as NotificationConfig
        notificationConfig.value = { ...config }
      }
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    // 保存任务
    if (formData.value.type === 'keepalive') {
      // 解析headers JSON
      if (headersJson.value.trim()) {
        try {
          keepaliveConfig.value.headers = JSON.parse(headersJson.value)
        } catch {
          error.value = '请求头JSON格式错误'
          loading.value = false
          return
        }
      }
      formData.value.config = keepaliveConfig.value
    } else {
      // 同步message到notifyxConfig
      notificationConfig.value.notifyxConfig.message = notificationConfig.value.message
      // 将选中的通知渠道保存到配置中
      ;(notificationConfig.value as any).channels = selectedChannels.value
      formData.value.config = notificationConfig.value
    }

    // 保存任务
    let success = false
    if (isEdit.value && props.task) {
      success = await tasksStore.updateTask(props.task.id, formData.value)
    } else {
      success = await tasksStore.createTask(formData.value)
    }

    if (success) {
      emit('save')
    } else {
      error.value = tasksStore.error || '保存失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a202c;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #718096;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.close-button:hover {
  color: #1a202c;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.form-group input[type='text'],
.form-group input[type='url'],
.form-group input[type='number'],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.95rem;
}

.form-group input[type='checkbox'] {
  margin-right: 0.5rem;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #718096;
}

.config-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e2e8f0;
}

.config-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #1a202c;
}

.config-section h4 {
  margin: 1.5rem 0 1rem 0;
  font-size: 1rem;
  color: #2d3748;
}

.error-message {
  padding: 0.75rem;
  background: #fed7d7;
  color: #c53030;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel,
.btn-submit {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-cancel:hover {
  background: #cbd5e0;
}

.btn-submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.channel-hint {
  padding: 0.75rem;
  background: #fefcbf;
  border-radius: 6px;
  color: #744210;
  font-size: 0.9rem;
}

.channel-hint a {
  color: #667eea;
  font-weight: 600;
}

.channel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.channel-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.channel-option:hover {
  border-color: #667eea;
  background: #f0f3ff;
}

.channel-option input[type='checkbox'] {
  accent-color: #667eea;
}

.channel-config-section {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f7fafc;
}

.channel-config-section h4 {
  margin: 0 0 1rem 0;
}
</style>
