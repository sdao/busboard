import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { useQuery, useQueryClient, QueryClient, QueryClientProvider, UseQueryResult } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";

import { getGtfsRealtimeQuery, getGtfsStaticQuery, getReverseGeocodeQuery, getUvForecastQuery, getWeatherCurrentQuery, getWeatherForecastQuery } from "./queries";
import BusTimeDisplay from "./BusTimeDisplay";
import RadarMap from "./RadarMap";
import WeatherDisplay from "./WeatherDisplay";

import "./App.css";

function AutoHideMouseCursor(props: React.PropsWithChildren) {
  const [showMouseCursor, setShowMouseCursor] = useState(true);
  const lastMouseMove = useRef(Temporal.Now.instant());

  // Mousemove/idle effect
  useEffect(() => {
    if (showMouseCursor) {
      const intervalId = window.setInterval(() => {
        const now = Temporal.Now.instant();
        if (now.since(lastMouseMove.current).total("seconds") > 10) {
          setShowMouseCursor(false);
        }
      }, 10 * 1000);

      return () => window.clearInterval(intervalId);
    }

    return () => { };
  }, [showMouseCursor]);

  const handleMouseMove = () => {
    lastMouseMove.current = Temporal.Now.instant();
    setShowMouseCursor(true);
  };

  return <div onMouseMove={handleMouseMove} className={showMouseCursor ? "" : "hide-mouse-cursor"}>{props.children}</div>;
}

function DisplayQueryError({ displayName, useQueryResult }: { displayName: string, useQueryResult: UseQueryResult }) {
  useEffect(() => {
    if (useQueryResult.failureReason !== null) {
      console.error(useQueryResult.failureReason);
    }
  }, [useQueryResult.failureReason]);

  if (useQueryResult.failureReason === null) {
    return <></>;
  }
  else {
    const time = useQueryResult.dataUpdatedAt == 0 ? "never" : `at  ${Temporal.Instant.fromEpochMilliseconds(useQueryResult.dataUpdatedAt).toLocaleString()}`;
    return <div><span>{displayName} last updated {time} <em>{useQueryResult.failureReason.message}</em></span></div>;
  }
}

function Dashboard({ lat, lon }: { lat: number, lon: number }) {
  // Query hooks
  useQueryClient();
  const reverseGeocode = useQuery(getReverseGeocodeQuery(lat, lon));
  const transitInfo = useQuery(getGtfsStaticQuery(lat, lon));
  const busTimes = useQuery(getGtfsRealtimeQuery(transitInfo.data));
  const weatherCurrent = useQuery(getWeatherCurrentQuery(reverseGeocode.data));
  const weatherForecast = useQuery(getWeatherForecastQuery(reverseGeocode.data));
  const uvForecast = useQuery(getUvForecastQuery(reverseGeocode.data));

  // Build rows for each stop/route/direction
  const rows = [];
  if (busTimes.data !== undefined) {
    for (const stop of busTimes.data.stops) {
      for (const route of stop.routes) {
        for (const dir of route.directions) {
          const key = `${stop.stopId}_${route.routeId}_${dir.directionId}`;
          rows.push(<BusTimeDisplay key={key} routeId={route.routeId} directionId={dir.directionId} nextInstances={dir.nextInstances} transitInfo={transitInfo.data ?? null} />);
        }
      }
    }
  }

  // Determine if the bus time components and/or radar components should be shown
  const paramsString = window.location.search;
  const searchParams = new URLSearchParams(paramsString);
  const forceBus = (() => {
    const flag = searchParams.get("bus");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();
  const forceRadar = (() => {
    const flag = searchParams.get("radar");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();

  const showBus = forceBus ?? (rows.length > 0);
  const showRadarIfChancePrecipitationGreater = 20;
  const showRadar = forceRadar ?? ((weatherCurrent.data !== undefined && weatherCurrent.data.precipitation !== null) || (weatherForecast.data !== undefined && weatherForecast.data.chancePrecipitation > showRadarIfChancePrecipitationGreater));

  return (
    <>
      <header>
        {(showBus || showRadar) ? <WeatherDisplay current={weatherCurrent.data ?? null} forecast={weatherForecast.data ?? null} uvForecast={uvForecast.data ?? null} lat={lat} lon={lon} /> : <></>}
      </header>
      <main>
        {showBus
          ? (
            <section>
              {rows.length == 0 ? <article><div>Nothing scheduled</div></article> : rows}
            </section>
          )
          : <></>}
        {showRadar
          ? (
            <section className="radar">
              <article><RadarMap lat={lat} lon={lon} radarStation={reverseGeocode.data?.radarStation} /></article>
            </section>
          )
          : <></>}
      </main>
      <footer>
        <DisplayQueryError displayName="Location information" useQueryResult={reverseGeocode} />
        <DisplayQueryError displayName="Transit agency info" useQueryResult={transitInfo} />
        <DisplayQueryError displayName="Realtime arrivals" useQueryResult={busTimes} />
        <DisplayQueryError displayName="Current weather" useQueryResult={weatherCurrent} />
        <DisplayQueryError displayName="Weather forecast" useQueryResult={weatherForecast} />
        <DisplayQueryError displayName="UV forecast" useQueryResult={uvForecast} />
      </footer>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: true,
      staleTime: Infinity,
    },
  },
});

function getLocalStorageFloat(key: string) {
  const str = localStorage.getItem(key);
  if (!str) {
    return null;
  }

  const float = parseFloat(str);
  if (!isFinite(float)) {
    return null;
  }

  return float;
}

function isFullscreenSubscribe(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

function isFullscreenGetSnapshot() {
  // eslint-disable-next-line compat/compat
  return document.fullscreenElement !== null;
}

function App() {
  const [lat, setLat] = useState<number | null>(() => getLocalStorageFloat("lat"));
  const [lon, setLon] = useState<number | null>(() => getLocalStorageFloat("lon"));

  const isFullscreen = useSyncExternalStore(isFullscreenSubscribe, isFullscreenGetSnapshot);

  // Geolocation effect
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(position => {
      console.log("GEOLOCATION SUCCESS!");
      setLat(position.coords.latitude);
      setLon(position.coords.longitude);
      localStorage.setItem("lat", String(position.coords.latitude));
      localStorage.setItem("lon", String(position.coords.longitude));
    });
  }, []);

  // Wakelock effect
  useEffect(() => {
    if (isFullscreen) {
      let wakeLockPromise = null;
      try {
        wakeLockPromise = navigator.wakeLock.request("screen");
      } catch (e) {
        console.error(e);
      }

      if (wakeLockPromise !== null) {
        return () => wakeLockPromise.then(wakeLock => wakeLock.release(), reason => console.error(reason));
      }
    }

    return () => { };
  }, [isFullscreen]);

  return (
    <QueryClientProvider client={queryClient}>
      <AutoHideMouseCursor>
        {(lat !== null && lon !== null)
          ? (
            <>
              <div className={isFullscreen ? "toolbar toolbar-hidden" : "toolbar"}>
                <button onClick={() => document.body.requestFullscreen()}>Enter Fullscreen</button>
              </div>
              <Dashboard lat={lat} lon={lon} />
            </>
          )
          : <div className="toolbar"><div className="loading-spinner" /></div>
        }
      </AutoHideMouseCursor>
    </QueryClientProvider>
  )
}

export default App
