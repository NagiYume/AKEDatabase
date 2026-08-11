export type UiTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export interface MetricItem {
  id: string
  label: string
  value: string | number
  description?: string
  tone?: UiTone
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface TabItem {
  value: string
  label: string
  disabled?: boolean
}

export type DrawerSide = 'left' | 'right'
