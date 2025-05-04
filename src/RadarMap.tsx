import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import OLView from "ol/View";
import Attribution from "ol/control/Attribution";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import olms from 'ol-mapbox-style';
import versatiles from "./assets/versatiles-eclipse.json?url";
import "ol/ol.css";
import "./RadarMap.css"

export default function RadarMap({ lat, lon }: { lat: number, lon: number }) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const olMapRef = useRef<OLMap>(null);
  
    // Insert map
    useEffect(() => {
      const node = mapDivRef.current;
      if (node) {
        const map = new OLMap({
          target: node,
          layers: [
            // Use GetCapabilities to see what layers are available:
            // <https://nowcoast.noaa.gov/geoserver/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities>
            //
            // Uncomment the layer below and use DevTools Network pane to see what requests are being made.
            // Find the GetMap request and change the WIDTH/HEIGHT to the tilesize in the style json and the BBOX to the placeholder:
            // <https://nowcoast.noaa.gov/geoserver/ows?service=wms&REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS=weather_radar:conus_base_reflectivity_mosaic&WIDTH=256&HEIGHT=256&CRS=EPSG:3857&BBOX={bbox-epsg-3857}>
            //
            // new ImageLayer({
            //   source: new ImageWMS({
            //     url: 'https://nowcoast.noaa.gov/geoserver/ows?service=wms',
            //     params: { 'LAYERS': 'weather_radar:conus_base_reflectivity_mosaic' },
            //     ratio: 1,
            //     serverType: 'geoserver',
            //   }),
            // }),
          ],
          view: new OLView({
            zoom: 10
          }),
          controls: [new Attribution({ collapsible: false })]
        });

        // Asynchronously load the style for the vector map and raster radar layers
        olms(map, versatiles);
  
        olMapRef.current = map;
        return () => map.setTarget(undefined);
      }
  
      return () => { };
    }, []);
  
    // Re-center map
    useEffect(() => {
      const currentMap = olMapRef.current;
      if (currentMap) {
        currentMap.getView().setCenter(fromLonLat([lon, lat]));
      }
    }, [lat, lon]);
  
    // Process map div resize
    useEffect(() => {
      const node = mapDivRef.current;
      if (node) {
        const observer = new ResizeObserver(() => {
          const currentMap = olMapRef.current;
          if (currentMap) {
            currentMap.updateSize();
          }
        });
  
        observer.observe(node);
        return () => observer.unobserve(node);
      }
  
      return () => { };
    }, []);
  
    // Periodically refresh map
    useEffect(() => {
      const intervalId = window.setInterval(() => {
        const currentMap = olMapRef.current;
        if (currentMap) {
          currentMap.getAllLayers().forEach((layer) => {
            if (layer instanceof TileLayer) {
              layer.getSource()?.refresh();
            }
          });
        }
      }, 10 * 60 * 1000);
  
      return () => window.clearInterval(intervalId);
    }, []);
  
    return <div ref={mapDivRef} style={{ width: '100%', minHeight: '400px' }}></div>;
  };
