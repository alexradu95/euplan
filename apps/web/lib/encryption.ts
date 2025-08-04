'use client'

/**
 * Client-side encryption utilities for zero-knowledge data storage
 * Uses Web Crypto API for AES-GCM encryption with user-derived keys
 */

// Derive encryption key from user session data
async function deriveKey(userId: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + salt),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Generate a random salt for key derivation
function generateSalt(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Encrypt data with user-specific key
export async function encryptData(data: string, userId: string): Promise<string> {
  try {
    const salt = generateSalt()
    const key = await deriveKey(userId, salt)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    )
    
    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(salt.length / 2 + iv.length + encryptedBuffer.byteLength)
    const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
    
    combined.set(saltBytes, 0)
    combined.set(iv, saltBytes.length)
    combined.set(new Uint8Array(encryptedBuffer), saltBytes.length + iv.length)
    
    // Return base64 encoded result
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

// Decrypt data with user-specific key
export async function decryptData(encryptedData: string, userId: string): Promise<string> {
  try {
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    )
    
    // Extract salt, iv, and encrypted data
    const saltBytes = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const encrypted = combined.slice(28)
    
    // Convert salt back to hex string
    const salt = Array.from(saltBytes, byte => byte.toString(16).padStart(2, '0')).join('')
    
    const key = await deriveKey(userId, salt)
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

// Encrypt widget data before storing
export async function encryptWidgetData(data: any, userId: string): Promise<string> {
  const jsonString = JSON.stringify(data)
  return encryptData(jsonString, userId)
}

// Decrypt widget data after retrieving
export async function decryptWidgetData<T = any>(encryptedData: string, userId: string): Promise<T> {
  const jsonString = await decryptData(encryptedData, userId)
  return JSON.parse(jsonString)
}

// Check if Web Crypto API is available
export function isEncryptionSupported(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues !== 'undefined'
}

// Fallback for environments without Web Crypto API
export function encryptDataFallback(data: string): string {
  console.warn('Web Crypto API not available, using base64 encoding (NOT SECURE)')
  return btoa(data)
}

export function decryptDataFallback(data: string): string {
  console.warn('Web Crypto API not available, using base64 decoding (NOT SECURE)')
  return atob(data)
}