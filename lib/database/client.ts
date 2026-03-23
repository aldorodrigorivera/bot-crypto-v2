import Parse from 'parse/node'

const g = globalThis as { _parseInitialized?: boolean }

export function initParse(): void {
  if (g._parseInitialized) return

  Parse.initialize(
    process.env.BACK4APP_APP_ID ?? '',
    process.env.BACK4APP_JS_KEY ?? ''
  )
  ;(Parse as { serverURL?: string }).serverURL =
    process.env.BACK4APP_SERVER_URL ?? 'https://parseapi.back4app.com'

  g._parseInitialized = true
}

export { Parse }
