import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-6xl font-black text-foreground mb-2">404</h1>
        <h2 className="text-xl font-bold text-foreground mb-3">ページが見つかりません</h2>
        <p className="text-sm text-muted-foreground mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </p>

        <Button
          asChild
          className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent text-primary-foreground"
        >
          <Link href="/">ホームに戻る</Link>
        </Button>
      </div>
    </main>
  )
}
