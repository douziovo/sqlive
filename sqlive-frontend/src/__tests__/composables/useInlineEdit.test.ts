import {describe, expect, it} from 'vitest'
import {useInlineEdit} from '@/composables/useInlineEdit'
import type {CellUpdateEvent} from '@/model/DatabaseTypes'

function makeBlurEvent(value: string): FocusEvent {
    const textarea = document.createElement('textarea')
    textarea.value = value
    // Dispatch blur event on the textarea so e.target is set correctly
    const event = new FocusEvent('blur', {bubbles: false, cancelable: true})
    Object.defineProperty(event, 'target', {value: textarea, writable: false})
    return event
}

describe('useInlineEdit', () => {
    it("emit('update-cell', payload) receives correct CellUpdateEvent payload shape when handleBlur is called with changed value", () => {
        let emittedPayload: CellUpdateEvent | null = null
        const mockEmit = (_event: 'update-cell', payload: CellUpdateEvent) => {
            emittedPayload = payload
        }

        const {handleBlur} = useInlineEdit('users', {name: 'TEXT'}, mockEmit)
        const row = {id: 1, name: 'OldName'}
        const event = makeBlurEvent('NewName')

        handleBlur(event, row, 'name')

        expect(emittedPayload).not.toBeNull()
        expect(emittedPayload!.tableName).toBe('users')
        expect(emittedPayload!.oldRow).toEqual({id: 1, name: 'OldName'})
        expect(emittedPayload!.newRow).toEqual({id: 1, name: 'NewName'})
    })

    it('handleBlur with same value does NOT call emit (no-op when oldVal === newVal)', () => {
        let emitCalled = false
        const mockEmit = () => {
            emitCalled = true
        }

        const {handleBlur} = useInlineEdit('users', {name: 'TEXT'}, mockEmit)
        const row = {id: 1, name: 'Alice'}
        const event = makeBlurEvent('Alice')

        handleBlur(event, row, 'name')

        expect(emitCalled).toBe(false)
    })

    it('NOT NULL constraint: does NOT call emit when newVal is empty string and column type has NOT NULL', () => {
        let emitCalled = false
        const mockEmit = () => {
            emitCalled = true
        }

        const {handleBlur} = useInlineEdit('users', {name: 'TEXT NOT NULL'}, mockEmit)
        const row = {id: 1, name: 'Alice'}
        const event = makeBlurEvent('')

        handleBlur(event, row, 'name')

        expect(emitCalled).toBe(false)
    })

    it('numeric type validation: does NOT call emit when newVal is non-numeric and column type is numeric', () => {
        let emitCalled = false
        const mockEmit = () => {
            emitCalled = true
        }

        const {handleBlur} = useInlineEdit('users', {id: 'INTEGER'}, mockEmit)
        const row = {id: 1, name: 'Alice'}
        const event = makeBlurEvent('not-a-number')

        handleBlur(event, row, 'id')

        expect(emitCalled).toBe(false)
    })

    it('numeric type validation: DOES call emit when newVal is valid numeric', () => {
        let emittedPayload: CellUpdateEvent | null = null
        const mockEmit = (_event: 'update-cell', payload: CellUpdateEvent) => {
            emittedPayload = payload
        }

        const {handleBlur} = useInlineEdit('users', {id: 'INTEGER'}, mockEmit)
        const row = {id: 1, name: 'Alice'}
        const event = makeBlurEvent('42')

        handleBlur(event, row, 'id')

        expect(emittedPayload).not.toBeNull()
        expect(emittedPayload!.newRow.id).toBe('42')
    })

    it('NOT NULL constraint with whitespace-only value: does NOT call emit', () => {
        let emitCalled = false
        const mockEmit = () => {
            emitCalled = true
        }

        const {handleBlur} = useInlineEdit('users', {name: 'TEXT NOT NULL'}, mockEmit)
        const row = {id: 1, name: 'Alice'}
        const event = makeBlurEvent('   ')

        handleBlur(event, row, 'name')

        expect(emitCalled).toBe(false)
    })
})
