interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ values, width = 96, height = 28, className }: SparklineProps) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const pad = 2
  const points = values.map(
    (v, i) => [i * step, height - pad - (v / max) * (height - pad * 2)] as const,
  )
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const empty = values.every((v) => v === 0)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {!empty && <polygon points={area} className="fill-primary/10" />}
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={empty ? 'stroke-muted-foreground/30' : 'stroke-primary'}
      />
    </svg>
  )
}
