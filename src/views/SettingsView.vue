<template>
  <AppLayout>
    <div class="settings-view">
      <h1>系统设置</h1>

      <!-- 修改密码 -->
      <section class="settings-section">
        <h2>修改密码</h2>
        <form @submit.prevent="handleChangePassword" class="settings-form">
          <div class="form-group">
            <label for="oldPassword">当前密码</label>
            <input
              id="oldPassword"
              v-model="passwordForm.oldPassword"
              type="password"
              placeholder="请输入当前密码"
              required
            />
          </div>
          <div class="form-group">
            <label for="newPassword">新密码</label>
            <input
              id="newPassword"
              v-model="passwordForm.newPassword"
              type="password"
              placeholder="至少8位，包含字母和数字"
              required
            />
          </div>
          <div class="form-group">
            <label for="confirmPassword">确认新密码</label>
            <input
              id="confirmPassword"
              v-model="passwordForm.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              required
            />
          </div>
          <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
          <div v-if="passwordSuccess" class="success-message">{{ passwordSuccess }}</div>
          <button type="submit" class="btn-primary" :disabled="settingsStore.loading">
            {{ settingsStore.loading ? '保存中...' : '修改密码' }}
          </button>
        </form>
      </section>

      <!-- 通知设置 -->
      <section class="settings-section">
        <h2>通知设置</h2>
        <div v-if="notifLoading" class="loading">加载中...</div>
        <form v-else @submit.prevent="handleSaveNotifications" class="settings-form">

          <!-- 失败阈值 -->
          <div class="form-group">
            <label for="failureThreshold">连续失败通知阈值</label>
            <input
              id="failureThreshold"
              v-model.number="notifForm.failure_threshold"
              type="number"
              min="1"
              max="100"
            />
            <small>连续失败达到此次数后发送通知</small>
          </div>

          <hr class="divider" />

          <!-- Email 通知 -->
          <div class="channel-section">
            <div class="channel-header">
              <label class="switch-label">
                <input v-model="notifForm.email_enabled" type="checkbox" />
                <span class="switch-text">邮件通知</span>
              </label>
            </div>
            <div v-if="notifForm.email_enabled" class="channel-config">
              <div class="form-group">
                <label for="emailAddress">邮箱地址</label>
                <input
                  id="emailAddress"
                  v-model="notifForm.email_address"
                  type="email"
                  placeholder="example@email.com"
                />
              </div>
              <div class="form-group">
                <label for="emailApiKey">邮件 API 密钥 (Resend)</label>
                <input
                  id="emailApiKey"
                  v-model="notifForm.email_api_key"
                  type="password"
                  placeholder="re_xxxxxxxx..."
                />
              </div>
            </div>
          </div>

          <hr class="divider" />

          <!-- Webhook 通知 -->
          <div class="channel-section">
            <div class="channel-header">
              <label class="switch-label">
                <input v-model="notifForm.webhook_enabled" type="checkbox" />
                <span class="switch-text">Webhook 通知</span>
              </label>
            </div>
            <div v-if="notifForm.webhook_enabled" class="channel-config">
              <div class="form-group">
                <label for="webhookUrl">Webhook URL</label>
                <input
                  id="webhookUrl"
                  v-model="notifForm.webhook_url"
                  type="url"
                  placeholder="https://example.com/webhook"
                />
              </div>
            </div>
          </div>

          <hr class="divider" />

          <!-- NotifyX 通知 -->
          <div class="channel-section">
            <div class="channel-header">
              <label class="switch-label">
                <input v-model="notifForm.notifyx_enabled" type="checkbox" />
                <span class="switch-text">NotifyX 通知</span>
              </label>
            </div>
            <div v-if="notifForm.notifyx_enabled" class="channel-config">
              <div class="form-group">
                <label for="notifyxApiKey">NotifyX API 密钥</label>
                <input
                  id="notifyxApiKey"
                  v-model="notifForm.notifyx_api_key"
                  type="password"
                  placeholder="NotifyX API密钥"
                />
              </div>
            </div>
          </div>

          <div v-if="notifError" class="error-message">{{ notifError }}</div>
          <div v-if="notifSuccess" class="success-message">{{ notifSuccess }}</div>
          <button type="submit" class="btn-primary" :disabled="settingsStore.loading">
            {{ settingsStore.loading ? '保存中...' : '保存通知设置' }}
          </button>
        </form>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

// 修改密码表单
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordError = ref('')
const passwordSuccess = ref('')

// 通知设置表单
const notifForm = ref({
  email_enabled: false,
  email_address: '',
  email_api_key: '',
  webhook_enabled: false,
  webhook_url: '',
  notifyx_enabled: false,
  notifyx_api_key: '',
  failure_threshold: 3
})
const notifError = ref('')
const notifSuccess = ref('')
const notifLoading = ref(false)

onMounted(async () => {
  await loadNotificationSettings()
})

async function loadNotificationSettings() {
  notifLoading.value = true
  await settingsStore.fetchSettings()
  notifLoading.value = false

  if (settingsStore.notificationSettings) {
    const s = settingsStore.notificationSettings
    notifForm.value = {
      email_enabled: Boolean(s.email_enabled),
      email_address: s.email_address || '',
      email_api_key: s.email_api_key || '',
      webhook_enabled: Boolean(s.webhook_enabled),
      webhook_url: s.webhook_url || '',
      notifyx_enabled: Boolean(s.notifyx_enabled),
      notifyx_api_key: s.notifyx_api_key || '',
      failure_threshold: s.failure_threshold || 3
    }
  }
}

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  if (passwordForm.value.newPassword.length < 8) {
    passwordError.value = '新密码至少需要8位'
    return
  }

  const result = await settingsStore.changePassword(
    passwordForm.value.oldPassword,
    passwordForm.value.newPassword
  )

  if (result.success) {
    passwordSuccess.value = '密码修改成功'
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } else {
    passwordError.value = result.error || '修改密码失败'
  }
}

async function handleSaveNotifications() {
  notifError.value = ''
  notifSuccess.value = ''

  const success = await settingsStore.updateSettings(notifForm.value)

  if (success) {
    notifSuccess.value = '通知设置已保存'
  } else {
    notifError.value = settingsStore.error || '保存通知设置失败'
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}

.settings-view > h1 {
  font-size: 1.75rem;
  color: #1a202c;
  margin: 0 0 2rem 0;
}

.settings-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h2 {
  font-size: 1.25rem;
  color: #1a202c;
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.form-group input[type='text'],
.form-group input[type='password'],
.form-group input[type='email'],
.form-group input[type='url'],
.form-group input[type='number'] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #718096;
}

.divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1rem 0;
}

.channel-section {
  margin-bottom: 0.5rem;
}

.channel-header {
  margin-bottom: 0.75rem;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.switch-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #667eea;
  cursor: pointer;
}

.switch-text {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

.channel-config {
  padding-left: 2rem;
  border-left: 3px solid #667eea;
  margin-left: 0.5rem;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-message {
  padding: 0.75rem;
  background: #fed7d7;
  color: #c53030;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.success-message {
  padding: 0.75rem;
  background: #c6f6d5;
  color: #22543d;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.btn-primary {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

@media (max-width: 768px) {
  .settings-section {
    padding: 1.25rem;
  }

  .channel-config {
    padding-left: 1rem;
  }
}
</style>
