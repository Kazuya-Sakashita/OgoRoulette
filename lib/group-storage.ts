// ISSUE-198: スピン履歴レコード（直近 10 件を保持）
export interface SpinRecord {
  winner: string
  spinAt: number       // Unix timestamp
  participants: string[]
}

export interface SavedGroup {
  id: string
  cloudId?: string   // DB UUID — set after first cloud sync
  name: string
  participants: string[]
  updatedAt: number
  lastUsedAt?: number  // timestamp of last group selection
  // ISSUE-182: リテンション — 最後にスピンした日時と当選者名
  lastSpinAt?: number
  lastWinner?: string
  // ISSUE-198: スピン履歴（最大 10 件）
  spinHistory?: SpinRecord[]
}

export interface TreatStats {
  count: number
  totalAmount: number
  lastTreatedAt: number
}

export interface RankingEntry {
  name: string
  count: number
  totalAmount: number
}

// Shape returned by GET /api/groups
export interface CloudGroup {
  id: string
  name: string
  participants: string[]
  updatedAt: string       // ISO date string
  lastUsedAt?: string | null
}

const GROUPS_KEY = "ogoroulette_groups"
const STATS_KEY = "ogoroulette_treat_stats"

/**
 * ログアウト時にユーザー由来のグループデータを localStorage から削除する。
 * cloudId を持つグループ（クラウド同期済み）を削除し、ローカルのみのグループは残す。
 * treat stats はユーザー単位のデータなので常に全クリアする。
 */
export function clearUserGroupData(): void {
  if (typeof window === "undefined") return
  // cloudId のないローカルのみグループは残す（ゲスト利用データは保護）
  const localOnly = loadGroups().filter((g) => !g.cloudId)
  if (localOnly.length > 0) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(localOnly))
  } else {
    localStorage.removeItem(GROUPS_KEY)
  }
  // treat stats はユーザー依存なので全削除
  localStorage.removeItem(STATS_KEY)
}

// --- Groups ---

export function loadGroups(): SavedGroup[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]")
  } catch {
    return []
  }
}

export function saveGroup(name: string, participants: string[]): SavedGroup {
  const groups = loadGroups()
  const existing = groups.find((g) => g.name === name)
  if (existing) {
    existing.participants = participants
    existing.updatedAt = Date.now()
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
    return existing
  }
  const group: SavedGroup = {
    id: crypto.randomUUID(),
    name,
    participants,
    updatedAt: Date.now(),
  }
  groups.unshift(group)
  // Keep at most 20 groups
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.slice(0, 20)))
  return group
}

