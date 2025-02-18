import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SrListNumberItem } from '@/types/SrTypes';
import { getGtsAndTracksWithGts } from '@/utils/parmUtils';
import { gtsOptions, tracksOptions, pairOptions, scOrientOptions } from '@/utils/parmUtils';
import { SC_FORWARD } from '@/sliderule/icesat2';

export const useGlobalChartStore = defineStore('globalChartStore', () => {
    const cycleOptions = ref<SrListNumberItem[]>([]);
    const selectedCycleOptions = ref<SrListNumberItem[]>([]);
    const filteredCycleOptions = ref<SrListNumberItem[]>([]);// subset for selected 
    const rgtOptions = ref<SrListNumberItem[]>([]);
    const selectedRgtOption = ref<SrListNumberItem>();
    const selectedSpots = ref<number[]>([]);
    const selectedTrackOptions = ref<SrListNumberItem[]>([]);
    const selectedGtOptions = ref<SrListNumberItem[]>([]);
    const selectedPairOptions = ref<SrListNumberItem[]>([]);
    const filteredPairOptions = ref<SrListNumberItem[]>([]);// subset for selected
    const selectedScOrientOptions = ref<SrListNumberItem[]>([]);
    const filteredScOrientOptions = ref<SrListNumberItem[]>([]);// subset for selected
    const scrollX = ref<number>(0);
    const scrollY = ref<number>(0);
    function setCycleOptions(newCycleOptions: SrListNumberItem[]) {
        cycleOptions.value = newCycleOptions;  
    }

    function getCycleOptions(): SrListNumberItem[] {
        return cycleOptions.value;
    }

    function getCycleOptionsValues(): number[] {
        return cycleOptions.value.map(cycle => cycle.value);
    }

    function findCycleOption(cycle: number): SrListNumberItem | undefined {
        return cycleOptions.value.find(option => option.value === cycle);
    }

    function setCycles(cycles: number[]) {
        if (!Array.isArray(cycles)) {
            console.error('setCycles received invalid cycles:', cycles);
            selectedCycleOptions.value = [];
            return;
        }
        const updatedCycleOptions = cycles.map(cycle => {
            return findCycleOption(cycle) || { label: cycle.toString(), value: cycle };
        });
        setSelectedCycleOptions(updatedCycleOptions);
        console.log('setCycles cycles:', cycles, ' selectedCycleOptions:', selectedCycleOptions.value);
    }

    function getCycles(): number[] {
        if (!Array.isArray(selectedCycleOptions.value)) {
            console.error(`getCycles: selectedCycleOptions is not an array`, selectedCycleOptions.value);
            return [];
        }
        return selectedCycleOptions.value.map(cycle => cycle.value);
    }

    function setSelectedCycleOptions(cycleOptions: SrListNumberItem[]) {
        if (!Array.isArray(cycleOptions)) {
            console.error('setSelectedCycleOptions received invalid cycleOptions:', cycleOptions);
            selectedCycleOptions.value = [];
            return;
        }
        selectedCycleOptions.value = cycleOptions;
    }

    function getSelectedCycleOptions(): SrListNumberItem[] {
        return selectedCycleOptions.value;
    }

    function getFilteredCycleOptions(): SrListNumberItem[] {
        return filteredCycleOptions.value;
    }

    function setFilteredCycleOptions(cycleOptions: SrListNumberItem[]) {
        filteredCycleOptions.value = cycleOptions;
    }
    
    function setRgtOptions(newRgtOptions: SrListNumberItem[]) {
        rgtOptions.value = newRgtOptions;  
    }
    
    function getRgtOptions(): SrListNumberItem[] {
        return rgtOptions.value;
    }

    function findRgtOption(rgt: number): SrListNumberItem | undefined {
        return rgtOptions.value.find(option => option.value === rgt);
    }

    function setRgt(rgtOption: number) {
        selectedRgtOption.value = findRgtOption(rgtOption) || { label: rgtOption.toString(), value: rgtOption };        
        console.log('setRgts rgts:', rgtOptions, ' selectedRgtOption:', selectedRgtOption.value);
    }

    function getRgt(): number  {
        const rgtOption = selectedRgtOption?.value;
        console.log('getRgt rgtOption:', rgtOption, ' selectedRgtOptions:', selectedRgtOption.value);
        return rgtOption ? rgtOption.value : -1;
    }

    function setSpots(spots: number[]) {
        if (!Array.isArray(spots)) {
            console.error('setSpots received invalid spots:', spots);
            selectedSpots.value = [];
            return;
        }
        selectedSpots.value = spots;
    }

    function getSpots(): number[] {
        if (!Array.isArray(selectedSpots.value)) {
            console.error(`getSpots: selectedSpots is not an array`, selectedSpots.value);
            return [];
        }
        return selectedSpots.value;
    }

    function setTracks(tracks: number[]) {
        if (!Array.isArray(tracks)) {
            console.error('setTracks received invalid tracks:', tracks);
            selectedTrackOptions.value = [];
            return;
        }
        const updatedTrackOptions = tracks.map(track => {
            return tracksOptions.find(option => option.value === track) || { label: track.toString(), value: track };
        });
    }

    function getTracksOptions(): SrListNumberItem[] {
        return tracksOptions;
    }

    function getTracks() : number[] {
        if(!Array.isArray(selectedTrackOptions.value)) {
            console.error(`getTracks: selectedTrackOptions is not an array`, selectedTrackOptions.value);
            return [];
        }
        return selectedTrackOptions.value.map(track => track.value);
    }

    function getSelectedTrackOptions():SrListNumberItem[] {
        return selectedTrackOptions.value;
    }

    function setGts(gts: number[]) {
        if (!Array.isArray(gts)) {
            console.error('setGts received invalid gts:', gts);
            selectedGtOptions.value = [];
            return;
        }
        selectedGtOptions.value = gts.map(gt => {
            return gtsOptions.find(option => option.value === gt) || { label: gt.toString(), value: gt };
        });
    }

    function getGts(): number[] {
        if (!Array.isArray(selectedGtOptions.value)) {
            console.error(`getBeams: selectedGtOptions is not an array`, selectedGtOptions.value);
            return [];
        }
        return selectedGtOptions.value.map(gt => gt.value);
    }


    function getGtsOptions(): SrListNumberItem[] {
        return gtsOptions;
    }

    function appendToSelectedGtOptions(gt: SrListNumberItem) {
        const beamExists = selectedGtOptions.value.some(b => b.value === gt.value);
        if (!beamExists) {
            selectedGtOptions.value.push(gt);
        }
    }

    function setSelectedGtOptions(gtOptions: SrListNumberItem[]) {
        if (!Array.isArray(gtOptions)) {
            console.error('setSelectedGtOptions received invalid gtOptions:', gtOptions);
            selectedGtOptions.value = [];
            return;
        }
        selectedGtOptions.value = gtOptions;
    }

    function getSelectedGtOptions(): SrListNumberItem[] {
        return selectedGtOptions.value;
    }

    function getGtLabels(): string[] {
        return selectedGtOptions.value.map(gt => gt.label);
    }

    function setGtsAndTracksWithGts(gts: SrListNumberItem[]) {
        const parms = getGtsAndTracksWithGts(gts);
        const trkList = parms.tracks.map(track => track.value);
        setSelectedGtOptions(parms.gts);
        setTracks(trkList);
    }

    function setTracksForGts(input_gts: SrListNumberItem[]) {    
        const tracks = input_gts
            .map(gt => tracksOptions.find(track => Number(gt.label.charAt(2)) === track.value))
            .filter((track): track is SrListNumberItem => track !== undefined);
        const trkList = tracks.map(track => track.value);
        setTracks(trkList);
    }

    function setGtsForTracks(input_tracks: number[]) {
        const gts = input_tracks
            .map(track => gtsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
            .filter((gt): gt is SrListNumberItem => gt !== undefined);
        setSelectedGtOptions(gts);
    }

    function setPairs(pairs: number[]) {
        if (!Array.isArray(pairs)) {
            console.error('setPairs received invalid pairs:', pairs);
            selectedPairOptions.value = [];
            return;
        }
        selectedPairOptions.value = pairs.map(pair => {
            return pairOptions.find(option => option.value === pair) || { label: pair.toString(), value: pair };
        });
    }

    function getSelectedPairOptions(): SrListNumberItem[] {
        return selectedPairOptions.value;
    }

    function getPairs(): number[] {
        return selectedPairOptions.value.map(pair => pair.value);
    }

    function getFilteredPairOptions(): SrListNumberItem[] {
        return filteredPairOptions.value;
    }

    function setFilteredPairOptions(pairOptions: SrListNumberItem[]) {
        filteredPairOptions.value = pairOptions;
    }

    function setSelectedPairOptions(pairOptions: SrListNumberItem[]) {
        if (!Array.isArray(pairOptions)) {
            console.error('setSelectedPairOptions received invalid pairOptions:', pairOptions);
            selectedPairOptions.value = [];
            return;
        }
        selectedPairOptions.value = pairOptions;
    }

    function appendPair(pair: number) {
        selectedPairOptions.value.push({ label: pair.toString(), value: pair });
    }

    function getScOrientOptions(): SrListNumberItem[] {
        return scOrientOptions;
    }

    function getSelectedScOrientOptions(): SrListNumberItem[] {
        return selectedScOrientOptions.value;
    }

    function setScOrients(scOrients:number[]) {
        if (!Array.isArray(scOrients)) {
            console.error('setSelectedScOrientOptions received invalid scOrients:', scOrients);
            selectedScOrientOptions.value = [];
            return;
        }
        selectedScOrientOptions.value = scOrients.map(scOrient => {
            return scOrientOptions.find(option => option.value === scOrient) || { label: scOrient.toString(), value: scOrient };
        });
    }

    function getScOrients(): number[] {
        return selectedScOrientOptions.value.map(scOrient => scOrient.value);
    }

    function getScOrientsLabels(): string[] {
        return selectedScOrientOptions.value.map(scOrient => scOrient.label);
    }

    function hasScForward(): boolean {
        return selectedScOrientOptions.value.some(scOrient => scOrient.value === SC_FORWARD);
    }

    function hasScBackward(): boolean {
        return selectedScOrientOptions.value.some(scOrient => scOrient.value !== SC_FORWARD);
    }

    function setSelectedScOrientOptions(scOrientOptions: SrListNumberItem[]) {
        if (!Array.isArray(scOrientOptions)) {
            console.error('setSelectedScOrientOptions received invalid scOrientOptions:', scOrientOptions);
            selectedScOrientOptions.value = [];
            return;
        }
        selectedScOrientOptions.value = scOrientOptions;
    }

    function appendScOrient(scOrient: number) {
        selectedScOrientOptions.value.push({ label: scOrient.toString(), value: scOrient });
    }

    function setFilteredScOrientOptions(scOrientOptions: SrListNumberItem[]) {
        filteredScOrientOptions.value = scOrientOptions;
    }

    function getFilteredScOrientOptions(): SrListNumberItem[] {
        return filteredScOrientOptions.value;
    }


    return {
        getCycleOptions,
        getCycleOptionsValues,
        setCycleOptions,
        findCycleOption,
        cycleOptions,
        setCycles,
        getCycles,
        setSelectedCycleOptions,
        getSelectedCycleOptions,
        selectedCycleOptions,
        getFilteredCycleOptions,
        setFilteredCycleOptions,
        setRgtOptions,
        getRgtOptions,
        rgtOptions,
        setRgt,
        getRgt,
        selectedRgtOption,
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
        setGtsAndTracksWithGts,
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
        getScOrientOptions,
        getSelectedScOrientOptions,
        setSelectedScOrientOptions,
        selectedScOrientOptions,
        appendScOrient,
        setFilteredScOrientOptions,
        getFilteredScOrientOptions,
        getScOrientsLabels,
        hasScForward,
        hasScBackward,
        scrollX,
        scrollY,
        titleOfElevationPlot: ref('Highlighted Track'),
    };
});
