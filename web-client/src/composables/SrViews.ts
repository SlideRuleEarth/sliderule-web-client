import { ref, computed } from "vue";

export interface SrView {
  name: string;
  hide: boolean;
  view: string;
  projectionName: string;
  baseLayerName: string;
}

// srViews is now an object with keys as view names
export const srViews = ref<{ [key: string]: SrView }>({
  "Global Mercator Esri": {
    name: "Global Mercator Esri",
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857", // 
    baseLayerName: "Esri World Topo",
  },
  "Global Esri": {
    hide: false,
    name: "Global Esri",
    view: "Global WSG 84",
    projectionName: "EPSG:4326", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "Esri World Topo",
  },
  "Global Mercator Google": {
    name: "Global Mercator Google",
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "Google",
  },
  "Global Google": {
    name: "Global Google",
    hide: false,
    view: "Global WSG 84",
    projectionName: "EPSG:4326", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "Google",
  },
  "Global Mercator OSM": {
    name: "Global Mercator OSM",
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "OpenStreet",
  },
  "Global OSM": {
    name: "Global OSM",
    hide: false,
    view: "Global WSG 84",
    projectionName: "EPSG:4326", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "OpenStreet",
  },  
  "North": {
    name: "North Polar Stereographic",
    hide: false,
    view: "North",
    projectionName: "EPSG:5936",// +proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs
    baseLayerName: "Artic Ocean Base",
  },
  "North NSIDC": {
    name: "North NSIDC",
    hide: false,
    view: "North NSIDC",
    projectionName: "EPSG:3413", //"+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs",
    baseLayerName: "Artic Ocean Base",
  },  
  "South Antarctic Polar Stereographic": {
    name: "South",
    hide: false,
    view: "South:",
    projectionName: "EPSG:3031", // +proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs
    baseLayerName: "Antartic Imagery",
  }
});

// Updated to work with an object
export const useViewNames = () => {
  const viewsNames = computed(() => Object.keys(srViews.value));
  return viewsNames;
};

// Directly access the view by its name
export const findViewByName = (name: string) => {
  return computed(() => srViews.value[name]);
};

// Assuming "Web Mercator" is the default view, or you can introduce a new ref to keep track of the default view's name
export const getDefaultView = () => {
  return srViews.value["Web Mercator"];
};

// Get unique views
export const getUniqueViews = () => {
  const uniqueViews = computed(() => {
    const viewSet = new Set<string>(
      Object.values(srViews.value).map((srView) => srView.view)
    );
    return Array.from(viewSet);
  });

  return uniqueViews;
};

// Get unique base layers by view
export const getUniqueBaseLayersByView = (view: string) => {
  const uniqueBaseLayers = computed(() => {
    const baseLayerSet = new Set<string>(
      Object.values(srViews.value)
        .filter((srView) => srView.view === view)
        .map((srView) => srView.baseLayerName)
    );
    return Array.from(baseLayerSet);
  });

  return uniqueBaseLayers;
};

export const getBaseLayersForCurrentView = (currentView: string) => { 
  const baseLayers = computed(() => {
    return Object.values(srViews.value)
      .filter((srView) => srView.view === currentView)
      .map((srView) => srView.baseLayerName);
  });

  return baseLayers;
}
export const findSrView = (viewName: string, baseLayerName: string) => {
  const srView = computed(() => {
    return Object.values(srViews.value).find(
      (srView) => srView.view === viewName && srView.baseLayerName === baseLayerName
    ) || null;
  });

  return srView;
};
