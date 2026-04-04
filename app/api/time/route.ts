// ISSUE-202: メンバークライアントの時刻同期用エンドポイント
// サーバー時刻を X-Server-Time ヘッダーで返す（NTP 方式）
// メンバーは RTT を補正して clockOffsetMs を算出する

export const runtime = "edge"

export function GET() {
  return new Response(null, {
    status: 204,
    headers: {
      "X-Server-Time": Date.now().toString(),
      "Cache-Control": "no-store",
    },
  })
}
