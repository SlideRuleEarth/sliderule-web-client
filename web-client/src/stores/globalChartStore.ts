import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MinMaxLowHigh, SrListNumberItem } from '@/types/SrTypes'
import { gtsOptions, tracksOptions, pairOptions } from '@/utils/parmUtils'
import { SC_FORWARD, SC_BACKWARD } from '@/sliderule/icesat2'
import { getDetailsFromSpotNumber, getScOrientFromSpotAndGt } from '@/utils/spotUtils'
import { resetCycleOptions, type ElevationDataItem } from '@/utils/SrMapUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('GlobalChartStore')

export const useGlobalChartStore = defineStore('globalChartStore', () => {
  const fontSize = ref<number>(16) // Default font size in pixels
  const cycleOptions = ref<SrListNumberItem[]>([])
  const selectedCycleOptions = ref<SrListNumberItem[]>([])
  const filteredCycleOptions = ref<SrListNumberItem[]>([]) // subset for selected
  const rgtOptions = ref<SrListNumberItem[]>([])
  const selectedRgtOption = ref<SrListNumberItem>()
  const selectedSpots = ref<number[]>([])
  const selectedTrackOptions = ref<SrListNumberItem[]>([])
  const selectedGtOptions = ref<SrListNumberItem[]>([])
  const selectedPairOptions = ref<SrListNumberItem[]>([])
  const filteredPairOptions = ref<SrListNumberItem[]>([]) // subset for selected
  const scrollX = ref<number>(0)
  const scrollY = ref<number>(0)
  const hasScForward = ref<boolean>(false)
  const hasScBackward = ref<boolean>(false)
  const selectedElevationRec = ref<ElevationDataItem | null>(null)
  const use_y_atc_filter = ref<boolean>(false)
  const use_rgt_in_filter = ref<boolean>(true)
  const enableLocationFinder = ref<boolean>(true)
  const locationFinderLat = ref<number>(0.0)
  const locationFinderLon = ref<number>(0.0)
  const mapHoverLat = ref<number | null>(null)
  const mapHoverLon = ref<number | null>(null)
  const mapHoverActive = ref<boolean>(false)
  const mapHoverIsSelected = ref<boolean>(false) // true if hovered point is on selected track
  const selected_y_atc = ref<number>(0.0)
  const y_atc_margin = ref<number>(50.0)
  const max_pnts_on_plot = ref<number>(50000)
  const chunk_size_for_plot = ref<number>(10000)
  const titleOfElevationPlot = ref<string>('Highlighted Track(s)') // Default title for the elevation plot
  const allColumnMinMaxValues = ref<MinMaxLowHigh>({})
  const usePercentileRange = ref<boolean>(false)
  const useMapLegendFullRange = ref<boolean>(true)
  const showPlotTooltip = ref<boolean>(false)

  // State for zooming map to plot extent
  const zoomToPlotExtent = ref<boolean>(false)
  const plotLatLonExtent = ref<{
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  } | null>(null)

  // State for storing current map view extent (for zooming plot to map extent)
  const mapLatLonExtent = ref<{
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  } | null>(null)

  function setCycleOptions(newCycleOptions: SrListNumberItem[]) {
    cycleOptions.value = newCycleOptions
  }

  function getCycleOptions(): SrListNumberItem[] {
    return cycleOptions.value
  }

  function getCycleOptionsValues(): number[] {
    return cycleOptions.value.map((cycle) => cycle.value)
  }

  function findCycleOption(cycle: number): SrListNumberItem | undefined {
    return cycleOptions.value.find((option) => option.value === cycle)
  }

  function setCycles(cycles: number[]) {
    if (!Array.isArray(cycles)) {
      logger.error('setCycles received invalid cycles', { cycles })
      selectedCycleOptions.value = []
      return
    }
    const updatedCycleOptions = cycles.map((cycle) => {
      return findCycleOption(cycle) || { label: cycle.toString(), value: cycle }
    })
    setSelectedCycleOptions(updatedCycleOptions)
    //console.log('setCycles cycles:', cycles, ' selectedCycleOptions:', selectedCycleOptions.value);
  }

  function getCycles(): number[] {
    if (!Array.isArray(selectedCycleOptions.value)) {
      logger.error('getCycles: selectedCycleOptions is not an array', {
        selectedCycleOptions: selectedCycleOptions.value
      })
      return []
    }
    return selectedCycleOptions.value.map((cycle) => cycle.value)
  }

  function setSelectedCycleOptions(cycleOptions: SrListNumberItem[]) {
    if (!Array.isArray(cycleOptions)) {
      logger.error('setSelectedCycleOptions received invalid cycleOptions', { cycleOptions })
      selectedCycleOptions.value = []
      return
    }
    selectedCycleOptions.value = cycleOptions
    //console.log('setSelectedCycleOptions cycleOptions:', cycleOptions, ' selectedCycleOptions:', selectedCycleOptions.value);
  }

  function getSelectedCycleOptions(): SrListNumberItem[] {
    return selectedCycleOptions.value
  }

  function getMaxSelectedCycle(): number {
    if (!Array.isArray(selectedCycleOptions.value) || selectedCycleOptions.value.length === 0) {
      logger.error('getMaxSelectedCycle: selectedCycleOptions is not an array or is empty', {
        selectedCycleOptions: selectedCycleOptions.value
      })
      return -1
    }
    return Math.max(...selectedCycleOptions.value.map((cycle) => cycle.value))
  }

  function getMinSelectedCycle(): number {
    if (!Array.isArray(selectedCycleOptions.value) || selectedCycleOptions.value.length === 0) {
      logger.error('getMinSelectedCycle: selectedCycleOptions is not an array or is empty', {
        selectedCycleOptions: selectedCycleOptions.value
      })
      return -1
    }
    return Math.min(...selectedCycleOptions.value.map((cycle) => cycle.value))
  }

  function getFilteredCycleOptions(): SrListNumberItem[] {
    return filteredCycleOptions.value
  }

  function setFilteredCycleOptions(cycleOptions: SrListNumberItem[]) {
    filteredCycleOptions.value = cycleOptions
  }

  function setRgtOptions(newRgtOptions: SrListNumberItem[]) {
    rgtOptions.value = newRgtOptions
    //console.trace('setRgtOptions rgtOptions:', newRgtOptions, ' selectedRgtOption:', selectedRgtOption.value);
  }

  function getRgtOptions(): SrListNumberItem[] {
    return rgtOptions.value
  }

  function setSelectedRgtOptions(rgtOptions: SrListNumberItem[]): void {
    if (!Array.isArray(rgtOptions)) {
      logger.error('setSelectedRgtOptions received invalid rgtOptions', { rgtOptions })
      selectedRgtOption.value = undefined
      return
    }
    selectedRgtOption.value = rgtOptions.find((option) => option.value === getRgt()) || {
      label: 'None',
      value: -1
    }
    //console.log('setSelectedRgtOptions rgtOptions:', rgtOptions, ' selectedRgtOption:', selectedRgtOption.value);
    if (selectedRgtOption.value === undefined) {
      logger.error('setSelectedRgtOptions: selectedRgtOption is undefined', {
        selectedRgtOption: selectedRgtOption.value
      })
      selectedRgtOption.value = { label: 'None', value: -1 }
    }
    //console.log('setSelectedRgtOptions rgtOptions:', rgtOptions, ' selectedRgtOption:', selectedRgtOption.value);
  }

  function findRgtOption(rgt: number): SrListNumberItem | undefined {
    return rgtOptions.value.find((option) => option.value === rgt)
  }

  function setRgt(rgtOption: number) {
    selectedRgtOption.value = findRgtOption(rgtOption) || {
      label: rgtOption.toString(),
      value: rgtOption
    }
    //console.log('setRgts rgts:', rgtOptions, ' selectedRgtOption:', selectedRgtOption.value);
  }

  function getRgt(): number {
    const rgtOption = selectedRgtOption?.value
    //console.log('getRgt rgtOption:', rgtOption, ' selectedRgtOptions:', selectedRgtOption.value);
    return rgtOption ? rgtOption.value : -1
  }

  function setSpots(spots: number[]) {
    if (!Array.isArray(spots)) {
      logger.error('setSpots received invalid spots', { spots })
      selectedSpots.value = []
      return
    }
    selectedSpots.value = spots
  }

  function getSpots(): number[] {
    if (!Array.isArray(selectedSpots.value)) {
      logger.error('getSpots: selectedSpots is not an array', {
        selectedSpots: selectedSpots.value
      })
      return []
    }
    return selectedSpots.value
  }

  function setTracks(tracks: number[]) {
    if (!Array.isArray(tracks)) {
      logger.error('setTracks received invalid tracks', { tracks })
      selectedTrackOptions.value = []
      return
    }
    const updatedTrackOptions = tracks.map((track) => {
      return (
        tracksOptions.find((option) => option.value === track) || {
          label: track.toString(),
          value: track
        }
      )
    })
    selectedTrackOptions.value = updatedTrackOptions
    //console.log('setTracks tracks:', tracks, ' selectedTrackOptions:', selectedTrackOptions.value);
  }

  function getTracksOptions(): SrListNumberItem[] {
    return tracksOptions
  }

  function getTracks(): number[] {
    if (!Array.isArray(selectedTrackOptions.value)) {
      logger.error('getTracks: selectedTrackOptions is not an array', {
        selectedTrackOptions: selectedTrackOptions.value
      })
      return []
    }
    return selectedTrackOptions.value.map((track) => track.value)
  }

  function getSelectedTrackOptions(): SrListNumberItem[] {
    return selectedTrackOptions.value
  }

  function setGts(gts: number[]) {
    if (!Array.isArray(gts)) {
      logger.error('setGts received invalid gts', { gts })
      selectedGtOptions.value = []
      return
    }
    selectedGtOptions.value = gts.map((gt) => {
      return gtsOptions.find((option) => option.value === gt) || { label: gt.toString(), value: gt }
    })
    //console.log('setGts gts:', gts, ' selectedGtOptions:', selectedGtOptions.value);
  }

  function getGts(): number[] {
    if (!Array.isArray(selectedGtOptions.value)) {
      logger.error('getGts: selectedGtOptions is not an array', {
        selectedGtOptions: selectedGtOptions.value
      })
      return []
    }
    return selectedGtOptions.value.map((gt) => gt.value)
  }

  function getGtsOptions(): SrListNumberItem[] {
    return gtsOptions
  }

  function appendToSelectedGtOptions(gt: SrListNumberItem) {
    const beamExists = selectedGtOptions.value.some((b) => b.value === gt.value)
    if (!beamExists) {
      selectedGtOptions.value.push(gt)
    }
  }

  function setSelectedGtOptions(gtOptions: SrListNumberItem[]) {
    if (!Array.isArray(gtOptions)) {
      logger.error('setSelectedGtOptions received invalid gtOptions', { gtOptions })
      selectedGtOptions.value = []
      return
    }
    selectedGtOptions.value = gtOptions
  }

  function getSelectedGtOptions(): SrListNumberItem[] {
    return selectedGtOptions.value
  }

  function getGtLabels(): string[] {
    return selectedGtOptions.value.map((gt) => gt.label)
  }

  function setFilterWithSpotAndGt(spot: number, gt: number): void {
    const sc_orient = getScOrientFromSpotAndGt(spot, gt)
    setScOrients([sc_orient])
    const details = getDetailsFromSpotNumber(spot)
    setSpots([spot])
    setGts([gt])
    setTracks([details[sc_orient].track])
    setPairs([details[sc_orient].pair])
  }

  function setTracksForGts(input_gts: SrListNumberItem[]) {
    const tracks = input_gts
      .map((gt) => tracksOptions.find((track) => Number(gt.label.charAt(2)) === track.value))
      .filter((track): track is SrListNumberItem => track !== undefined)
    const trkList = tracks.map((track) => track.value)
    //console.log('setTracksForGts:',input_gts, 'tracks:', trkList);
    setTracks(trkList)
  }

  function setGtsForTracks(input_tracks: number[]) {
    const gts = input_tracks
      .map((track) => gtsOptions.find((option) => Number(track) === Number(option.label.charAt(2))))
      .filter((gt): gt is SrListNumberItem => gt !== undefined)
    setSelectedGtOptions(gts)
  }

  function setPairs(pairs: number[]) {
    if (!Array.isArray(pairs)) {
      logger.error('setPairs received invalid pairs', { pairs })
      selectedPairOptions.value = []
      return
    }
    selectedPairOptions.value = pairs.map((pair) => {
      return (
        pairOptions.find((option) => option.value === pair) || {
          label: pair.toString(),
          value: pair
        }
      )
    })
  }

  function getSelectedPairOptions(): SrListNumberItem[] {
    return selectedPairOptions.value
  }

  function getPairs(): number[] {
    return selectedPairOptions.value.map((pair) => pair.value)
  }

  function getFilteredPairOptions(): SrListNumberItem[] {
    return filteredPairOptions.value
  }

  function setFilteredPairOptions(pairOptions: SrListNumberItem[]) {
    filteredPairOptions.value = pairOptions
  }

  function setSelectedPairOptions(pairOptions: SrListNumberItem[]) {
    if (!Array.isArray(pairOptions)) {
      logger.error('setSelectedPairOptions received invalid pairOptions', { pairOptions })
      selectedPairOptions.value = []
      return
    }
    selectedPairOptions.value = pairOptions
  }

  function appendPair(pair: number) {
    selectedPairOptions.value.push({ label: pair.toString(), value: pair })
  }

  function setScOrients(scOrients: number[]) {
    hasScForward.value = scOrients.includes(SC_FORWARD)
    hasScBackward.value = scOrients.includes(SC_BACKWARD)
  }

  function getScOrients(): number[] {
    const scOrients = []
    if (hasScForward.value) {
      scOrients.push(SC_FORWARD)
    }
    if (hasScBackward.value) {
      scOrients.push(SC_BACKWARD)
    }
    return scOrients
  }

  function getScOrientsLabels(): string[] {
    const scOrientLabels = []
    if (hasScForward.value) {
      scOrientLabels.push('Forward')
    }
    if (hasScBackward.value) {
      scOrientLabels.push('Backward')
    }
    return scOrientLabels
  }

  const setSelectedElevationRec = (rec: ElevationDataItem): void => {
    selectedElevationRec.value = rec
  }

  const getSelectedElevationRec = (): ElevationDataItem | null => {
    return selectedElevationRec.value ?? null
  }

  function y_atc_is_valid(): boolean {
    return (
      selected_y_atc.value != undefined &&
      selected_y_atc.value != null &&
      !isNaN(selected_y_atc.value)
    )
  }

  function generateNameSuffix(req_id: number | string): string {
    const rgt = getRgt()
    const cycles = getCycles()
    const spots = getSpots()
    const min_y_atc = selected_y_atc.value - y_atc_margin.value
    const max_y_atc = selected_y_atc.value + y_atc_margin.value
    const min_y_atc_str = min_y_atc !== undefined ? min_y_atc.toFixed(2) : ''
    const max_y_atc_str = max_y_atc !== undefined ? max_y_atc.toFixed(2) : ''
    let nameSuffix = `-${req_id}-${rgt}-${cycles.join('-')}-${spots.join('-')}`

    if (use_y_atc_filter.value && min_y_atc !== undefined && max_y_atc !== undefined) {
      nameSuffix += `-${min_y_atc_str}-${max_y_atc_str}`
    }
    return nameSuffix
  }
  function setAllColumnMinMaxValues(values: MinMaxLowHigh) {
    allColumnMinMaxValues.value = values
  }

  function getAllColumnMinMaxValues(): MinMaxLowHigh {
    return allColumnMinMaxValues.value
  }

  function getMin(column: string): number {
    return allColumnMinMaxValues.value[column]?.min ?? undefined
  }
  function getMax(column: string): number {
    return allColumnMinMaxValues.value[column]?.max ?? undefined
  }
  function getLow(column: string): number {
    return allColumnMinMaxValues.value[column]?.low ?? undefined
  }
  function getHigh(column: string): number {
    return allColumnMinMaxValues.value[column]?.high ?? undefined
  }

  function set_use_y_atc_filter(value: boolean) {
    use_y_atc_filter.value = value
  }

  function setPlotLatLonExtent(
    extent: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  ): void {
    plotLatLonExtent.value = extent
    if (extent) {
      zoomToPlotExtent.value = true
    }
  }

  function resetZoomToPlotExtent(): void {
    zoomToPlotExtent.value = false
  }

  function getPlotLatLonExtent(): {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  } | null {
    return plotLatLonExtent.value
  }

  function setMapLatLonExtent(
    extent: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  ): void {
    mapLatLonExtent.value = extent
  }

  function getMapLatLonExtent(): {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  } | null {
    return mapLatLonExtent.value
  }

  async function selectAllCycleOptions() {
    //console.log('selectAllCycleOptions called');
    await resetCycleOptions()
    setSelectedCycleOptions(getCycleOptions())
  }

  return {
    fontSize,
    getCycleOptions,
    getCycleOptionsValues,
    setCycleOptions,
    findCycleOption,
    selectAllCycleOptions,
    cycleOptions,
    setCycles,
    getCycles,
    setSelectedCycleOptions,
    getSelectedCycleOptions,
    selectedCycleOptions,
    getFilteredCycleOptions,
    setFilteredCycleOptions,
    getMaxSelectedCycle,
    getMinSelectedCycle,
    setRgtOptions,
    getRgtOptions,
    setRgt,
    getRgt,
    selectedRgtOption,
    setSelectedRgtOptions,
    selectedSpots,
    getSpots,
    setSpots,
    getTracksOptions,
    getTracks,
    setTracks,
    getGts,
    setGts,
    getGtsOptions,
    getGtLabels,
    appendToSelectedGtOptions,
    getSelectedGtOptions,
    setSelectedGtOptions,
    setFilterWithSpotAndGt,
    setTracksForGts,
    setGtsForTracks,
    getSelectedTrackOptions,
    setPairs,
    getSelectedPairOptions,
    getFilteredPairOptions,
    setFilteredPairOptions,
    setSelectedPairOptions,
    appendPair,
    getPairs,
    setScOrients,
    getScOrients,
    getScOrientsLabels,
    hasScForward,
    hasScBackward,
    scrollX,
    scrollY,
    titleOfElevationPlot,
    setSelectedElevationRec,
    getSelectedElevationRec,
    use_y_atc_filter,
    use_rgt_in_filter,
    set_use_y_atc_filter,
    selected_y_atc,
    y_atc_is_valid,
    y_atc_margin,
    generateNameSuffix,
    max_pnts_on_plot,
    chunk_size_for_plot,
    enableLocationFinder,
    locationFinderLat,
    locationFinderLon,
    mapHoverLat,
    mapHoverLon,
    mapHoverActive,
    mapHoverIsSelected,
    allColumnMinMaxValues,
    setAllColumnMinMaxValues,
    getAllColumnMinMaxValues,
    getMin,
    getMax,
    getLow,
    getHigh,
    usePercentileRange,
    useMapLegendFullRange,
    showPlotTooltip,
    zoomToPlotExtent,
    plotLatLonExtent,
    setPlotLatLonExtent,
    resetZoomToPlotExtent,
    getPlotLatLonExtent,
    mapLatLonExtent,
    setMapLatLonExtent,
    getMapLatLonExtent
  }
})
