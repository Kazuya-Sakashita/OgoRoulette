"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Calculator, Users, Sparkles, ChevronRight } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function BillInputPage() {
  const [totalBill, setTotalBill] = useState<number>(30000)
  const [treatAmount, setTreatAmount] = useState<number>(20000)
  const [participants, setParticipants] = useState([
    { name: "A", isTreater: true },
    { name: "B", isTreater: false },
    { name: "C", isTreater: false },
    { name: "D", isTreater: false },
    { name: "E", isTreater: false },
  ])

  const treater = participants.find(p => p.isTreater)
  const nonTreaters = participants.filter(p => !p.isTreater)
  const remainingAmount = Math.max(0, totalBill - treatAmount)
  const splitAmount = nonTreaters.length > 0 ? Math.ceil(remainingAmount / nonTreaters.length) : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA]">
      {/* App Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-[420px] mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 -ml-2">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">お会計入力</h1>
        </div>
      </header>

      <div className="max-w-[420px] mx-auto px-4 py-6 space-y-6">
        
        {/* Total Bill Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">合計金額</h2>
          </div>
          
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-medium text-gray-400">¥</span>
            <input
              type="number"
              value={totalBill}
              onChange={(e) => setTotalBill(Number(e.target.value))}
              className="w-full h-16 pl-10 pr-4 text-3xl font-bold text-gray-900 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all"
              placeholder="0"
            />
          </div>
        </div>

        {/* Treat Amount Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">奢り金額</h2>
              <p className="text-xs text-gray-500">{treater?.name}さんが奢る金額</p>
            </div>
          </div>
          
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-medium text-gray-400">¥</span>
            <input
              type="number"
              value={treatAmount}
              onChange={(e) => setTreatAmount(Math.min(Number(e.target.value), totalBill))}
              className="w-full h-16 pl-10 pr-4 text-3xl font-bold text-gray-900 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-pink-500 focus:bg-white outline-none transition-all"
              placeholder="0"
              max={totalBill}
            />
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[5000, 10000, 15000, 20000].map((amount) => (
              <button
                key={amount}
                onClick={() => setTreatAmount(Math.min(amount, totalBill))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  treatAmount === amount 
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {formatCurrency(amount).replace('￥', '¥')}
              </button>
            ))}
          </div>
        </div>

        {/* Participants Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">参加者</h2>
            </div>
            <span className="text-sm text-gray-500">{participants.length}人</span>
          </div>

          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                  participant.isTreater 
                    ? 'bg-gradient-to-r from-orange-50 to-pink-50 border-2 border-orange-200' 
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      participant.isTreater 
                        ? 'bg-gradient-to-br from-orange-500 to-pink-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {participant.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{participant.name}</span>
                    {participant.isTreater && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white">奢り</span>
                    )}
                  </div>
                </div>
                <span className="font-semibold text-gray-900">
                  {participant.isTreater ? formatCurrency(treatAmount) : formatCurrency(splitAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-3xl p-6 text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-80 mb-4">計算プレビュー</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="opacity-80">合計金額</span>
              <span className="text-xl font-bold">{formatCurrency(totalBill)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-80">奢り金額</span>
              <span className="text-xl font-bold">- {formatCurrency(treatAmount)}</span>
            </div>
            <div className="h-px bg-white/30" />
            <div className="flex justify-between items-center">
              <span className="opacity-80">残り（割り勘）</span>
              <span className="text-xl font-bold">{formatCurrency(remainingAmount)}</span>
            </div>
            <div className="h-px bg-white/30" />
            <div className="flex justify-between items-center pt-1">
              <span className="font-medium">1人あたり</span>
              <span className="text-2xl font-black">{formatCurrency(splitAmount)}</span>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <Button 
          asChild
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 text-white font-semibold text-lg shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98]"
        >
          <Link href={`/result?total=${totalBill}&treat=${treatAmount}&treater=${treater?.name}&participants=${participants.map(p => p.name).join(',')}`}>
            確認する
            <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </Button>
      </div>
    </main>
  )
}
