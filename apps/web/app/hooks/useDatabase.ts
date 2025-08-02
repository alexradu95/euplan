'use client'

import { useState, useEffect } from 'react'
import type { Database } from 'sql.js'

const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm"

export function useDatabase() {
  const [db, setDb] = useState<Database | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initDb = async () => {
      try {
        // Dynamically import sql.js only on the client side
        const initSqlJs = (await import('sql.js')).default
        
        const SQL = await initSqlJs({ 
          locateFile: (file: string) => {
            if (file === 'sql-wasm.wasm') {
              return wasmUrl
            }
            return file
          }
        })
        
        const savedDb = localStorage.getItem('euplan-sqlite-db')
        let database: Database

        if (savedDb) {
          // If a saved database exists in localStorage, load it
          database = new SQL.Database(new Uint8Array(JSON.parse(savedDb)))
        } else {
          // Otherwise, create a new database
          database = new SQL.Database()
          // And create our table schema for local caching
          database.run("CREATE TABLE documents (id TEXT PRIMARY KEY, data BLOB);")
        }
        
        setDb(database)
        setIsInitialized(true)
      } catch (err) {
        import('@/lib/logger').then(({ logError }) => {
          logError('Failed to initialize SQLite database', err instanceof Error ? err : new Error(String(err)))
        })
        setIsInitialized(true) // Mark as initialized even on error
      }
    }
    
    // Only run on client side
    if (typeof window !== 'undefined') {
      initDb()
    }
  }, [])

  const saveDatabase = (database: Database) => {
    if (database) {
      const binaryDb = database.export()
      localStorage.setItem('euplan-sqlite-db', JSON.stringify(Array.from(binaryDb)))
    }
  }

  return {
    db,
    isInitialized,
    saveDatabase
  }
}