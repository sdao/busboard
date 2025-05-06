import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import OLView from "ol/View";
import Attribution from "ol/control/Attribution";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { fromLonLat } from "ol/proj";
import olms, { getLayer } from "ol-mapbox-style";
import versatiles from "./assets/versatiles-eclipse.json?url";
import { colorToAlpha, alphaBlendImageData } from "./imageData";
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
              const imageLayer = new ImageLayer({
                source: new ImageWMS({
                  // See https://www.weather.gov/gis/
                  url: 'https://opengeo.ncep.noaa.gov/geoserver/kgrk/ows?service=wms',
                  params: { 'LAYERS': 'kgrk_sr_bref' },
                  // url: 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms',
                  // params: { 'LAYERS': 'conus_bref_qcd' },
                  ratio: 1,
                  serverType: 'geoserver',
                  crossOrigin: 'anonymous',
                }),
              });

              let baseMapImageData: ImageData | null = null;
              imageLayer.on("prerender", (event) => {
                if (!(event.context instanceof CanvasRenderingContext2D)) {
                  return;
                }

                const canvas = event.context.canvas;
                const width = canvas.width;
                const height = canvas.height;
                baseMapImageData = event.context.getImageData(0, 0, width, height);

                const emptyImageData = event.context.createImageData(width, height);
                event.context.putImageData(emptyImageData, 0, 0);
              });

              imageLayer.on("postrender", (event) => {
                if (!(event.context instanceof CanvasRenderingContext2D && baseMapImageData)) {
                  return;
                }

                const canvas = event.context.canvas;
                const width = canvas.width;
                const height = canvas.height;
                const processedRadarImageData = colorToAlpha(
                  event.context.getImageData(0, 0, width, height),
                  { r: 255, g: 255, b: 255 }, 50);

                const compositedImageData = alphaBlendImageData(
                  processedRadarImageData, 0.8, baseMapImageData);
                event.context.putImageData(compositedImageData, 0, 0);
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
