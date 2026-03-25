export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getIncubationStateInMemory } from '@/lib/incubation/manager'
import { getIncubationStatus } from '@/lib/incubation/monitor'
import { getAppConfig } from '@/lib/config'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const state = getIncubationStateInMemory()
    if (!state) {
      return NextResponse.json<ApiResponse>({ success: true, data: { active: false, state: null } })
    }
    const config = getAppConfig()
    const status = getIncubationStatus(state, config.incubation)
    return NextResponse.json<ApiResponse>({ success: true, data: { active: state.isActive, state, status } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo estado de incubación'
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
