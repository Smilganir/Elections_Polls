import { useState } from 'react'
import { publicUrl } from '../utils/publicUrl'

type IconWithFallbackProps = {
  src?: string
  label: string
}

export function IconWithFallback({ src, label }: IconWithFallbackProps) {
  const [broken, setBroken] = useState(false)

  if (!src || broken) {
    return <span className="icon-fallback">{label.slice(0, 2)}</span>
  }

  return (
    <img
      src={publicUrl(src)}
      alt={label}
      className="mapped-icon"
      onError={() => setBroken(true)}
    />
  )
}
