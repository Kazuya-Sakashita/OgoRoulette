"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ChevronDown, HelpCircle, Users, QrCode, Calculator, Share2, History, Sparkles } from "lucide-react"
import { useState } from "react"

interface FAQItem {
  question: string
  answer: string
  icon: React.ReactNode
}

const faqItems: FAQItem[] = [
  {
    question: "OgoRouletteとは何ですか？",
    answer: "OgoRouletteは、飲み会やイベントで「誰が奢るか」をルーレットで楽しく決められるアプリです。一部奢り・残りを割り勘という柔軟な支払い方法にも対応しています。",
    icon: <Sparkles className="w-5 h-5" />
  },
  {
    question: "ログインせずに使えますか？",
    answer: "はい、ログインなしでもルーレット機能を試すことができます。ただし、履歴の保存やルームの共有など一部機能はログインが必要です。",
    icon: <Users className="w-5 h-5" />
  },
  {
    question: "QRコードで参加するには？",
    answer: "ホストがルームを作成するとQRコードが表示されます。参加者はそのQRコードをスキャンするか、招待コードを入力することでルームに参加できます。",
    icon: <QrCode className="w-5 h-5" />
  },
  {
    question: "一部奢り・割り勘とは？",
    answer: "例えば、合計30,000円のうち20,000円をルーレットの勝者が奢り、残りの10,000円を他の参加者で割り勘するという柔軟な支払い方法です。「金額を設定」から設定できます。",
    icon: <Calculator className="w-5 h-5" />
  },
  {
    question: "結果をシェアできますか？",
    answer: "ルーレット結果は、X（Twitter）、LINE、Instagramなどにシェアできます。結果画面に表示されるシェアボタンをタップしてください。",
    icon: <Share2 className="w-5 h-5" />
  },
  {
    question: "履歴はどこで確認できますか？",
    answer: "ログイン後、ヘッダーの履歴アイコンをタップすると過去のルーレット結果一覧を確認できます。各結果の詳細も見ることができます。",
    icon: <History className="w-5 h-5" />
  }
]

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-2xl glass-card border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center text-primary-foreground shrink-0">
          {item.icon}
        </div>
        <span className="flex-1 text-sm font-medium text-foreground">{item.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed pl-14">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[480px] min-h-screen flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/home">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-base font-bold tracking-tight">
              <span className="text-foreground">Ogo</span>
              <span className="text-gradient">Roulette</span>
            </span>
          </div>
        </header>

        {/* Page Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-accent mb-4">
            <HelpCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">ヘルプ</h1>
          <p className="text-sm text-muted-foreground">
            よくある質問と使い方
          </p>
        </div>

        {/* Quick Start Guide */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            かんたんスタートガイド
          </h2>
          <div className="p-5 rounded-3xl glass-card border border-white/10">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">参加者を追加</h3>
                  <p className="text-xs text-muted-foreground">ホーム画面で「プレイヤーを追加」から参加者の名前を入力します。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">金額を設定（任意）</h3>
                  <p className="text-xs text-muted-foreground">「金額を設定」から合計金額と奢り金額を入力すると、割り勘額が自動計算されます。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">SPINをタップ</h3>
                  <p className="text-xs text-muted-foreground">ルーレットが回転し、止まった人が今日の奢り役に決定！</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            よくある質問
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <FAQAccordion key={index} item={item} />
            ))}
          </div>
        </section>

        {/* Contact Section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            お問い合わせ
          </h2>
          <div className="p-5 rounded-3xl glass-card border border-white/10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              解決しない問題がありますか？<br />
              お気軽にお問い合わせください。
            </p>
            <Button
              asChild
              className="rounded-xl bg-gradient-accent hover:opacity-90 text-primary-foreground font-semibold press-effect"
            >
              <a href="mailto:ogoroulette@gmail.com">
                メールで問い合わせ
              </a>
            </Button>
          </div>
        </section>

        {/* Back to Home */}
        <div className="mt-auto pt-6">
          <Button
            asChild
            variant="outline"
            className="w-full h-12 rounded-xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect"
          >
            <Link href="/home">
              ホームに戻る
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-white/5">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">プライバシー</Link>
            <span>・</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            © 2026 OgoRoulette
          </p>
        </footer>
      </div>
    </main>
  )
}