export function deleteGroup(id: string): void {
  const groups = loadGroups().filter((g) => g.id !== id)
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

/** Mark a group as used (update lastUsedAt) and re-sort the list */
export function touchGroupLocally(id: string): void {
  const groups = loadGroups()
  const target = groups.find((g) => g.id === id)
  if (!target) return
  target.lastUsedAt = Date.now()
  const sorted = groups.sort(
    (a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt)
  )
  localStorage.setItem(GROUPS_KEY, JSON.stringify(sorted))
}

/**
 * ISSUE-182/198: スピン結果後にグループの lastSpinAt / lastWinner を更新し、
 * spinHistory に記録を追加する（最大 10 件保持）。
 */
export function updateGroupLastSpin(
  id: string,
  winner: string,
  participants: string[] = []
): void {
  const groups = loadGroups()
  const target = groups.find((g) => g.id === id)
  if (!target) return
  const now = Date.now()
  target.lastSpinAt = now
  target.lastWinner = winner
  // ISSUE-198: 履歴を先頭に追加し、最大 10 件に切り詰める
  const record: SpinRecord = { winner, spinAt: now, participants }
  target.spinHistory = [record, ...(target.spinHistory ?? [])].slice(0, 10)
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

/** Update name and/or participants for a local group */
export function updateGroupLocal(
  id: string,
  data: { name?: string; participants?: string[] }
): void {
  const groups = loadGroups()
  const target = groups.find((g) => g.id === id)
  if (!target) return
  if (data.name) target.name = data.name
  if (data.participants) target.participants = data.participants
  target.updatedAt = Date.now()
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

/** After POST /api/groups succeeds, store the returned cloud ID against the local group */
export function updateGroupCloudId(localName: string, cloudId: string): void {
  const groups = loadGroups()
  const target = groups.find((g) => g.name === localName)
  if (target) {
    target.cloudId = cloudId
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  }
}

/**
 * Merge cloud groups into LocalStorage.
 * - Cloud wins on participant conflicts (cloud is assumed to be newer for cross-device changes).
 * - Cloud-only groups are added to LocalStorage.
 * - Returns the merged list and writes it to LocalStorage.
 */
export function syncGroupsFromCloud(cloudGroups: CloudGroup[]): SavedGroup[] {
  if (typeof window === "undefined") return []
  const local = loadGroups()

  for (const cloud of cloudGroups) {
    const cloudUpdatedAt = new Date(cloud.updatedAt).getTime()
    const idx = local.findIndex((lg) => lg.name === cloud.name)
    const cloudLastUsedAt = cloud.lastUsedAt ? new Date(cloud.lastUsedAt).getTime() : undefined
    if (idx >= 0) {
      // Match by name: update cloudId; cloud wins if it's newer
      local[idx] = {
        ...local[idx],
        cloudId: cloud.id,
        participants: cloudUpdatedAt > local[idx].updatedAt ? cloud.participants : local[idx].participants,
        updatedAt: Math.max(local[idx].updatedAt, cloudUpdatedAt),
        lastUsedAt: Math.max(local[idx].lastUsedAt ?? 0, cloudLastUsedAt ?? 0) || undefined,
        // ISSUE-182: lastSpinAt / lastWinner はローカルで管理 — cloud sync では上書きしない
        lastSpinAt: local[idx].lastSpinAt,
        lastWinner: local[idx].lastWinner,
      }
    } else {
      // Cloud-only group: add locally
      local.push({
        id: crypto.randomUUID(),
        cloudId: cloud.id,
        name: cloud.name,
        participants: cloud.participants,
        updatedAt: cloudUpdatedAt,
        lastUsedAt: cloudLastUsedAt,
      })
    }
  }

  const sorted = local
    .sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt))
    .slice(0, 20)
  localStorage.setItem(GROUPS_KEY, JSON.stringify(sorted))
  return sorted
}

// --- Treat stats ---

function loadStats(): Record<string, TreatStats> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}")
  } catch {
    return {}
  }
}

export function recordTreat(name: string, amount = 0): number {
  const stats = loadStats()
  const prev = stats[name] ?? { count: 0, totalAmount: 0, lastTreatedAt: 0 }
  stats[name] = {
    count: prev.count + 1,
    totalAmount: prev.totalAmount + amount,
    lastTreatedAt: Date.now(),
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  return stats[name].count
}

export function getTreatCount(name: string): number {
  return loadStats()[name]?.count ?? 0
}

export function getGroupRanking(participants: string[]): RankingEntry[] {
  const stats = loadStats()
  return participants
    .map((name) => ({
      name,
      count: stats[name]?.count ?? 0,
      totalAmount: stats[name]?.totalAmount ?? 0,
    }))
    .sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount)
}

export function getTreatTitle(count: number): string {
  if (count === 1) return "🎊 記念すべき初奢り！"
  if (count <= 3) return "👑 奢り王子"
  if (count <= 9) return "🏆 奢り王"
  if (count <= 19) return "💎 奢り女王"
  return "🌟 伝説の奢り神様"
}

/**
 * Seed LocalStorage treat stats from cloud session history.
 * For each name, use whichever count/amount is higher (DB is source of truth for past sessions,
 * LocalStorage tracks current-device spins that may not yet be synced).
 */
export function seedTreatStats(
  cloudStats: Record<string, { count: number; totalAmount: number }>
): void {
  if (typeof window === "undefined") return
  const local = loadStats()
  let changed = false

  for (const [name, cloud] of Object.entries(cloudStats)) {
    const prev = local[name] ?? { count: 0, totalAmount: 0, lastTreatedAt: 0 }
    const newCount = Math.max(cloud.count, prev.count)
    const newAmount = Math.max(cloud.totalAmount, prev.totalAmount)
    if (newCount !== prev.count || newAmount !== prev.totalAmount) {
      local[name] = { count: newCount, totalAmount: newAmount, lastTreatedAt: prev.lastTreatedAt }
      changed = true
    }
  }

  if (changed) {
    localStorage.setItem(STATS_KEY, JSON.stringify(local))
  }
}
