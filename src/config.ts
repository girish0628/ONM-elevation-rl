import { ImmutableObject } from 'jimu-core'

export interface Config {
  /** The id of the selected map widget. */
  mapWidgetId?: string

  /** The ImageServer service URL endpoint. */
  imageServiceUrl?: string

  /** The format to display the date. */
  dateFormat?: string

  /** Adjustment value used for ADPH calculation. */
  zAdjustment?: number
}

export type IMConfig = ImmutableObject<Config>
