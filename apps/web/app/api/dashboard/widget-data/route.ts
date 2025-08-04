import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { widgetData } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { WidgetDataRequest, WidgetDataResponse } from '@/lib/types/api'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const widgetId = searchParams.get('widgetId')
    const periodId = searchParams.get('periodId')

    let query = db
      .select()
      .from(widgetData)
      .where(eq(widgetData.userId, session.user.id))

    if (widgetId && periodId) {
      query = query.where(and(
        eq(widgetData.userId, session.user.id),
        eq(widgetData.widgetId, widgetId),
        eq(widgetData.periodId, periodId)
      )) as any
    } else if (widgetId) {
      query = query.where(and(
        eq(widgetData.userId, session.user.id),
        eq(widgetData.widgetId, widgetId)
      )) as any
    } else if (periodId) {
      query = query.where(and(
        eq(widgetData.userId, session.user.id),
        eq(widgetData.periodId, periodId)
      )) as any
    }

    const dataList = await query

    const response: WidgetDataResponse[] = dataList.map(data => ({
      id: data.id,
      widgetId: data.widgetId,
      userId: data.userId,
      periodId: data.periodId,
      data: data.data,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching widget data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch widget data' },
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

    const body: WidgetDataRequest = await request.json()
    
    if (!body.widgetId || !body.periodId) {
      return NextResponse.json(
        { error: 'WidgetId and periodId are required' },
        { status: 400 }
      )
    }

    // Check if data already exists for this widget/period combination
    const existingData = await db
      .select()
      .from(widgetData)
      .where(and(
        eq(widgetData.userId, session.user.id),
        eq(widgetData.widgetId, body.widgetId),
        eq(widgetData.periodId, body.periodId)
      ))
      .limit(1)

    let result
    if (existingData.length > 0) {
      // Update existing data
      result = await db
        .update(widgetData)
        .set({
          data: body.data,
          updatedAt: new Date()
        })
        .where(and(
          eq(widgetData.userId, session.user.id),
          eq(widgetData.widgetId, body.widgetId),
          eq(widgetData.periodId, body.periodId)
        ))
        .returning()
    } else {
      // Create new data
      result = await db
        .insert(widgetData)
        .values({
          userId: session.user.id,
          widgetId: body.widgetId,
          periodId: body.periodId,
          data: body.data
        })
        .returning()
    }

    const data = result[0]
    const response: WidgetDataResponse = {
      id: data.id,
      widgetId: data.widgetId,
      userId: data.userId,
      periodId: data.periodId,
      data: data.data,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error saving widget data:', error)
    return NextResponse.json(
      { error: 'Failed to save widget data' },
      { status: 500 }
    )
  }
}