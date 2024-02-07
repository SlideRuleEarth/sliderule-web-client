
import { ref } from "vue";
export interface SrBaseLayer {
    url: string;
    title: string;
    attribution: string;
    allowed_projections: string[];
    type?: string;
}
export const baseLayers = ref<SrBaseLayer[]>([
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      title: "Esri-World-Topo",
      attribution: "Tiles © Esri contributers",
      allowed_projections:["EPSG:3857","EPSG:4326"]
    },
    {
      url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      title: "OpenStreet",
      attribution: "© OpenStreetMap contributors",
      allowed_projections:["EPSG:3857","EPSG:4326"]
    },
    {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      title: "Google",
      attribution: "Map data © Google",
      allowed_projections:["EPSG:3857","EPSG:4326"]
    },
    {
      url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      title: "Artic Ocean Base",
      attribution: "Tiles © Esri contributers",
      allowed_projections:["EPSG:5936"]
    },
    {
      url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}",
      title: "Artic Imagery",
      attribution: "Tiles © Esri Artic Imagery contributers",
      allowed_projections:["EPSG:5936"]
    },
    {
      url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
      title: "Artic Reference",
      attribution: "Tiles © Esri Artic Ref contributers",
      allowed_projections:["EPSG:5936"]
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      title: "Esri World Topo",
      attribution: "Tiles © Esri World Topo contributers",
      allowed_projections:["EPSG:3857","EPSG:4326"]
    },
    {
      url:"http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}",
      title: "Antarctic Imagery",
      attribution: "Tiles © Esri Antartic contributers",
      allowed_projections:["EPSG:3031"]
    },
    {
      url:"url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?TIME=2013-12-01'",
      title: "NASA Gibs",
      attribution: "Tiles © NASA Gibs contributers",
      allowed_projections:["EPSG:3031"],
      type: "wmts"
    }
  ]);
