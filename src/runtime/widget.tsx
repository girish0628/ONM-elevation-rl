import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AllWidgetProps, AppMode, getAppStore, IMState, WidgetState } from 'jimu-core'
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

// Shrink ExB's floating panel container to 0×0 with overflow:visible so
// the chrome (title bar) is invisible but our portal-mounted overlays remain.
// Uses !important via setProperty to override ExB's inline size styles.
const minimiseExbPanel = (widgetRoot: HTMLElement) => {
  const applyTo = (el: HTMLElement) => {
    el.style.setProperty('width', '0', 'important')
    el.style.setProperty('height', '0', 'important')
    el.style.setProperty('min-width', '0', 'important')
    el.style.setProperty('min-height', '0', 'important')
    el.style.setProperty('max-width', 'none', 'important')
    el.style.setProperty('max-height', 'none', 'important')
    el.style.setProperty('overflow', 'visible', 'important')
    el.style.setProperty('background', 'transparent', 'important')
    el.style.setProperty('border', 'none', 'important')
    el.style.setProperty('box-shadow', 'none', 'important')
    el.style.setProperty('padding', '0', 'important')

    // Hide chrome siblings (title bar, resize handle, etc.)
    Array.from(el.children).forEach((child) => {
      const childEl = child as HTMLElement
      if (!childEl.contains(widgetRoot)) {
        childEl.style.setProperty('display', 'none', 'important')
      }
    })
  }

  // Walk up from the widget root looking for ExB's floating panel container.
  // ExB 1.18 uses classes like: float-layout-item, widget-mover, off-panel-widget.
  let el: HTMLElement | null = widgetRoot.parentElement
  let depth = 0
  let found = false

  while (el && el !== document.body && depth < 12) {
    const cls = (el.className ?? '') as string
    if (
      cls.includes('float-layout-item') ||
      cls.includes('widget-mover') ||
      cls.includes('off-panel') ||
      cls.includes('jimu-widget-placeholder')
    ) {
      applyTo(el)
      found = true
      break
    }
    el = el.parentElement
    depth++
  }

  // Fallback: if no class match, look for first absolutely-positioned ancestor
  // with a non-transparent background (i.e. a visible panel container).
  if (!found) {
    el = widgetRoot.parentElement
    depth = 0
    while (el && el !== document.body && depth < 6) {
      const computed = window.getComputedStyle(el)
      const pos = computed.position
      const bg = computed.backgroundColor
      const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      if ((pos === 'absolute' || pos === 'fixed') && hasBg) {
        applyTo(el)
        break
      }
      el = el.parentElement
      depth++
    }
  }
}

