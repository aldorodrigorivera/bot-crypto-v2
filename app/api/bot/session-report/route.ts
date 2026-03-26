export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getRecentSessions } from '@/lib/database/tradingSessions'
import { generateSessionReport } from '@/lib/bot/sessionReport'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function POST() {
  logger.info('POST /api/bot/session-report')
  try {
    const config = getAppConfig()
    const sessions = await getRecentSessions(config.bot.pair, 30)
    if (sessions.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No hay sesiones recientes para generar el reporte' },
        { status: 404 }
      )
    }
    const lastSession = sessions[0]
    await generateSessionReport(lastSession)
    logger.info('POST /api/bot/session-report OK')
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Reporte generado' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error generando reporte de sesión'
    logger.error('POST /api/bot/session-report ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
