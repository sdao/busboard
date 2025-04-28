import { Temporal } from "@js-temporal/polyfill";
import { BusInstance, DirectionId, RouteId, TransitSystemInfo } from "../shared/types";
import MinutesDisplay from "./MinutesDisplay";
import RouteIdDisplay from "./RouteIdDisplay";
import RouteNameDisplay from "./RouteNameDisplay";
import "./BusTimeDisplay.css"

export default function BusTimeDisplay({ routeId, directionId, nextInstances, transitInfo }: { routeId: RouteId, directionId: DirectionId, nextInstances: BusInstance[], transitInfo: TransitSystemInfo | null }) {
    return (
      <article>
        <div><RouteIdDisplay routeId={routeId} /></div>
        <div className="bustime-headsign"><RouteNameDisplay routeId={routeId} directionId={directionId} transitInfo={transitInfo} /></div>
        <div><div className="bustime-minutes-display-list">{nextInstances.map(inst => <MinutesDisplay key={inst.time} hasLeftTerminus={inst.hasLeftTerminus} targetTime={Temporal.Instant.from(inst.time)} />)}</div><div className="bustime-subtitle">minutes</div></div>
      </article>
    )
  }