const Widget = (props: AllWidgetProps<IMConfig> & WidgetProps): React.ReactElement => {
  const [modalInfo, setModalInfo] = useState<MessageBoxInfo>()
  const [selectedMapPoint, setSelectedMapPoint] = useState<__esri.Point>()
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)

  const handles = useRef<__esri.Handles>(new Handles())
  const layerRef = useRef<__esri.GraphicsLayer>(new GraphicsLayer({ title: GraphicsLayerTitle, listMode: 'hide' }))
  const viewRef = useRef<__esri.MapView | __esri.SceneView>()
  const attachedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Show config warning once on mount (design mode excluded)
  useEffect(() => {
    if (getAppStore().getState().appRuntimeInfo.appMode === AppMode.Design) return

    if (!props.config?.imageServiceUrl) {
      setModalInfo({
        title: defaultI18nMessages.imageServiceUrlMissingTitle,
        message: defaultI18nMessages.imageServiceUrlMissingMessage
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Minimise ExB's floating panel container so only our portal overlay is visible.
  // Runs once on mount; uses !important to override ExB's stored inline sizes.
  useEffect(() => {
    if (rootRef.current) {
      minimiseExbPanel(rootRef.current)
    }
  }, [])

  // React to widget open/close — never call state setters directly in render body
  useEffect(() => {
    if (props.state === WidgetState.Opened) {
      onOpenWidget()
    } else if (props.state === WidgetState.Closed) {
      onCloseWidget()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onCloseWidget()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Convert view-relative click coords to viewport coords so the overlay
      // can be positioned near the click point.
      // e.x / e.y are pixels from the top-left of the ArcGIS view container.
      const rawContainer = viewRef.current?.container
      const containerEl: HTMLElement | null = typeof rawContainer === 'string'
        ? document.getElementById(rawContainer)
        : (rawContainer as HTMLElement | null) ?? null
      if (containerEl) {
        const rect = containerEl.getBoundingClientRect()
        const OFFSET = 18   // px gap between pin and panel
        const PANEL_W = 220 // approximate panel width for right-edge clamping
        const PANEL_H = 60  // approximate panel height for bottom-edge clamping
        const vpX = rect.left + e.x
        const vpY = rect.top + e.y
        setClickPos({
          x: Math.max(8, Math.min(vpX + OFFSET, window.innerWidth - PANEL_W - 8)),
          y: Math.max(8, Math.min(vpY + OFFSET, window.innerHeight - PANEL_H - 8))
        })
      }
    })

    handles.current?.add(clickHandle)
  }

  const onSelectAHD = async () => {
    if (!selectedMapPoint) return

    setShowTypeSelector(false)
    setClickPos(null)
    const text = await queryElevation(selectedMapPoint, 1, 'AHD')
    addTextGraphic(layerRef.current, selectedMapPoint, text)
  }

  const onSelectADPH = async () => {
    if (!selectedMapPoint) return

    setShowTypeSelector(false)
    setClickPos(null)
    const text = await queryElevation(selectedMapPoint, 1, 'ADPH')
    addTextGraphic(layerRef.current, selectedMapPoint, text)
  }

  const onCancelTypeSelector = () => {
    setShowTypeSelector(false)
    setClickPos(null)
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
    setClickPos(null)
    setSelectedMapPoint(undefined)
  }

  const onActiveViewChange = (jmv: JimuMapView) => {
    if (!jmv) return

    viewRef.current = jmv.view.type === '3d'
      ? jmv.view as __esri.SceneView
      : jmv.view as __esri.MapView

    // If the widget was already opened before the view loaded, attach handlers now
    const runtimeState = getAppStore().getState().widgetsRuntimeInfo?.[props.id]?.state
    if (runtimeState === WidgetState.Opened) {
      onOpenWidget()
    }
  }

  const onModalClose = () => {
    setModalInfo(undefined)
  }

  // When a click position is available, place the panel near the click point
  // (offset so it doesn't cover the pin).  bottom:'auto' resets the CSS default.
  const typeSelectorStyle: React.CSSProperties = clickPos
    ? { left: clickPos.x, top: clickPos.y, bottom: 'auto' }
    : {}

  // Overlay panels are mounted via React portal to document.body so they are
  // never clipped by ExB's panel container and are not affected by any CSS
  // transform stacking context that ExB may apply to the panel wrapper.
  const overlays = (
    <>
      {showTypeSelector && (
        <div className="bhp-elev-overlay" style={typeSelectorStyle}>
          <div className="btn-group">
            <button className="btn primary" onClick={onSelectADPH}>ADPH</button>
            <button className="btn primary" onClick={onSelectAHD}>AHD</button>
            <button className="btn secondary" onClick={onCancelTypeSelector}>Cancel</button>
          </div>
        </div>
      )}

      {modalInfo && (
        <div className="bhp-elev-overlay" style={{ maxWidth: modalInfo.maxWidth ?? 360 }}>
          <strong>{modalInfo.title}</strong>
          <div>{modalInfo.message}</div>
          <div style={{ marginTop: 8 }}>
            <button className="btn secondary" onClick={onModalClose}>Close</button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div ref={rootRef} className="bhp-elevation-rl">
      {props.config?.mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={props.config.mapWidgetId}
          onActiveViewChange={onActiveViewChange}
        />
      )}

      {/* Portal to body: escapes ExB's panel sizing, clipping, and transform context */}
      {typeof document !== 'undefined' && createPortal(overlays, document.body)}
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
