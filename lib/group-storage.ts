export interface SavedGroup {
  id: string
  name: string
  participants: string[]
  updatedAt: number
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

const GROUPS_KEY = "ogoroulette_groups"
const STATS_KEY = "ogoroulette_treat_stats"

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
