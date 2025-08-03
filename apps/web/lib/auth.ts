import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"
import type { NextAuthConfig } from "next-auth"
import { signToken } from "./jwt"

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "jwt"
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Find user by email
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        if (!user[0] || !user[0].hashedPassword) {
          return null
        }

        const currentUser = user[0]

        // Check if account is locked
        if (currentUser.lockedUntil && currentUser.lockedUntil > new Date()) {
          console.warn(`Login attempt on locked account: ${email}`)
          return null
        }

        // Verify password
        const passwordsMatch = await bcrypt.compare(password, currentUser.hashedPassword)

        if (!passwordsMatch) {
          // Increment failed attempts
          const failedAttempts = (currentUser.failedLoginAttempts || 0) + 1
          const MAX_ATTEMPTS = 5
          const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

          let updateData: any = {
            failedLoginAttempts: failedAttempts
          }

          // Lock account if max attempts reached
          if (failedAttempts >= MAX_ATTEMPTS) {
            updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION)
            console.warn(`Account locked due to ${failedAttempts} failed attempts: ${email}`)
          }

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, currentUser.id))

          return null
        }

        // Reset failed attempts on successful login
        if (currentUser.failedLoginAttempts && currentUser.failedLoginAttempts > 0) {
          await db
            .update(users)
            .set({
              failedLoginAttempts: 0,
              lockedUntil: null
            })
            .where(eq(users.id, currentUser.id))
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
        // Create proper JWT token for WebSocket authentication
        session.accessToken = signToken({
          userId: token.sub,
          email: session.user.email || ''
        })
      }
      return session
    },
    async jwt({ token, user }) {
      // Include user info in token when user first signs in
      if (user) {
        token.sub = user.id
      }
      return token
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)