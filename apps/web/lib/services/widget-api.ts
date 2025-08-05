import { WidgetDataRequest, WidgetDataResponse, ApiResponse, isApiError } from '../types/api'

/**
 * Service for handling widget data persistence through the API
 */
export class WidgetApiService {
  /**
   * Load widget data for a specific widget and period
   */
  static async loadWidgetData(widgetId: string, periodId: string): Promise<unknown | null> {
    try {
      const response = await fetch(
        `/api/dashboard/widget-data?widgetId=${encodeURIComponent(widgetId)}&periodId=${encodeURIComponent(periodId)}`
      )

      const result: ApiResponse<WidgetDataResponse[]> = await response.json()

      if (!response.ok) {
        const errorMessage = isApiError(result) ? result.error : 'Unknown error'
        throw new Error(`Failed to load widget data: ${errorMessage}`)
      }

      if (isApiError(result)) {
        throw new Error(`Failed to load widget data: ${result.error}`)
      }

      // Return the parsed data from the first matching record, or null if none exists
      if (result.data.length === 0) {
        return null
      }

      const widgetData = result.data[0] 
      return widgetData.data ? JSON.parse(widgetData.data) : null
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to load widget data')
    }
  }

  /**
   * Save widget data for a specific widget and period
   */
  static async saveWidgetData(widgetId: string, periodId: string, data: unknown): Promise<void> {
    try {
      const requestBody: WidgetDataRequest = {
        widgetId,
        periodId,
        data: JSON.stringify(data)
      }

      const response = await fetch('/api/dashboard/widget-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const result: ApiResponse<WidgetDataResponse> = await response.json()

      if (!response.ok) {
        const errorMessage = isApiError(result) ? result.error : 'Unknown error'
        throw new Error(`Failed to save widget data: ${errorMessage}`)
      }

      if (isApiError(result)) {
        throw new Error(`Failed to save widget data: ${result.error}`)
      }

      // Success - no need to return anything
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to save widget data')
    }
  }

  /**
   * Delete widget data for a specific widget and period
   * Note: This would require a DELETE endpoint to be implemented in the API
   */
  static async deleteWidgetData(widgetId: string, periodId: string): Promise<void> {
    // For now, we can save empty data to effectively "delete" the widget data
    await this.saveWidgetData(widgetId, periodId, null)
  }
}