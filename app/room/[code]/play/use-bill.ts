"use client"

import { useState } from "react"
import { calculateBillSplit } from "@/lib/bill-calculator"

export const QUICK_AMOUNTS = [5000, 10000, 15000, 20000]

export function useBill(participantCount: number) {
  const [showBillInput, setShowBillInput] = useState(false)
  const [totalBill, setTotalBill] = useState(0)
  const [treatAmount, setTreatAmount] = useState(0)

  const { splitAmount, isActive: hasBillInput } = calculateBillSplit(
    totalBill,
    treatAmount,
    participantCount
  )

  const handleTotalBillChange = (val: number) => {
    const safe = Math.max(0, val)
    setTotalBill(safe)
    if (treatAmount > safe) setTreatAmount(safe)
  }

  const handleTreatAmountChange = (val: number) =>
    setTreatAmount(Math.min(Math.max(0, val), totalBill))

  return {
    showBillInput,
    setShowBillInput,
    totalBill,
    treatAmount,
    setTreatAmount,
    splitAmount,
    hasBillInput,
    handleTotalBillChange,
    handleTreatAmountChange,
  }
}
