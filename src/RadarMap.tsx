import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import OLView from "ol/View";
import Attribution from "ol/control/Attribution";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { fromLonLat } from "ol/proj";
import { MapboxVectorLayer } from "ol-mapbox-style";
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
            new MapboxVectorLayer({
              styleUrl: versatiles
            }),
            new ImageLayer({
              source: new ImageWMS({
                url: 'https://nowcoast.noaa.gov/geoserver/ows?service=wms',
                params: { 'LAYERS': 'weather_radar:conus_base_reflectivity_mosaic' },
                ratio: 1,
                serverType: 'geoserver',
              }),
            }),
          ],
          view: new OLView({
            zoom: 10
          }),
          controls: [new Attribution({ collapsible: false })]
        });
  
        map.updateSize();
  
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
            if (layer instanceof ImageLayer) {
              layer.getSource()?.refresh();
            }
          });
        }
      }, 10 * 60 * 1000);
  
      return () => window.clearInterval(intervalId);
    }, []);
  
    return <div ref={mapDivRef} style={{ width: '100%', minHeight: '400px' }}></div>;
  };
