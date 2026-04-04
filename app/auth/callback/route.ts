import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { validateReturnTo } from "@/lib/safe-redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/home"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Upsert user profile in DB after successful OAuth login
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await prisma.profile.upsert({
          where: { id: user.id },
          update: {
            name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatarUrl: user.user_metadata?.avatar_url || null,
          },
          create: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null,
            avatarUrl: user.user_metadata?.avatar_url || null,
          },
        }).catch((err) => {
          // Log but don't block redirect — profile sync is best-effort
          console.error("Profile upsert failed:", err)
        })
      }

      // ISSUE-028/035: next を相対パスに限定し、x-forwarded-host は信頼しない
      // NEXT_PUBLIC_APP_URL を既存 LINE OAuth 等と同じ変数名に統一
      const safeNext = validateReturnTo(next)
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
      return NextResponse.redirect(`${siteUrl}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
