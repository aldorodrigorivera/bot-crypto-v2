export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getRecentSessions } from '@/lib/database/tradingSessions'
import { getAppConfig } from '@/lib/config'
import { withCache } from '@/lib/cache'

export async function GET(req: NextRequest) {
  try {
    const config = getAppConfig()
    const days = Number(req.nextUrl.searchParams.get('days') ?? '7')
    const sessions = await withCache(`sessions:${config.bot.pair}:${days}`, 60_000, () =>
      getRecentSessions(config.bot.pair, days)
    )
    return Response.json({ success: true, data: sessions })
  } catch (err) {
    return Response.json({ success: false, error: 'Error al obtener sesiones' }, { status: 500 })
  }
}
