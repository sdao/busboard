import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { useQuery, useQueryClient, QueryClient, QueryClientProvider, UseQueryResult } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";

import { getAqiQuery, getGtfsRealtimeQuery, getGtfsStaticQuery, getReverseGeocodeQuery, getUvForecastQuery, getWeatherCurrentQuery, getWeatherForecastQuery } from "./queries";
import { isPrecipitation } from "../shared/types";
import BusTimeDisplay from "./BusTimeDisplay";
import Marquee from "./Marquee";
import RadarMap from "./RadarMap";
import WeatherDisplay from "./WeatherDisplay";
import WeatherForecastTile from "./WeatherForecastTile";

import "./App.css";
import { useTime } from "./hooks";

function AutoHideMouseCursor(props: React.PropsWithChildren) {
  const [showMouseCursor, setShowMouseCursor] = useState(true);
  const lastMouseMove = useRef(Temporal.Now.instant());
  const now = useTime(5 * 60 * 1000);

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

  const handleMouseActivity = () => {
    lastMouseMove.current = Temporal.Now.instant();
    setShowMouseCursor(true);
  };

  // Between 12AM-6AM, blank the screen if there's no activity
  const localNow = now.toZonedDateTimeISO(Temporal.Now.timeZoneId());
  const className = showMouseCursor ? "" : (localNow.hour < 6 ? "hide-screen" : "hide-mouse-cursor");

  return <div onMouseMove={handleMouseActivity} onPointerDown={handleMouseActivity} className={className}>{props.children}</div>;
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
  const aqi = useQuery(getAqiQuery(reverseGeocode.data));

  const now = useTime(60 * 1000);

  // Build rows for each stop/route/direction
  // Limit of 3
  const busRows = [];
  if (busTimes.data !== undefined) {
    busRowsLoop: for (const stop of busTimes.data.stops) {
      for (const route of stop.routes) {
        for (const dir of route.directions) {
          const key = `${stop.stopId}_${route.routeId}_${dir.directionId}`;
          busRows.push(<BusTimeDisplay key={key} routeId={route.routeId} directionId={dir.directionId} nextInstances={dir.nextInstances} transitInfo={transitInfo.data ?? null} />);

          if (busRows.length === 3) {
            break busRowsLoop;
          }
        }
      }
    }
  }

  // Build rows for each forecast period
  // Limit of 4
  const forecastRows = [];
  if (weatherForecast.data !== undefined) {
    forecastRowsLoop: for (const forecast of weatherForecast.data.forecasts) {
      if (Temporal.Instant.compare(Temporal.Instant.from(forecast.time), now) > 0) {
        forecastRows.push(<section key={forecast.time}><WeatherForecastTile lat={lat} lon={lon} forecastHour={forecast} /></section>);

        if (forecastRows.length === 4) {
          break forecastRowsLoop;
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

  const showBus = forceBus ?? (busRows.length > 0);
  const showRadarIfChancePrecipitationGreater = 20;
  const showRadar = forceRadar ?? (weatherCurrent.data?.phenomena.some(x => isPrecipitation(x.type)) === true || (weatherForecast.data?.forecasts.slice(0, 2).some(x => x.chancePrecipitation > showRadarIfChancePrecipitationGreater) === true));

  return (
    <>
      {showBus
        ? <header>
            {busRows.length !== 0
              ? <Marquee>{busRows}</Marquee>
              : <span>No bus information available</span>
            }
          </header>
        : <></>
      }
      {weatherCurrent.data !== undefined ? (
          <section className="weather-display-section">
            <WeatherDisplay current={weatherCurrent.data} forecast={weatherForecast.data} uvForecast={uvForecast.data} aqi={aqi.data} lat={lat} lon={lon} />
          </section>
        )
        : <></>
      }
      {showRadar
        ? (
          <section className="weather-radar">
            <RadarMap lat={lat} lon={lon} radarStation={reverseGeocode.data?.radarStation} />
          </section>
        )
        : <div className="weather-forecast-list">{forecastRows}</div>
      }
      <footer>
        <DisplayQueryError displayName="Location information" useQueryResult={reverseGeocode} />
        <DisplayQueryError displayName="Transit agency info" useQueryResult={transitInfo} />
        <DisplayQueryError displayName="Realtime arrivals" useQueryResult={busTimes} />
        <DisplayQueryError displayName="Current weather" useQueryResult={weatherCurrent} />
        <DisplayQueryError displayName="Weather forecast" useQueryResult={weatherForecast} />
        <DisplayQueryError displayName="UV forecast" useQueryResult={uvForecast} />
        <DisplayQueryError displayName="Air quality" useQueryResult={aqi} />
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
      setLat(oldLat => (oldLat === null || Math.abs(position.coords.latitude - oldLat) > 1e-3) ? position.coords.latitude : oldLat);
      setLon(oldLon => (oldLon === null || Math.abs(position.coords.longitude - oldLon) > 1e-3) ? position.coords.longitude : oldLon);
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
            <main>
              <div className={isFullscreen ? "toolbar toolbar-hidden" : "toolbar"}>
                <button onClick={() => document.body.requestFullscreen()}>Enter Fullscreen</button>
              </div>
              <Dashboard lat={lat} lon={lon} />
            </main>
          )
          : <div className="toolbar"><div className="loading-spinner" /></div>
        }
      </AutoHideMouseCursor>
    </QueryClientProvider>
  )
}

export default App
