# ISSUE-210: リテンション強化 — グループ再利用ショートカットと「また使いたい」フロー

## ステータス
📋 未着手

## 優先度
**Recommended** — AARRR-Retention が最弱ポイント（2/5）。アプリの継続利用率に直結。

## カテゴリ
UX / Retention / Growth

## 対象スコア
AARRR-Retention: +2 / HEART-Retention: +2 / 感情: +1

---

## 背景

OgoRoulette の AARRR-Retention スコアは 2/5（40点）で全指標最弱。
「また使いたい」と思ったとき、次回利用への導線が弱い。

現状の問題:
- スピン後に WinnerCard を閉じると「ホームに戻る」だけ
- 「このグループでまた使う」ボタンがない
- 通知・リマインドがない
- 「前回どのグループで使ったか」が起動時に見えない

---

## 問題

### ① 「また使いたい」気持ちが生まれた瞬間の導線がない

WinnerCard で「楽しかった！」ピークを迎えた直後、次のアクションが「閉じる」「ホーム」しかない。
「来週の飲み会でも使おう」という気持ちが蒸発する。

### ② ホーム画面で「続き」が見えない

`/home` に「最近使ったグループ」は存在するが、「ワンタップで同じメンバーで再スタート」できない。
QRコード作成 → グループ選択 → 確認 → スピンという多ステップが必要。

### ③ 通知がない

飲み会の幹事が「明日使う予定」でも、前日に思い出させる仕組みがない。
LINE や Web Push で「今日の飲み会、OgoRoulette で決める？」と送ることができない。

---

## 改善内容

### Step 1: WinnerCard 後の「次回予約」CTA

```tsx
// WinnerCard 最下部に追加
<div className="mt-4 border-t border-white/10 pt-4">
  <p className="text-xs text-muted-foreground mb-2">このグループでまた使う？</p>
  <Button
    variant="outline"
    onClick={() => saveGroupAndCreateRoom(participants)}
    className="w-full"
  >
    📌 このメンバーを保存して次回ショートカット
  </Button>
</div>
```

### Step 2: ホーム画面の「ワンタップ再開」

```tsx
// /home — 最近使ったグループの各カードに追加
<Button
  size="sm"
  onClick={() => createRoomWithGroup(group)}
  className="mt-2 w-full"
>
  ▶ このメンバーで今すぐ開始
</Button>
```

これにより: ホーム起動 → ワンタップ → ルーム作成 → QR共有 の3ステップに短縮。

### Step 3: スピン後の「LINE でシェア」にグループ招待リンクを含める

```
「今日は田中さんがおごり！OgoRoulette で決めたよ。
次回は → https://ogo-roulette.vercel.app/?group=abc123」
```

グループ URL でホームを開くと自動的にそのグループが選択された状態になる。

### Step 4: PWA ショートカット（Web App Manifest）

```json
// manifest.json
"shortcuts": [
  {
    "name": "最近のグループ",
    "url": "/home?tab=groups",
    "description": "最近使ったグループから始める"
  }
]
```

---

## 影響ファイル

- `components/winner-card.tsx` — 次回CTA追加
- `app/home/page.tsx` — ワンタップ再開ボタン追加
- `app/api/rooms/create/route.ts` — グループ指定でルーム作成
- `public/manifest.json` — shortcuts 追加

---

## 完了条件

- [ ] WinnerCard 最下部に「このメンバーを保存」CTA が表示される
- [ ] `/home` のグループカードに「今すぐ開始」ボタンが追加される
- [ ] ワンタップで同じメンバーのルームが作成されQRが表示される
- [ ] PWA manifest に shortcuts が追加される
- [ ] ユーザビリティテスト: 既存グループを使った2回目のセッション開始が1分以内に完了

## 期待スコア上昇

AARRR-Retention: +2（2→4/5） / HEART-Retention: +2 / 感情: +1
→ 総合: +3点
