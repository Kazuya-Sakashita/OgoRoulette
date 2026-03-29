# ISSUE-084: QRコード読み取り機能のモバイル実装戦略

**ステータス:** 計画中
**優先度:** Medium
**関連:** ISSUE-025（QRカメラスタブ）、ISSUE-064（ロビーQRコードビジュアル）

---

## 1. 問題整理：iPhone / Android の実装差

### 現状

`/scan` ページのQRスキャンモードはプレースホルダーのみ。カメラ・デコードの実装はゼロ。
手動コード入力（`/scan` マニュアルモード）は動作済み。

### ブラウザ API 対応表

| API / 機能 | iPhone Safari | iPhone Chrome | Android Chrome | Android Firefox |
|---|---|---|---|---|
| `getUserMedia()` (カメラ取得) | ✅ iOS 11+ | ✅ (Safari WebKit) | ✅ | ✅ |
| `BarcodeDetector` | ❌ 未対応 | ❌ 未対応 | ✅ Chrome 83+ | ❌ |
| `<input type="file" capture>` | ✅ | ✅ | ✅ | ✅ |
| Web Workers (JSデコード) | ✅ | ✅ | ✅ | ✅ |

**最大の課題:** `BarcodeDetector` は Android Chrome のみ。iOS Safari/Chrome は非対応。
JSライブラリによるデコードが iOS では唯一のリアルタイムスキャン手段。

### HTTPS 要件

`getUserMedia()` はセキュアコンテキスト必須。`ogo-roulette.vercel.app` は HTTPS なので本番で問題なし。
ローカル開発は `localhost` で例外扱いのため問題なし。

### iOS 固有の挙動

- カメラ権限ダイアログは iOS が制御。再許可は「設定アプリ」から手動操作が必要。
- `<input capture="environment">` で写真アプリ経由のQR読み取りも可能（リアルタイムではない）。
- iOS 16.4+ の Safari ではカメラプレビューの `<video>` 表示にユーザージェスチャーが必要。

---

## 2. 実装案比較

### A案：共通 JS ライブラリ（全端末対応）

**概要:** `jsQR` または `zxing-js/library` を使い、`getUserMedia()` で映像を取得、Canvas に描画して毎フレームデコード。`BarcodeDetector` は使わない。

| 評価軸 | 内容 |
|---|---|
| iOS対応 | ✅ Safari/Chrome 共に動作 |
| Android対応 | ✅ Chrome/Firefox 共に動作 |
| 実装コスト | 中（ライブラリ導入 + Canvasループ実装） |
| バンドルサイズ | +20〜60KB（gzip） |
| スキャン速度 | 中程度（60〜200ms/フレーム） |
| 安定性 | 高（ライブラリは枯れている） |
| UX | リアルタイムプレビュー可 |

**リスク:** `jsQR` はメンテナンスが低下気味。`zxing-js` は大きい。`@zxing/browser` は軽量版あり。

---

### B案：端末別最適化（ハイブリッド）

**概要:** Android Chrome では `BarcodeDetector`、iOS では `jsQR` / `@zxing/browser`。
`BarcodeDetector` は OS レベルのデコーダーで高速・省電力。

| 評価軸 | 内容 |
|---|---|
| iOS対応 | ✅（JSフォールバック） |
| Android対応 | ✅ BarcodeDetector（高速） |
| 実装コスト | 高（条件分岐 + 2系統のコード管理） |
| バンドルサイズ | +20〜60KB（Android では動的インポートで削減可） |
| スキャン速度 | Android: 高速（OS処理）/ iOS: 中程度 |
| 安定性 | 中（分岐バグのリスク） |
| UX | Android で体験が良い |

**リスク:** 分岐ロジックの複雑化。テストマトリクスが倍増。

---

### C案：OS カメラアプリへの委譲（フォールバック重視）

**概要:** `<input type="file" capture="environment" accept="image/*">` で写真撮影させ、画像ファイルをデコード。リアルタイムスキャンはしない。

| 評価軸 | 内容 |
|---|---|
| iOS対応 | ✅ |
| Android対応 | ✅ |
| 実装コスト | 低 |
| バンドルサイズ | 最小 |
| スキャン速度 | 遅い（撮影 → 確認 → デコード） |
| 安定性 | 高 |
| UX | 悪い（リアルタイム感なし） |

