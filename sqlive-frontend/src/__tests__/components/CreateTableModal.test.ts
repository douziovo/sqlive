import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CreateTableModal from '../../components/CreateTableModal.vue'

// Dialog (reka-ui) uses Teleport / v-if — stub so content renders inline for testing
const stubs = {
    Dialog: {
        props: { open: Boolean },
        template: '<div v-if="open"><slot /></div>'
    },
    DialogContent: {
        template: '<div><slot /></div>'
    }
}

function mountOpen(props = {}) {
    return mount(CreateTableModal, {
        props: { open: true, ...props },
        global: { stubs }
    })
}

describe('CreateTableModal', () => {
    it('does not show modal content when open is false', () => {
        const wrapper = mount(CreateTableModal, {
            props: { open: false },
            global: { stubs }
        })
        // When closed, the Dialog should not render children — the submit button should be absent
        const buttons = wrapper.findAll('button')
        const createBtn = Array.from(buttons).find((b) => b.text().includes('立即创建'))
        expect(createBtn).toBeUndefined()
    })

    it('renders title when open is true', () => {
        const wrapper = mountOpen()
        expect(wrapper.text()).toContain('创建新表格')
    })

    it('submit button is disabled when table name is empty', () => {
        const wrapper = mountOpen()
        const btn = wrapper.find('button:disabled')
        expect(btn.exists()).toBe(true)
    })

    it('submit button enables when table name and column are filled', async () => {
        const wrapper = mountOpen()

        await wrapper.find('input[placeholder*="请输入表名"]').setValue('users')
        await wrapper.find('input[placeholder*="int"]').setValue('INTEGER')
        await wrapper.find('input[placeholder*="id"]').setValue('id')

        const btn = wrapper.find('button:not(:disabled)')
        expect(btn.exists()).toBe(true)
    })

    it('emits close when X button is clicked', async () => {
        const wrapper = mountOpen()
        // The X close button is the first button in the header
        const buttons = wrapper.findAll('button')
        const closeBtn = buttons[0]
        await closeBtn.trigger('click')
        expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    })

    it('emits close when cancel button is clicked', async () => {
        const wrapper = mountOpen()
        const buttons = wrapper.findAll('button')
        // Cancel button contains "取消"
        for (const btn of buttons) {
            if (btn.text().includes('取消')) {
                await btn.trigger('click')
                expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
                return
            }
        }
        expect.fail('Cancel button not found')
    })

    it('emits submit with correct payload', async () => {
        const wrapper = mountOpen()

        await wrapper.find('input[placeholder*="请输入表名"]').setValue('users')
        await wrapper.find('input[placeholder*="int"]').setValue('INTEGER')
        await wrapper.find('input[placeholder*="id"]').setValue('id')

        const buttons = wrapper.findAll('button')
        const submitBtn = Array.from(buttons).find((b) => b.text().includes('立即创建'))
        expect(submitBtn).toBeTruthy()
        await submitBtn?.trigger('click')

        const submitCalls = wrapper.emitted('submit')
        expect(submitCalls).toBeTruthy()
        expect(submitCalls?.[0][0]).toMatchObject({
            name: 'users',
            columns: ['"id" INTEGER']
        })
    })

    it('adds a row when "添加新字段" is clicked', async () => {
        const wrapper = mountOpen()
        const buttons = wrapper.findAll('button')
        const addBtn = Array.from(buttons).find((b) => b.text().includes('添加新字段'))
        expect(addBtn).toBeTruthy()

        const initialCount = wrapper.findAll('input[placeholder*="int"]').length
        await addBtn?.trigger('click')
        expect(wrapper.findAll('input[placeholder*="int"]').length).toBe(initialCount + 1)
    })

    it('resets form when open toggles from false to true', async () => {
        const wrapper = mountOpen()

        await wrapper.find('input[placeholder*="请输入表名"]').setValue('dirty')
        expect(
            (wrapper.find('input[placeholder*="请输入表名"]').element as HTMLInputElement).value
        ).toBe('dirty')

        await wrapper.setProps({ open: false })
        await wrapper.setProps({ open: true })

        expect(
            (wrapper.find('input[placeholder*="请输入表名"]').element as HTMLInputElement).value
        ).toBe('')
    })

    it('shows "等待输入..." when no table name', () => {
        const wrapper = mountOpen()
        expect(wrapper.text()).toContain('等待输入...')
    })

    it('shows SQL preview when table name and columns are filled', async () => {
        const wrapper = mountOpen()

        await wrapper.find('input[placeholder*="请输入表名"]').setValue('t')
        await wrapper.find('input[placeholder*="int"]').setValue('int')
        await wrapper.find('input[placeholder*="id"]').setValue('a')

        const preview = wrapper.find('pre')
        expect(preview.exists()).toBe(true)
        expect(preview.text()).toContain('CREATE TABLE "t"(')
    })
})

