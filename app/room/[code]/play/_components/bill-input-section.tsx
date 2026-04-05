"use client"

import { Calculator, ChevronDown, ChevronUp } from "lucide-react"
import { QUICK_AMOUNTS } from "../use-bill"
import { formatCurrency } from "@/lib/format"
import type { Phase } from "../types"

interface BillInputSectionProps {
  phase: Phase
  showBillInput: boolean
  setShowBillInput: (v: boolean) => void
  totalBill: number
  treatAmount: number
  splitAmount: number
  hasBillInput: boolean
  handleTotalBillChange: (n: number) => void
  handleTreatAmountChange: (n: number) => void
  setTreatAmount: (n: number) => void
}

export function BillInputSection({
  phase,
  showBillInput,
  setShowBillInput,
  totalBill,
  treatAmount,
  splitAmount,
  hasBillInput,
  handleTotalBillChange,
  handleTreatAmountChange,
  setTreatAmount,
}: BillInputSectionProps) {
  return (
    <section className={`mb-4 ${phase !== "waiting" ? "hidden" : ""}`}>
      <button
        onClick={() => setShowBillInput(!showBillInput)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl glass-card border border-white/10 hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center">
            <Calculator className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">金額を設定</span>
            {hasBillInput && (
              <p className="text-xs text-muted-foreground">
                奢り {formatCurrency(treatAmount)} / 割り勘 {formatCurrency(splitAmount)}
              </p>
            )}
          </div>
        </div>
        {showBillInput ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {showBillInput && (
        <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">合計金額</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
              <input
                type="number"
                value={totalBill || ""}
                min="0"
                onChange={(e) => handleTotalBillChange(Number(e.target.value))}
                className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="30000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">奢り金額（勝者が払う）</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
              <input
                type="number"
                value={treatAmount || ""}
                min="0"
                max={totalBill}
                onChange={(e) => handleTreatAmountChange(Number(e.target.value))}
                className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="20000"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTreatAmount(Math.min(amount, totalBill || amount))}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    treatAmount === amount
                      ? "bg-gradient-accent text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground border border-white/10"
                  }`}
                >
                  ¥{amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          {hasBillInput && (
            <div className="p-4 rounded-xl bg-gradient-accent text-primary-foreground">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-80">合計</span>
                  <span className="font-semibold">{formatCurrency(totalBill)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">奢り</span>
                  <span className="font-semibold">- {formatCurrency(treatAmount)}</span>
                </div>
                <div className="h-px bg-white/30" />
                <div className="flex justify-between pt-1">
                  <span className="font-medium">1人あたり</span>
                  <span className="text-lg font-bold">{formatCurrency(splitAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
