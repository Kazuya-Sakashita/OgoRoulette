import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/auth/line/callback
// WHAT: LINE OAuth コールバックを処理し、Supabase セッションを確立する
// WHY:  LINE は Supabase の組み込みプロバイダーではないため、
//       Admin API でユーザーを upsert し、magic link 検証でセッションを作成する
// HOW:  1. state 検証（CSRF 対策）
//       2. LINE アクセストークン取得
//       3. LINE プロフィール取得
//       4. Supabase Admin でユーザー upsert（仮想メール: line_{userId}@line.ogoroulette.app）
//       5. generateLink → verifyOtp でセッション cookie を設定
//       6. Prisma profile upsert
//       7. /home にリダイレクト

interface LineTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const lineError = searchParams.get("error")
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  // ユーザーが LINE 認可をキャンセルした場合
  if (lineError) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // 1. State 検証（CSRF 対策）
  const storedState = request.cookies.get("line_oauth_state")?.value
  if (!code || !state || !storedState || state !== storedState) {
    console.error("[LINE callback] step=state_check FAILED", {
      hasCode: !!code,
      hasState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state === storedState,
    })
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  try {
    // 2. LINE アクセストークン取得
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINE_CALLBACK_URL!,
        client_id: process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error("[LINE callback] step=token_exchange FAILED", {
        status: tokenRes.status,
        body,
      })
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    const lineToken = (await tokenRes.json()) as LineTokenResponse

    if (lineToken.error) {
      console.error("[LINE callback] step=token_exchange ERROR in body", {
        error: lineToken.error,
        description: lineToken.error_description,
      })
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    // 3. LINE プロフィール取得
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${lineToken.access_token}` },
    })

    if (!profileRes.ok) {
      const body = await profileRes.text()
      console.error("[LINE callback] step=profile_fetch FAILED", {
        status: profileRes.status,
        body,
      })
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    const lineProfile = (await profileRes.json()) as LineProfile

    // 4. Supabase ユーザー upsert
    // LINE ユーザーには仮想メールアドレスを割り当てる（LINE はメール未公開のため）
    const lineEmail = `line_${lineProfile.userId}@line.ogoroulette.app`
    const supabaseAdmin = createAdminClient()

    // 既存 LINE ユーザーの確認（Prisma profile の email で判定）
    const existingProfile = await prisma.profile.findUnique({
      where: { email: lineEmail },
      select: { id: true },
    })

    let supabaseUserId: string

    if (existingProfile) {
      // 既存ユーザー: メタデータのみ更新
      supabaseUserId = existingProfile.id
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
        user_metadata: {
          provider: "line",
          full_name: lineProfile.displayName,
          avatar_url: lineProfile.pictureUrl ?? null,
          line_user_id: lineProfile.userId,
        },
      })
      if (updateError) {
        console.error("[LINE callback] step=user_update FAILED", { message: updateError.message })
        return NextResponse.redirect(`${origin}/auth/error`)
      }
    } else {
      // 新規ユーザー: Supabase Auth ユーザー作成
      const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: lineEmail,
        email_confirm: true,
        user_metadata: {
          provider: "line",
          full_name: lineProfile.displayName,
          avatar_url: lineProfile.pictureUrl ?? null,
          line_user_id: lineProfile.userId,
        },
      })

      if (createError || !user) {
        console.error("[LINE callback] step=user_create FAILED", { message: createError?.message })
        return NextResponse.redirect(`${origin}/auth/error`)
      }

      supabaseUserId = user.id
    }

    // 5. Magic link を生成し、verifyOtp でセッション cookie を設定
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: lineEmail,
    })

    if (linkError || !linkData) {
      console.error("[LINE callback] step=generate_link FAILED", { message: linkError?.message })
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    // ミドルウェアと同じパターン: verifyOtp が呼ぶ setAll でリダイレクトレスポンスに cookie をセット
    // 複数回 setAll が呼ばれても全 cookie を蓄積し、最後にまとめて適用する
    const redirectResponse = NextResponse.redirect(`${origin}/home`)
    const pendingCookies: Array<{ name: string; value: string; options: Parameters<typeof redirectResponse.cookies.set>[2] }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => pendingCookies.push(c))
          },
        },
      }
    )

    // NOTE: generateLink(type: "magiclink") で生成したトークンは type: "email" で検証する
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    })

    if (verifyError) {
      console.error("[LINE callback] step=verify_otp FAILED", { message: verifyError.message })
      return NextResponse.redirect(`${origin}/auth/error`)
    }

    // 蓄積された cookie を一括でリダイレクトレスポンスに適用
    pendingCookies.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set(name, value, options)
    )

    // 6. Prisma profile upsert（ログインのたびに name / avatarUrl を同期）
    await prisma.profile.upsert({
      where: { id: supabaseUserId },
      update: {
        name: lineProfile.displayName,
        avatarUrl: lineProfile.pictureUrl ?? null,
      },
      create: {
        id: supabaseUserId,
        email: lineEmail,
        name: lineProfile.displayName,
        avatarUrl: lineProfile.pictureUrl ?? null,
      },
    }).catch((err) => {
      // プロフィール同期失敗はログのみ。ログインは継続する。
      console.error("[LINE callback] step=profile_upsert FAILED (non-blocking)", err)
    })

    // 7. state cookie を削除してリダイレクト
    redirectResponse.cookies.delete("line_oauth_state")
    return redirectResponse

  } catch (error) {
    console.error("[LINE callback] UNEXPECTED ERROR:", error)
    return NextResponse.redirect(`${origin}/auth/error`)
  }
}