describe('CreateTableModal — rows and SQL preview', () => {
    it('quotes special names in preview and retains actual data keys on submit', async () => {
        const wrapper = mountOpen()
        await wrapper.find('input[placeholder*="请输入表名"]').setValue('order "中文')
        await wrapper.find('input[placeholder*="int"]').setValue('TEXT')
        await wrapper.find('input[placeholder*="id"]').setValue('full "name')
        await wrapper.find('input[placeholder="空"]').setValue('Alice')

        expect(wrapper.find('pre').text()).toContain('CREATE TABLE "order ""中文"(')
        expect(wrapper.find('pre').text()).toContain('"full ""name" TEXT')
        const submit = wrapper
            .findAll('button')
            .find((button) => button.text().includes('立即创建'))
        await submit!.trigger('click')
        expect(wrapper.emitted('submit')![0][0]).toEqual({
            name: 'order "中文',
            columns: ['"full ""name" TEXT'],
            data: [{ 'full "name': 'Alice' }]
        })
    })
    it('removes a row when its delete button is clicked', async () => {
        const wrapper = mountOpen()
        const addBtn = wrapper.findAll('button').find((b) => b.text().includes('添加新字段'))
        await addBtn!.trigger('click')
        expect(wrapper.findAll('input[placeholder*="int"]').length).toBe(2)

        const delBtn = wrapper.find('button[title="删除此行"]')
        await delBtn.trigger('click')
        expect(wrapper.findAll('input[placeholder*="int"]').length).toBe(1)
    })

    it('preview includes an INSERT with NULL for empty values and literals for filled ones', async () => {
        const wrapper = mountOpen()
        await wrapper.find('input[placeholder*="请输入表名"]').setValue('users')
        const typeInputs = wrapper.findAll('input[placeholder*="int"]')
        await typeInputs[0].setValue('INTEGER')
        await wrapper.find('input[placeholder*="id"]').setValue('id')
        await wrapper.find('input[placeholder="空"]').setValue('42')

        // Second row: type + name, no value → NULL in INSERT
        const addBtn = wrapper.findAll('button').find((b) => b.text().includes('添加新字段'))
        await addBtn!.trigger('click')
        const types = wrapper.findAll('input[placeholder*="int"]')
        await types[1].setValue('TEXT')
        await wrapper.findAll('input[placeholder*="id"]')[1].setValue('name')

        const preview = wrapper.text()
        expect(preview).toContain('CREATE TABLE "users"(')
        expect(preview).toContain('INSERT INTO "users" VALUES (42, NULL);')
    })

    it('preview omits the INSERT statement when no row has a value', async () => {
        const wrapper = mountOpen()
        await wrapper.find('input[placeholder*="请输入表名"]').setValue('users')
        await wrapper.find('input[placeholder*="int"]').setValue('INTEGER')
        await wrapper.find('input[placeholder*="id"]').setValue('id')

        expect(wrapper.text()).toContain('CREATE TABLE "users"(')
        expect(wrapper.text()).not.toContain('INSERT INTO')
    })

    it('submit maps row values into a single data record', async () => {
        const wrapper = mountOpen()
        await wrapper.find('input[placeholder*="请输入表名"]').setValue('users')
        await wrapper.find('input[placeholder*="int"]').setValue('INTEGER')
        await wrapper.find('input[placeholder*="id"]').setValue('id')
        await wrapper.find('input[placeholder="空"]').setValue('7')

        const submitBtn = wrapper.findAll('button').find((b) => b.text().includes('立即创建'))
        await submitBtn!.trigger('click')

        const events = wrapper.emitted('submit')
        expect(events).toBeTruthy()
        expect(events![0][0]).toEqual({
            name: 'users',
            columns: ['"id" INTEGER'],
            data: [{ id: '7' }]
        })
        expect(wrapper.emitted('update:open')).toEqual([[false]])
    })
})
