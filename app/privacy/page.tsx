"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[640px] min-h-screen px-5 py-6">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={28}
              height={28}
              className="w-7 h-7"
            />
            <span className="text-base font-bold tracking-tight">
              <span className="text-foreground">Ogo</span>
              <span className="text-gradient">Roulette</span>
            </span>
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-invert max-w-none">
          <h1 className="text-2xl font-bold text-foreground mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-muted-foreground mb-8">最終更新日: 2026年3月15日</p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. はじめに</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                OgoRoulette（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めています。
                本プライバシーポリシーは、本サービスがどのような情報を収集し、どのように利用・保護するかについて説明します。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. 収集する情報</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>本サービスは、以下の情報を収集する場合があります：</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><span className="text-foreground font-medium">アカウント情報：</span>SNSログインを通じて取得するメールアドレス、表示名、プロフィール画像</li>
                <li><span className="text-foreground font-medium">利用データ：</span>ルーレットの使用履歴、参加者情報、支払い金額の記録</li>
                <li><span className="text-foreground font-medium">デバイス情報：</span>IPアドレス、ブラウザの種類、デバイスの種類</li>
                <li><span className="text-foreground font-medium">Cookie：</span>セッション管理およびユーザー体験向上のためのCookie</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. 情報の利用目的</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>収集した情報は、以下の目的で利用します：</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>本サービスの提供・運営・改善</li>
                <li>ユーザーサポートの提供</li>
                <li>利用状況の分析およびサービス向上</li>
                <li>不正利用の防止およびセキュリティの確保</li>
                <li>法令に基づく対応</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. 情報の共有</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>ユーザーの同意がある場合</li>
                <li>法令に基づく開示要請がある場合</li>
                <li>サービス提供に必要な業務委託先への提供（秘密保持契約を締結）</li>
                <li>統計データとして個人を特定できない形式での利用</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. データの保管</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                ユーザーのデータは、適切なセキュリティ対策を講じたサーバーに保管されます。
                データの保管期間は、サービス利用中および退会後一定期間とし、法令で定められた期間を遵守します。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">6. ユーザーの権利</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>ユーザーは以下の権利を有します：</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>個人情報の開示・訂正・削除の請求</li>
                <li>個人情報の利用停止の請求</li>
                <li>アカウントの削除</li>
              </ul>
              <p className="mt-3">
                これらの請求については、本ポリシー末尾のお問い合わせ先までご連絡ください。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookieの使用</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本サービスは、ユーザー体験の向上およびサービス分析のためにCookieを使用します。
                ブラウザの設定によりCookieを無効にすることができますが、一部の機能が利用できなくなる場合があります。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">8. 未成年者のプライバシー</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本サービスは、13歳未満の方からの個人情報を意図的に収集することはありません。
                13歳未満の方が個人情報を提供したことが判明した場合、速やかに削除いたします。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">9. プライバシーポリシーの変更</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本ポリシーは、法令の変更やサービス内容の変更に応じて改定される場合があります。
                重要な変更がある場合は、本サービス上で通知いたします。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">10. お問い合わせ</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本ポリシーに関するご質問やお問い合わせは、以下までご連絡ください：
              </p>
              <div className="mt-4 p-4 rounded-2xl glass-card border border-white/10">
                <p className="text-foreground font-medium">OgoRoulette 運営チーム</p>
                <p className="text-muted-foreground">メール: ogoroulette@gmail.com</p>
              </div>
            </div>
          </section>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/5">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
            <span>・</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
            <span>・</span>
            <Link href="/help" className="hover:text-foreground transition-colors">ヘルプ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-3">
            © 2026 OgoRoulette
          </p>
        </footer>
      </div>
    </main>
  )
}
