import { ref, computed } from "vue";

export interface SrView {
  name: string;
  description: string;
  default_zoom?: number;
  min_zoom: number;
  max_zoom: number;
  bbox: number[];
}

// srViews is now an object with keys as view names
export const srViews = ref<{ [key: string]: SrView }>({
  "Global": {
    name: "Global",
    description: "Web Mercator",
    default_zoom: 1,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, -90.0, 180.0],
  },
  "North": {
    name: "North",
    description: "North Polar Stereographic",
    default_zoom: 5,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, 60.0, 180.0],
  },
  "South": {
    name: "South",
    description: "South: Antarctic Polar Stereographic",
    default_zoom: 2,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [-60.0, -180.0, -90.0, 180.0],
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
