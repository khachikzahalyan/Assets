export interface LoadingStateProps {
  rows?: number
}

export function LoadingState({ rows = 6 }: LoadingStateProps) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-[#1B1F24] border border-[#2A2F36] rounded-lg">
          <div className="w-9 h-9 rounded-md anim-skeleton flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded anim-skeleton" />
            <div className="h-2.5 w-3/5 rounded anim-skeleton" />
          </div>
          <div className="w-20 h-5 rounded anim-skeleton" />
        </div>
      ))}
    </div>
  )
}
