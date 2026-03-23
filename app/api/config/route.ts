export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getGridConfig, saveGridConfig } from '@/lib/database/config'
import { getAppConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  logger.debug('GET /api/config')
  try {
    const config = getAppConfig()
    const dbConfig = await getGridConfig(config.bot.pair)
    const data = dbConfig ?? { gridLevels: config.bot.gridLevels, gridRangePercent: config.bot.gridRangePercent }
    logger.debug('GET /api/config OK', data)
    return NextResponse.json<ApiResponse>({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo config'
    logger.error('GET /api/config ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  logger.info('PATCH /api/config', { gridLevels: body.gridLevels, gridRangePercent: body.gridRangePercent })
  try {
    const config = getAppConfig()
    const current = await getGridConfig(config.bot.pair)
    const newLevels = body.gridLevels ?? current?.gridLevels ?? config.bot.gridLevels
    const newRange = body.gridRangePercent ?? current?.gridRangePercent ?? config.bot.gridRangePercent
    await saveGridConfig(config.bot.pair, newLevels, newRange)
    logger.info('PATCH /api/config OK', { gridLevels: newLevels, gridRangePercent: newRange })
    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Config actualizada' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error actualizando config'
    logger.error('PATCH /api/config ERROR', { error: msg })
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 })
  }
}
