# ISSUE-135: 録画キャンバスをRetinaディスプレイ対応にする

## 概要

`components/recording-canvas.tsx` の Canvas 2D が `devicePixelRatio` を考慮しておらず、
Retina / HiDPI 環境で生成される動画がぼやけて見える問題を修正する。

---

## 背景

- Canvas は CSS サイズ (`width` / `height` 属性) とピクセルバッファが別物
- Retina では `window.devicePixelRatio` が 2〜3 になるため、論理 1px が物理 2〜3px 相当
- スケーリングなしでは Canvas バッファが論理サイズと同じ解像度 → 拡大表示でぼける
- 録画キャンバスは `position: fixed; left: -10000px` でオフスクリーン表示のため CSS影響なし

---

## 修正内容

### `components/recording-canvas.tsx`

```ts
// Before
canvas.width  = W
canvas.height = H

// After
const dpr = Math.min(window.devicePixelRatio || 1, 2)  // 最大2xにキャップ
canvas.width  = W * dpr
canvas.height = H * dpr
ctx.scale(dpr, dpr)
// 以降の描画コードはすべて論理サイズ (W, H) のまま変更不要
```

- `Math.min(..., 2)` で3x以上のデバイスの過剰レンダリングコストを抑制
- `ctx.scale(dpr, dpr)` により全描画関数は従来の論理座標で動作継続

---

## ステータス

✅ 完了（commit: 0830173）
