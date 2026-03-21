/**
 * ルームオーナー判定
 *
 * WHAT: メンバーリストとユーザーIDからオーナー（ホストフラグ持ち）かを判定する
 * WHY:  play/page.tsx からロジックを切り出してテスト可能にする
 */

export interface RoomMemberForOwnerCheck {
  profile: { id: string } | null
  isHost: boolean
}

/**
 * 認証ユーザーがルームのオーナーかどうかを判定する
 *
 * @param members  ルームメンバー一覧
 * @param userId   判定対象のユーザーID（Supabase Profile.id）
 * @returns        isHost=true のメンバーの profileId と userId が一致すれば true
 */
export function isRoomOwner(
  members: RoomMemberForOwnerCheck[],
  userId: string
): boolean {
  return members.find((m) => m.profile?.id === userId)?.isHost ?? false
}
