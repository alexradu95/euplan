'use client'

import { 
  DashboardConfigRequest, 
  DashboardConfigResponse,
  WidgetRequest,
  WidgetResponse,
  WidgetDataRequest,
  WidgetDataResponse,
  ApiResponse,
  isApiSuccess
} from '@/lib/types/api'
import { encryptWidgetData, decryptWidgetData, isEncryptionSupported } from '@/lib/encryption'

class DashboardService {
  private baseUrl = '/api/dashboard'

  // Dashboard Configs
  async getDashboardConfigs(period?: string): Promise<DashboardConfigResponse[]> {
    const url = period 
      ? `${this.baseUrl}/configs?period=${encodeURIComponent(period)}`
      : `${this.baseUrl}/configs`
    
    const response = await fetch(url)
    const result: ApiResponse<DashboardConfigResponse[]> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async saveDashboardConfig(config: DashboardConfigRequest): Promise<DashboardConfigResponse> {
    const response = await fetch(`${this.baseUrl}/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    
    const result: ApiResponse<DashboardConfigResponse> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  // Widgets
  async getWidgets(configId?: string): Promise<WidgetResponse[]> {
    const url = configId 
      ? `${this.baseUrl}/widgets?configId=${encodeURIComponent(configId)}`
      : `${this.baseUrl}/widgets`
    
    const response = await fetch(url)
    const result: ApiResponse<WidgetResponse[]> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async createWidget(widget: WidgetRequest): Promise<WidgetResponse> {
    const response = await fetch(`${this.baseUrl}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(widget)
    })
    
    const result: ApiResponse<WidgetResponse> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async updateWidget(id: string, updates: { position: string; settings?: string }): Promise<WidgetResponse> {
    const response = await fetch(`${this.baseUrl}/widgets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    
    const result: ApiResponse<WidgetResponse> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async deleteWidget(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/widgets/${id}`, {
      method: 'DELETE'
    })
    
    const result: ApiResponse<{ success: boolean }> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
  }

  // Widget Data with encryption
  async getWidgetData(widgetId?: string, periodId?: string): Promise<WidgetDataResponse[]> {
    const params = new URLSearchParams()
    if (widgetId) params.append('widgetId', widgetId)
    if (periodId) params.append('periodId', periodId)
    
    const url = `${this.baseUrl}/widget-data${params.toString() ? '?' + params.toString() : ''}`
    
    const response = await fetch(url)
    const result: ApiResponse<WidgetDataResponse[]> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async saveWidgetData(widgetId: string, periodId: string, data: any, userId: string): Promise<WidgetDataResponse> {
    let encryptedData: string
    
    if (isEncryptionSupported()) {
      try {
        encryptedData = await encryptWidgetData(data, userId)
      } catch (error) {
        console.error('Encryption failed, storing as plain text:', error)
        encryptedData = JSON.stringify(data)
      }
    } else {
      console.warn('Encryption not supported, storing as plain text')
      encryptedData = JSON.stringify(data)
    }

    const request: WidgetDataRequest = {
      widgetId,
      periodId,
      data: encryptedData
    }

    const response = await fetch(`${this.baseUrl}/widget-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    
    const result: ApiResponse<WidgetDataResponse> = await response.json()
    
    if (!isApiSuccess(result)) {
      throw new Error(result.error)
    }
    
    return result.data
  }

  async loadWidgetData<T = any>(widgetId: string, periodId: string, userId: string): Promise<T | null> {
    try {
      const dataList = await this.getWidgetData(widgetId, periodId)
      
      if (dataList.length === 0 || !dataList[0].data) {
        return null
      }

      const encryptedData = dataList[0].data
      
      if (isEncryptionSupported()) {
        try {
          return await decryptWidgetData<T>(encryptedData, userId)
        } catch (error) {
          console.error('Decryption failed, trying plain text:', error)
          return JSON.parse(encryptedData)
        }
      } else {
        console.warn('Encryption not supported, parsing as plain text')
        return JSON.parse(encryptedData)
      }
    } catch (error) {
      console.error('Error loading widget data:', error)
      return null
    }
  }

  // Local storage fallback methods
  saveToLocalStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }

  loadFromLocalStorage<T = any>(key: string): T | null {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }
}

export const dashboardService = new DashboardService()