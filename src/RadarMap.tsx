import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import OLView from "ol/View";
import Attribution from "ol/control/Attribution";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { fromLonLat } from "ol/proj";
import olms, { getLayer } from "ol-mapbox-style";
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
        layers: [],
        view: new OLView({
          zoom: 10
        }),
        controls: [new Attribution({ collapsible: false })]
      });

      // Periodically refresh the map
      // This can happen a bit eagerly because the image requests will be cached by the browser
      const refreshIntervalId = window.setInterval(() => {
        map.getAllLayers().forEach((layer) => {
          if (layer instanceof ImageLayer) {
            layer.getSource()?.refresh();
          }
        });
      }, 2 * 60 * 1000);

      // Respond to the map div resizing
      const observer = new ResizeObserver(() => map.updateSize());
      observer.observe(node);

      // Asynchronously load the style for the vector map and raster radar layers
      // The raster radar layer is inserted into the layer stack by finding a special placeholder
      // in the mapbox style
      olms(map, versatiles).then(() => {
        const placeholderLayer = getLayer(map, "radar-placeholder");
        if (placeholderLayer) {
          const layers = map.getLayers();
          for (let i = 0; i < layers.getLength(); ++i) {
            if (layers.item(i) === placeholderLayer) {
              layers.insertAt(i, new ImageLayer({
                source: new ImageWMS({
                  url: 'https://nowcoast.noaa.gov/geoserver/ows?service=wms',
                  params: { 'LAYERS': 'weather_radar:conus_base_reflectivity_mosaic' },
                  ratio: 1,
                  serverType: 'geoserver',
                  attributions: 'NOAA',
                }),
                opacity: 0.7,
              }));
              break;
            }
          }
        }
      });

      olMapRef.current = map;
      return () => {
        window.clearInterval(refreshIntervalId);
        observer.unobserve(node);
        map.setTarget(undefined);
      };
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

  return <div ref={mapDivRef} style={{ width: '100%', minHeight: '400px' }}></div>;
};
