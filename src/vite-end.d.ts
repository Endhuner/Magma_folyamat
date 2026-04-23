/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

declare const spark: {
  llmPrompt: (strings: TemplateStringsArray, ...values: any[]) => string
  llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
  user: () => Promise<UserInfo>
  kv: {
    keys: () => Promise<string[]>
    get: <T>(key: string) => Promise<T | undefined>
    set: <T>(key: string, value: T) => Promise<void>
    delete: (key: string) => Promise<void>
  }
}

declare module 'xlsx-template' {
  interface TemplateInstance {
    substitute(sheetNumber: number, values: Record<string, string | number>): void
    generate(options?: { type?: string }): ArrayBuffer | Uint8Array | string
  }

  interface TemplateConstructor {
    new (templateData: ArrayBuffer): TemplateInstance
  }

  const XlsxTemplate: TemplateConstructor
  export default XlsxTemplate
}