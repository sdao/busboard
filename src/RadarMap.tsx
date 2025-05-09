import { useEffect, useRef } from "react";
import Map, { MapRef } from "react-map-gl/maplibre";
import { addProtocol, removeProtocol } from "maplibre-gl";
import versatiles from "./assets/versatiles-eclipse.json?url";
import { processRadarImage } from "./imageData";
import "maplibre-gl/dist/maplibre-gl.css";
import "./RadarMap.css"

export default function RadarMap({ lat, lon, radarStation }: { lat: number, lon: number, radarStation?: string }) {
  const mapRef = useRef<MapRef | null>(null);

  // Periodically refresh the map
  useEffect(() => {
    const refreshIntervalId = window.setInterval(() => {
      if (mapRef.current) {
        mapRef.current.refreshTiles("noaa-ncep-opengeo");
      }
    }, 10 * 60 * 1000);

    return () => window.clearInterval(refreshIntervalId);
  }, []);

  // Register a handler for the radar: protocol that downloads the radar image and then processes it
  // before handing it off to maplibregl
  useEffect(() => {
    addProtocol("radar", async (params) => {
      // See https://www.weather.gov/gis/
      // and https://opengeo.ncep.noaa.gov/geoserver/www/index.html
      // and https://www.weather.gov/radarfaq
      //
      // If we have a known radar station, pull its image directly to use Super-Resolution Base Reflectivity.
      // Otherwise use the national radar "mosaic", which is a lower resolution but covers all of the US.
      // This fills in the template string
      // radar://opengeo.ncep.noaa.gov/geoserver/{station}/ows?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS={layer}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX={bbox-epsg-3857}
      const station = radarStation ? radarStation.toLowerCase() : "conus/conus_bref_qcd";
      const layer = radarStation ? `${radarStation.toLowerCase()}_sr_bref` : "conus_bref_qcd";
      const transformedPath = params.url.split("://")[1].replaceAll("{station}", station).replaceAll("{layer}", layer);
      const url = `https://${transformedPath}`;
      const processedBuffer = await processRadarImage(url);
      return { data: processedBuffer };
    });

    if (mapRef.current && mapRef.current.getSource("noaa-ncep-opengeo")) {
      mapRef.current.refreshTiles("noaa-ncep-opengeo");
    }

    return () => removeProtocol("radar");
  }, [radarStation]);

  return <Map
    ref={mapRef}
    longitude={lon}
    latitude={lat}
    zoom={9}
    mapStyle={versatiles}
    attributionControl={{ compact: false }}
  />;
};