**用途:** メインフローには不向き。権限拒否時のフォールバックとして使える。

---

### D案：3段構え（A案 + C案 + 手動入力）

**概要:**
1. `getUserMedia()` + `jsQR` でリアルタイムスキャン（メイン）
2. 権限拒否 / 未対応なら `<input capture>` で静止画スキャン
3. それも失敗なら手動入力誘導

| 評価軸 | 内容 |
|---|---|
| iOS対応 | ✅ |
| Android対応 | ✅ |
| 実装コスト | 高（3段のフォールバック） |
| バンドルサイズ | +20〜60KB |
| スキャン速度 | 段階依存 |
| 安定性 | 最高（ゼロ詰まり） |
| UX | 段階ごとに説明が必要 |

---

## 3. 推奨案（結論）

**A案（共通 JS ライブラリ）+ 手動入力フォールバック**

### 理由

1. **実装パスが1本.** B案の端末分岐は今後のメンテコストが高い。OgoRoulette のフロントエンドは1人〜少人数で維持するため、コードパスを増やさない方針が合理的。
2. **`jsQR` は実績あり.** 軽量（~23KB gzip）、依存ゼロ、Canvas ループとの相性が良い。`BarcodeDetector` の恩恵（高速）は体験上の差が小さい。
3. **手動入力はすでに動いている.** 権限拒否・非対応環境では既存の手動タブへ誘導するだけ。追加の `<input capture>` フォールバックは不要。

### ライブラリ選定

```
jsQR@1.4.0
```
- 23KB gzip、依存ゼロ
- Canvas ImageData を直接受け取る API
- 最後のリリース: 2021年（安定・変化なし）
- 代替: `@zxing/browser`（ライセンス Apache2、より高機能だが大きい）

---

## 4. 端末別方針

### iPhone Safari / Chrome

```
getUserMedia({ video: { facingMode: "environment" } })
  → <video> プレビュー
  → requestAnimationFrame ループ
  → Canvas.drawImage() → getImageData()
  → jsQR(data, width, height)
  → コード検出 → /join/[code] へ遷移
```

- `playsinline` 属性が必須（フルスクリーン化防止）
- カメラ権限は `navigator.permissions.query({ name: "camera" })` で事前確認可（iOS 16+）
- 権限拒否後の再許可はアプリ側では不可。設定アプリへの誘導テキストのみ。

### Android Chrome

iPhone と同一コードで動作。`BarcodeDetector` は使わない（A案の方針）。

---

## 5. フォールバック仕様

### ケース別の動作

| 状況 | 挙動 |
|---|---|
| `getUserMedia` 未対応 | スキャンタブを非表示または disabled、手動タブをデフォルト表示 |
| カメラ権限 `denied` | 「カメラへのアクセスが拒否されています」+ 設定アプリへの誘導テキスト表示 |
| カメラ権限 `prompt`（未決定） | 通常フロー（getUserMedia 呼び出しでダイアログ） |
| スキャン5秒間失敗 | 「うまく読み取れませんか？」→ 手動入力タブへ誘導バナー表示 |
| QR解読成功だが inviteCode が不正 | 「無効なQRコードです」エラートースト（コードをデコードせず） |
| ストリーム取得成功後にカメラ切断 | `onerror` → エラー表示 + 再試行ボタン |

### 権限拒否時の UI テキスト

```
カメラへのアクセスが許可されていません。
設定アプリ > Safari（またはChrome）> カメラ から許可してください。
または、コード入力タブからルームに参加できます。
```

---

## 6. UX仕様

### レイアウト

```
[QRスキャン] [コード入力]  ← 既存のトグル、変更なし

┌─────────────────────────┐
│  ██████████████████████ │  ← <video> プレビュー（正方形）
│  █                    █ │
│  █   [ スキャン枠 ]   █ │  ← オーバーレイ（四隅の角線）
│  █                    █ │
│  ██████████████████████ │
└─────────────────────────┘
  QRコードをカメラに向けてください

  ─────────── または ───────────

  [コードを手動で入力する →]   ← テキストリンク
```

