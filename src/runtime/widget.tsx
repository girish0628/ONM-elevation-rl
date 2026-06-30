import React, { useEffect, useRef, useState } from 'react'
import { AllWidgetProps, AppMode, FormattedMessage, getAppStore, IMState, WidgetState } from 'jimu-core'
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import './style.css'
import { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'

import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Handles from '@arcgis/core/core/Handles'
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol'
import TextSymbol from '@arcgis/core/symbols/TextSymbol'
import IdentifyParameters from '@arcgis/core/rest/support/IdentifyParameters'
import { identify } from '@arcgis/core/rest/identify'

import pictureSymbol from './assets/esriRedPin_20x33.png'

const GraphicsLayerTitle = 'Elevation Currency Layer'

const Widget = (props: AllWidgetProps<IMConfig> & WidgetProps): React.ReactElement => {
  const [modalInfo, setModalInfo] = useState<MessageBoxInfo>()
  const [selectedMapPoint, setSelectedMapPoint] = useState<__esri.Point>()
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  const handles = useRef<__esri.Handles>(new Handles())
  const layerRef = useRef<__esri.GraphicsLayer>(new GraphicsLayer({ title: GraphicsLayerTitle, listMode: 'hide' }))
  const viewRef = useRef<__esri.MapView | __esri.SceneView>()
  const attachedRef = useRef(false)

  useEffect(() => {
    if (getAppStore().getState().appRuntimeInfo.appMode === AppMode.Design) return

    if (!props.config?.imageServiceUrl) {
      setModalInfo({
        title: defaultI18nMessages.imageServiceUrlMissingTitle,
        message: defaultI18nMessages.imageServiceUrlMissingMessage
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      onCloseWidget()
    }
  }, [])

  const showMessage = (title: string, message: string, maxWidth?: number) => {
    setModalInfo({ title, message, maxWidth })
  }

  const queryElevation = async (
    mapPoint: __esri.Point,
    tolerance: number,
    label: 'AHD' | 'ADPH'
  ): Promise<string> => {
    try {
      if (!props.config?.imageServiceUrl || !viewRef.current) {
        return `Z(${label}): `
      }

      const params = new IdentifyParameters({
        geometry: mapPoint,
        mapExtent: viewRef.current.extent,
        width: viewRef.current.width,
        height: viewRef.current.height,
        tolerance,
        returnGeometry: false,
        returnFieldName: true,
        returnUnformattedValues: true,
        layerOption: 'top'
      })

      const response = await identify(props.config.imageServiceUrl, params)
      const results = response?.results ?? []

      let rlText = `Z(${label}): `

      if (results.length > 0 && results[0].feature?.attributes) {
        const pixelValue = results[0].feature.attributes['Pixel Value']

        if (pixelValue !== undefined && pixelValue !== null && pixelValue !== '') {
          const num = Number(pixelValue)
          let rounded: number | string = Number.isFinite(num) ? Math.round(num * 10) / 10 : pixelValue

          if (label === 'ADPH' && typeof rounded === 'number') {
            rounded = Math.round((rounded + Number(props.config.zAdjustment ?? -3.155)) * 10) / 10
          }

          rlText = `${rlText}${rounded}m`
        }
      }

      return rlText
    } catch (err) {
      console.error(`Error in queryElevation ${label}:`, err)
      return `Z(${label}): `
    }
  }

  const getPictureMarkerSymbol = () => {
    return new PictureMarkerSymbol({
      url: pictureSymbol,
      width: '20px',
      height: '33px',
      yoffset: '16px'
    })
  }

  const addGraphic = (graphicsLayer: __esri.GraphicsLayer, mapPoint: __esri.Point) => {
    const graphic = new Graphic({
      geometry: mapPoint,
      symbol: getPictureMarkerSymbol(),
      attributes: {}
    })

    graphicsLayer.removeAll()
    graphicsLayer.add(graphic)
  }

  const addTextGraphic = (graphicsLayer: __esri.GraphicsLayer, mapPoint: __esri.Point, rlText: string) => {
    const textSymbol = new TextSymbol({
      text: rlText,
      color: 'black',
      font: {
        size: 12,
        family: 'sans-serif',
        weight: 'bold'
      },
      haloColor: 'white',
      haloSize: 1,
      yoffset: '43px'
    })

    const graphic = new Graphic({
      geometry: mapPoint,
      symbol: textSymbol,
      attributes: {}
    })

    graphicsLayer.add(graphic)
  }

  const addGraphicsLayer = (view: __esri.MapView | __esri.SceneView) => {
    const layer = view.map.layers.find((l) => l.title === GraphicsLayerTitle)
    if (!layer) {
      view.map.add(layerRef.current)
    }
  }

  const removeGraphicsLayer = (view?: __esri.MapView | __esri.SceneView) => {
    if (!view) return

    const layer = view.map.layers.find((l) => l.title === GraphicsLayerTitle)
    if (layer) {
      view.map.remove(layer)
    }
  }

  const detachHandles = () => {
    handles.current?.removeAll()
  }

  const attachHandles = (view: __esri.MapView | __esri.SceneView) => {
    detachHandles()

    const clickHandle = view.on('click', async (e: __esri.ViewClickEvent) => {
      if (e.button !== 0) return

      if (!props.config?.imageServiceUrl) {
        showMessage(
          defaultI18nMessages.configurationMissingTitle,
          defaultI18nMessages.configurationMissingMessage
        )
        return
      }

      addGraphic(layerRef.current, e.mapPoint)
      setSelectedMapPoint(e.mapPoint)
      setShowTypeSelector(true)
    })

    handles.current?.add(clickHandle)
  }

  const onSelectAHD = async () => {
    if (!selectedMapPoint) return

    setShowTypeSelector(false)
    const text = await queryElevation(selectedMapPoint, 1, 'AHD')
    addTextGraphic(layerRef.current, selectedMapPoint, text)
  }

  const onSelectADPH = async () => {
    if (!selectedMapPoint) return

    setShowTypeSelector(false)
    const text = await queryElevation(selectedMapPoint, 1, 'ADPH')
    addTextGraphic(layerRef.current, selectedMapPoint, text)
  }

  const onCancelTypeSelector = () => {
    setShowTypeSelector(false)
    setSelectedMapPoint(undefined)
    layerRef.current?.removeAll()
  }

  const onOpenWidget = () => {
    if (viewRef.current && !attachedRef.current) {
      addGraphicsLayer(viewRef.current)
      attachHandles(viewRef.current)
      attachedRef.current = true

      viewRef.current.closePopup()
      viewRef.current.popupEnabled = false
    }
  }

  const onCloseWidget = () => {
    if (attachedRef.current) {
      detachHandles()
      removeGraphicsLayer(viewRef.current)
      attachedRef.current = false

      if (viewRef.current) {
        viewRef.current.popupEnabled = true
      }
    }

    setShowTypeSelector(false)
    setSelectedMapPoint(undefined)
  }

  const onActiveViewChange = (jmv: JimuMapView) => {
    if (jmv) {
      viewRef.current = jmv.view.type === '3d'
        ? jmv.view as __esri.SceneView
        : jmv.view as __esri.MapView

      const widgetRuntimeInfo = getAppStore().getState().widgetsRuntimeInfo?.[props.id]?.state
      if (widgetRuntimeInfo === WidgetState.Opened) {
        onOpenWidget()
      }
    }
  }

  const onModalClose = () => {
    setModalInfo(undefined)
  }

  const widgetRuntimeInfo = getAppStore().getState().widgetsRuntimeInfo?.[props.id]?.state
  if (widgetRuntimeInfo === WidgetState.Opened) {
    onOpenWidget()
  } else if (widgetRuntimeInfo === WidgetState.Closed) {
    onCloseWidget()
  }

  return (
    <div className="bhp-elevation-rl">
      {props.config?.mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={props.config.mapWidgetId}
          onActiveViewChange={onActiveViewChange}
        />
      )}

      <FormattedMessage id="displayMessage" defaultMessage={defaultI18nMessages.displayMessage} />

      {showTypeSelector && (
        <div className="elevation-panel">
          <div className="btn-group">
            <button className="btn primary" onClick={onSelectADPH}>ADPH</button>
            <button className="btn primary" onClick={onSelectAHD}>AHD</button>
            <button className="btn secondary" onClick={onCancelTypeSelector}>Cancel</button>
          </div>
        </div>
      )}

      {modalInfo && (
        <div className="elevation-panel" style={{ maxWidth: modalInfo.maxWidth ?? 360 }}>
          <strong>{modalInfo.title}</strong>
          <div>{modalInfo.message}</div>
          <div style={{ marginTop: 8 }}>
            <button className="btn secondary" onClick={onModalClose}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

Widget.mapExtraStateProps = (state: IMState): WidgetProps => {
  return {
    locale: state.appContext.locale
  }
}

export default Widget

interface WidgetProps {
  locale: string
}

interface MessageBoxInfo {
  title: string
  message: string
  maxWidth?: number
}
