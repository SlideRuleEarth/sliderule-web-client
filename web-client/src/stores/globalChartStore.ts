import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SrListNumberItem } from '@/types/SrTypes';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions, spotsOptions, pairOptions, scOrientOptions } from '@/utils/parmUtils';
import { get, set } from 'lodash';
import { number } from 'echarts';

export const useGlobalChartStore = defineStore('globalChartStore', () => {
    const cycleOptions = ref<SrListNumberItem[]>([]);
    const selectedCycleOptions = ref<SrListNumberItem[]>([]);
    const filteredCycleOptions = ref<SrListNumberItem[]>([]);// subset for selected 
    const rgtOptions = ref<number[]>([]);
    const selectedRgtOption = ref<number>(-1);//Only one RGT can be selected
    const filteredRgtOptions = ref<number[]>([]);// subset for selected 
    const selectedSpotOptions = ref<SrListNumberItem[]>([]);
    const filteredSpotOptions = ref<SrListNumberItem[]>([]);// subset for selected 
    const selectedTrackOptions = ref<number[]>([]);
    const filteredTrackOptions = ref<number[]>([]);// subset for selected
    const selectedBeamOptions = ref<SrListNumberItem[]>([]);
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
    
    function setRgtOptions(newRgtOptions: number[]) {
        rgtOptions.value = newRgtOptions;  
    }
    
    function getRgtOptions(): number[] {
        return rgtOptions.value;
    }

    function setRgt(rgtOption: number) {
        selectedRgtOption.value = rgtOption;
    }

    function getRgt(): number {
        return selectedRgtOption.value;
    }

    function getFilteredRgtOptions(): number[] {
        return filteredRgtOptions.value;
    }

    function setFilteredRgtOptions(rgtOptions: number[]) {
        filteredRgtOptions.value = rgtOptions;
    }

    function appendToSelectedSpotOptions(spot: SrListNumberItem) {
        const spotExists = selectedSpotOptions.value.some(s => s.value === spot.value);
        if (!spotExists) {
            selectedSpotOptions.value.push(spot);
        }
    }

    function getSpotsOptions(): SrListNumberItem[] {
        return spotsOptions;
    }

    function getFilteredSpotOptions(): SrListNumberItem[] {
        return filteredSpotOptions.value;
    }

    function setFilteredSpotOptions(spotsOptions: SrListNumberItem[]) {
        filteredSpotOptions.value = spotsOptions;
    }

    function setSpots(spots: number[]) {
        if (!Array.isArray(spots)) {
            console.error('setSpots received invalid spots:', spots);
            selectedSpotOptions.value = [];
            return;
        }
        selectedSpotOptions.value = spots.map(spot => {
            return spotsOptions.find(option => option.value === spot) || { label: spot.toString(), value: spot };
        });
    }

    function getSpots(): number[] {
        if (!Array.isArray(selectedSpotOptions.value)) {
            console.error(`getSpots: selectedSpotOptions is not an array`, selectedSpotOptions.value);
            return [];
        }
        return selectedSpotOptions.value.map(spot => spot.value);
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

    function setBeams(beams: number[]) {
        if (!Array.isArray(beams)) {
            console.error('setBeams received invalid beams:', beams);
            selectedBeamOptions.value = [];
            return;
        }
        selectedBeamOptions.value = beams.map(beam => {
            return beamsOptions.find(option => option.value === beam) || { label: beam.toString(), value: beam };
        });
    }

    function getBeams(): number[] {
        if (!Array.isArray(selectedBeamOptions.value)) {
            console.error(`getBeams: selectedBeamOptions is not an array`, selectedBeamOptions.value);
            return [];
        }
        return selectedBeamOptions.value.map(beam => beam.value);
    }


    function getBeamsOptions(): SrListNumberItem[] {
        return beamsOptions;
    }

    function appendToSelectedBeamOptions(beam: SrListNumberItem) {
        const beamExists = selectedBeamOptions.value.some(b => b.value === beam.value);
        if (!beamExists) {
            selectedBeamOptions.value.push(beam);
        }
    }

    function setSelectedBeamOptions(beamOptions: SrListNumberItem[]) {
        if (!Array.isArray(beamOptions)) {
            console.error('setSelectedBeamOptions received invalid beamOptions:', beamOptions);
            selectedBeamOptions.value = [];
            return;
        }
        selectedBeamOptions.value = beamOptions;
    }

    function getSelectedBeamOptions(): SrListNumberItem[] {
        return selectedBeamOptions.value;
    }

    function getFilteredBeamOptions(): SrListNumberItem[] {
        return filteredBeamOptions.value;
    }

    function setFilteredBeamOptions(beamOptions: SrListNumberItem[]) {
        filteredBeamOptions.value = beamOptions;
    }

    function getBeamLabels(): string[] {
        return selectedBeamOptions.value.map(beam => beam.label);
    }

    function setBeamsAndTracksWithGts(gts: SrListNumberItem[]) {
        const parms = getBeamsAndTracksWithGts(gts);
        const trkList = parms.tracks.map(track => track.value);
        setSelectedBeamOptions(parms.beams);
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
            .map(track => beamsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
            .filter((beam): beam is SrListNumberItem => beam !== undefined);
        setSelectedBeamOptions(beams);
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
        if (!Array.isArray(selectedScOrientOptions.value)) {
            console.error(`getScOrients: selectedScOrientOptions is not an array`, selectedScOrientOptions.value);
            return [];
        }
        return selectedScOrientOptions.value.map(scOrient => scOrient.value);
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
        setRgt,
        getRgt,
        getFilteredRgtOptions,
        setFilteredRgtOptions,
        getSpotsOptions,
        getSpots,
        setSpots,
        appendToSelectedSpotOptions,
        getFilteredSpotOptions,
        setFilteredSpotOptions,
        getTracksOptions,
        getTracks,
        setTracks,
        getFilteredTrackOptions,
        setFilteredTrackOptions,
        appendTrack,
        getBeamsOptions,
        getBeams,
        setBeams,
        getBeamLabels,
        appendToSelectedBeamOptions,
        getSelectedBeamOptions,
        setSelectedBeamOptions,
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
        setScOrients,
        getScOrients,
        getScOrientOptions,
        getSelectedScOrientOptions,
        setSelectedScOrientOptions,
        appendScOrient,
        setFilteredScOrientOptions,
        getFilteredScOrientOptions,
    };
});
