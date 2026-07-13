import { Suspense, lazy } from 'react'

const TrashView = lazy(() =>
  import('@/components/TrashView').then((m) => ({ default: m.TrashView })),
)

export default function LomtarPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4">Lomtár betöltése…</div>}>
      <TrashView />
    </Suspense>
  )
}
