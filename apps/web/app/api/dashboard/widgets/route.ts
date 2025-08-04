import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { widgets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { WidgetRequest, WidgetResponse } from '@/lib/types/api'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    let query = db
      .select()
      .from(widgets)
      .where(eq(widgets.userId, session.user.id))

    if (configId) {
      query = query.where(and(
        eq(widgets.userId, session.user.id),
        eq(widgets.configId, configId)
      )) as any
    }

    const widgetList = await query

    const response: WidgetResponse[] = widgetList.map(widget => ({
      id: widget.id,
      userId: widget.userId,
      configId: widget.configId,
      type: widget.type,
      position: widget.position,
      settings: widget.settings,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching widgets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch widgets' },
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

    const body: WidgetRequest = await request.json()
    
    if (!body.configId || !body.type || !body.position) {
      return NextResponse.json(
        { error: 'ConfigId, type, and position are required' },
        { status: 400 }
      )
    }

    const result = await db
      .insert(widgets)
      .values({
        userId: session.user.id,
        configId: body.configId,
        type: body.type,
        position: body.position,
        settings: body.settings || null
      })
      .returning()

    const widget = result[0]
    const response: WidgetResponse = {
      id: widget.id,
      userId: widget.userId,
      configId: widget.configId,
      type: widget.type,
      position: widget.position,
      settings: widget.settings,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error creating widget:', error)
    return NextResponse.json(
      { error: 'Failed to create widget' },
      { status: 500 }
    )
  }
}