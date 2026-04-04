// @vitest-environment happy-dom
import { describe, expect, test, beforeEach, vi } from 'vitest'
import {
  loadGroups,
  saveGroup,
  deleteGroup,
  touchGroupLocally,
  updateGroupLastSpin,
  updateGroupLocal,
  syncGroupsFromCloud,
  clearUserGroupData,
  recordTreat,
  getTreatCount,
  getGroupRanking,
  getTreatTitle,
  seedTreatStats,
} from './group-storage'

// WHAT: group-storage.ts の全パブリック関数を検証する
// WHY:  グループデータとトリートスタッツは localStorage に永続化されるビジネスクリティカルなデータ。
//       クラウド同期・リテンション（ISSUE-182）・ランキング表示のバグは直接UXに影響する。

describe('group-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ─── loadGroups / saveGroup ───────────────────────────────────────────────

  describe('loadGroups / saveGroup', () => {
    test('空の場合は空配列を返す', () => {
      expect(loadGroups()).toEqual([])
    })

    test('グループを保存して読み込める', () => {
      saveGroup('チームA', ['太郎', '花子'])
      const groups = loadGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].name).toBe('チームA')
      expect(groups[0].participants).toEqual(['太郎', '花子'])
    })

    test('id・updatedAt が自動付与される', () => {
      const g = saveGroup('チームA', ['太郎'])
      expect(typeof g.id).toBe('string')
      expect(g.id.length).toBeGreaterThan(0)
      expect(g.updatedAt).toBeGreaterThan(0)
    })

    test('同名グループは上書きされる（重複なし）', () => {
      saveGroup('チームA', ['太郎'])
      saveGroup('チームA', ['太郎', '花子'])
      const groups = loadGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].participants).toEqual(['太郎', '花子'])
    })

    test('異なる名前のグループは別々に保存される', () => {
      saveGroup('チームA', ['太郎'])
      saveGroup('チームB', ['花子'])
      expect(loadGroups()).toHaveLength(2)
    })

    test('最大20グループまで保存される（21件目は切り捨て）', () => {
      for (let i = 0; i < 25; i++) {
        saveGroup(`グループ${i}`, ['メンバー'])
      }
      expect(loadGroups()).toHaveLength(20)
    })

    test('新しく保存したグループはリストの先頭に来る', () => {
      saveGroup('チームA', ['太郎'])
      saveGroup('チームB', ['花子'])
      // 最後に追加したグループが先頭（unshift）
      expect(loadGroups()[0].name).toBe('チームB')
    })
  })

  // ─── deleteGroup ─────────────────────────────────────────────────────────

  describe('deleteGroup', () => {
    test('指定IDのグループを削除する', () => {
      const g = saveGroup('チームA', ['太郎'])
      deleteGroup(g.id)
      expect(loadGroups()).toHaveLength(0)
    })

    test('存在しないIDを削除しても他グループは残る', () => {
      saveGroup('チームA', ['太郎'])
      deleteGroup('non-existent-id')
      expect(loadGroups()).toHaveLength(1)
    })

    test('複数グループから正しい1件だけ削除する', () => {
      saveGroup('チームA', ['太郎'])
      const gB = saveGroup('チームB', ['花子'])
      deleteGroup(gB.id)
      const remaining = loadGroups()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('チームA')
    })
  })

  // ─── touchGroupLocally ────────────────────────────────────────────────────

  describe('touchGroupLocally', () => {
    test('lastUsedAt が更新される', () => {
      const g = saveGroup('チームA', ['太郎'])
      const before = Date.now()
      touchGroupLocally(g.id)
      const updated = loadGroups()[0]
      expect(updated.lastUsedAt).toBeGreaterThanOrEqual(before)
    })

    test('最後に使ったグループがリストの先頭に移動する', () => {
      // タイムスタンプを制御して確実に順序を作る
      vi.useFakeTimers()
      vi.setSystemTime(1000)
      saveGroup('チームA', ['太郎'])
      vi.setSystemTime(2000)
      saveGroup('チームB', ['花子'])
      vi.setSystemTime(3000)
      // チームBが先頭にある状態で、チームAをタッチ
      touchGroupLocally(loadGroups().find(g => g.name === 'チームA')!.id)
      expect(loadGroups()[0].name).toBe('チームA')
      vi.useRealTimers()
    })
  })

  // ─── updateGroupLastSpin ──────────────────────────────────────────────────

  describe('updateGroupLastSpin（ISSUE-182）', () => {
    test('lastSpinAt と lastWinner が更新される', () => {
      const g = saveGroup('チームA', ['太郎', '花子'])
      const before = Date.now()
      updateGroupLastSpin(g.id, '太郎')
      const updated = loadGroups()[0]
      expect(updated.lastWinner).toBe('太郎')
      expect(updated.lastSpinAt).toBeGreaterThanOrEqual(before)
    })

    test('存在しないIDを更新しても例外が発生しない', () => {
      saveGroup('チームA', ['太郎'])
      expect(() => updateGroupLastSpin('non-existent', '太郎')).not.toThrow()
    })

    test('他グループの lastSpinAt には影響しない', () => {
      saveGroup('チームA', ['太郎'])
      const gB = saveGroup('チームB', ['花子'])
      updateGroupLastSpin(gB.id, '花子')
      const gA = loadGroups().find(g => g.name === 'チームA')!
      expect(gA.lastSpinAt).toBeUndefined()
    })
  })

  // ─── updateGroupLocal ─────────────────────────────────────────────────────

  describe('updateGroupLocal', () => {
    test('参加者リストを更新できる', () => {
      const g = saveGroup('チームA', ['太郎'])
      updateGroupLocal(g.id, { participants: ['太郎', '花子', '鈴木'] })
      expect(loadGroups()[0].participants).toEqual(['太郎', '花子', '鈴木'])
    })

    test('グループ名を更新できる', () => {
      const g = saveGroup('チームA', ['太郎'])
      updateGroupLocal(g.id, { name: '新チームA' })
      expect(loadGroups()[0].name).toBe('新チームA')
    })
  })

  // ─── syncGroupsFromCloud ──────────────────────────────────────────────────

  describe('syncGroupsFromCloud', () => {
    test('クラウドのみのグループはローカルに追加される', () => {
      const cloudGroups = [{
        id: 'cloud-uuid-1',
        name: 'クラウドグループ',
        participants: ['A', 'B'],
        updatedAt: new Date().toISOString(),
      }]
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('クラウドグループ')
      expect(result[0].cloudId).toBe('cloud-uuid-1')
    })

    test('cloudId がローカルグループに付与される（名前マッチ）', () => {
      const g = saveGroup('チームA', ['太郎'])
      const cloudGroups = [{
        id: 'cloud-id-99',
        name: 'チームA',
        participants: ['太郎'],
        updatedAt: new Date(g.updatedAt - 1000).toISOString(), // ローカルより古い
      }]
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result[0].cloudId).toBe('cloud-id-99')
    })

    test('クラウドが新しい場合は参加者リストをクラウドで上書きする', () => {
      const g = saveGroup('チームA', ['太郎'])
      const cloudGroups = [{
        id: 'cloud-id',
        name: 'チームA',
        participants: ['太郎', '花子'],
        updatedAt: new Date(g.updatedAt + 5000).toISOString(), // ローカルより新しい
      }]
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result[0].participants).toEqual(['太郎', '花子'])
    })

    test('ローカルが新しい場合は参加者リストをローカルで維持する', () => {
      const g = saveGroup('チームA', ['太郎', '花子'])
      const cloudGroups = [{
        id: 'cloud-id',
        name: 'チームA',
        participants: ['太郎'], // 古いクラウドデータ
        updatedAt: new Date(g.updatedAt - 5000).toISOString(), // ローカルより古い
      }]
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result[0].participants).toEqual(['太郎', '花子'])
    })

    test('lastSpinAt / lastWinner はローカル値を維持する（クラウドで上書きしない）', () => {
      const g = saveGroup('チームA', ['太郎'])
      updateGroupLastSpin(g.id, '太郎')

      const cloudGroups = [{
        id: 'cloud-id',
        name: 'チームA',
        participants: ['太郎'],
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      }]
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result[0].lastWinner).toBe('太郎')
      expect(result[0].lastSpinAt).toBeDefined()
    })

    test('最大20件まで保存される', () => {
      const cloudGroups = Array.from({ length: 25 }, (_, i) => ({
        id: `cloud-${i}`,
        name: `グループ${i}`,
        participants: ['A'],
        updatedAt: new Date().toISOString(),
      }))
      const result = syncGroupsFromCloud(cloudGroups)
      expect(result).toHaveLength(20)
    })
  })

  // ─── clearUserGroupData ───────────────────────────────────────────────────

  describe('clearUserGroupData', () => {
    test('cloudId なし（ゲスト）グループは削除されない', () => {
      saveGroup('ローカルグループ', ['太郎'])
      clearUserGroupData()
      expect(loadGroups()).toHaveLength(1)
    })

    test('cloudId ありグループは削除される', () => {
      // クラウド同期でcloudIdを付与する
      syncGroupsFromCloud([{
        id: 'cloud-id-1',
        name: 'クラウドグループ',
        participants: ['花子'],
        updatedAt: new Date().toISOString(),
      }])
      clearUserGroupData()
      const remaining = loadGroups()
      expect(remaining.every(g => !g.cloudId)).toBe(true)
    })
  })

  // ─── treat stats ─────────────────────────────────────────────────────────

  describe('recordTreat / getTreatCount', () => {
    test('recordTreat: 初回で1を返す', () => {
      expect(recordTreat('太郎')).toBe(1)
    })

    test('recordTreat: 累積カウントが増える', () => {
      recordTreat('太郎')
      expect(recordTreat('太郎')).toBe(2)
    })

    test('getTreatCount: 未記録の名前は0を返す', () => {
      expect(getTreatCount('未登場の人')).toBe(0)
    })

    test('getTreatCount: 記録後に正しいカウントを返す', () => {
      recordTreat('花子')
      recordTreat('花子')
      recordTreat('花子')
      expect(getTreatCount('花子')).toBe(3)
    })

    test('recordTreat: 金額を記録できる', () => {
      recordTreat('太郎', 5000)
      recordTreat('太郎', 3000)
      // カウントが返ること
      expect(getTreatCount('太郎')).toBe(2)
    })
  })

  // ─── getGroupRanking ──────────────────────────────────────────────────────

  describe('getGroupRanking', () => {
    test('奢り回数の多い順に並ぶ', () => {
      recordTreat('花子')
      recordTreat('花子')
      recordTreat('太郎')
      const ranking = getGroupRanking(['太郎', '花子', '鈴木'])
      expect(ranking[0].name).toBe('花子')
      expect(ranking[0].count).toBe(2)
      expect(ranking[1].name).toBe('太郎')
      expect(ranking[1].count).toBe(1)
    })

    test('未記録のメンバーはcount=0で含まれる', () => {
      const ranking = getGroupRanking(['太郎', '花子'])
      expect(ranking).toHaveLength(2)
      expect(ranking.every(r => r.count === 0)).toBe(true)
    })

    test('指定した参加者のみがランキングに含まれる', () => {
      recordTreat('外部の人')
      const ranking = getGroupRanking(['太郎', '花子'])
      expect(ranking.map(r => r.name)).toEqual(expect.not.arrayContaining(['外部の人']))
    })
  })

  // ─── getTreatTitle ────────────────────────────────────────────────────────

  describe('getTreatTitle', () => {
    test('1回 → 初奢り', () => {
      expect(getTreatTitle(1)).toContain('初奢り')
    })

    test('2〜3回 → 奢り王子', () => {
      expect(getTreatTitle(2)).toContain('奢り王子')
      expect(getTreatTitle(3)).toContain('奢り王子')
    })

    test('4〜9回 → 奢り王', () => {
      expect(getTreatTitle(4)).toContain('奢り王')
      expect(getTreatTitle(9)).toContain('奢り王')
    })

    test('10〜19回 → 奢り女王', () => {
      expect(getTreatTitle(10)).toContain('奢り女王')
      expect(getTreatTitle(19)).toContain('奢り女王')
    })

    test('20回以上 → 伝説', () => {
      expect(getTreatTitle(20)).toContain('伝説')
      expect(getTreatTitle(100)).toContain('伝説')
    })
  })

  // ─── seedTreatStats ───────────────────────────────────────────────────────

  describe('seedTreatStats', () => {
    test('クラウドのカウントがローカルより多い場合はクラウドで上書きされる', () => {
      recordTreat('太郎') // ローカルで1回
      seedTreatStats({ 太郎: { count: 5, totalAmount: 15000 } })
      expect(getTreatCount('太郎')).toBe(5)
    })

    test('ローカルのカウントがクラウドより多い場合はローカルを維持する', () => {
      recordTreat('花子')
      recordTreat('花子')
      recordTreat('花子') // ローカル3回
      seedTreatStats({ 花子: { count: 1, totalAmount: 0 } }) // クラウドは1回
      expect(getTreatCount('花子')).toBe(3) // ローカルを維持
    })

    test('既存データがない場合はクラウドデータで初期化される', () => {
      seedTreatStats({ 鈴木: { count: 7, totalAmount: 21000 } })
      expect(getTreatCount('鈴木')).toBe(7)
    })
  })

})
