/**
 * ルームスピン状態遷移ロジック
 *
 * WHAT: IN_SESSION への遷移可否・メンバーへの通知アクション判定を純粋関数として定義する
 * WHY:  play/page.tsx と API ルートから切り出してユニットテスト可能にする
 */

/** ルームがスピン開始できる状態か */
export function canStartSpin(roomStatus: string): boolean {
  return roomStatus === "WAITING"
}

/** ルームがスピン中の状態か（メンバーへの視覚的フィードバック用） */
export function isSpinInProgress(roomStatus: string): boolean {
  return roomStatus === "IN_SESSION"
}

export type MemberSpinAction =
  | "trigger-spin"   // 新セッション検知 → アニメーション実行して結果を見せる
  | "show-winner"    // リロード時の既存COMPLETED → アニメーションなしで結果表示
  | "noop"           // 何もしない

/**
 * メンバー画面でポーリング結果を受け取ったとき何をすべきかを判定する
 *
 * @param isOwner         オーナーか（オーナーは自分でハンドリングするため常に noop）
 * @param roomStatus      現在のルームステータス
 * @param newSessionId    最新セッションID（なければ null）
 * @param prevSessionId   前回確認時のセッションID（初回は undefined）
 * @param hasWinner       すでに当選者が表示中か
 */
export function determineMemberSpinAction(
  isOwner: boolean,
  roomStatus: string,
  newSessionId: string | null,
  prevSessionId: string | null | undefined,
  hasWinner: boolean
): MemberSpinAction {
  // オーナーは自分でハンドリング済み
  if (isOwner) return "noop"

  // 初回ロード
  if (prevSessionId === undefined) {
    if (roomStatus === "COMPLETED" && newSessionId) return "show-winner"
    return "noop"
  }

  // 新しいセッション検知 かつ まだ表示していない
  if (newSessionId && newSessionId !== prevSessionId && !hasWinner) {
    return "trigger-spin"
  }

  return "noop"
}
