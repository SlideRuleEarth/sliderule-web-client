
import { ref } from "vue";
export interface SrBaseLayer {
    url: string;
    title: string;
    attribution: string;
}
export const baseLayers = ref<SrBaseLayer[]>([
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      title: "Esri-World-Topo",
      attribution: "Tiles © Esri contributers"
    },
    {
      url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      title: "OpenStreet",
      attribution: "© OpenStreetMap contributors"
    },
    {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      title: "Google",
      attribution: "Map data © Google"
    }
  ]);
