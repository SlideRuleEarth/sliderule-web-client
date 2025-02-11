import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SrListNumberItem } from '@/types/SrTypes';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { gtsOptions, tracksOptions, spotsOptions, pairOptions, scOrientOptions } from '@/utils/parmUtils';
import { SC_FORWARD } from '@/sliderule/icesat2';

export const useGlobalChartStore = defineStore('globalChartStore', () => {
    const cycleOptions = ref<SrListNumberItem[]>([]);
    const selectedCycleOptions = ref<SrListNumberItem[]>([]);
    const filteredCycleOptions = ref<SrListNumberItem[]>([]);// subset for selected 
    const rgtOptions = ref<SrListNumberItem[]>([]);
    const selectedRgtOptions = ref<SrListNumberItem[]>([]);
    const filteredRgtOptions = ref<SrListNumberItem[]>([]);// subset for selected 
    const selectedSpots = ref<number[]>([]);
    const selectedTrackOptions = ref<number[]>([]);
    const filteredTrackOptions = ref<number[]>([]);// subset for selected
    const selectedGtOptions = ref<SrListNumberItem[]>([]);
    const filteredBeamOptions = ref<SrListNumberItem[]>([]);// subset for selected
    const selectedPairOptions = ref<SrListNumberItem[]>([]);
    const filteredPairOptions = ref<SrListNumberItem[]>([]);// subset for selected
    const selectedScOrientOptions = ref<SrListNumberItem[]>([]);
    const filteredScOrientOptions = ref<SrListNumberItem[]>([]);// subset for selected

    function setCycleOptions(newCycleOptions: SrListNumberItem[]) {
        cycleOptions.value = newCycleOptions;  
    }

    function getCycleOptions(): SrListNumberItem[] {
        return cycleOptions.value;
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

    function appendToSelectedCycleOptions(cycle: number) {
        const cycleExists = selectedCycleOptions.value.some(c => c.value === cycle);
        if (!cycleExists) {
            selectedCycleOptions.value.push({ label: cycle.toString(), value: cycle });
        }
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

    function setRgts(rgtOptions: number[]) {
        if(!Array.isArray(rgtOptions)) {    
            console.error('setRgts received invalid rgts:', rgtOptions);
            selectedRgtOptions.value = [];
            return;
        }
        const updatedRgtOptions = rgtOptions.map(rgt => {
            return findRgtOption(rgt) || { label: rgt.toString(), value: rgt };
        });
        setSelectedRgtOptions(updatedRgtOptions);
        console.log('setRgts rgts:', rgtOptions, ' selectedRgtOptions:', selectedRgtOptions.value);
    }

    function getRgts(): number[] {
        if(!Array.isArray(selectedRgtOptions.value)) {
            console.error(`getRgts: selectedRgtOptions is not an array`, selectedRgtOptions.value);
            return [];
        }
        return selectedRgtOptions.value.map(rgt => rgt.value);
    }

    function setSelectedRgtOptions(rgtOptions: SrListNumberItem[]) {
        if (!Array.isArray(rgtOptions)) {
            console.error('setSelectedRgtOptions received invalid rgtOptions:', rgtOptions);
            selectedRgtOptions.value = [];
            return;
        }
        selectedRgtOptions.value = rgtOptions;
    }

    function getSelectedRgtOptions(): SrListNumberItem[] {
        return selectedRgtOptions.value;
    }

    function appendToSelectedRgtOptions(rgt: number) {
        const rgtExists = selectedRgtOptions.value.some(r => r.value === rgt);
        if (!rgtExists) {
            selectedRgtOptions.value.push({ label: rgt.toString(), value: rgt });   
        }
    }

    function getFilteredRgtOptions(): SrListNumberItem[] {
        return filteredRgtOptions.value;
    }

    function setFilteredRgtOptions(rgtOptions: SrListNumberItem[]) {
        filteredRgtOptions.value = rgtOptions;
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
        selectedTrackOptions.value = tracks;
    }

    function getTracksOptions(): SrListNumberItem[] {
        return tracksOptions;
    }

    function getTracks() : number[] {
        return selectedTrackOptions.value;
    }

    function appendTrack(track: number) {
        selectedTrackOptions.value.push(track);
    }

    function getFilteredTrackOptions(): number[] {
        return filteredTrackOptions.value;
    }

    function setFilteredTrackOptions(tracks: number[]) {
        filteredTrackOptions.value = tracks;
    }

    function setGts(beams: number[]) {
        if (!Array.isArray(beams)) {
            console.error('setGts received invalid beams:', beams);
            selectedGtOptions.value = [];
            return;
        }
        selectedGtOptions.value = beams.map(beam => {
            return gtsOptions.find(option => option.value === beam) || { label: beam.toString(), value: beam };
        });
    }

    function getGts(): number[] {
        if (!Array.isArray(selectedGtOptions.value)) {
            console.error(`getBeams: selectedGtOptions is not an array`, selectedGtOptions.value);
            return [];
        }
        return selectedGtOptions.value.map(beam => beam.value);
    }


    function getGtsOptions(): SrListNumberItem[] {
        return gtsOptions;
    }

    function appendToSelectedGtOptions(beam: SrListNumberItem) {
        const beamExists = selectedGtOptions.value.some(b => b.value === beam.value);
        if (!beamExists) {
            selectedGtOptions.value.push(beam);
        }
    }

    function setSelectedGtOptions(beamOptions: SrListNumberItem[]) {
        if (!Array.isArray(beamOptions)) {
            console.error('setSelectedGtOptions received invalid beamOptions:', beamOptions);
            selectedGtOptions.value = [];
            return;
        }
        selectedGtOptions.value = beamOptions;
    }

    function getSelectedGtOptions(): SrListNumberItem[] {
        return selectedGtOptions.value;
    }

    function getFilteredBeamOptions(): SrListNumberItem[] {
        return filteredBeamOptions.value;
    }

    function setFilteredBeamOptions(beamOptions: SrListNumberItem[]) {
        filteredBeamOptions.value = beamOptions;
    }

    function getBeamLabels(): string[] {
        return selectedGtOptions.value.map(beam => beam.label);
    }

    function setBeamsAndTracksWithGts(gts: SrListNumberItem[]) {
        const parms = getBeamsAndTracksWithGts(gts);
        const trkList = parms.tracks.map(track => track.value);
        setSelectedGtOptions(parms.beams);
        setTracks(trkList);
    }

    function setTracksForBeams(input_beams: SrListNumberItem[]) {    
        const tracks = input_beams
            .map(beam => tracksOptions.find(track => Number(beam.label.charAt(2)) === track.value))
            .filter((track): track is SrListNumberItem => track !== undefined);
        const trkList = tracks.map(track => track.value);
        setTracks(trkList);
    }

    function setBeamsForTracks(input_tracks: number[]) {
        const beams = input_tracks
            .map(track => gtsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
            .filter((beam): beam is SrListNumberItem => beam !== undefined);
        setSelectedGtOptions(beams);
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
        setCycleOptions,
        findCycleOption,
        setCycles,
        getCycles,
        setSelectedCycleOptions,
        getSelectedCycleOptions,
        appendToSelectedCycleOptions,
        getFilteredCycleOptions,
        setFilteredCycleOptions,
        setRgtOptions,
        getRgtOptions,
        setRgts,
        getRgts,
        getSelectedRgtOptions,
        setSelectedRgtOptions,
        appendToSelectedRgtOptions,
        getFilteredRgtOptions,
        setFilteredRgtOptions,
        selectedSpots,
        getSpots,
        setSpots,
        getTracksOptions,
        getTracks,
        setTracks,
        getFilteredTrackOptions,
        setFilteredTrackOptions,
        appendTrack,
        getGts,
        setGts,
        getGtsOptions,
        getBeamLabels,
        appendToSelectedGtOptions,
        getSelectedGtOptions,
        setSelectedGtOptions,
        getFilteredBeamOptions,
        setFilteredBeamOptions,
        setBeamsAndTracksWithGts,
        setTracksForBeams,
        setBeamsForTracks,
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
        appendScOrient,
        setFilteredScOrientOptions,
        getFilteredScOrientOptions,
        getScOrientsLabels,
        hasScForward,
        hasScBackward,
    };
});
