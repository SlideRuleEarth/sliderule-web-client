import { createRouter, createWebHistory } from 'vue-router'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('router')
// Note: using route level code-splitting
// this generates a separate chunk (<route>.[hash].js) for this route
// which is lazy-loaded when the route is visited.

const router = createRouter({
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: async () => import('@/views/RequestView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: async () => import('@/views/AboutView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: async () => import('@/views/SettingsView.vue')
    },
    {
      path: '/rectree',
      name: 'rectree',
      component: async () => import('@/views/RecTreeView.vue')
    },
    {
      path: '/request',
      name: 'request',
      component: async () => import('@/views/RequestView.vue')
    },
    {
      path: '/request/:reqId',
      name: 'request-with-params',
      component: async () => import('@/views/RequestView.vue'),
      props: true
    },
    {
      path: '/analyze/:id',
      name: 'analyze',
      component: async () => import('@/views/AnalyzeView.vue'),
      props: true
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: async () => import('@/components/NotFoundComponent.vue')
    }
  ]
})
// router.ts (or wherever you create the router)
router.afterEach(() => {
  const req = useReqParamsStore()
  logger.debug('afterEach meta', { storeId: req.$id, meta: req.__meta })
})

export default router
