# ISSUE-085: jsQR 導入と QrScanner コンポーネント実装

**ステータス:** 実装済み
**優先度:** High
**前提:** ISSUE-084（QRコード実装戦略）承認

## 概要

`jsQR` ライブラリを使い、`getUserMedia()` + Canvas ループでリアルタイムQRスキャンを行う
`QrScanner` コンポーネントを実装する。

## 実装内容

**ファイル:** `components/qr-scanner.tsx`（新規）

- `jsQR@1.4.0` パッケージ追加
- `useRef<HTMLVideoElement>` + `useRef<HTMLCanvasElement>` でプレビューとデコードを分離
- `getUserMedia({ video: { facingMode: "environment" } })` でリアカメラ取得
- `requestAnimationFrame` ループで毎フレーム Canvas に描画 → `jsQR` でデコード
- 成功時: `onScan(code)` コールバック + カメラストリーム停止
- エラー種別: `NotAllowedError`（権限拒否）/ `NotFoundError`（カメラなし）/ その他
- アンマウント時に必ずカメラストリームを停止

## インターフェース

```tsx
interface QrScannerProps {
  onScan: (code: string) => void
  onError?: (error: "permission_denied" | "no_camera" | "unknown") => void
  active?: boolean  // false のときカメラを停止
}
```
