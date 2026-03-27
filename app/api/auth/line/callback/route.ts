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
//          - createUser を楽観的に試みる
//          - "already registered" の場合は generateLink でユーザー ID+トークンを取得（再ログイン対応）
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

    // 4. Supabase ユーザー upsert（楽観的 create → already-exists フォールバック）
    // LINE ユーザーには仮想メールアドレスを割り当てる（LINE はメール未公開のため）
    const lineEmail = `line_${lineProfile.userId}@line.ogoroulette.app`
    const supabaseAdmin = createAdminClient()

    const lineUserMeta = {
      provider: "line",
      full_name: lineProfile.displayName,
      avatar_url: lineProfile.pictureUrl ?? null,
      line_user_id: lineProfile.userId,
    }

    let supabaseUserId: string
    let hashedToken: string

    // createUser を楽観的に試みる
    // 注意: Prisma profile を存在確認に使わない。
    //       前回ログインが途中で失敗した場合、Supabase Auth にユーザーは存在するが
    //       Prisma profile が作られていない状態になり、次回ログイン時に
    //       "already registered" エラーが発生する。
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: lineEmail,
      email_confirm: true,
      user_metadata: lineUserMeta,
    })

    if (createError) {
      const isAlreadyExists =
        createError.message.includes("already been registered") ||
        createError.message.includes("already registered")

      if (!isAlreadyExists) {
        console.error("[LINE callback] step=user_create FAILED (unexpected)", { message: createError.message })
        return NextResponse.redirect(`${origin}/auth/error`)
      }

      // Supabase Auth にユーザーが存在する（新規 or 中途失敗の再ログイン）
      // generateLink で既存ユーザー ID とセッショントークンを同時取得
      console.info("[LINE callback] step=user_create SKIPPED — user already exists in Supabase Auth")
      const { data: existingLinkData, error: existingLinkError } =
        await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: lineEmail })

      if (existingLinkError || !existingLinkData?.user?.id) {
        console.error("[LINE callback] step=user_lookup FAILED", { message: existingLinkError?.message })
        return NextResponse.redirect(`${origin}/auth/error`)
      }

      supabaseUserId = existingLinkData.user.id
      hashedToken = existingLinkData.properties.hashed_token

      // メタデータを最新の LINE プロフィールに更新（non-blocking）
      supabaseAdmin.auth.admin
        .updateUserById(supabaseUserId, { user_metadata: lineUserMeta })
        .then(({ error }) => {
          if (error) console.warn("[LINE callback] step=user_update WARN", { message: error.message })
        })
    } else {
      if (!createData?.user?.id) {
        console.error("[LINE callback] step=user_create no user in response")
        return NextResponse.redirect(`${origin}/auth/error`)
      }
      supabaseUserId = createData.user.id

      // 5. 新規ユーザー: セッション確立用 magic link 生成
      const { data: newLinkData, error: newLinkError } =
        await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: lineEmail })

      if (newLinkError || !newLinkData) {
        console.error("[LINE callback] step=generate_link FAILED", { message: newLinkError?.message })
        return NextResponse.redirect(`${origin}/auth/error`)
      }

      hashedToken = newLinkData.properties.hashed_token
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
      token_hash: hashedToken,
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
