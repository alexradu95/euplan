'use client'

import React, { useMemo } from 'react'
import { Responsive, WidthProvider, Layout } from 'react-grid-layout'
import { useDashboard } from '../providers/DashboardProvider'
import { getWidgetById } from '../widgets/WidgetRegistry'
import { WidgetLayout } from '../types/widget'

// Import the CSS for react-grid-layout
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

export default function GridDashboard() {
  const {
    getCurrentWidgets,
    getCurrentLayout,
    updateLayout,
    removeWidget
  } = useDashboard()

  const widgets = getCurrentWidgets()
  const layouts = getCurrentLayout()

  // Convert our layout format to react-grid-layout format
  const gridLayouts = useMemo(() => {
    const layoutMap: Layout[] = layouts.map(layout => ({
      i: layout.i,
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      minW: layout.minW,
      minH: layout.minH,
      maxW: layout.maxW,
      maxH: layout.maxH,
      isDraggable: layout.isDraggable !== false,
      isResizable: layout.isResizable !== false
    }))

    return {
      lg: layoutMap,
      md: layoutMap,
      sm: layoutMap.map(l => ({ ...l, w: Math.min(l.w, 6) })), // Smaller width for tablets
      xs: layoutMap.map(l => ({ ...l, w: 12, x: 0 })), // Full width for mobile
      xxs: layoutMap.map(l => ({ ...l, w: 12, x: 0 })) // Full width for small mobile
    }
  }, [layouts])

  // Handle layout changes
  const handleLayoutChange = (layout: Layout[], layouts: { [key: string]: Layout[] }) => {
    // Convert back to our format and update state
    const newLayout: WidgetLayout[] = layout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
      isDraggable: item.isDraggable !== false,
      isResizable: item.isResizable !== false
    }))
    
    updateLayout(newLayout)
  }

  // Handle widget removal
  const handleRemoveWidget = (widgetId: string) => {
    removeWidget(widgetId)
  }

  // Render individual widgets
  const renderWidget = (widget: typeof widgets[0]) => {
    const widgetDef = getWidgetById(widget.type)
    if (!widgetDef) {
      return (
        <div key={widget.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Widget type "{widget.type}" not found</p>
        </div>
      )
    }

    const WidgetComponent = widgetDef.component
    return (
      <div key={widget.id} className="widget-container">
        <WidgetComponent
          widgetId={widget.id}
          config={widgetDef.config}
          onRemove={handleRemoveWidget}
        />
      </div>
    )
  }

  if (widgets.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No widgets yet</h3>
          <p className="text-gray-500">Add some widgets to customize your dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveGridLayout
        className="layout"
        layouts={gridLayouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={true}
        isResizable={true}
        onLayoutChange={handleLayoutChange}
        useCSSTransforms={true}
        preventCollision={false}
        compactType="vertical"
        draggableCancel=".non-draggable"
      >
        {widgets.map(renderWidget)}
      </ResponsiveGridLayout>

      {/* Custom styles for grid layout */}
      <style jsx global>{`
        .widget-container {
          height: 100%;
        }
        
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top;
        }
        
        .react-grid-item.cssTransforms {
          transition-property: transform;
        }
        
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          bottom: 0;
          right: 0;
          background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZG90cyBmaWxsPSIjOTk5IiAvPgo8cGF0aCBkPSJtMS41IDQuNSAzLTMgMS41IDEuNS0zIDN6IiBmaWxsPSIjOTk5IiAvPgo8L3N2Zz4K');
          background-position: bottom right;
          padding: 0 3px 3px 0;
          background-repeat: no-repeat;
          background-origin: content-box;
          box-sizing: border-box;
          cursor: se-resize;
        }
        
        .react-grid-item.react-grid-placeholder {
          background: rgb(59 130 246 / 0.15);
          border: 2px dashed rgb(59 130 246 / 0.5);
          opacity: 0.2;
          transition-duration: 100ms;
          z-index: 2;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -o-user-select: none;
          user-select: none;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          opacity: 0.8;
        }
        
        .react-grid-item.react-resizable-resizing {
          transition: none;
          z-index: 3;
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}