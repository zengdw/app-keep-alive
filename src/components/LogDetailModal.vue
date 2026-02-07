<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>日志详情</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">日志ID：</span>
              <span>{{ log.id }}</span>
            </div>
            <div class="detail-item">
              <span class="label">任务ID：</span>
              <span>{{ log.taskId }}</span>
            </div>
            <div v-if="log.taskName" class="detail-item">
              <span class="label">任务名称：</span>
              <span>{{ log.taskName }}</span>
            </div>
            <div v-if="log.taskType" class="detail-item">
              <span class="label">任务类型：</span>
              <span class="task-type" :class="log.taskType">
                {{ log.taskType === 'keepalive' ? '保活任务' : '通知任务' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">执行时间：</span>
              <span>{{ formatDate(log.executionTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">执行状态：</span>
              <span class="status" :class="log.status">
                {{ log.status === 'success' ? '成功' : '失败' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="log.responseTime || log.statusCode" class="detail-section">
          <h3>执行结果</h3>
          <div class="detail-grid">
            <div v-if="log.responseTime" class="detail-item">
              <span class="label">响应时间：</span>
              <span>{{ log.responseTime }}ms</span>
            </div>
            <div v-if="log.statusCode" class="detail-item">
              <span class="label">HTTP状态码：</span>
              <span>{{ log.statusCode }}</span>
            </div>
          </div>
        </div>

        <div v-if="log.errorMessage" class="detail-section error-section">
          <h3>错误信息</h3>
          <div class="error-content">
            {{ log.errorMessage }}
          </div>
        </div>

        <div v-if="log.details" class="detail-section">
          <h3>详细信息</h3>
          <pre class="details-content">{{ formatDetails(log.details) }}</pre>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LogEntry } from '@/types'

defineProps<{
  log: LogEntry
}>()

defineEmits<{
  close: []
}>()

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDetails(details: string): string {
  try {
    const parsed = JSON.parse(details)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return details
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
  max-width: 700px;
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

.detail-section {
  margin-bottom: 2rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #1a202c;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.detail-item .label {
  font-weight: 600;
  color: #4a5568;
  white-space: nowrap;
}

.task-type {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.task-type.keepalive {
  background: #bee3f8;
  color: #2c5282;
}

.task-type.notification {
  background: #fbd38d;
  color: #7c2d12;
}

.status {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.status.success {
  background: #c6f6d5;
  color: #22543d;
}

.status.failure {
  background: #fed7d7;
  color: #742a2a;
}

.error-section {
  background: #fff5f5;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #e53e3e;
}

.error-content {
  color: #c53030;
  font-size: 0.95rem;
  line-height: 1.6;
  word-break: break-word;
}

.details-content {
  background: #f7fafc;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.btn-close {
  padding: 0.75rem 1.5rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #3182ce;
}
</style>
