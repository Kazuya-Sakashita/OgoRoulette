import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'OgoRoulette — 飲み会・ランチのおごりをルーレットで公平に決めよう',
  description: '飲み会・合コン・社内ランチ。おごる人をリアルタイムルーレットで公平に決める無料Webアプリ。QRコードで全員の画面が同期。スマホだけで使える。',
  keywords: ['おごり', '決め方', '飲み会', 'ゲーム', 'ルーレット', '幹事', '割り勘', '合コン', '社内ランチ', 'QRコード', '順番決め アプリ', '担当決め スマホ', '罰ゲーム 決め方', 'じゃんけん 代わり アプリ', 'グループ ランダム 選出'],
  openGraph: {
    title: 'OgoRoulette — 今日の奢り、運命に任せろ。',
    description: '飲み会・ランチ・打ち上げ。誰が奢るか、ルーレットで一発決定。公平で盛り上がる無料Webアプリ。',
    url: 'https://ogo-roulette.vercel.app/lp',
    siteName: 'OgoRoulette',
    locale: 'ja_JP',
    type: 'website',
  },
  alternates: {
    canonical: 'https://ogo-roulette.vercel.app/lp',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'OgoRoulette',
  url: 'https://ogo-roulette.vercel.app',
  description: '飲み会・ランチ・打ち上げ。誰が奢るか、ルーレットで一発決定。',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'JPY',
  },
  inLanguage: 'ja',
}

