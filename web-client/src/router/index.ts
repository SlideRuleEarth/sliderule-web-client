import { createRouter, createWebHistory } from 'vue-router'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('router')
// Note: using route level code-splitting
// this generates a separate chunk (<route>.[hash].js) for this route
// which is lazy-loaded when the route is visited.

const router = createRouter({
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  /* eslint-disable @typescript-eslint/promise-function-async */
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/RequestView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/rectree',
      name: 'rectree',
      component: () => import('@/views/RecTreeView.vue')
    },
    {
      path: '/request',
      name: 'request',
      component: () => import('@/views/RequestView.vue')
    },
    {
      path: '/request/:reqId',
      name: 'request-with-params',
      component: () => import('@/views/RequestView.vue'),
      props: true
    },
    {
      path: '/analyze/:id',
      name: 'analyze',
      component: () => import('@/views/AnalyzeView.vue'),
      props: true
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/components/NotFoundComponent.vue')
    }
  ]
  /* eslint-enable @typescript-eslint/promise-function-async */
})
// router.ts (or wherever you create the router)
router.afterEach(() => {
  const req = useReqParamsStore()
  logger.debug('afterEach meta', { storeId: req.$id, meta: req.__meta })
})

export default router
