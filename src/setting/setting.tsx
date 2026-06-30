import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'jimu-core'
import { Button, Label, TextInput } from 'jimu-ui'
import { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'
import '../runtime/style.css'

// Inline writingMode on every label element is the only reliable way to override
// ExB sidebar's inherited writing-mode:vertical-rl.

const Sentinel = null

const labelStyle: React.CSSProperties = {
  display: 'block',
  writingMode: 'horizontal-tb',
  textOrientation: 'mixed',
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--ref-palette-neutral-1100, #191919)'
}

const rowStyle: React.CSSProperties = {
  writingMode: 'horizontal-tb',
  textOrientation: 'mixed',
  width: '100%'
}

const Setting = (props: AllWidgetSettingProps<IMConfig>): React.ReactElement => {
  const [imageServiceUrl, setImageServiceUrl] = useState<string>('')
  const [zAdjustment, setZAdjustment] = useState<number>(0)

  useEffect(() => {
    setImageServiceUrl(props.config?.imageServiceUrl || '')
    setZAdjustment(Number(props.config?.zAdjustment ?? 0))
  }, [props.config?.imageServiceUrl, props.config?.zAdjustment])

  const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
    const mapWidgetId = useMapWidgetIds.length ? useMapWidgetIds[0] : Sentinel
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
      config: {
        ...props.config,
        mapWidgetId,
        imageServiceUrl: Sentinel,
        zAdjustment: Sentinel
      }
    })
  }

  const onSaveUrl = () => {
    props.onSettingChange({
      id: props.id,
      config: {
        ...props.config,
        imageServiceUrl,
        zAdjustment
      }
    })
  }

  const selectedMapWidgetIds = props.useMapWidgetIds && props.config?.mapWidgetId
    ? props.useMapWidgetIds.filter((m) => m === props.config.mapWidgetId)
    : Sentinel

  // Outer div resets writing-mode for all descendants as a belt-and-suspenders
  return (
    <div style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}>

      <SettingSection>
        {/* Label rendered manually — avoids SettingRow's label column inheriting writing-mode */}
        <SettingRow>
          <div style={rowStyle}>
            <Label style={labelStyle}>
              <FormattedMessage id="selectMapWidget" defaultMessage={defaultI18nMessages.selectMapWidget} />
            </Label>
            <MapWidgetSelector
              useMapWidgetIds={selectedMapWidgetIds}
              onSelect={onMapWidgetSelected}
              showLabel={false}
            />
          </div>
        </SettingRow>
      </SettingSection>

      {props.config?.mapWidgetId && (
        <SettingSection>

          <SettingRow>
            <div style={rowStyle}>
              <Label style={labelStyle}>
                <FormattedMessage id="selectImageSource" defaultMessage={defaultI18nMessages.selectImageSource} />
              </Label>
              <TextInput
                allowClear
                style={{ width: '100%' }}
                type="text"
                value={imageServiceUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageServiceUrl(e.target.value)}
                required
              />
            </div>
          </SettingRow>

          <SettingRow>
            <div style={rowStyle}>
              <Label style={labelStyle}>
                <FormattedMessage id="zAdjustment" defaultMessage={defaultI18nMessages.zAdjustment} />
              </Label>
              <TextInput
                allowClear
                style={{ width: '100%' }}
                type="text"
                value={`${zAdjustment}`}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const parsed = Number.parseFloat(e.target.value)
                  setZAdjustment(Number.isFinite(parsed) ? parsed : 0)
                }}
                required
              />
            </div>
          </SettingRow>

          <SettingRow>
            <Button onClick={onSaveUrl} size="default" type="primary" style={{ width: '100%' }}>
              <FormattedMessage id="submit" defaultMessage={defaultI18nMessages.saveImageServerUrl} />
            </Button>
          </SettingRow>

        </SettingSection>
      )}
    </div>
  )
}

export default Setting
