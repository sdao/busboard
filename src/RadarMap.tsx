import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import OLView from "ol/View";
import Attribution from "ol/control/Attribution";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { fromLonLat } from "ol/proj";
import olms, { getLayer } from "ol-mapbox-style";
import versatiles from "./assets/versatiles-eclipse.json?url";
import { processRadarImage } from "./imageData";
import "ol/ol.css";
import "./RadarMap.css"

export default function RadarMap({ lat, lon, radarStation }: { lat: number, lon: number, radarStation?: string }) {
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
      const refreshIntervalId = window.setInterval(() => {
        map.getAllLayers().forEach((layer) => {
          if (layer instanceof ImageLayer) {
            layer.getSource()?.refresh();
          }
        });
      }, 10 * 60 * 1000);

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
              // See https://www.weather.gov/gis/
              // and https://opengeo.ncep.noaa.gov/geoserver/www/index.html
              // and https://www.weather.gov/radarfaq
              //
              // If we have a known radar station, pull its image directly to use Super-Resolution Base Reflectivity.
              // Otherwise use the national radar "mosaic", which is a lower resolution but covers all of the US.
              let url: string, params: { [x: string]: string };
              if (radarStation) {
                url = `https://opengeo.ncep.noaa.gov/geoserver/${radarStation.toLowerCase()}/ows?service=wms`;
                params = { 'LAYERS': `${radarStation.toLowerCase()}_sr_bref` };
              }
              else {
                url = 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms';
                params = { 'LAYERS': 'conus_bref_qcd' };
              }

              const imageLayer = new ImageLayer({
                source: new ImageWMS({
                  url,
                  params,
                  ratio: 1,
                  serverType: 'geoserver',
                  imageLoadFunction: async (image, src) => {
                    const imgElem = image.getImage();
                    if (imgElem instanceof HTMLImageElement || imgElem instanceof HTMLVideoElement) {
                      imgElem.src = await processRadarImage(src);
                    }
                  },
                }),
                opacity: 0.8,
              });

              layers.insertAt(i, imageLayer);
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
  }, [radarStation]);

  // Re-center map
  useEffect(() => {
    const currentMap = olMapRef.current;
    if (currentMap) {
      currentMap.getView().setCenter(fromLonLat([lon, lat]));
    }
  }, [lat, lon, radarStation /* when radarStation changes, map is reconstructed */]);

  return <div ref={mapDivRef} style={{ width: '100%', minHeight: '400px' }}></div>;
};
