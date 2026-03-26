import { describe, test, expect, vi, afterEach } from 'vitest'
import { getSupportedMimeType, canRecord } from './video-recorder'

// WHAT: MIME タイプ優先順位と canRecord のフォールバック挙動を検証する
// WHY:  ISSUE-007 修正（iOS Safari 向け mp4;codecs=h264 を先頭に配置）の回帰テスト

afterEach(() => {
  vi.restoreAllMocks()
})

// --- getSupportedMimeType ---

describe('getSupportedMimeType', () => {
  test('MediaRecorder が undefined のときは空文字を返す', () => {
    const original = globalThis.MediaRecorder
    // @ts-expect-error テスト用に undefined に設定
    globalThis.MediaRecorder = undefined

    expect(getSupportedMimeType()).toBe('')

    globalThis.MediaRecorder = original
  })

  test('iOS Safari: mp4;codecs=h264 のみ対応 → "video/mp4;codecs=h264" を返す', () => {
    // @ts-expect-error テスト用に最小限の MediaRecorder を設定
    globalThis.MediaRecorder = {
      isTypeSupported: (t: string) => t === 'video/mp4;codecs=h264',
    }

    expect(getSupportedMimeType()).toBe('video/mp4;codecs=h264')

    // @ts-expect-error
    delete globalThis.MediaRecorder
  })

  test('Chrome/Firefox: vp9,opus 対応 → WebM が選ばれる（mp4 より後退しない）', () => {
    // @ts-expect-error
    globalThis.MediaRecorder = {
      isTypeSupported: (t: string) =>
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].includes(t),
    }

    const result = getSupportedMimeType()
    // ISSUE-007: Chrome では mp4;codecs=h264 が false → 最初に一致するのは vp9,opus
    expect(result).toBe('video/webm;codecs=vp9,opus')

    // @ts-expect-error
    delete globalThis.MediaRecorder
  })

  test('mp4;codecs=h264 が先頭候補（インデックス 0）であることを確認', () => {
    const callOrder: string[] = []
    // @ts-expect-error
    globalThis.MediaRecorder = {
      isTypeSupported: (t: string) => {
        callOrder.push(t)
        return false // すべて false → どれも一致しない
      },
    }

    getSupportedMimeType()

    // 先頭が mp4;codecs=h264 であること（ISSUE-007 修正の核心）
    expect(callOrder[0]).toBe('video/mp4;codecs=h264')

    // @ts-expect-error
    delete globalThis.MediaRecorder
  })

  test('候補がすべて非対応のときは空文字を返す', () => {
    // @ts-expect-error
    globalThis.MediaRecorder = {
      isTypeSupported: () => false,
    }

    expect(getSupportedMimeType()).toBe('')

    // @ts-expect-error
    delete globalThis.MediaRecorder
  })

  test('mp4（コーデック指定なし）のみ対応するとき → "video/mp4" を返す', () => {
    // @ts-expect-error
    globalThis.MediaRecorder = {
      isTypeSupported: (t: string) => t === 'video/mp4',
    }

    expect(getSupportedMimeType()).toBe('video/mp4')

    // @ts-expect-error
    delete globalThis.MediaRecorder
  })
})

// --- canRecord ---

describe('canRecord', () => {
  test('window が undefined（Node.js 環境）のときは false を返す', () => {
    // Node.js 環境では window は未定義 → canRecord は false
    expect(canRecord()).toBe(false)
  })

  test('MediaRecorder が undefined のときは false を返す', () => {
    // window を疑似的に定義
    const origWindow = globalThis.window
    // @ts-expect-error
    globalThis.window = {}
    const original = globalThis.MediaRecorder
    // @ts-expect-error
    globalThis.MediaRecorder = undefined

    expect(canRecord()).toBe(false)

    globalThis.MediaRecorder = original
    globalThis.window = origWindow
  })
})
