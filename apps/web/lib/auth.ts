import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"
import type { NextAuthConfig } from "next-auth"

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

        // Verify password
        const passwordsMatch = await bcrypt.compare(password, user[0].hashedPassword)

        if (!passwordsMatch) {
          return null
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
      }
      // Create a simple access token with user ID for WebSocket auth
      session.accessToken = token.sub
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