export default function LPPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* NAV */}
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__logo">
            <img className="nav__logo-icon" src="/images/logo-icon.png" alt="OgoRoulette" />
            <span>Ogo<span className="grad-text">Roulette</span></span>
          </div>
          <Link href="/home" className={"btn btn--primary nav__cta"} style={{ padding: '9px 18px', fontSize: '13px' }}>無料で試す</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero__glow"></div>
        <div className="container">

          <div className="hero__eyebrow">
            <span className={"badge badge--orange"}>🎰 完全無料 · ログイン不要</span>
          </div>

          <h1 className="hero__title">
            <span className="grad-text">今日の奢り、</span>
            <em>運命に任せろ。</em>
          </h1>

          <p className="hero__subtitle">
            飲み会・ランチ・打ち上げ。<br />
            誰が払うかで気まずくなるあの瞬間を、<br />
            ルーレットで最高の盛り上がりに変える。
          </p>

          <div className="hero__cta_group">
            <Link href="/home" className={"btn btn--primary"} style={{ width: '100%', maxWidth: '320px', fontSize: '18px', padding: '18px 32px' }}>
              🎰 今すぐ回してみる
            </Link>
            <p className="hero__note">✓ 無料 &nbsp;·&nbsp; ✓ ログイン不要 &nbsp;·&nbsp; ✓ 30秒で開始</p>
          </div>

          {/* Roulette Wheel */}
          <div className="wheel-container">
            <div className="wheel-glow"></div>
            <div className="wheel-ring"><div className="wheel-ring-inner"></div></div>

            {/* Pointer */}
            <div className="wheel-pointer">
              <svg width="28" height="36" viewBox="0 0 28 36">
                <defs>
                  <linearGradient id="pgrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#C2410C" />
                    <stop offset="50%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#FB923C" />
                  </linearGradient>
                </defs>
                <path d="M14 36 L2 10 L14 0 L26 10 Z" fill="url(#pgrad)" stroke="#9A3412" strokeWidth="1.5" />
                <path d="M14 4 L8 12 L14 34" fill="rgba(255,255,255,0.2)" />
              </svg>
            </div>

            {/* Wheel SVG */}
            <svg className="wheel-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hl" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                </filter>
              </defs>

              {/* 6 segments: 60deg each */}
              {/* Seg 0: 0-60, color #F97316 orange */}
              <path d="M140 140 L140 16 A124 124 0 0 1 247.4 78 Z" fill="#F97316" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L140 16 A124 124 0 0 1 247.4 78 Z" fill="url(#hl)" />
              {/* Seg 1: 60-120, color #EC4899 pink */}
              <path d="M140 140 L247.4 78 A124 124 0 0 1 247.4 202 Z" fill="#EC4899" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L247.4 78 A124 124 0 0 1 247.4 202 Z" fill="url(#hl)" />
              {/* Seg 2: 120-180, color #A855F7 purple */}
              <path d="M140 140 L247.4 202 A124 124 0 0 1 140 264 Z" fill="#A855F7" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L247.4 202 A124 124 0 0 1 140 264 Z" fill="url(#hl)" />
              {/* Seg 3: 180-240, color #3B82F6 blue */}
              <path d="M140 140 L140 264 A124 124 0 0 1 32.6 202 Z" fill="#3B82F6" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L140 264 A124 124 0 0 1 32.6 202 Z" fill="url(#hl)" />
              {/* Seg 4: 240-300, color #10B981 green */}
              <path d="M140 140 L32.6 202 A124 124 0 0 1 32.6 78 Z" fill="#10B981" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L32.6 202 A124 124 0 0 1 32.6 78 Z" fill="url(#hl)" />
              {/* Seg 5: 300-360, color #FBBF24 gold */}
              <path d="M140 140 L32.6 78 A124 124 0 0 1 140 16 Z" fill="#FBBF24" stroke="#080F1A" strokeWidth="2" filter="url(#shadow)" />
              <path d="M140 140 L32.6 78 A124 124 0 0 1 140 16 Z" fill="url(#hl)" />

              {/* Segment labels */}
              <text x="168" y="75"  textAnchor="middle" dominantBaseline="middle" fill="#080F1A" fontSize="16" fontWeight="800" transform="rotate(30 168 75)">たろう</text>
              <text x="218" y="140" textAnchor="middle" dominantBaseline="middle" fill="#080F1A" fontSize="16" fontWeight="800" transform="rotate(90 218 140)">さくら</text>
              <text x="168" y="210" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="16" fontWeight="800" transform="rotate(150 168 210)">けんた</text>
              <text x="112" y="210" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="16" fontWeight="800" transform="rotate(210 112 210)">はな</text>
              <text x="62"  y="140" textAnchor="middle" dominantBaseline="middle" fill="#080F1A" fontSize="16" fontWeight="800" transform="rotate(270 62 140)">ゆうき</text>
              <text x="112" y="75"  textAnchor="middle" dominantBaseline="middle" fill="#080F1A" fontSize="16" fontWeight="800" transform="rotate(330 112 75)">みか</text>

              {/* Center hub */}
              <circle cx="140" cy="140" r="28" fill="#080F1A" />
              <circle cx="140" cy="140" r="22" fill="none" stroke="url(#cgrad)" strokeWidth="3" />
              {/* Sparkle */}
              <path d="M140 124 L143 134 L153 137 L143 140 L140 150 L137 140 L127 137 L137 134 Z" fill="url(#cgrad)" opacity="0.9" />
              <defs>
                <linearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Stats */}
          <div className="stat-row">
            <div className="stat-item">
              <div className="stat-num">∞</div>
              <div className="stat-label">何度でも無料</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">30秒</div>
              <div className="stat-label">で開始できる</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">10人</div>
              <div className="stat-label">まで同時参加</div>
            </div>
          </div>

          <div className="hero__scroll_hint">
            <span>スクロールして体験を見る</span>
            <span className="scroll-arrow">↓</span>
          </div>
        </div>
      </section>

      <div className="divider"></div>

      {/* PAIN — 共感パート */}
      <section className="pain">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--pink"}>あなたも経験したはず</span>
          </div>
          <h2 className="section-title">その気まずい空気、<br />なんとかしたくない？</h2>
          <p className="section-sub">飲み会の終わり。あの微妙な沈黙、もう終わりにしよう。</p>

          <div className="pain__cards">
            <div className="pain__card">
              <div className="pain__icon">😅</div>
              <div className="pain__content">
                <div className="pain__card-title">「誰が払う？」で空気が読めない</div>
                <div className="pain__card-desc">みんな顔を見合わせて、なんとなく押し付け合いになる。気まずい。</div>
              </div>
            </div>
            <div className="pain__card">
              <div className="pain__icon">✊</div>
              <div className="pain__content">
                <div className="pain__card-title">ジャンケンじゃ盛り上がり切らない</div>
                <div className="pain__card-desc">結果が出ても「え〜」で終わり。せっかくのシーンがシラけてしまう。</div>
              </div>
            </div>
            <div className="pain__card">
              <div className="pain__icon">😑</div>
              <div className="pain__content">
                <div className="pain__card-title">後から「不公平」と思われる</div>
                <div className="pain__card-desc">なんとなく決めると、誰かが損をした気持ちになる。公平感が大事。</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="solution">
        <div className="solution__bg"></div>
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--orange"}>解決策</span>
          </div>
          <h2 className="section-title">OgoRoulette が<br /><span className="grad-text">その空気を変える。</span></h2>
          <p className="section-sub">抽選に「演出」を加えるだけで、その場が一瞬でイベントになる。</p>

          <div className="solution__arrow">🎰</div>

          <div className="solution__cards">
            <div className="solution__card">
              <div className="solution__card-icon">⚡</div>
              <div>
                <div className="solution__card-title">ワンタップで即スタート</div>
                <div className="solution__card-desc">アプリ不要。ブラウザだけで、30秒以内に始められる。</div>
              </div>
            </div>
            <div className="solution__card">
              <div className="solution__card-icon">🎲</div>
              <div>
                <div className="solution__card-title">完全にランダム・完全に公平</div>
                <div className="solution__card-desc">サーバー側で暗号的乱数を使って決定。誰も文句を言えない。</div>
              </div>
            </div>
            <div className="solution__card">
              <div className="solution__card-icon">🔥</div>
              <div>
                <div className="solution__card-title">その場が確実に盛り上がる</div>
                <div className="solution__card-desc">ドキドキの演出、ニアミス効果、結果発表のビジュアルで場が湧く。</div>
              </div>
            </div>
            <div className="solution__card">
              <div className="solution__card-icon">📱</div>
              <div>
                <div className="solution__card-title">QRでみんなが参加</div>
                <div className="solution__card-desc">QRコードをスキャンするだけ。全員のスマホにルーレットが表示される。</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXPERIENCE */}
      <section className="experience">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--gold"}>体験</span>
          </div>
          <h2 className="section-title">ドキドキが<br /><span className="grad-text">記憶に残る体験</span>になる。</h2>
          <p className="section-sub">ルーレットが回る4.5秒間、全員が画面を見る。その瞬間が最高のエンタメ。</p>

          <div className="experience__steps">
            <div className="exp__step">
              <div className="exp__num">1</div>
              <div className="exp__content">
                <div className="exp__title">参加者の名前を入力する</div>
                <div className="exp__desc">ルーム作成かソロプレイ。QRで全員を招待してもOK。</div>
                <div className="exp__emoji">👥</div>
              </div>
            </div>
            <div className="exp__step">
              <div className="exp__num">2</div>
              <div className="exp__content">
                <div className="exp__title">SPINボタンを押す</div>
                <div className="exp__desc">カウントダウンが始まり、全員のスマホで同時にルーレットが回る。</div>
                <div className="exp__emoji">🎰</div>
              </div>
            </div>
            <div className="exp__step">
              <div className="exp__num">3</div>
              <div className="exp__content">
                <div className="exp__title">ドキドキの演出が流れる</div>
                <div className="exp__desc">減速するたびにカチカチ音。ニアミス演出で「惜しかった！」が連発。</div>
                <div className="exp__emoji">😱</div>
              </div>
            </div>
            <div className="exp__step">
              <div className="exp__num">4</div>
              <div className="exp__content">
                <div className="exp__title">「〇〇さんが奢り！」確定</div>
                <div className="exp__desc">紙吹雪と演出でお祝い。動画保存・SNSシェアもワンタップ。</div>
                <div className="exp__emoji">🎉</div>
              </div>
            </div>
          </div>

          <div className="experience__demo">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎊</div>
            <div style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>たろうさんが奢り確定！</div>
            <div style={{ fontSize: '14px', color: 'var(--c-muted)', marginBottom: '20px' }}>合計 ¥24,800 のうち ¥12,400 を奢り</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: 'var(--c-orange)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 700 }}>📹 動画保存</span>
              <span style={{ background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.3)', color: 'var(--c-pink)', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 700 }}>📤 シェアする</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--orange"}>機能</span>
          </div>
          <h2 className="section-title">どんなシーンにも<br />使える機能が揃ってる。</h2>

          <div className="features__grid">
            <div className="feature__card">
              <div className="feature__icon">🔗</div>
              <div className="feature__title">QRコード参加</div>
              <div className="feature__desc">スキャンだけでルームに入れる。アプリ不要。</div>
            </div>
            <div className="feature__card">
              <div className="feature__icon">💰</div>
              <div className="feature__title">金額設定</div>
              <div className="feature__desc">合計金額と奢り額を設定。割り勘計算も自動。</div>
            </div>
            <div className="feature__card">
              <div className="feature__icon">📹</div>
              <div className="feature__title">動画録画</div>
              <div className="feature__desc">ルーレットの瞬間を動画で保存。思い出になる。</div>
            </div>
            <div className="feature__card">
              <div className="feature__icon">📤</div>
              <div className="feature__title">SNSシェア</div>
              <div className="feature__desc">結果を一発でX/LINEに投稿できる。</div>
            </div>
            <div className="feature__card">
              <div className="feature__icon">📅</div>
              <div className="feature__title">履歴管理</div>
              <div className="feature__desc">過去の結果を振り返り。「俺ばっかり」が防げる。</div>
            </div>
            <div className="feature__card">
              <div className="feature__icon">👥</div>
              <div className="feature__title">グループ保存</div>
              <div className="feature__desc">いつものメンバーを保存。次回は即スタート。</div>
            </div>
          </div>

          <div className="features__highlight">
            <div className="features__highlight-icon">🔒</div>
            <div>
              <div className="features__highlight-title">サーバー側で公平に決定</div>
              <div className="features__highlight-desc">当選者は暗号的乱数でサーバーが決定。誰も操作できない本物の公平さ。</div>
            </div>
          </div>
        </div>
      </section>

      {/* SCENES */}
      <section className="scenes">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--pink"}>シーン</span>
          </div>
          <h2 className="section-title">どんな場でも<br />使えるから最強。</h2>

          <div className="scenes__list">
            <div className="scene__item">
              <div className="scene__emoji">🍻</div>
              <div>
                <div className="scene__title">飲み会・合コン</div>
                <div className="scene__desc">会計のタイミングで回すだけ。場が一気に盛り上がる鉄板コンテンツ。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🍱</div>
              <div>
                <div className="scene__title">社内ランチ・1on1</div>
                <div className="scene__desc">「どっちが払う？」をゲームに。チームの距離が縮まる。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🎉</div>
              <div>
                <div className="scene__title">打ち上げ・イベント後</div>
                <div className="scene__desc">盛り上がったその流れで、さらにドキドキを追加できる。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🎓</div>
              <div>
                <div className="scene__title">学生グループ・サークル</div>
                <div className="scene__desc">割り勘でも、誰かが多めに払う日でも。何でも使えるルーレット。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🏠</div>
              <div>
                <div className="scene__title">家族・友達との食事</div>
                <div className="scene__desc">「今日は誰かがサービス」という楽しみとして気軽に使える。</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="scenes">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--gold"}>使い方いろいろ</span>
          </div>
          <h2 className="section-title">奢り以外でも<br />使える。</h2>

          <div className="scenes__list">
            <div className="scene__item">
              <div className="scene__emoji">🎯</div>
              <div>
                <div className="scene__title">順番決め</div>
                <div className="scene__desc">発表順・掃除当番・プレゼン順を公平にランダムで決定。「じゃんけんが苦手」な人もすっきり。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🎮</div>
              <div>
                <div className="scene__title">罰ゲーム</div>
                <div className="scene__desc">ゲームの罰当て・ドリンクの種類決め・お題のランダム選出に。盛り上がること保証。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">📋</div>
              <div>
                <div className="scene__title">担当決め</div>
                <div className="scene__desc">当番・役割・リーダーをフェアに決定。「誰かが押し付けられた」という空気をゼロに。</div>
              </div>
            </div>
            <div className="scene__item">
              <div className="scene__emoji">🎁</div>
              <div>
                <div className="scene__title">プレゼント・サプライズ</div>
                <div className="scene__desc">誰がサプライズ幹事かを演出で発表。ルーレットで決まる瞬間が盛り上がりポイントに。</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUZZ */}
      <section className="buzz">
        <div className="buzz__bg"></div>
        <div className="container">

          <div className="buzz__center">
            <div className="section-label">
              <span className={"badge badge--gold"}>SNS反響</span>
            </div>
            <h2 className="section-title">「これ絶対バズる」<br /><span className="grad-text">と言われるレベルの体験。</span></h2>
            <div className="buzz__big">🔥🎰🔥</div>
          </div>

          <div className="buzz__quote">
            <div className="buzz__quote-text">ルーレットが回ってる間、全員が無言で画面見てたの草。結果発表の瞬間みんな叫んでて最高の飲み会だった。</div>
            <div className="buzz__quote-meta">🍺 飲み会にて — 20代グループ</div>
          </div>

          <div className="buzz__quote">
            <div className="buzz__quote-text">ジャンケンより全然盛り上がるし、何より公平だから文句が出ない。これ毎回使うやつだ。</div>
            <div className="buzz__quote-meta">🍽️ 社内ランチにて — 30代会社員</div>
          </div>

          <div className="buzz__quote">
            <div className="buzz__quote-text">動画撮って即シェアしたら友達グループで大バズりした。「なにこれ面白すぎ」って感じ。</div>
            <div className="buzz__quote-meta">🎊 打ち上げにて — 大学生グループ</div>
          </div>

          <div className="buzz__share">
            <div className="buzz__share-title">📣 シェアしたくなるタグ</div>
            <div className="buzz__share-tags">
              <span className="buzz__tag">#OgoRoulette</span>
              <span className="buzz__tag">#今日の奢り</span>
              <span className="buzz__tag">#飲み会</span>
              <span className="buzz__tag">#ルーレット</span>
              <span className="buzz__tag">#運命</span>
              <span className="buzz__tag">#バズる</span>
            </div>
          </div>
        </div>
      </section>

      {/* FREE PROMISE */}
      <section className="free">
        <div className="container">
          <div className="section-label">
            <span className={"badge badge--orange"}>安心</span>
          </div>
          <h2 className="section-title">完全無料。<br />面倒な手続き一切なし。</h2>

          <div className="free__points">
            <div className="free__point">
              <div className="free__point-icon">🆓</div>
              <div className="free__point-text">全機能 永久無料</div>
            </div>
            <div className="free__point">
              <div className="free__point-icon">📲</div>
              <div className="free__point-text">アプリインストール不要</div>
            </div>
            <div className="free__point">
              <div className="free__point-icon">👤</div>
              <div className="free__point-text">ログイン不要で即スタート</div>
            </div>
            <div className="free__point">
              <div className="free__point-icon">💳</div>
              <div className="free__point-text">クレカ登録なし · 広告なし</div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--c-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            ※ ログインすると履歴のクラウド保存・グループ保存など<br />さらに便利な機能が使えます（任意）
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="final-cta__bg"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="final-cta__title">
            次の飲み会、<br />
            <span className="grad-text">これで決めよう。</span>
          </h2>
          <p className="final-cta__sub">
            今すぐ開いて、仲間に送るだけ。<br />
            30秒後には全員のスマホでルーレットが回ってる。
          </p>
          <div className="final-cta__btns">
            <Link href="/home" className={"btn btn--primary"} style={{ width: '100%', maxWidth: '340px', fontSize: '19px', padding: '20px 32px' }}>
              🎰 今すぐ無料で使う
            </Link>
            <Link href="/room/create" className={"btn btn--outline"} style={{ width: '100%', maxWidth: '340px' }}>
              👥 みんなで回す（ルーム作成）
            </Link>
          </div>
          <div className="final-cta__note">
            ✓ 完全無料 &nbsp;·&nbsp; ✓ アプリ不要 &nbsp;·&nbsp; ✓ 今すぐ開始
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer__logo">
          <img width={28} height={28} src="/images/logo-icon.png" alt="OgoRoulette" style={{ borderRadius: '6px' }} />
          <span>Ogo<span className="grad-text">Roulette</span></span>
        </div>
        <p className="footer__tagline">今日の奢り、運命に任せろ。</p>
        <p className="footer__copy">© 2026 OgoRoulette · All rights reserved.</p>
      </footer>
    </>
  )
}
