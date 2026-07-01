import { describe, expect, it, vi } from 'vitest'

// Stub lazy-loaded route components so route resolution tests don't pull
// App.vue + DocsLayout + Monaco + splitpanes into jsdom.
vi.mock('@/App.vue', () => ({ default: { name: 'AppStub', template: '<div />' } }))
vi.mock('@/pages/docs/DocsLayout.vue', () => ({ default: { name: 'DocsLayoutStub', template: '<div />' } }))
vi.mock('@/pages/docs/ArticlePage.vue', () => ({ default: { name: 'ArticlePageStub', template: '<div />' } }))
vi.mock('@/pages/docs/ApiPage.vue', () => ({ default: { name: 'ApiPageStub', template: '<div />' } }))
vi.mock('@/pages/docs/NotFoundPage.vue', () => ({ default: { name: 'NotFoundPageStub', template: '<div />' } }))

import { router } from '@/router'

async function push(path: string) {
  await router.push(path)
  await router.isReady()
}

describe('router', () => {
  it('resolves / to App.vue route', async () => {
    await push('/')
    expect(router.currentRoute.value.path).toBe('/')
    const matched = router.currentRoute.value.matched
    expect(matched.length).toBeGreaterThan(0)
    // The / route component is App.vue (stubbed as AppStub).
    expect(matched[0].components?.default?.name).toBe('AppStub')
  })

  it('redirects /docs to /docs/intro', async () => {
    await push('/docs')
    expect(router.currentRoute.value.path).toBe('/docs/intro')
    expect(router.currentRoute.value.name).toBe('docs-intro')
  })

  it('resolves /docs/usage/editor with slug=usage/editor', async () => {
    await push('/docs/usage/editor')
    expect(router.currentRoute.value.path).toBe('/docs/usage/editor')
    expect(router.currentRoute.value.params.article).toBe('editor')
    // ArticlePage props function returns slug = 'usage/' + params.article
    const matched = router.currentRoute.value.matched
    expect(matched.length).toBeGreaterThan(0)
    expect(matched[matched.length - 1].components?.default?.name).toBe('ArticlePageStub')
  })

  it('resolves /docs/intro as named route docs-intro', async () => {
    await push('/docs/intro')
    expect(router.currentRoute.value.name).toBe('docs-intro')
    expect(router.currentRoute.value.path).toBe('/docs/intro')
  })

  it('redirects unknown /docs/* to docs-not-found', async () => {
    await push('/docs/unknown/missing')
    expect(router.currentRoute.value.name).toBe('docs-not-found')
  })

  it('redirects unknown top-level paths to /', async () => {
    await push('/completely-unknown')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
