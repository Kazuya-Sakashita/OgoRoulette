import { redirect } from "next/navigation"

// /join (コードなし) → /scan にリダイレクト
// /join/[code] は別ルートで処理される
export default function JoinPage() {
  redirect("/scan")
}
