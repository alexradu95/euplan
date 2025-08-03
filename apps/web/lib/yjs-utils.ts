import * as Y from 'yjs'

// Optimize Y.js document for performance
export function optimizeYDoc(doc: Y.Doc) {
  // Enable garbage collection for better memory usage
  doc.gc = true
  
  return doc
}

// Compress Y.js updates periodically to reduce storage size
export function compressDocumentState(doc: Y.Doc): Uint8Array {
  // Get current state
  const state = Y.encodeStateAsUpdate(doc)
  
  // For very large documents, you could implement compression here
  // For now, Y.js is already quite efficient
  return state
}

// Helper to convert Y.js state to base64 for API transmission
export function encodeStateForAPI(doc: Y.Doc): string {
  const state = Y.encodeStateAsUpdate(doc)
  return btoa(String.fromCharCode(...state))
}

// Helper to decode API state back to Y.js
export function decodeStateFromAPI(base64String: string): Uint8Array {
  return Uint8Array.from(atob(base64String), c => c.charCodeAt(0))
}
