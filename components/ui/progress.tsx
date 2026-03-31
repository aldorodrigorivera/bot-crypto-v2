"use client"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: {
  className?: string
  value?: number | null
} & React.HTMLAttributes<HTMLDivElement>) {
  const clamped = value == null ? 0 : Math.min(100, Math.max(0, value))

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("relative w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