### スキャン成功時

- カメラを即停止（`track.stop()`）
- バイブレーション（`navigator.vibrate(200)` if available）
- `/join/[code]` へ `router.push()`（確認ステップなし、即遷移）

### スキャン中の状態表示

- ローディング中（getUserMedia 待ち）: スピナー
- スキャン中: 枠線アニメーション（pulse）
- エラー状態: 赤枠 + エラーメッセージ

### コンポーネント配置

```
app/scan/page.tsx
  └── QrScanner コンポーネント（新規）
        - getUserMedia / jsQR ロジックをここに集約
        - onScan(code: string) コールバックで親に通知
```

---

## 7. 実装タスク案

### ISSUE-085: jsQR 導入と QrScanner コンポーネント実装

**ファイル:** `components/qr-scanner.tsx`（新規）

```tsx
interface QrScannerProps {
  onScan: (code: string) => void
  onError?: (error: string) => void
}
```

- `jsQR` パッケージ追加
- `useRef<HTMLVideoElement>` + `useRef<HTMLCanvasElement>`
- `getUserMedia` 呼び出し + permission チェック
- `requestAnimationFrame` ループ + `jsQR` デコード
- コンポーネントアンマウント時にカメラストリーム停止

---

### ISSUE-086: /scan ページへの QrScanner 統合

**ファイル:** `app/scan/page.tsx`

- プレースホルダー削除
- `<QrScanner onScan={(code) => router.push(\`/join/\${code}\`)} />` に置き換え
- 権限拒否・未対応の場合はエラーメッセージ表示 + 手動タブへのリンク
- 5秒タイマーで手動入力誘導バナー表示

---

### ISSUE-087: カメラ権限拒否 UI

**ファイル:** `components/qr-scanner.tsx` 内エラー状態

- `NotAllowedError` をキャッチして「設定から許可を」テキスト表示
- `NotFoundError`（カメラなし端末）をキャッチして手動タブへ誘導
- スキャンタブ選択時のみ `getUserMedia` を呼ぶ（ページ開いた瞬間に権限要求しない）

---

## 8. 検証計画

### テスト端末・環境

| 端末 | ブラウザ | テスト内容 |
|---|---|---|
| iPhone 15 / iOS 17 | Safari | 通常スキャン、権限拒否、再試行 |
| iPhone 15 / iOS 17 | Chrome | 同上 |
| Android (Pixel 7 / Chrome) | Chrome | 通常スキャン、権限拒否 |
| MacBook (開発) | Chrome | localhost での動作確認 |

### テストシナリオ

1. **正常系:** QRコードをカメラに向ける → 自動検出 → `/join/[code]` 遷移
2. **権限拒否:** 権限を事前に拒否 → エラーUI表示 → 設定誘導テキスト確認
3. **手動誘導:** 5秒間QRを向けない → 手動入力バナーが出ることを確認
4. **不正QR:** 無関係なQRコードをスキャン → エラートースト確認
5. **タブ切替:** スキャン → 手動 → スキャン で再度カメラが起動することを確認
6. **ページ離脱:** スキャン中にブラウザバック → カメラが停止することを確認

---

## 9. Issue化候補

| Issue番号 | タイトル | 優先度 | 前提 |
|---|---|---|---|
| ISSUE-085 | jsQR 導入と QrScanner コンポーネント実装 | High | 本 Issue の承認後 |
| ISSUE-086 | /scan ページへの QrScanner 統合 | High | ISSUE-085 完了後 |
| ISSUE-087 | カメラ権限拒否・未対応 UI | Medium | ISSUE-086 と同時実装可 |

### 実装順序

```
ISSUE-084（本計画承認）
  → ISSUE-085（QrScanner コンポーネント）
  → ISSUE-086（/scan 統合） + ISSUE-087（エラー UI） ← 同時実装
```

---

## 参考

- [jsQR GitHub](https://github.com/cozmo/jsQR)
- [BarcodeDetector MDN](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) — Android Chrome のみ
- [getUserMedia MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- iOS Safari での `playsinline` 要件: [WebKit Blog](https://webkit.org/blog/6784/new-video-policies-for-ios/)
