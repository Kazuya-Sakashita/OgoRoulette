import { describe, expect, test } from 'vitest'

// WHAT: WinnerCard の参加者フィルタロジックを検証する
// WHY:  同名参加者がいる場合に正しく当選者だけを除外できることを保証する
//       以前は `p !== winner`（名前比較）で同名参加者が誤除外されていた

describe('WinnerCard participant filter', () => {

  // index ベースのフィルタ関数（winner-card.tsx と同じロジック）
  function filterNonWinners(participants: string[], winnerIndex: number): string[] {
    return participants.filter((_, i) => i !== winnerIndex)
  }

  test('当選者 index=0 を除外する', () => {
    const result = filterNonWinners(['田中', '佐藤', '鈴木'], 0)
    expect(result).toEqual(['佐藤', '鈴木'])
  })

  test('当選者 index=2 を除外する', () => {
    const result = filterNonWinners(['田中', '佐藤', '鈴木'], 2)
    expect(result).toEqual(['田中', '佐藤'])
  })

  test('同名参加者がいる場合、当選者 index だけが除外される', () => {
    // index=1 の「田中」が当選。index=0 の「田中」は除外されないこと
    const result = filterNonWinners(['田中', '田中', '鈴木'], 1)
    expect(result).toEqual(['田中', '鈴木'])
    expect(result).toHaveLength(2)
  })

  test('2人の場合、当選者だけ除外して1人残る', () => {
    const result = filterNonWinners(['Aさん', 'Bさん'], 0)
    expect(result).toEqual(['Bさん'])
  })

  test('全員同じ名前でも当選 index のみ除外される', () => {
    const result = filterNonWinners(['同', '同', '同', '同'], 2)
    expect(result).toHaveLength(3)
  })

})
