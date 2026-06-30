import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'jimu-core'
import { Button, TextInput } from 'jimu-ui'
import { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'

const Sentinel = null

const Setting = (props: AllWidgetSettingProps<IMConfig>): React.ReactElement => {
  const [imageServiceUrl, setImageServiceUrl] = useState<string>('')
  const [zAdjustment, setZAdjustment] = useState<number>(0)

  useEffect(() => {
    setImageServiceUrl(props.config?.imageServiceUrl || '')
    setZAdjustment(Number(props.config?.zAdjustment ?? 0))
  }, [props.config?.imageServiceUrl, props.config?.zAdjustment])

  const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
    const mapWidgetId = useMapWidgetIds.length ? useMapWidgetIds[0] : Sentinel
    const config = {
      ...props.config,
      mapWidgetId,
      imageServiceUrl: Sentinel,
      zAdjustment: Sentinel
    }

    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
      config
    })
  }

  const onImageServerChange = (newValue: string) => {
    setImageServiceUrl(newValue)
  }

  const onZAdjustmentChange = (newValue: string) => {
    const parsedValue = Number.parseFloat(newValue)
    setZAdjustment(Number.isFinite(parsedValue) ? parsedValue : 0)
  }

  const onSaveUrl = () => {
    const config = {
      ...props.config,
      imageServiceUrl,
      zAdjustment
    }

    props.onSettingChange({
      id: props.id,
      config
    })
  }

  const selectedMapWidgetIds = props.useMapWidgetIds && props.config?.mapWidgetId
    ? props.useMapWidgetIds.filter((m) => m === props.config.mapWidgetId)
    : Sentinel

  return (
    <div className="bhp-elevation-rl-setting">
      <SettingSection>
        <SettingRow className="w-100" label={<FormattedMessage id="selectMapWidget" defaultMessage={defaultI18nMessages.selectMapWidget} />}>
          <MapWidgetSelector
            useMapWidgetIds={selectedMapWidgetIds}
            onSelect={onMapWidgetSelected}
            showLabel={false}
          />
        </SettingRow>
      </SettingSection>

      {props.config?.mapWidgetId && (
        <SettingSection>
          <SettingRow className="w-100" label={<FormattedMessage id="selectImageSource" defaultMessage={defaultI18nMessages.selectImageSource} />}>
            <TextInput
              allowClear
              className="w-100"
              type="text"
              value={imageServiceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onImageServerChange(e.target.value)}
              required
            />
          </SettingRow>

          <SettingRow>
            <Button onClick={onSaveUrl} size="default" type="primary">
              <FormattedMessage id="submit" defaultMessage={defaultI18nMessages.saveImageServerUrl} />
            </Button>
          </SettingRow>

          <SettingRow className="w-100" label={<FormattedMessage id="zAdjustment" defaultMessage={defaultI18nMessages.zAdjustment} />}>
            <TextInput
              allowClear
              className="w-100"
              type="text"
              value={`${zAdjustment}`}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onZAdjustmentChange(e.target.value)}
              required
            />
          </SettingRow>
        </SettingSection>
      )}
    </div>
  )
}

export default Setting
