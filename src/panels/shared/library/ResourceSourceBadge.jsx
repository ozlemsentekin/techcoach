import Badge from '../../ui/Badge'
import { RESOURCE_SOURCE_LABELS } from './libraryConstants'

export default function ResourceSourceBadge({ source }) {
  if (!source) return null
  return <Badge tone={source === 'okul' ? 'blue' : 'neutral'}>{RESOURCE_SOURCE_LABELS[source] || source}</Badge>
}
