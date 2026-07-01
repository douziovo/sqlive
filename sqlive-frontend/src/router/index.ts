import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Route table (D-02 router, D-05 structure).
 *
 * - `/` → App.vue (main playground, kept alive via RootLayout's KeepAlive)
 * - `/docs/*` → DocsLayout + nested article/api/not-found children (lazy chunk)
 * - catch-all → redirect to `/`
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    // App.vue is the `/` route component (NOT RootLayout — RootLayout is the
    // mount target; App.vue is the `/` route child).
    component: () => import('@/App.vue'),
  },
  {
    path: '/docs',
    component: () => import('@/pages/docs/DocsLayout.vue'),
    children: [
      { path: '', redirect: { name: 'docs-intro' } },
      {
        path: 'intro',
        name: 'docs-intro',
        component: () => import('@/pages/docs/ArticlePage.vue'),
        props: { slug: 'intro' },
      },
      {
        path: 'usage/:article',
        component: () => import('@/pages/docs/ArticlePage.vue'),
        props: (route) => ({ slug: 'usage/' + route.params.article }),
      },
      {
        path: 'api',
        component: () => import('@/pages/docs/ApiPage.vue'),
      },
      {
        path: 'changelog',
        component: () => import('@/pages/docs/ArticlePage.vue'),
        props: { slug: 'changelog' },
      },
      {
        path: 'not-found',
        name: 'docs-not-found',
        component: () => import('@/pages/docs/NotFoundPage.vue'),
      },
      { path: ':pathMatch(.*)*', redirect: { name: 'docs-not-found' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
