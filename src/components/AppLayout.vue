<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">定时任务管理系统</h1>
        <nav class="app-nav">
          <router-link to="/" class="nav-link">仪表板</router-link>
          <router-link to="/tasks" class="nav-link">任务管理</router-link>
          <router-link to="/logs" class="nav-link">日志查看</router-link>
        </nav>
        <div class="user-section">
          <span class="user-name">{{ authStore.user?.username }}</span>
          <button @click="handleLogout" class="logout-button">注销</button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7fafc;
}

.app-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.app-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
  white-space: nowrap;
}

.app-nav {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.nav-link {
  padding: 0.5rem 1rem;
  color: #4a5568;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  background-color: #edf2f7;
  color: #2d3748;
}

.nav-link.router-link-active {
  background-color: #667eea;
  color: white;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  font-size: 0.9rem;
  color: #4a5568;
  font-weight: 500;
}

.logout-button {
  padding: 0.5rem 1rem;
  background-color: #e53e3e;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-button:hover {
  background-color: #c53030;
}

.app-main {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .app-title {
    text-align: center;
  }

  .app-nav {
    justify-content: center;
  }

  .user-section {
    justify-content: center;
  }
}
</style>
