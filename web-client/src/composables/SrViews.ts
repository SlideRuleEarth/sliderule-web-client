import { ref, computed } from "vue";

export interface SrView {
  hide: boolean;
  view: string;
  projectionName: string;
  baseLayerName: string;
}

// srViews is now an object with keys as view names
export const srViews = ref<{ [key: string]: SrView }>({
  "Global Mercator Esri": {
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857",
    baseLayerName: "Esri World Topo",
  },
  "Global Esri": {
    hide: true,
    view: "Global WSG 84",
    projectionName: "EPSG:4326",
    baseLayerName: "Esri World Topo",
  },
  "Global Mercator Google": {
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857",
    baseLayerName: "Google",
  },
  "Global Google": {
    hide: true,
    view: "Global WSG 84",
    projectionName: "EPSG:4326",
    baseLayerName: "Google",
  },
  "Global Mercator OSM": {
    hide: false,
    view: "Global Mercator",
    projectionName: "EPSG:3857",
    baseLayerName: "OpenStreet",
  },
  "Global OSM": {
    hide: true,
    view: "Global WSG 84",
    projectionName: "EPSG:4326",
    baseLayerName: "OpenStreet",
  },  
  "North": {
    hide: true,
    view: "North",
    projectionName: "EPSG:5936",
    baseLayerName: "Arctic Ocean Base",
  },
  "North NSIDC": {
    hide: true,
    view: "North NDIC",
    projectionName: "EPSG:3413",
    baseLayerName: "Arctic Ocean Base",
  },  
  "South Antarctic Polar Stereographic": {
    hide: true,
    view: "South",
    projectionName: "EPSG:3031",
    baseLayerName: "Antarctic Imagery",
  }
});

export const useViewNames = () => {
  const viewsNames = computed(() => 
    Object.keys(srViews.value).filter(key => !srViews.value[key].hide)
  );
  return viewsNames;
};

export const findViewByName = (name: string) => {
  return computed(() => srViews.value[name]?.hide ? null : srViews.value[name]);
};

export const getDefaultView = () => {
  const defaultView = srViews.value["Global Mercator Esri"];
  return defaultView?.hide ? null : defaultView;
};

export const getUniqueViews = () => {
  const uniqueViews = computed(() => {
    const viewSet = new Set<string>(
      Object.values(srViews.value)
        .filter((srView) => !srView.hide)
        .map((srView) => srView.view)
    );
    return Array.from(viewSet);
  });

  return uniqueViews;
};

export const getUniqueBaseLayersByView = (view: string) => {
  const uniqueBaseLayers = computed(() => {
    const baseLayerSet = new Set<string>(
      Object.values(srViews.value)
        .filter((srView) => srView.view === view && !srView.hide)
        .map((srView) => srView.baseLayerName)
    );
    return Array.from(baseLayerSet);
  });

  return uniqueBaseLayers;
};

export const getBaseLayersForView = (currentView: string) => { 
  const baseLayers = computed(() => {
    return Object.values(srViews.value)
      .filter((srView) => srView.view === currentView && !srView.hide)
      .map((srView) => srView.baseLayerName);
  });

  return baseLayers;
};

export const getDefaultBaseLayerForView = (currentView: string) => {
  const defaultBaseLayer = computed(() => {
    const baseLayers = getBaseLayersForView(currentView).value;
    return baseLayers.length > 0 ? baseLayers[0] : null;
  });

  return defaultBaseLayer;
};

export const findSrView = (viewName: string, baseLayerName: string) => {
  const srView = computed(() => {
    return Object.values(srViews.value).find(
      (srView) =>
        srView.view === viewName &&
        srView.baseLayerName === baseLayerName &&
        !srView.hide
    ) || Object.values(srViews.value).find((srView) => srView.view === viewName) ||
    null
  });

  return srView;
};

export const findSrViewKey = (viewName: string, baseLayerName: string) => {
  return computed(() => {
    const entry = Object.entries(srViews.value).find(
      ([, srView]) =>
        srView.view === viewName &&
        srView.baseLayerName === baseLayerName &&
        !srView.hide
    );
    return entry ? entry[0] : null; // Return the key if found, otherwise null
  });
};
