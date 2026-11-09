import type { AiResponse } from '../model/ApiTypes'

export function apiErrorMessage(error: AiResponse<unknown>['error']): string {
    return (typeof error === 'string' ? error : error?.message) || '未知错误'
}
