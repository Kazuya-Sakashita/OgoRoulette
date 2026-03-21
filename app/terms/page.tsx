"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold text-foreground mb-2">利用規約</h1>
          <p className="text-sm text-muted-foreground mb-8">最終更新日: 2026年3月15日</p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第1条（適用）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本規約は、OgoRoulette（以下「本サービス」）の利用に関する条件を、本サービスを利用するすべてのユーザー（以下「ユーザー」）と
                本サービスの運営者（以下「運営者」）との間で定めるものです。
              </p>
              <p>
                ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第2条（サービスの内容）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本サービスは、飲み会などの場面で「奢る人」をルーレットで決定し、支払い金額の計算を支援するエンターテインメントアプリです。
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>ルーレットによる抽選機能</li>
                <li>一部奢り・割り勘の金額計算機能</li>
                <li>QRコードによるグループ参加機能</li>
                <li>利用履歴の記録・閲覧機能</li>
                <li>SNSシェア機能</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第3条（アカウント）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  ユーザーは、SNSアカウント（LINE、Google、X）を使用して本サービスにログインすることができます。
                </li>
                <li>
                  ユーザーは、自身のアカウント情報を適切に管理する責任を負い、第三者への貸与・譲渡・共有はできません。
                </li>
                <li>
                  ゲストとして参加する場合、アカウント登録なしで一部機能を利用できますが、履歴の保存などの機能は制限されます。
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第4条（禁止事項）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません：</p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>運営者のサーバーまたはネットワークに過度な負荷をかける行為</li>
                <li>本サービスの運営を妨害する行為</li>
                <li>他のユーザーに対する嫌がらせ、誹謗中傷</li>
                <li>他のユーザーの個人情報を不正に収集・利用する行為</li>
                <li>運営者の許可なく本サービスを商業目的で利用する行為</li>
                <li>本サービスを悪用した金銭トラブルの誘発</li>
                <li>不正なプログラムやボットの使用</li>
                <li>その他、運営者が不適切と判断する行為</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第5条（免責事項）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  本サービスは「現状有姿」で提供され、運営者は本サービスの完全性、正確性、信頼性、適時性について保証しません。
                </li>
                <li>
                  本サービスはエンターテインメント目的であり、ルーレットの結果に基づく実際の支払いについて、運営者は一切の責任を負いません。
                </li>
                <li>
                  ユーザー間で発生した金銭トラブル、紛争について、運営者は一切の責任を負いません。
                </li>
                <li>
                  本サービスの利用により生じた損害について、運営者の故意または重大な過失による場合を除き、運営者は責任を負いません。
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第6条（サービスの変更・停止）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  運営者は、ユーザーに事前に通知することなく、本サービスの内容を変更または機能を追加・削除できます。
                </li>
                <li>
                  運営者は、以下の場合、本サービスの全部または一部を停止できます：
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>システムの保守・更新を行う場合</li>
                    <li>地震、落雷、火災などの不可抗力により提供が困難な場合</li>
                    <li>その他、運営上の理由���より必要な場合</li>
                  </ul>
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第7条（知的財産権）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本サービスに関する著作権、商標権、その他の知的財産権は、運営者または正当な権利者に帰属します。
                ユーザーは、運営者の許可なく、本サービスのコンテンツを複製、改変、頒布、公開することはできません。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第8条（アカウントの停止・削除）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  運営者は、ユーザーが本規約に違反した場合、事前の通知なくアカウントを停止または削除できます。
                </li>
                <li>
                  ユーザーは、いつでもアカウントを削除することができます。削除後、関連データは復元できません。
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第9条（規約の変更）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                運営者は、必要に応じて本規約を変更できます。変更後の規約は、本サービス上に掲載した時点で効力を生じます。
                重要な変更がある場合は、適切な方法でユーザーに通知します。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第10条（準拠法・管轄裁判所）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本規約の解釈および適用は日本法に準拠します。
                本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">第11条（お問い合わせ）</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                本規約に関するお問い合わせは、以下までご連絡ください：
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
            <Link href="/privacy" className="hover:text-foreground transition-colors">プライバシー</Link>
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
