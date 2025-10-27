import { defineStore } from 'pinia'
import { type SrReqParamsState } from '@/types/SrReqParamsState'
import type { AtlReqParams, AtlxxReqParams, SrRegion, SrSurfaceFit } from '@/types/SrTypes'
import { type SrListNumberItem, type Atl13Coord } from '@/types/SrTypes'
import { calculatePolygonArea } from '@/composables/SrTurfUtils'
import { convertTimeFormat } from '@/utils/parmUtils'
import { db } from '@/db/SlideRuleDb'
import { convexHull, regionFromBounds } from '@/composables/SrTurfUtils'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { type ApiName, isValidAPI, type SrMultiSelectNumberItem } from '@/types/SrTypes'
import { type Icesat2ConfigYapc } from '@/types/slideruleDefaultsInterfaces'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
import { useGeoJsonStore } from './geoJsonStore'
import { useChartStore } from '@/stores/chartStore'
import { useRasterParamsStore } from '@/stores/rasterParamsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ReqParamsStore')
import {
  distanceInOptions,
  surfaceReferenceTypeOptions,
  awsRegionOptions,
  iceSat2APIsItems,
  gediAPIsItems,
  atl24_class_ph_Options,
  OnOffOptions,
  geoLocationOptions,
  signalConfidenceNumberOptions,
  qualityPHOptions
} from '@/types/SrStaticOptions'

export function getDefaultReqParamsState(): SrReqParamsState {
  return {
    missionValue: 'ICESat-2' as string,
    iceSat2SelectedAPI: 'atl03x-surface' as string,
    gediSelectedAPI: 'gedi01bp' as string,
    using_worker: false,
    isFeatherStream: false,
    rasterizePolyCellSize: 0.01,
    ignorePolygon: false,
    poly: null as SrRegion | null,
    convexHull: null as SrRegion | null,
    areaOfConvexHull: 0.0 as number,
    urlValue: 'slideruleearth.io',
    enableGranuleSelection: false,
    tracks: [] as SrListNumberItem[],
    selectAllTracks: false,
    beams: [] as SrListNumberItem[],
    selectAllBeams: false,
    useRGT: false,
    rgtValue: 1,
    useCycle: false,
    cycleValue: 1,
    useRegion: false,
    regionValue: 1,
    useTime: false,
    gpsToUTCOffset: 18,
    minDate: new Date('2018-10-01T00:00:00Z'),
    t0Value: new Date('2018-10-01T00:00:00Z'),
    t1Value: new Date(),
    useServerTimeout: false,
    serverTimeoutValue: 601,
    useReqTimeout: false,
    reqTimeoutValue: 601,
    useNodeTimeout: false,
    nodeTimeoutValue: 601,
    useReadTimeout: false,
    readTimeoutValue: 601,
    useLength: false,
    lengthValue: 40,
    useStep: false,
    stepValue: 20,
    confidenceValue: 4,
    iterationsValue: 6,
    spreadValue: 20.0,
    PE_CountValue: 10,
    windowValue: 3.0,
    enableAtl03Classification: false,
    surfaceReferenceType: [surfaceReferenceTypeOptions[0]] as SrMultiSelectNumberItem[],
    signalConfidence: [
      signalConfidenceNumberOptions[4],
      signalConfidenceNumberOptions[5],
      signalConfidenceNumberOptions[6]
    ],
    qualityPH: [qualityPHOptions[0]] as SrMultiSelectNumberItem[],
    enableAtl08Classification: false,
    atl08LandType: [] as string[],
    distanceIn: distanceInOptions[0], // { label: 'meters', value: 'meters' },
    passInvalid: false,
    useAlongTrackSpread: false,
    alongTrackSpread: -1.0,
    useMinimumPhotonCount: false,
    minimumPhotonCount: -1,
    useSurfaceFitAlgorithm: true, // start with this on
    maxIterations: -1,
    useMaxIterations: false,
    minWindowHeight: -1.0,
    useMinWindowHeight: false,
    maxRobustDispersion: -1,
    useMaxRobustDispersion: false,
    enablePhoReal: false,
    usePhoRealGeoLocation: false,
    phoRealGeoLocation: geoLocationOptions[0], // 'mean'
    usePhoRealBinSize: false,
    phoRealBinSize: 0,
    usePhoRealAbsoluteHeights: false,
    usePhoRealSendWaveforms: false,
    usePhoRealABoVEClassifier: false,
    gediBeams: [0, 1, 2, 3, 5, 6, 8, 11] as number[],
    degradeFlag: false,
    l2QualityFlag: false,
    l4QualityFlag: false,
    surfaceFlag: false,
    fileOutput: true,
    staged: false,
    outputLocation: { label: 'local', value: 'local' },
    outputLocationPath: '',
    isGeoParquet: true,
    awsRegion: awsRegionOptions[0], // { label: 'us-west-2', value: 'us-west-2' },
    enableYAPC: false,
    useYAPCScore: false,
    YAPCScore: 0.0,
    usesYAPCKnn: false,
    YAPCKnn: 0,
    usesYAPCMinKnn: false,
    YAPCMinKnn: 5,
    usesYAPCWindowHeight: false,
    YAPCWindowHeight: 6.0,
    usesYAPCWindowWidth: false,
    YAPCWindowWidth: 15.0,
    usesYAPCVersion: false,
    YAPCVersion: 0 as number,
    resources: [] as string[],
    useChecksum: false,
    enableAtl24Classification: false,
    defaultsFetched: false,
    useDatum: false,
    useAtl24Compact: false,
    atl24Compact: false,
    useAtl24Classification: false,
    atl24_class_ph: ['bathymetry'] as string[],
    useAtl24ConfidenceThreshold: false,
    atl24ConfidenceThreshold: 0.6,
    useAtl24InvalidKD: false,
    atl24InvalidKD: OnOffOptions,
    useAtl24InvalidWindspeed: false,
    atl24InvalidWindspeed: OnOffOptions,
    useAtl24LowConfidence: false,
    atl24LowConfidence: OnOffOptions,
    useAtl24Night: false,
    atl24Night: OnOffOptions,
    useAtl24SensorDepthExceeded: false,
    atl24SensorDepthExceeded: OnOffOptions,
    atl24AncillaryFields: [] as string[],
    atl03AncillaryFields: [] as string[],
    atl08AncillaryFields: [] as string[],
    atl03_geo_fields: [] as string[],
    atl03_corr_fields: [] as string[],
    atl03_ph_fields: [] as string[],
    atl06_fields: [] as string[],
    atl08_fields: [] as string[],
    atl13_fields: [] as string[],
    gedi_fields: [] as string[],
    useAtl13RefId: false,
    atl13: {
      refid: 0 as number,
      name: '' as string,
      coord: null as Atl13Coord | null
    } as { refid: number; name: string; coord: Atl13Coord | null },
    useAtl13Polygon: false,
    useAtl13Point: false,
    forcedAddedParams: {} as Record<string, unknown>,
    forcedRemovedParams: [] as string[],
    showParamsDialog: false
  }
}
function setNestedValue(obj: any, path: string, value: unknown) {
  logger.debug('Setting nested value', { path, value })
  const keys = path.split('.')
  let current = obj
  keys.slice(0, -1).forEach((key) => {
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key]
  })
  current[keys[keys.length - 1]] = value
  logger.debug('Nested value set', { path })
}

