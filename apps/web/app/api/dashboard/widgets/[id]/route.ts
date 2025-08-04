import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { widgets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { WidgetResponse } from '@/lib/types/api'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { position, settings } = body

    if (!position) {
      return NextResponse.json(
        { error: 'Position is required' },
        { status: 400 }
      )
    }

    const result = await db
      .update(widgets)
      .set({
        position,
        settings: settings || null,
        updatedAt: new Date()
      })
      .where(and(
        eq(widgets.id, params.id),
        eq(widgets.userId, session.user.id)
      ))
      .returning()

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      )
    }

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
    console.error('Error updating widget:', error)
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db
      .delete(widgets)
      .where(and(
        eq(widgets.id, params.id),
        eq(widgets.userId, session.user.id)
      ))
      .returning()

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Error deleting widget:', error)
    return NextResponse.json(
      { error: 'Failed to delete widget' },
      { status: 500 }
    )
  }
}