import { Order, DashboardMetrics, Product } from './types'
import { format, formatDistanceToNow, isPast } from 'date-fns'

function stripDiacritics(s: string | undefined | null): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isDelivered(status: string): boolean {
  const st = stripDiacritics(status)
  return st === 'kiszallitva' || st.includes('kiszallitva')
}

export function calculateDashboardMetrics(
  orders: Order[]
): DashboardMetrics {
  const totalOrders = orders.length
  const pendingOrders = orders.filter(o => o.status === 'Felvéve').length
  const inProductionOrders = orders.filter(o => o.status === 'Folyamatban').length
  const readyForDeliveryOrders = orders.filter(o => o.ready === 'x' || o.ready === 'X').length
  const deliveredOrders = orders.filter(o => isDelivered(o.status)).length
  const invoicedOrders = orders.filter(o => o.invoiced === 'x' || o.invoiced === 'X').length

  return {
    totalOrders,
    pendingOrders,
    inProductionOrders,
    readyForDeliveryOrders,
    deliveredOrders,
    invoicedOrders,
  }
}

export function formatDate(date: string): string {
  if (!date) return ''
  return format(new Date(date), 'yyyy/MM/dd')
}

export function formatDateTime(date: string): string {
  if (!date) return ''
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

export function formatTimeAgo(date: string): string {
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate) return false
  return !isDelivered(status) && isPast(new Date(dueDate))
}

export function generateOwnOrderNumber(existingOrders: { ownOrderNumber: string }[]): string {
  const now = new Date()
  const year = now.getFullYear()
  const yearSuffix = String(year).slice(-2)
  
  const prefix = `M${yearSuffix}1`
  
  const currentYearOrders = existingOrders.filter(o => {
    const orderPrefix = o.ownOrderNumber.substring(0, 4)
    return orderPrefix === prefix
  })
  
  const maxSequence = currentYearOrders.reduce((max, order) => {
    const match = order.ownOrderNumber.match(/^M\d{2}1(\d+)$/)
    if (match) {
      const seq = parseInt(match[1], 10)
      return Math.max(max, seq)
    }
    return max
  }, 0)
  
  const nextSequence = maxSequence + 1
  
  if (nextSequence === 1) {
    return `${prefix}${nextSequence}`
  } else {
    return `${prefix}${String(nextSequence).padStart(3, '0')}`
  }
}



export function parseYear(dateStr: string): number | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return Number(m[3])

  m = s.match(/^(\d{4})([\/-]\d{1,2})?([\/-]\d{1,2})?$/)
  if (m) return Number(m[1])

  m = s.match(/(20\d{2}|19\d{2})/)
  if (m) return Number(m[1])

  return null
}

export function generateDeliveryNoteSequenceNumber(
  deliveryNotes: { sequenceNumber: string, type: string }[],
  type: 'delivery' | 'cmr'
): string {
  const prefix = type === 'delivery' ? 'SZL' : 'CMR'
  const now = new Date()
  const year = now.getFullYear()
  
  const sameTypeNotes = deliveryNotes.filter(note => note.type === type)
  
  const maxSequence = sameTypeNotes.reduce((max, note) => {
    const match = note.sequenceNumber.match(/^(SZL|CMR)(\d+)$/)
    if (match) {
      const seq = parseInt(match[2], 10)
      return Math.max(max, seq)
    }
    return max
  }, 0)
  
  const nextSequence = maxSequence + 1
  return `${prefix}${String(nextSequence).padStart(4, '0')}`
}
