declare module 'monaco-editor/esm/vs/editor/editor.api' {
    export * from 'monaco-editor'
}

declare module 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution' {
}

declare module 'monaco-editor/esm/vs/platform/commands/common/commands' {
    export const CommandsRegistry: {
        registerCommand(opts: { id: string; handler: (...args: any[]) => void }): void
        getCommand(id: string): any
    }
}
