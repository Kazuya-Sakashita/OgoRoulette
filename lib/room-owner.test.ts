import { describe, expect, test } from 'vitest'
import { isRoomOwner } from './room-owner'

// WHAT: ルームオーナー判定ロジックを検証する
// WHY:  「オーナーのみがルーレットを回せる」仕様の根幹。
//       判定ミスはメンバーによる不正実行または正当なオーナーが弾かれる事態を招く。

describe('isRoomOwner', () => {

  const members = [
    { profile: { id: 'owner-id' }, isHost: true },
    { profile: { id: 'member-id-1' }, isHost: false },
    { profile: { id: 'member-id-2' }, isHost: false },
  ]

  // --- 正常系 ---

  test('isHost=true のメンバーの profileId が一致すればオーナーと判定する', () => {
    expect(isRoomOwner(members, 'owner-id')).toBe(true)
  })

  test('isHost=false のメンバーはオーナーではない', () => {
    expect(isRoomOwner(members, 'member-id-1')).toBe(false)
    expect(isRoomOwner(members, 'member-id-2')).toBe(false)
  })

  test('ルームに存在しないユーザーはオーナーではない', () => {
    expect(isRoomOwner(members, 'unknown-id')).toBe(false)
  })

  // --- 境界値 ---

  test('メンバーが0人の場合は false を返す', () => {
    expect(isRoomOwner([], 'owner-id')).toBe(false)
  })

  test('全員が isHost=true のメンバーでも userId が一致しなければ false', () => {
    const allHosts = [
      { profile: { id: 'a' }, isHost: true },
      { profile: { id: 'b' }, isHost: true },
    ]
    expect(isRoomOwner(allHosts, 'c')).toBe(false)
  })

  // --- ゲストメンバー ---

  test('profile が null のメンバーはオーナーと判定されない', () => {
    const withGuest = [
      { profile: null, isHost: true },     // ゲストホスト（profileなし）
      { profile: { id: 'user-1' }, isHost: false },
    ]
    // profileがnullのメンバーは isRoomOwner では判定対象外
    expect(isRoomOwner(withGuest, 'user-1')).toBe(false)
  })

  // --- 複数オーナーが存在する場合（異常ケース）---

  test('複数の isHost=true メンバーが存在しても最初に一致したものを採用する', () => {
    const multiHost = [
      { profile: { id: 'host-a' }, isHost: true },
      { profile: { id: 'host-b' }, isHost: true },
    ]
    expect(isRoomOwner(multiHost, 'host-a')).toBe(true)
    expect(isRoomOwner(multiHost, 'host-b')).toBe(true)
  })

})
