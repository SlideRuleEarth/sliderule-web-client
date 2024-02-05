import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/GeneralUser.vue')
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('@/views/AboutView.vue')
    },
    {
      path: '/general-user',
      name: 'general-user',
      component: () => import('@/views/GeneralUser.vue') 
    },
    {
      path: '/advanced-user',
      name: 'advanced-user',
      component: () => import('@/views/AdvancedUser.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/components/NotFoundComponent.vue')
    }  
  ]
})

export default router