function deleteNestedKey(obj: any, path: string): void {
  if (!path) return

  const keys = path.split('.')
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const nextKey = /^\d+$/.test(key) ? Number(key) : key

    if (current && typeof current === 'object' && nextKey in current) {
      current = current[nextKey]
    } else {
      return // exit early if path is invalid
    }
  }

  const lastKey = keys[keys.length - 1]
  const finalKey = /^\d+$/.test(lastKey) ? Number(lastKey) : lastKey

  if (current && typeof current === 'object' && finalKey in current) {
    delete current[finalKey]
  }
}

const createReqParamsStore = (id: string) =>
  defineStore(id, {
    state: () => getDefaultReqParamsState(),
    actions: {
      reset() {
        console.trace('resetting reqParamsStore')
        this.$patch(getDefaultReqParamsState() as any)
      },
      async presetForScatterPlotOverlay(parentReqId: number) {
        //TBD HACK when svr params is fixed it will include rgt. so use that instead of this
        // set things the user may have changed in this routine
        const parentApi = await db.getFunc(parentReqId)
        this.setUseSurfaceFitAlgorithm(false) // turn off surface fit
        this.setMissionValue('ICESat-2')
        this.setIceSat2API('atl03x')
        this.setEnableGranuleSelection(true) //tracks and beams
        this.setUseRgt(true)
        this.setUseCycle(true)
        if (parentApi === 'atl13x') {
          // dont use the request polygon, use the track bounds
          const parentReqIdStr = parentReqId.toString()
          const mmlh = useChartStore().getMinMaxLowHigh(parentReqIdStr)
          logger.debug('Preset for scatter plot overlay', {
            parentReqId,
            parentApi,
            hasMinMax: !!mmlh
          })
          const region = regionFromBounds(
            mmlh['latitude']?.min,
            mmlh['latitude']?.max,
            mmlh['longitude']?.min,
            mmlh['longitude']?.max,
            { close: true }
          )
          if (region) {
            this.setPoly(region)
            this.setConvexHull(convexHull(region))
            this.setAreaOfConvexHull(calculatePolygonArea(region))
            logger.debug('Using poly from track bounds', { parentReqId, polyLength: region.length })
          } else {
            logger.error('Unable to create region from track bounds', { parentReqId })
          }
        } else {
          // all other APIs use the request polygon
          const poly = await db.getSvrReqPoly(parentReqId)
          if (poly && poly.length > 0) {
            this.setPoly(poly)
            this.setConvexHull(convexHull(poly))
            this.setAreaOfConvexHull(calculatePolygonArea(poly))
            logger.debug('Using poly from server params', { parentReqId, polyLength: poly.length })
          } else {
            logger.error('No poly found for preset', { parentReqId })
          }
        }
        this.enableAtl03Classification = true
        this.signalConfidence = [
          signalConfidenceNumberOptions[2],
          signalConfidenceNumberOptions[3],
          signalConfidenceNumberOptions[4],
          signalConfidenceNumberOptions[5],
          signalConfidenceNumberOptions[6]
        ]
        if (parentApi === 'atl24x') {
          this.enableAtl24Classification = true
          this.enableAtl08Classification = false
          this.atl24_class_ph = atl24_class_ph_Options
          this.useDatum = true
        } else {
          this.enableAtl24Classification = false
          this.enableAtl08Classification = true
          this.atl08LandType = [
            'atl08_noise',
            'atl08_ground',
            'atl08_canopy',
            'atl08_top_of_canopy',
            'atl08_unclassified'
          ]
          this.useDatum = false
        }
        this.enableYAPC = true
        this.YAPCVersion = 0
        this.setUseRgt(true)
        //TBD maybe when svr params is fixed it will include rgt. so use that instead of this
        this.setSelectedTrackOptions(useGlobalChartStore().getSelectedTrackOptions())
        this.setSelectedGtOptions(useGlobalChartStore().getSelectedGtOptions())
        this.setRgt(useGlobalChartStore().getRgt())
        this.setEnableGranuleSelection(true)
        this.setUseCycle(true)
        this.setCycle(useGlobalChartStore().getCycles()[0])
        logger.debug('Preset granule selection complete', {
          tracks: this.getSelectedTrackOptions().length,
          gts: this.getSelectedGtOptions().length,
          rgt: this.getRgt(),
          cycle: this.getCycle()
        })
      },
      getRasterizePolyCellSize() {
        return this.rasterizePolyCellSize
      },
      setRasterizePolyCellSize(value: number) {
        this.rasterizePolyCellSize = value
      },
      addResource(resource: string) {
        if (resource.trim().length) {
          this.resources.push(resource)
        }
      },
      removeResource(index: number) {
        this.resources.splice(index, 1)
      },
      getFunc(): string {
        let func = 'xxx'
        if (this.missionValue === 'ICESat-2') {
          func = this.iceSat2SelectedAPI
        } else if (this.missionValue === 'GEDI') {
          func = this.gediSelectedAPI
        } else {
          logger.error('Mission not recognized in getFunc', { mission: this.missionValue })
        }
        return func
      },
      /////////////////////////////////////////////
      getAtlReqParams(req_id: number): AtlReqParams {
        //console.log('getAtlReqParams req_id:', req_id);
        const req: AtlReqParams = {}
        if (this.missionValue === 'ICESat-2') {
          if (!this.iceSat2SelectedAPI.includes('x')) {
            // atlnnx does not need asset set
            req.asset = this.iceSat2SelectedAPI === 'atl06sp' ? 'icesat2-atl06' : 'icesat2'
          }
        } else if (this.missionValue === 'GEDI') {
          if (this.gediSelectedAPI === 'gedi01bp') req.asset = 'gedil1b'
          else if (this.gediSelectedAPI === 'gedi02ap') req.asset = 'gedil2a'
          else if (this.gediSelectedAPI === 'gedi04ap') req.asset = 'gedil4a'
        } else {
          logger.error('Mission not recognized in getAtlReqParams', { mission: this.missionValue })
        }

        if (this.iceSat2SelectedAPI === 'atl08p' || this.iceSat2SelectedAPI.includes('atl03')) {
          if (this.getEnablePhoReal()) {
            req.phoreal = {} // atl08p requires phoreal even if not used

            if (this.usePhoRealGeoLocation) {
              req.phoreal.geoloc = this.phoRealGeoLocation
            }
            if (this.usePhoRealBinSize) {
              req.phoreal.binsize = this.phoRealBinSize
            }
            if (this.usePhoRealABoVEClassifier) {
              req.phoreal.above_classifier = true
            }
            if (this.usePhoRealAbsoluteHeights) {
              req.phoreal.use_abs_h = true
            }
            if (this.usePhoRealSendWaveforms) {
              req.phoreal.send_waveform = true
            }
          }
        }
        if (this.iceSat2SelectedAPI === 'atl08p') {
          if (this.atl08AncillaryFields.length > 0) {
            req.anc_fields = (req.anc_fields ?? []).concat(this.atl08AncillaryFields)
          }
        }
        if (this.iceSat2SelectedAPI === 'atl24x') {
          req.atl24 = {}
          if (this.useAtl24Compact) {
            req.atl24.compact = this.atl24Compact
          }
          if (this.useAtl24Classification) {
            req.atl24.class_ph = this.atl24_class_ph
          }
          if (this.useAtl24ConfidenceThreshold) {
            req.atl24.confidence_threshold = this.atl24ConfidenceThreshold
          }
          if (this.useAtl24InvalidKD) {
            req.atl24.invalid_kd = this.atl24InvalidKD
          }
          if (this.useAtl24InvalidWindspeed) {
            req.atl24.invalid_wind_speed = this.atl24InvalidWindspeed
          }
          if (this.useAtl24LowConfidence) {
            req.atl24.low_confidence = this.atl24LowConfidence
          }
          if (this.useAtl24Night) {
            req.atl24.night = this.atl24Night
          }
          if (this.useAtl24SensorDepthExceeded) {
            req.atl24.sensor_depth_exceeded = this.atl24SensorDepthExceeded
          }
          if (this.atl24AncillaryFields.length > 0) {
            req.atl24.anc_fields = this.atl24AncillaryFields
          }
        } else {
          if (this.missionValue === 'ICESat-2') {
            if (this.enableAtl03Classification) {
              if (
                this.surfaceReferenceType.length === 1 &&
                this.surfaceReferenceType[0].value === -1
              ) {
                req.srt = -1 // and not [-1]
              } else {
                if (this.surfaceReferenceType.length >= 1) {
                  req.srt = this.getSrt()
                }
              }
              if (this.qualityPH.length > 0) {
                req.quality_ph = this.qualityPH.map((item) => item.value)
              }
              if (this.signalConfidence.length > 0) {
                req.cnf = this.signalConfidence.map((item) => item.value)
              }
            }
          }
        }

        //console.log('getAtlReqParams: req.asset:', req.asset);
        if (this.iceSat2SelectedAPI.includes('atl03')) {
          if (this.atl03_geo_fields.length > 0) {
            req.atl03_geo_fields = this.atl03_geo_fields
          }
          if (this.atl03_corr_fields.length > 0) {
            req.atl03_corr_fields = this.atl03_corr_fields
          }
          if (this.atl03_ph_fields.length > 0) {
            req.atl03_ph_fields = this.atl03_ph_fields
          }
        }

        if (
          this.iceSat2SelectedAPI.includes('atl06') ||
          this.iceSat2SelectedAPI.includes('atl03x-surface')
        ) {
          if (this.atl06_fields.length > 0) {
            req.atl06_fields = this.atl06_fields
          }
        }
        if (
          this.iceSat2SelectedAPI.includes('atl08') ||
          this.iceSat2SelectedAPI.includes('atl03x-phoreal')
        ) {
          if (this.atl08_fields.length > 0) {
            req.atl08_fields = this.atl08_fields
          }
        }
        if (this.iceSat2SelectedAPI.includes('atl13')) {
          if (!req.atl13) req.atl13 = this.atl13
          if (this.useAtl13RefId) {
            req.atl13.refid = this.atl13.refid
          }
          if (this.atl13.name && this.atl13.name.length > 0) {
            req.atl13.name = this.atl13.name
          }
          if (this.atl13_fields.length > 0) {
            req.atl13_fields = this.atl13_fields
          }
        }

        if (this.missionValue === 'ICESat-2') {
          if (this.getUseSurfaceFitAlgorithm()) {
            req.fit = {} as SrSurfaceFit
            if (this.getUseMaxIterations()) {
              req.fit.maxi = this.getMaxIterations()
            }
            if (this.getUseMinWindowHeight()) {
              req.fit.h_win = this.getMinWindowHeight()
            }
            if (this.getUseMaxRobustDispersion()) {
              req.fit.sigma_r = this.getSigmaRmax()
            }
          }
          if (this.useLength) {
            req.len = this.getLengthValue()
          }
          if (this.useStep) {
            req.res = this.getStepValue()
          }
        } else if (this.missionValue === 'GEDI') {
          if (this.degradeFlag) {
            req.degrade = true
          }
          if (this.l2QualityFlag) {
            req.l2_quality = true
          }
          if (this.l4QualityFlag) {
            req.l4_quality = true
          }
          if (this.surfaceFlag) {
            req.surface = true
          }
        }
        if (this.poly?.length && !this.ignorePolygon) {
          req.poly = this.poly
        }
        const geojsonStore = useGeoJsonStore()
        logger.debug('GeoJSON data in getAtlReqParams', {
          geoJsonData: geojsonStore.getReqGeoJsonData()
        })
        if (geojsonStore.getReqGeoJsonData() != null) {
          if (geojsonStore.reqHasPoly()) {
            req.region_mask = {
              geojson: JSON.stringify(geojsonStore.getReqGeoJsonData()),
              cellsize: this.getRasterizePolyCellSize()
            }
          }
        }
        if (this.passInvalid) {
          req.pass_invalid = true
        } else {
          if (this.getUseAlongTrackSpread()) {
            req.ats = this.alongTrackSpread
          }
          if (this.getUseMinimumPhotonCount()) {
            req.cnt = this.minimumPhotonCount
          }
        }

        if (this.fileOutput) {
          const pathBase = (() => {
            let path = this.outputLocationPath
            if (this.outputLocation.value === 'S3') path = `s3://${this.outputLocationPath}`
            if (!this.outputLocationPath.length) {
              const reqIdStr = req_id > 0 ? String(req_id) : 'nnn'
              return `${this.getFunc()}_${reqIdStr}_${new Date()
                .toISOString()
                .replace(/:/g, '_')
                .replace(/\./g, '_')
                .replace(/T/g, '_')
                .replace(/Z/g, '')}`
            }
            return path
          })()

          const path = this.isGeoParquet ? `${pathBase}_GEO.parquet` : `${pathBase}.parquet`
          req.output = {
            format: 'parquet',
            as_geo: this.isGeoParquet,
            path,
            with_checksum: this.useChecksum
          }
        }

        if (this.getEnableGranuleSelection()) {
          if (this.beams.length > 0) {
            req.beams = this.beams.map((beam) => beam.value)
          }
          if (this.getUseRgt()) {
            req.rgt = this.getRgt()
          }
          if (this.getUseCycle()) {
            req.cycle = this.getCycle()
          }
          if (this.getUseRegion()) {
            req.region = this.getRegion()
          }
          if (this.getUseTime()) {
            if (this.getT0()) {
              req.t0 = convertTimeFormat(this.getT0(), '%Y-%m-%dT%H:%M:%SZ')
            }
            if (this.getT1()) {
              req.t1 = convertTimeFormat(this.getT1(), '%Y-%m-%dT%H:%M:%SZ')
            }
          }
        }
        if (this.enableAtl03Classification) {
          // ATL03 classification settings would go here
        }

        if (this.enableAtl08Classification) {
          if (this.atl08LandType.length > 0) {
            req.atl08_class = this.atl08LandType
          }
        }

        if (this.enableAtl24Classification) {
          if (!req.atl24) req.atl24 = {}
          if (this.atl24_class_ph.length > 0) {
            req.atl24.class_ph = this.atl24_class_ph
          }
        }

        if (this.enableYAPC) {
          let yapc = {} as Icesat2ConfigYapc
          yapc.version = this.getYAPCVersion()
          yapc.score = this.YAPCScore
          if (this.usesYAPCKnn) {
            yapc.knn = this.YAPCKnn
          }
          if (this.usesYAPCWindowHeight) {
            yapc.win_h = this.YAPCWindowHeight
          }
          if (this.usesYAPCWindowWidth) {
            yapc.win_x = this.YAPCWindowWidth
          }
          req.yapc = yapc
          //console.log('using req.yapc:',req.yapc)
        }
        if (this.distanceIn.value === 'segments') {
          req.dist_in_seg = true
        }
        if (this.useServerTimeout) {
          req.timeout = this.serverTimeoutValue
        }
        if (this.useReqTimeout) {
          req['rqst-timeout'] = this.reqTimeoutValue
        }
        if (this.useNodeTimeout) {
          req['node-timeout'] = this.nodeTimeoutValue
        }
        if (this.useReadTimeout) {
          req['read-timeout'] = this.readTimeoutValue
        }
        if (this.useDatum) {
          req.datum = 'EGM08'
        }
        if (useRasterParamsStore().dataTable.length > 0 && this.iceSat2SelectedAPI.includes('x')) {
          req.samples = useRasterParamsStore().getFormattedParms()
        }
        return req
      }, ///////////////////////////
      getSrt(): number[] {
        return this.surfaceReferenceType.map((item) => item.value)
      },
      getSurfaceReferenceType(name: string): number {
        const option = surfaceReferenceTypeOptions.find((option) => option.name === name)
        return option ? option.value : -1
      },
      getWorkerThreadTimeout(): number {
        let timeout = 600000 // 10 minutes
        if (this.getReqTimeout() > 0) {
          timeout = this.getReqTimeout() * 1000 + 5000 //millisecs; add 5 seconds to the request timeout to allow server to timeout first;
        } else {
          timeout = 600 * 1000 + 5000 // default to 10 minutes 5 seconds. TBD use server defaults api to set this
        }
        if (this.useNodeTimeout && this.getNodeTimeout() > 0) {
          const nodeTimeSetting = this.getNodeTimeout() * 1000 + 5000
          if (nodeTimeSetting > timeout) {
            timeout = nodeTimeSetting
          }
        }
        if (this.useReadTimeout && this.getReadTimeout() > 0) {
          const readTimeSetting = this.getReadTimeout() * 1000 + 5000
          if (readTimeSetting > timeout) {
            timeout = readTimeSetting
          }
        }
        logger.debug('Worker thread timeout calculated', {
          reqTimeout: this.getReqTimeout(),
          timeout
        })
        return timeout
      },
      getAtlxxReqParams(req_id: number): AtlxxReqParams {
        logger.debug('Getting Atlxx request params', { reqId: req_id })
        const baseParams: AtlxxReqParams = {
          parms: this.getAtlReqParams(req_id)
        }

        if (this.resources.length > 0) {
          baseParams['resources'] = this.resources
        }

        // Apply forced additions
        for (const [path, value] of Object.entries(this.forcedAddedParams)) {
          const adjustedPath = path.startsWith('parms.') ? path.slice(6) : path
          setNestedValue(baseParams.parms, adjustedPath, value) // note: target is baseParams.parms
        }
        // Apply forced removals
        for (const path of this.forcedRemovedParams) {
          const actualPath = path.startsWith('parms.') ? path.slice('parms.'.length) : path
          deleteNestedKey(baseParams.parms, actualPath)
        }

        //console.trace('getAtlReqParams this:', this, 'req_id:', req_id, 'req:', baseParams);

        return baseParams
      },
      getEnableGranuleSelection(): boolean {
        return this.enableGranuleSelection
      },
      setEnableGranuleSelection(enableGranuleSelection: boolean) {
        this.enableGranuleSelection = enableGranuleSelection
      },
      getUseRgt(): boolean {
        return this.useRGT
      },
      setUseRgt(useRGT: boolean) {
        this.useRGT = useRGT
      },
      setRgt(rgtValue: number) {
        this.rgtValue = rgtValue
      },
      getRgt(): number {
        return this.rgtValue
      },
      setUseCycle(useCycle: boolean) {
        this.useCycle = useCycle
      },
      getUseCycle(): boolean {
        return this.useCycle
      },
      setCycle(cycleValue: number) {
        this.cycleValue = cycleValue
      },
      getCycle(): number {
        return this.cycleValue
      },
      setUseRegion(useRegion: boolean) {
        this.useRegion = useRegion
      },
      getUseRegion(): boolean {
        return this.useRegion
      },
      setRegion(regionValue: number) {
        this.regionValue = regionValue
      },
      getRegion(): number {
        return this.regionValue
      },
      getUseTime(): boolean {
        return this.useTime
      },
      setUseTime(useTime: boolean) {
        this.useTime = useTime
      },
      setT0(t0Value: Date) {
        this.t0Value = t0Value
      },
      getT0(): Date {
        return this.t0Value
      },
      setT1(t1Value: Date) {
        this.t1Value = t1Value
      },
      getT1(): Date {
        return this.t1Value
      },
      getGpsToUTCOffset(): number {
        // hack a constant instead of a function of time
        return this.gpsToUTCOffset
      },
      setGpsToUTCOffset(gpsToUTCOffset: number) {
        this.gpsToUTCOffset = gpsToUTCOffset
      },
      setSelectedGtOptions(gts: SrListNumberItem[]) {
        this.beams = gts // in the req it is called beams
      },
      getSelectedGtOptions(): SrListNumberItem[] {
        return this.beams // in the req it is called beams
      },
      setSelectedTrackOptions(tracks: SrListNumberItem[]) {
        this.tracks = tracks
      },
      getSelectedTrackOptions() {
        return this.tracks
      },
      setSelectAllTracks(selectAllTracks: boolean) {
        this.selectAllTracks = selectAllTracks
      },
      getSelectAllTracks() {
        return this.selectAllTracks
      },
      setSelectAllBeams(selectAllBeams: boolean) {
        this.selectAllBeams = selectAllBeams
      },
      getSelectAllBeams(): boolean {
        return this.selectAllBeams
      },
      setUseChecksum(useChecksum: boolean) {
        this.useChecksum = useChecksum
      },
      getUseChecksum(): boolean {
        return this.useChecksum
      },
      getPassInvalid(): boolean {
        return this.passInvalid
      },
      setPassInvalid(passInvalid: boolean) {
        this.passInvalid = passInvalid
      },
      getMinWindowHeight(): number {
        return this.minWindowHeight
      },
      setMinWindowHeight(minWindowHeight: number) {
        this.minWindowHeight = minWindowHeight
      },
      setUseLength(useLength: boolean) {
        this.useLength = useLength
      },
      getUseLength() {
        return this.useLength
      },
      getLengthValue(): number {
        return this.lengthValue
      },
      setLengthValue(lengthValue: number) {
        this.lengthValue = lengthValue
      },
      setUseStep(useStep: boolean) {
        this.useStep = useStep
      },
      getUseStep() {
        return this.useStep
      },
      getStepValue(): number {
        return this.stepValue
      },
      setStepValue(stepValue: number) {
        this.stepValue = stepValue
      },
      getUseSurfaceFitAlgorithm(): boolean {
        return this.useSurfaceFitAlgorithm
      },
      setUseSurfaceFitAlgorithm(useSurfaceFitAlgorithm: boolean) {
        this.useSurfaceFitAlgorithm = useSurfaceFitAlgorithm
        if (useSurfaceFitAlgorithm) {
          this.enablePhoReal = false
        }
      },
      setEnablePhoReal(enable: boolean) {
        this.enablePhoReal = enable
        if (enable) {
          this.useSurfaceFitAlgorithm = false
        }
      },
      getEnablePhoReal(): boolean {
        return this.enablePhoReal
      },
      getSigmaRmax(): number {
        return this.maxRobustDispersion
      },
      setSigmaRmax(sigma_r_max: number) {
        this.maxRobustDispersion = sigma_r_max
      },
      getMaxIterations(): number {
        return this.maxIterations
      },
      setMaxIterations(maxIterations: number) {
        this.maxIterations = maxIterations
      },
      getUseAlongTrackSpread(): boolean {
        return this.useAlongTrackSpread
      },
      setUseAlongTrackSpread(ats: boolean) {
        this.useAlongTrackSpread = ats
      },
      getAlongTrackSpread(): number {
        return this.alongTrackSpread
      },
      setAlongTrackSpread(alongTrackSpread: number) {
        this.alongTrackSpread = alongTrackSpread
      },
      getUseMinimumPhotonCount(): boolean {
        return this.useMinimumPhotonCount
      },
      setUseMinimumPhotonCount(useMinimumPhotonCount: boolean) {
        this.useMinimumPhotonCount = useMinimumPhotonCount
      },
      getMinimumPhotonCount(): number {
        return this.minimumPhotonCount
      },
      setMinimumPhotonCount(minimumPhotonCount: number) {
        this.minimumPhotonCount = minimumPhotonCount
      },
      setUseReqTimeout(useReqTimeout: boolean) {
        this.useReqTimeout = useReqTimeout
      },
      getUseReqTimeout(): boolean {
        return this.useReqTimeout
      },
      setReqTimeout(reqTimeoutValue: number) {
        this.reqTimeoutValue = reqTimeoutValue
      },
      getReqTimeout(): number {
        return this.reqTimeoutValue
      },
      setUseNodeTimeout(useNodeTimeout: boolean) {
        this.useNodeTimeout = useNodeTimeout
      },
      getUseNodeTimeout(): boolean {
        return this.useNodeTimeout
      },
      setNodeTimeout(nodeTimeoutValue: number) {
        this.nodeTimeoutValue = nodeTimeoutValue
      },
      getNodeTimeout(): number {
        return this.nodeTimeoutValue
      },
      setUseReadTimeout(useReadTimeout: boolean) {
        this.useReadTimeout = useReadTimeout
      },
      getUseReadTimeout(): boolean {
        return this.useReadTimeout
      },
      getReadTimeout(): number {
        return this.readTimeoutValue
      },
      setReadTimeout(readTimeoutValue: number) {
        this.readTimeoutValue = readTimeoutValue
      },
      restoreTimeouts() {
        logger.debug('Restoring timeouts to defaults')
        this.useServerTimeout = false
        this.useReqTimeout = false
        this.useNodeTimeout = false
        this.useReadTimeout = false
        const sto = useSlideruleDefaults().getNestedDefault<number>('core', 'timeout')
        if (sto) {
          this.setServerTimeout(sto)
        } else {
          logger.warn('No default server timeout found, using fallback', { fallbackValue: 601 })
          this.setServerTimeout(601) // fallback default
        }
        const nto = useSlideruleDefaults().getNestedDefault<number>('core', 'node_timeout')
        if (nto) {
          this.setNodeTimeout(nto)
        } else {
          logger.warn('No default node timeout found, using fallback', { fallbackValue: 601 })
          this.setNodeTimeout(601) // fallback default
        }
        const rto = useSlideruleDefaults().getNestedDefault<number>('core', 'read_timeout')
        if (rto) {
          this.setReadTimeout(rto)
        } else {
          logger.warn('No default read timeout found, using fallback', { fallbackValue: 601 })
          this.setReadTimeout(601) // fallback default
        }
        const rqto = useSlideruleDefaults().getNestedDefault<number>('core', 'rqst_timeout')
        if (rqto) {
          this.setReqTimeout(rqto)
        } else {
          logger.warn('No default request timeout found, using fallback', { fallbackValue: 601 })
          this.setReqTimeout(601) // fallback default
        }
      },
      getUseServerTimeout(): boolean {
        return this.useServerTimeout
      },
      setUseServerTimeout(useServerTimeout: boolean) {
        this.useServerTimeout = useServerTimeout
      },
      getServerTimeout(): number {
        return this.serverTimeoutValue
      },
      setServerTimeout(serverTimeoutValue: number) {
        this.serverTimeoutValue = serverTimeoutValue
      },
      getYAPCScore(): number {
        return this.YAPCScore
      },
      setYAPCScore(value: number) {
        //console.trace('setYAPCScore')
        this.YAPCScore = value
      },
      getUseYAPCScore(): boolean {
        return this.useYAPCScore
      },
      setUseYAPCScore(value: boolean) {
        this.useYAPCScore = value
      },
      getUseYAPCKnn(): boolean {
        return this.usesYAPCKnn
      },
      setUseYAPCKnn(value: boolean) {
        this.usesYAPCKnn = value
      },
      getYAPCKnn(): number {
        return this.YAPCKnn
      },
      setYAPCKnn(value: number) {
        this.YAPCKnn = value
      },
      getUseYAPCMinKnn(): boolean {
        return this.usesYAPCMinKnn
      },
      setUseYAPCMinKnn(value: boolean) {
        this.usesYAPCMinKnn = value
      },
      getYAPCMinKnn(): number {
        return this.YAPCMinKnn
      },
      setYAPCMinKnn(value: number) {
        this.YAPCMinKnn = value
      },
      getYAPCWindowHeight() {
        return this.YAPCWindowHeight
      },
      setYAPCWindowHeight(value: number) {
        this.YAPCWindowHeight = value
      },
      getUsesYAPCWindowWidth() {
        return this.usesYAPCWindowWidth
      },
      setUsesYAPCWindowWidth(value: boolean) {
        this.usesYAPCWindowWidth = value
      },
      getUsesYAPCWindowHeight() {
        return this.usesYAPCWindowHeight
      },
      setUsesYAPCWindowHeight(value: boolean) {
        this.usesYAPCWindowHeight = value
      },
      getYAPCWindowWidth() {
        return this.YAPCWindowWidth
      },
      setYAPCWindowWidth(value: number) {
        this.YAPCWindowWidth = value
      },
      getYAPCVersion(): number {
        return this.YAPCVersion
      },
      setYAPCVersion(value: number) {
        this.YAPCVersion = value
      },

      initYapcDefaults() {
        const yapc = useSlideruleDefaults().getNestedMissionDefault<object>(
          this.missionValue,
          'yapc'
        ) as Icesat2ConfigYapc
        logger.debug('Initializing YAPC defaults', { yapc })
        if (yapc) {
          this.setYAPCVersion(yapc['version']) //3
          logger.debug('YAPC score from defaults', { score: yapc['score'] })
          this.setYAPCScore(yapc['score']) //0
          this.setYAPCKnn(yapc['knn']) //0
          this.setYAPCWindowHeight(yapc['win_h']) //10
          this.setYAPCWindowWidth(yapc['win_x']) //10
        }
      },
      getMissionValue(): string {
        return this.missionValue
      },
      setMissionValue(value: string) {
        if (value === 'ICESat-2') {
          this.iceSat2SelectedAPI = iceSat2APIsItems[0] // Reset to default when mission changes
        } else if (value === 'GEDI') {
          this.gediSelectedAPI = gediAPIsItems[0] // Reset to default when mission changes
        }
        this.missionValue = value
      },
      getIceSat2API(): string {
        //console.log('getIceSat2API:', this.iceSat2SelectedAPI);
        return this.iceSat2SelectedAPI
      },
      setIceSat2API(value: string) {
        //console.log('setIceSat2API:', value);
        this.iceSat2SelectedAPI = value

        // Auto-enable fit or phoreal based on API selection
        // This ensures the JSON will have fit:{} or phoreal:{} when opened in Edit dialog
        if (value === 'atl03x-surface') {
          this.setUseSurfaceFitAlgorithm(true)
        } else if (value === 'atl03x-phoreal') {
          this.setEnablePhoReal(true)
        }
      },
      getGediAPI(): string {
        return this.gediSelectedAPI
      },
      setGediAPI(value: string) {
        this.gediSelectedAPI = value
      },
      getCurAPIStr(): string {
        if (this.missionValue === 'ICESat-2') {
          return this.iceSat2SelectedAPI
        } else if (this.missionValue === 'GEDI') {
          return this.gediSelectedAPI
        }
        return ''
      },
      getCurAPIObj(): ApiName | null {
        if (this.missionValue === 'ICESat-2' && isValidAPI(this.iceSat2SelectedAPI)) {
          return this.iceSat2SelectedAPI as ApiName
        } else if (this.missionValue === 'GEDI' && isValidAPI(this.gediSelectedAPI)) {
          return this.gediSelectedAPI as ApiName
        }
        logger.error('Mission not recognized or API not valid', {
          mission: this.missionValue,
          iceSat2API: this.iceSat2SelectedAPI,
          gediAPI: this.gediSelectedAPI
        })
        return null // Explicitly return `null` instead of `''`
      },
      setConvexHull(convexHull: SrRegion | null) {
        this.convexHull = convexHull
        if (convexHull === null || convexHull.length === 0) {
          this.areaOfConvexHull = 0
          return
        }
        this.areaOfConvexHull = calculatePolygonArea(convexHull)
      },
      getConvexHull(): SrRegion | null {
        return this.convexHull
      },
      getAreaOfConvexHull(): number {
        return this.areaOfConvexHull
      },
      getFormattedAreaOfConvexHull(): string {
        return this.areaOfConvexHull.toFixed(2).toString() + ' km²'
      },
      setAreaOfConvexHull(value: number) {
        this.areaOfConvexHull = value
      },
      getEnableAtl08Classification(): boolean {
        return this.enableAtl08Classification
      },
      setEnableAtl08Classification(enableAtl08Classification: boolean) {
        this.enableAtl08Classification = enableAtl08Classification
      },
      getUseMaxIterations(): boolean {
        return this.useMaxIterations
      },
      setUseMaxIterations(useMaxIterations: boolean) {
        this.useMaxIterations = useMaxIterations
      },
      getUseMaxRobustDispersion(): boolean {
        return this.useMaxRobustDispersion
      },
      setUseMaxRobustDispersion(useRobustDispersion: boolean) {
        this.useMaxRobustDispersion = useRobustDispersion
      },
      getUseMinWindowHeight(): boolean {
        return this.useMinWindowHeight
      },
      setUseMinWindowHeight(useMinWindowHeight: boolean) {
        this.useMinWindowHeight = useMinWindowHeight
      },
      setPoly(poly: SrRegion | null) {
        this.poly = poly
      },
      // setCmr(cmr: { polygon: SrRegion }) {
      //   this.poly = cmr.polygon;
      // },
      dropPin(coord: number[]) {
        this.useAtl13Point = true
        this.atl13.coord = { lon: coord[0], lat: coord[1] }
      },
      removePin() {
        this.useAtl13Point = false
        this.atl13.coord = null
      }
    }
  })
const theReqParamsStore = createReqParamsStore('reqParamsStore')
const theAutoReqParamsStore = createReqParamsStore('autoReqParamsStore')
export const useReqParamsStore = theReqParamsStore
export const useAutoReqParamsStore = theAutoReqParamsStore
