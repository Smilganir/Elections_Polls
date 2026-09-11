import { publicUrl } from '../utils/publicUrl'

const EMPTY_PORTRAIT_MASK = publicUrl('knesset-seat-empty-portrait.png')

export function KnessetSeatEmptyPortraitIcon({
  className = 'lpo-ps-knesset-seat-empty-portrait',
}: {
  className?: string
}) {
  return (
    <span
      className={className}
      style={{
        backgroundColor: '#2D333D',
        WebkitMaskImage: `url(${EMPTY_PORTRAIT_MASK})`,
        maskImage: `url(${EMPTY_PORTRAIT_MASK})`,
      }}
      aria-hidden
    />
  )
}
