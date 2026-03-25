export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getIncubationStateInMemory } from '@/lib/incubation/manager'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const state = getIncubationStateInMemory()
    const history = state?.phaseHistory ?? []
    return NextResponse.json<ApiResponse>({ success: true, data: { history } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo historial de incubación'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
