"use client"

import { useState, useEffect, useCallback } from "react"
import {
  loadGroups,
  saveGroup as saveGroupLocal,
  deleteGroup as deleteGroupLocal,
  touchGroupLocally,
  updateGroupLocal,
  updateGroupCloudId,
  syncGroupsFromCloud,
  type SavedGroup,
  type CloudGroup,
} from "@/lib/group-storage"
import type { User } from "@supabase/supabase-js"

export function useGroups(user: User | null) {
  // Start with [] so SSR and CSR initial render both produce the same DOM.
  // LocalStorage is client-only — load it in useEffect after hydration.
  const [groups, setGroups] = useState<SavedGroup[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const refresh = useCallback(() => setGroups(loadGroups()), [])

  // Hydration-safe localStorage load — fires only on the client, after hydration
  useEffect(() => {
    setGroups(loadGroups())
    setIsLoaded(true)
  }, [])

  // user が null になったとき（ログアウト）は React state もリセット
  // localStorage は handleLogout 側でクリア済みなので再読込でクリーンになる
  useEffect(() => {
    if (user === null && isLoaded) {
      setGroups(loadGroups())
      setSelectedGroupId(null)
    }
  }, [user, isLoaded])

  // Cloud sync when user logs in
  useEffect(() => {
    if (!user) return

    fetch("/api/groups")
      .then((r) => r.json())
      .then((cloudGroups: CloudGroup[]) => {
        const merged = syncGroupsFromCloud(cloudGroups)
        setGroups(merged)

        // Push local-only groups (no cloudId) to cloud
        for (const g of merged) {
          if (!g.cloudId) {
            fetch("/api/groups", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: g.name, participants: g.participants }),
            })
              .then((r) => r.json())
              .then((cg: { id?: string }) => {
                if (cg.id) {
                  updateGroupCloudId(g.name, cg.id)
                  refresh()
                }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [user, refresh])

  /** Load a group's participants and record the access time. Returns the participant list. */
  const selectGroup = useCallback(
    (id: string): string[] => {
      touchGroupLocally(id)
      const updated = loadGroups()
      setGroups(updated)
      setSelectedGroupId(id)

      const group = updated.find((g) => g.id === id)
      if (user && group?.cloudId) {
        fetch(`/api/groups/${group.cloudId}/use`, { method: "POST" }).catch(() => {})
      }
      return group?.participants ?? []
    },
    [user]
  )

  const saveGroup = useCallback(
    async (name: string, participants: string[]) => {
      saveGroupLocal(name, participants)
      refresh()

      if (user) {
        try {
          const res = await fetch("/api/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, participants }),
          })
          const cg: { id?: string } = await res.json()
          if (cg.id) {
            updateGroupCloudId(name, cg.id)
            refresh()
          }
        } catch {
          // silently fail — local save already succeeded
        }
      }
    },
    [user, refresh]
  )

  const updateGroup = useCallback(
    async (id: string, data: { name?: string; participants?: string[] }) => {
      updateGroupLocal(id, data)
      refresh()

      const group = loadGroups().find((g) => g.id === id)
      if (user && group?.cloudId) {
        fetch(`/api/groups/${group.cloudId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).catch(() => {})
      }
    },
    [user, refresh]
  )

  const deleteGroup = useCallback(
    (id: string) => {
      const group = groups.find((g) => g.id === id)
      deleteGroupLocal(id)
      refresh()
      if (selectedGroupId === id) setSelectedGroupId(null)

      if (user && group?.cloudId) {
        fetch(`/api/groups/${group.cloudId}`, { method: "DELETE" }).catch(() => {})
      }
    },
    [user, groups, selectedGroupId, refresh]
  )

  return { groups, isLoaded, selectedGroupId, selectGroup, saveGroup, updateGroup, deleteGroup }
}
