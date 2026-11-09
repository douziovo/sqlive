import { makeKnowledgeTopic } from '@/__tests__/fixtures/knowledge'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import KnowledgeGraphDetailCard from '@/components/knowledge/graph/KnowledgeGraphDetailCard.vue'

const topic = makeKnowledgeTopic({ id: 'basics', label: '基础', difficulty: 1 })

function mountCard(props: { topic?: KnowledgeTopic | null; masteredTopics?: string[] } = {}) {
    return mount(KnowledgeGraphDetailCard, {
        props: {
            topic: props.topic ?? null,
            masteredTopics: props.masteredTopics ?? []
        },
        global: { stubs: { KnowledgeDetail: true } }
    })
}

describe('KnowledgeGraphDetailCard', () => {
    it('renders nothing visible when topic is null', () => {
        const wrapper = mountCard()
        expect(wrapper.findComponent({ name: 'KnowledgeDetail' }).exists()).toBe(false)
    })

    it('passes topic and mastered state to KnowledgeDetail', () => {
        const wrapper = mountCard({ topic, masteredTopics: ['basics'] })
        const detail = wrapper.findComponent({ name: 'KnowledgeDetail' })
        expect(detail.props('topic')).toMatchObject({ id: 'basics' })
        expect(detail.props('isMastered')).toBe(true)
    })

    it('relays all KnowledgeDetail events', async () => {
        const wrapper = mountCard({ topic })
        const detail = wrapper.findComponent({ name: 'KnowledgeDetail' })

        await detail.vm.$emit('toggle-mastered', 'basics')
        await detail.vm.$emit('ask-ai', '基础')
        await detail.vm.$emit('close')
        await detail.vm.$emit('view-all-tasks')
        await detail.vm.$emit('complete-task', 'basics')
        await detail.vm.$emit('navigate-to-topic', 'basics')

        expect(wrapper.emitted('toggle-mastered')).toEqual([['basics']])
        expect(wrapper.emitted('ask-ai')).toEqual([['基础']])
        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(wrapper.emitted('view-all-tasks')).toHaveLength(1)
        expect(wrapper.emitted('complete-task')).toEqual([['basics']])
        expect(wrapper.emitted('navigate-to-topic')).toEqual([['basics']])
    })
})
