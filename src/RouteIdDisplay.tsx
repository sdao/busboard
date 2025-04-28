import { RouteId } from "../shared/types";
import "./RouteIdDisplay.css"

export default function RouteIdDisplay({ routeId }: { routeId: RouteId }) {
  const routeClassName = String(routeId).length > 2 ? "route route3" : "route";
  return <h1 className={routeClassName}><span>{routeId}</span></h1>;
}