export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getRecentSessions } from '@/lib/database/tradingSessions'
import { getAppConfig } from '@/lib/config'

export async function GET(req: NextRequest) {
  try {
    const config = getAppConfig()
    const days = Number(req.nextUrl.searchParams.get('days') ?? '7')
    const sessions = await getRecentSessions(config.bot.pair, days)
    return Response.json({ success: true, data: sessions })
  } catch (err) {
    return Response.json({ success: false, error: 'Error al obtener sesiones' }, { status: 500 })
  }
}
