import { WidgetApiService } from './widget-api'
import { WidgetDataResponse } from '../types/api'

// Mock fetch globally
global.fetch = jest.fn()

describe('WidgetApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadWidgetData', () => {
    it('should load widget data successfully', async () => {
      const mockResponse: WidgetDataResponse = {
        id: 'data-1',
        widgetId: 'widget-1',
        userId: 'user-1',
        periodId: 'period-1',
        data: JSON.stringify({ tasks: [] }),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockResponse] })
      })

      const result = await WidgetApiService.loadWidgetData('widget-1', 'period-1')

      expect(result).toEqual({ tasks: [] })
      expect(fetch).toHaveBeenCalledWith(
        '/api/dashboard/widget-data?widgetId=widget-1&periodId=period-1'
      )
    })

    it('should return null when no data exists', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      })

      const result = await WidgetApiService.loadWidgetData('widget-1', 'period-1')

      expect(result).toBeNull()
    })

    it('should throw error when API call fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' })
      })

      await expect(
        WidgetApiService.loadWidgetData('widget-1', 'period-1')
      ).rejects.toThrow('Failed to load widget data: Unauthorized')
    })

    it('should handle network errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(
        WidgetApiService.loadWidgetData('widget-1', 'period-1')
      ).rejects.toThrow('Network error')
    })
  })

  describe('saveWidgetData', () => {
    it('should save widget data successfully', async () => {
      const testData = { tasks: [{ id: '1', text: 'Test task' }] }
      const mockResponse: WidgetDataResponse = {
        id: 'data-1',
        widgetId: 'widget-1',
        userId: 'user-1',
        periodId: 'period-1',
        data: JSON.stringify(testData),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await WidgetApiService.saveWidgetData('widget-1', 'period-1', testData)

      expect(fetch).toHaveBeenCalledWith('/api/dashboard/widget-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          widgetId: 'widget-1',
          periodId: 'period-1',
          data: JSON.stringify(testData)
        })
      })
    })

    it('should throw error when save fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation error' })
      })

      await expect(
        WidgetApiService.saveWidgetData('widget-1', 'period-1', { test: 'data' })
      ).rejects.toThrow('Failed to save widget data: Validation error')
    })

    it('should handle network errors during save', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(
        WidgetApiService.saveWidgetData('widget-1', 'period-1', { test: 'data' })
      ).rejects.toThrow('Network error')
    })
  })

  describe('error handling', () => {
    it('should parse error messages from API responses', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Specific error message' })
      })

      await expect(
        WidgetApiService.loadWidgetData('widget-1', 'period-1')
      ).rejects.toThrow('Failed to load widget data: Specific error message')
    })

    it('should handle malformed API responses', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ malformed: 'response' })
      })

      await expect(
        WidgetApiService.loadWidgetData('widget-1', 'period-1')
      ).rejects.toThrow('Failed to load widget data: Unknown error')
    })
  })
})