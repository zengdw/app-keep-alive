import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthToken } from '@/api/client'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/TasksView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false
  const token = getAuthToken()

  // 如果路由需要认证
  if (requiresAuth) {
    if (!token) {
      // 没有令牌，重定向到登录页
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }

    // 如果还没有用户信息，验证令牌
    if (!authStore.user) {
      const isValid = await authStore.validateToken()
      if (!isValid) {
        // 令牌无效，重定向到登录页
        next({ name: 'login', query: { redirect: to.fullPath } })
        return
      }
    }
  }

  // 如果已登录且访问登录页，重定向到首页
  if (to.name === 'login' && token && authStore.user) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

export default router
