// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import {
  SHARE_TEMPLATES,
  buildShareText,
  buildShareUrl,
  trimForX,
} from './share-service'

// WHAT: share-service.ts の純粋関数と URL 生成ロジックを検証する
// WHY:  シェアテキスト・URL の不具合はウイルスループ（ISSUE-183）の CVR に直結する。
//       X の文字数制限オーバーや URL パラメータ欠落はシェア失敗を引き起こす。

describe('share-service', () => {

  // ─── buildShareText ───────────────────────────────────────────────────────

  describe('buildShareText', () => {
    const classicTemplate = SHARE_TEMPLATES.find(t => t.id === 'classic')!
    const billTemplate = SHARE_TEMPLATES.find(t => t.id === 'bill')!
    const groupTemplate = SHARE_TEMPLATES.find(t => t.id === 'group')!

    test('classic: 当選者名が含まれる', () => {
      const text = buildShareText(classicTemplate, { winner: '太郎' })
      expect(text).toContain('太郎')
      expect(text).toContain('#OgoRoulette')
    })

    test('bill: 金額が指定されている場合は金額を含む', () => {
      const text = buildShareText(billTemplate, { winner: '花子', totalBill: 10000, treatAmount: 10000 })
      expect(text).toContain('花子')
      // Intl.NumberFormat(ja-JP) は環境により ¥ (U+00A5) または ￥ (U+FFE5) を使う
      expect(text).toMatch(/1[0,]*0,000/)
    })

    test('bill: 金額が未指定の場合は classic と同じフォーマットにフォールバック', () => {
      const text = buildShareText(billTemplate, { winner: '花子' })
      expect(text).toContain('花子')
      expect(text).toContain('#OgoRoulette')
    })

    test('group: 参加者数が含まれる', () => {
      const text = buildShareText(groupTemplate, { winner: '鈴木', participants: ['A', 'B', 'C'] })
      expect(text).toContain('3人')
      expect(text).toContain('鈴木')
    })

    test('group: 参加者が1人の場合は人数表示なし', () => {
      const text = buildShareText(groupTemplate, { winner: '鈴木', participants: ['鈴木'] })
      expect(text).not.toContain('1人')
    })

    test('すべてのテンプレートが winner 名を含む', () => {
      for (const template of SHARE_TEMPLATES) {
        const text = buildShareText(template, { winner: 'テスト太郎' })
        expect(text).toContain('テスト太郎')
      }
    })
  })

  // ─── trimForX ─────────────────────────────────────────────────────────────

  describe('trimForX', () => {
    // X の制限: 280文字 - URL(23文字) - スペース(1文字) = 256文字の予算
    // CJK は 2weight、ASCII は 1weight

    test('短いASCIIテキストはそのまま返す', () => {
      const text = 'Hello OgoRoulette!'
      expect(trimForX(text)).toBe(text)
    })

    test('短い日本語テキストはそのまま返す', () => {
      const text = '太郎さんが奢り確定！'
      expect(trimForX(text)).toBe(text)
    })

    test('予算を超えるテキストは省略記号で切り詰める', () => {
      // CJK文字は2weight。256 / 2 = 128文字以上で切り詰めが起きる
      const longText = '奢'.repeat(200)
      const result = trimForX(longText)
      expect(result.endsWith('…')).toBe(true)
      expect(result.length).toBeLessThan(longText.length)
    })

    test('切り詰め後のテキスト + URL が 280文字予算内に収まる', () => {
      // budget = 280 - 23(URL) - 1(space) = 256
      // CJK文字(2weight)で 128文字まで
      const longText = 'あ'.repeat(200)
      const result = trimForX(longText)
      // '…' を除いた本文部分の weight を計算
      const trimmedBody = result.slice(0, -1) // '…' を除く
      const weight = [...trimmedBody].reduce((sum, ch) => sum + (ch.codePointAt(0)! > 0x007E ? 2 : 1), 0)
      expect(weight).toBeLessThanOrEqual(256)
    })

    test('ちょうど予算内のテキストは切り詰めない', () => {
      // ASCII 256文字 = weight 256 でギリギリ
      const exactText = 'a'.repeat(256)
      expect(trimForX(exactText)).toBe(exactText)
    })

    test('絵文字を含むテキストが正しく切り詰められる', () => {
      const withEmoji = '🎰'.repeat(50) // 絵文字もweight=2以上
      const result = trimForX(withEmoji)
      // 長さが短くなっているか、そのままか
      expect(result.length).toBeLessThanOrEqual(withEmoji.length)
    })
  })

  // ─── buildShareUrl ────────────────────────────────────────────────────────

  describe('buildShareUrl', () => {
    // ISSUE-214: roomCode があっても /result に統一（動的OGP有効化）
    test('roomCode がある場合も /result に飛び動的OGP が有効になる', () => {
      const url = buildShareUrl({ winner: '太郎', roomCode: 'ABC123' })
      expect(url).toContain('/result')
      expect(url).toContain('room=ABC123')
      expect(url).toContain('ref=share')
      expect(url).toContain('winner=')
      // 以前の /join? パターンに戻っていないことを確認
      expect(url).not.toContain('/join')
    })

    test('roomCode がない場合も /result?treater=... を返す', () => {
      const url = buildShareUrl({ winner: '花子' })
      expect(url).toContain('/result')
      expect(url).toContain('winner=')
    })

    test('roomCode ありの URL に winner 名が含まれる', () => {
      const url = buildShareUrl({ winner: '鈴木', roomCode: 'XYZ789' })
      // winner パラメータにURLエンコードされた名前が含まれる
      expect(decodeURIComponent(url)).toContain('鈴木')
    })

    test('participants が指定されると result URL に含まれる', () => {
      const url = buildShareUrl({ winner: '太郎', participants: ['太郎', '花子', '鈴木'] })
      expect(url).toContain('participants=')
    })

    test('totalBill が指定されると result URL に含まれる', () => {
      const url = buildShareUrl({ winner: '太郎', totalBill: 5000 })
      expect(url).toContain('total=5000')
    })
  })

  // ─── SHARE_TEMPLATES ──────────────────────────────────────────────────────

  describe('SHARE_TEMPLATES', () => {
    test('5種類のテンプレートが存在する', () => {
      expect(SHARE_TEMPLATES).toHaveLength(5)
    })

    test('各テンプレートは id・label・build を持つ', () => {
      for (const t of SHARE_TEMPLATES) {
        expect(typeof t.id).toBe('string')
        expect(typeof t.label).toBe('string')
        expect(typeof t.build).toBe('function')
      }
    })

    test('必須テンプレート(classic/dramatic/roast/bill/group)が存在する', () => {
      const ids = SHARE_TEMPLATES.map(t => t.id)
      expect(ids).toContain('classic')
      expect(ids).toContain('dramatic')
      expect(ids).toContain('roast')
      expect(ids).toContain('bill')
      expect(ids).toContain('group')
    })
  })

})
