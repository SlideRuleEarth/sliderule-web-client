import { createRouter, createWebHistory } from 'vue-router'
import GeneralUser from '../views/GeneralUser.vue'
import AdvancedUser from '../views/AdvancedUser.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: GeneralUser
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    },
    {
      path: '/general-user',
      name: 'general-user',
      component: GeneralUser
    },
    {
      path: '/advanced-user',
      name: 'advanced-user',
      component: AdvancedUser
    }
  ]
})

export default router
