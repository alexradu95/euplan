import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { dashboardConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { DashboardConfigRequest, DashboardConfigResponse } from '@/lib/types/api'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    let query = db
      .select()
      .from(dashboardConfigs)
      .where(eq(dashboardConfigs.userId, session.user.id))

    if (period) {
      query = query.where(and(
        eq(dashboardConfigs.userId, session.user.id),
        eq(dashboardConfigs.period, period)
      )) as any
    }

    const configs = await query

    const response: DashboardConfigResponse[] = configs.map(config => ({
      id: config.id,
      userId: config.userId,
      period: config.period as 'daily' | 'weekly' | 'monthly',
      layout: config.layout,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching dashboard configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: DashboardConfigRequest = await request.json()
    
    if (!body.period || !body.layout) {
      return NextResponse.json(
        { error: 'Period and layout are required' },
        { status: 400 }
      )
    }

    // Check if config already exists for this period
    const existingConfig = await db
      .select()
      .from(dashboardConfigs)
      .where(and(
        eq(dashboardConfigs.userId, session.user.id),
        eq(dashboardConfigs.period, body.period)
      ))
      .limit(1)

    let result
    if (existingConfig.length > 0) {
      // Update existing config
      result = await db
        .update(dashboardConfigs)
        .set({
          layout: body.layout,
          updatedAt: new Date()
        })
        .where(and(
          eq(dashboardConfigs.userId, session.user.id),
          eq(dashboardConfigs.period, body.period)
        ))
        .returning()
    } else {
      // Create new config
      result = await db
        .insert(dashboardConfigs)
        .values({
          userId: session.user.id,
          period: body.period,
          layout: body.layout
        })
        .returning()
    }

    const config = result[0]
    const response: DashboardConfigResponse = {
      id: config.id,
      userId: config.userId,
      period: config.period as 'daily' | 'weekly' | 'monthly',
      layout: config.layout,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error creating/updating dashboard config:', error)
    return NextResponse.json(
      { error: 'Failed to save dashboard config' },
      { status: 500 }
    )
  }
}