"use client"

import { useState, useRef } from "react"
import { Plus, Check, Pencil, Trash2, X as XIcon, Play } from "lucide-react"
import type { SavedGroup } from "@/lib/group-storage"

interface GroupListProps {
  groups: SavedGroup[]
  loading?: boolean
  selectedGroupId: string | null
  onSelect: (id: string) => void
  onSpin?: (id: string) => void
  onUpdate: (id: string, data: { name?: string; participants?: string[] }) => void
  onDelete: (id: string) => void
  onNew: () => void
}

function relativeTime(ts: number | undefined): string {
  if (!ts) return ""
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "今日"
  if (days === 1) return "昨日"
  if (days < 7) return `${days}日前`
  if (days < 14) return "先週"
  if (days < 30) return `${Math.floor(days / 7)}週間前`
  return `${Math.floor(days / 30)}ヶ月前`
}

interface EditState {
  id: string
  name: string
}

export function GroupList({
  groups,
  loading = false,
  selectedGroupId,
  onSelect,
  onSpin,
  onUpdate,
  onDelete,
  onNew,
}: GroupListProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startEdit = (group: SavedGroup) => {
    setOpenMenuId(null)
    setEditState({ id: group.id, name: group.name })
  }

  const commitEdit = () => {
    if (!editState) return
    if (editState.name.trim()) {
      onUpdate(editState.id, { name: editState.name.trim() })
    }
    setEditState(null)
  }

  const handleLongPressStart = (id: string) => {
    longPressTimer.current = setTimeout(() => setOpenMenuId(id), 500)
  }

  const handleLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  // Render nothing while hydrating — SSR produces [] and CSR initial render must match.
  // Without this guard, the empty-state DOM rendered by the server would conflict with
  // the group-list DOM the client wants to render, causing a Hydration error.
  if (loading) return null

  if (groups.length === 0) {
    return (
      <section className="mb-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          いつものメンバー
        </h2>
        <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-white/10 text-muted-foreground text-sm">
          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <Plus className="w-3.5 h-3.5 opacity-40" />
          </div>
          <span className="opacity-60">ルーレット後に「保存」でメンバーを登録できます</span>
        </div>
        <button
          onClick={onNew}
          className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新しいグループを登録
        </button>
      </section>
    )
  }

  return (
    <section className="mb-5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        いつものメンバー
      </h2>

      <div className="space-y-2">
        {groups.map((group) => {
          const isSelected = group.id === selectedGroupId
          const isEditing = editState?.id === group.id
          const menuOpen = openMenuId === group.id
          const lastUsed = relativeTime(group.lastUsedAt)

          return (
            <div key={group.id} className="relative">
              {/* Edit mode */}
              {isEditing ? (
                <div className="flex gap-2 px-3 py-2.5 rounded-2xl glass-card border border-primary/40">
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit()
                      if (e.key === "Escape") setEditState(null)
                    }}
                    maxLength={20}
                    autoFocus
                    className="flex-1 bg-transparent text-sm font-medium text-foreground focus:outline-none"
                  />
                  <button
                    onClick={commitEdit}
                    className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditState(null)}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-muted-foreground"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Normal / selected card */
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl glass-card border transition-all ${
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  {/* Left: tap to select */}
                  <button
                    onClick={() => {
                      if (menuOpen) { setOpenMenuId(null); return }
                      onSelect(group.id)
                    }}
                    onMouseDown={() => handleLongPressStart(group.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(group.id)}
                    onTouchEnd={handleLongPressEnd}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {/* Selection indicator */}
                    <div
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-primary"
                          : "bg-white/10"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {group.name}
                        </p>
                        {lastUsed && (
                          <span className="text-xs text-muted-foreground shrink-0">{lastUsed}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {group.participants.join(" · ")}
                      </p>
                    </div>
                  </button>

                  {/* Right: spin immediately with this group */}
                  {onSpin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSpin(group.id)
                      }}
                      className="shrink-0 w-8 h-8 rounded-xl bg-primary/20 hover:bg-primary/40 flex items-center justify-center text-primary transition-all active:scale-95"
                      title={`${group.name}ですぐ回す`}
                    >
                      <Play className="w-3.5 h-3.5 fill-primary" />
                    </button>
                  )}
                </div>
              )}

              {/* Long-press action menu */}
              {menuOpen && !isEditing && (
                <div className="absolute right-0 top-full mt-1 z-20 flex gap-1 p-1 rounded-xl glass-card border border-white/15 shadow-lg">
                  <button
                    onClick={() => startEdit(group)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    編集
                  </button>
                  <button
                    onClick={() => { setOpenMenuId(null); onDelete(group.id) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/15 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    削除
                  </button>
                  <button
                    onClick={() => setOpenMenuId(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/10 transition-colors"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={onNew}
        className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        新しいグループを登録
      </button>
    </section>
  )
}
