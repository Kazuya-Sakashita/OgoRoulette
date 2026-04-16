import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

/**
 * Supabase セッションを refresh する middleware。
 *
 * ISSUE-260: 設計方針の記録
 *
 * このミドルウェアはセッションの refresh のみを担当する。
 * ページルートの認可チェック（認証必須ページへの未認証アクセス防止）は
 * 意図的にここでは行っていない。
 *
 * 理由:
 *   - データはすべて API route 経由で取得され、各 route handler に
 *     認証・認可チェックが実装されている（Supabase JWT / HMAC トークン）
 *   - ページ自体は Client Component として描画され、useEffect で
 *     認証状態を確認後にリダイレクトまたはデータ取得を行う
 *   - 現在の構成では Server Components でユーザーデータを直接 fetch しない
 *
 * 将来の注意:
 *   Server Components でデータを直接 fetch する実装を追加する場合は、
 *   このミドルウェアに認可チェックを追加する。
 *   その際は `updateSession` から user を取得して保護ルートを定義すること。
 *
 * @see docs/issues/issue-260-security-middleware-no-authz.md
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
