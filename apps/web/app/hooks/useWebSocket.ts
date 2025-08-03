'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'
import * as Y from 'yjs'

interface UseWebSocketProps {
  onDocumentSync?: (state: number[]) => void
  onDocumentUpdate?: (data: { update: number[]; clientId: string; userId: string }) => void
  onUserJoined?: (data: { userId: string; clientId: string }) => void
  onUserLeft?: (data: { userId: string; clientId: string }) => void
}

export function useWebSocket({
  onDocumentSync,
  onDocumentUpdate,
  onUserJoined,
  onUserLeft
}: UseWebSocketProps = {}) {
  const { data: session, status } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set())
  const socketRef = useRef<Socket | null>(null)

  const connectToSyncServer = useCallback(() => {
    if (!session?.accessToken || socketRef.current?.connected) {
      return
    }

    try {
      const syncServerUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://your-sync-server.com'
        : 'ws://localhost:3001'

      const socket = io(`${syncServerUrl}/collaboration`, {
        auth: {
          token: session.accessToken // Now using JWT token
        },
        transports: ['websocket', 'polling']
      })

      socket.on('connect', () => {
        setIsConnected(true)
      })

      socket.on('disconnect', () => {
        setIsConnected(false)
        setConnectedUsers(new Set())
      })

      socket.on('auth_error', (error) => {
        import('@/lib/logger').then(({ logError }) => {
          logError('Sync server authentication failed', new Error(error.message), {
            socketId: socket.id,
            shouldRetry: error.shouldRetry,
            code: error.code
          })
        })
        setIsConnected(false)
        // Disconnect socket on auth error to prevent reconnection attempts
        socket.disconnect()
      })

      socket.on('join_error', (error) => {
        import('@/lib/logger').then(({ logError }) => {
          logError('Failed to join document', new Error(error.message), {
            socketId: socket.id
          })
        })
      })

      socket.on('update_error', (error) => {
        import('@/lib/logger').then(({ logError }) => {
          logError('Failed to process update', new Error(error.message), {
            socketId: socket.id
          })
        })
      })

      socket.on('document_sync', (state: number[]) => {
        onDocumentSync?.(state)
      })

      socket.on('document_update', (data: { update: number[]; clientId: string; userId: string }) => {
        if (data.clientId !== socket.id) {
          onDocumentUpdate?.(data)
        }
      })

      socket.on('user_joined', (data: { userId: string; clientId: string }) => {
        setConnectedUsers(prev => new Set(prev).add(data.userId))
        onUserJoined?.(data)
      })

      socket.on('user_left', (data: { userId: string; clientId: string }) => {
        setConnectedUsers(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.userId)
          return newSet
        })
        onUserLeft?.(data)
      })

      socketRef.current = socket
    } catch (error) {
      import('@/lib/logger').then(({ logError }) => {
        logError('Sync server connection failed', error instanceof Error ? error : new Error('An unexpected error occurred'))
      })
      setIsConnected(false)
    }
  }, [session?.accessToken, onDocumentSync, onDocumentUpdate, onUserJoined, onUserLeft])

  const disconnectFromSyncServer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setConnectedUsers(new Set())
    }
  }, [])

  const joinDocument = useCallback((documentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_document', { documentId })
    }
  }, [])

  const sendUpdate = useCallback((update: Uint8Array, documentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('document_update', {
        update: Array.from(update),
        documentId: documentId
      })
    }
  }, [])

  // Handle connection based on authentication
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      connectToSyncServer()
    } else if (status === 'unauthenticated') {
      disconnectFromSyncServer()
    }

    return () => {
      disconnectFromSyncServer()
    }
  }, [status, session?.accessToken, connectToSyncServer, disconnectFromSyncServer])

  return {
    isConnected,
    connectedUsers,
    joinDocument,
    sendUpdate,
    disconnect: disconnectFromSyncServer
  }
}