import { createRouter, createWebHistory } from 'vue-router'
import { useReqParamsStore } from '@/stores/reqParamsStore'
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
})
// router.ts (or wherever you create the router)
router.afterEach(() => {
    const req = useReqParamsStore();
    console.debug(`[${req.$id}] afterEach meta:`, req.__meta);
});

export default router
