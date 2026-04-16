# ISSUE-262: Security — セキュリティ対策ロードマップ

## ステータス
📋 計画

## カテゴリ
Security / Roadmap / Planning

---

## 概要

OgoRoulette のセキュリティ対策の優先順位と今後のロードマップ。
第1〜4回の監査結果を統合した、実務レベルの対応計画。

---

## Phase 1: 即時対応（〜1週間）

### P1-1: セキュリティヘッダ追加（ISSUE-257）
- **影響**: Clickjacking 防止・将来の XSS 対策強化
- **工数**: 30分
- **ファイル**: `next.config.mjs`

```javascript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }]
}
```

### P1-2: LINE OAuth metadata 更新を blocking 化（ISSUE-258）
- **影響**: ユーザープロフィールの整合性保証
- **工数**: 15分
- **ファイル**: `app/api/auth/line/callback/route.ts`

---

## Phase 2: 短期対応（〜1ヶ月）

### P2-1: result URL パラメータのバリデーション（ISSUE-259）
- 名前 20文字制限・人数 20名制限・金額範囲チェック

### P2-2: CSP（Content Security Policy）の段階的導入
- script-src / style-src / img-src から段階的に追加
- Next.js の `<Script>` コンポーネントとの調整が必要

### P2-3: Supabase RLS 有効化の検討
- 現在は API 経由のみでデータアクセスするため不要だが、将来の Server Components 追加時にリスクが高まる
- Row Level Security を Supabase 側で設定することで多重防御が可能

---

## Phase 3: 中長期対応（〜3ヶ月）

### P3-1: セキュリティログ基盤の整備
- 現在の `console.error` ではなく、Sentry 等の外部サービスへの統合
- エラーレートの可視化・アラート設定

### P3-2: ゲストルームのセッション履歴アクセス制御（ISSUE-250 追加対応）
- ルームコードを知っているだけで当選履歴が取得できる設計の再評価
- 会員登録後のみ履歴を表示する設計変更 or rate limit 強化

### P3-3: 依存ライブラリの定期更新フロー確立
- Dependabot の設定
- マイナーバージョンアップを月次で実施
- セキュリティパッチのみ即時適用

---

## CI に入れるべきセキュリティ対策

現在 `.github/workflows/security.yml` で実施中：

```yaml
# 実施済み
- dependency-audit: pnpm audit --audit-level=high  ✅
- secret-scan: TruffleHog OSS  ✅
- security-headers: curl で本番 URL を確認  ✅
- lint-security: ESLint  ✅
```

追加推奨：

```yaml
# 追加すべき
- name: Check security headers (strict)
  run: |
    for header in "x-frame-options" "x-content-type-options" "referrer-policy"; do
      if ! curl -sI https://ogo-roulette.vercel.app/ | grep -qi "$header"; then
        echo "❌ Missing header: $header"
        exit 1  # CI を失敗させる
      fi
    done

- name: Check for dangerouslySetInnerHTML (user data)
  run: |
    # user-controlled data を dangerouslySetInnerHTML に渡している箇所を検出
    rg "dangerouslySetInnerHTML.*params\|dangerouslySetInnerHTML.*user\|dangerouslySetInnerHTML.*input" app/ --type tsx || true
```

---

## 再監査タイミング

| タイミング | 理由 |
|-----------|------|
| Phase 1 対応後（1週間後） | ヘッダ追加の副作用確認 |
| 月次 | 依存ライブラリの脆弱性確認（CI で自動化） |
| 新機能追加時 | Server Components / 新 API route 追加時 |
| 半年後 | 全体的な再評価 |

---

## セキュリティ成熟度の推移

| 時期 | スコア | 主な改善 |
|------|--------|---------|
| 初回監査前 | 推定 60 | 基本的な認証・認可はあったが多くの欠陥 |
| ISSUE-244〜251 修正後 | 82 | サニタイズ・HMAC・IP fix・レート制限 |
| ISSUE-252〜256 修正後 | 90 | Cookie secure / スタックトレース / 一貫性 |
| 第4回監査時点 | **91** | 安定。残件は High 1・Medium 1・Low 2 |
| Phase 1 対応後（予測） | **95** | セキュリティヘッダ追加で Clickjacking 解消 |
