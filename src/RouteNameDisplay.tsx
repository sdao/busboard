import { memo } from "react";
import { DirectionId, RouteId, TransitSystemInfo } from "../shared/types";

export default memo(function RouteNameDisplay({ routeId, directionId, transitInfo }: { routeId: RouteId, directionId: DirectionId, transitInfo: TransitSystemInfo | null }) {
  function abbreviate(n: string) {
    // If `n` is all upper-case, convert it to title case
    if (n.toUpperCase() === n) {
      const wordRegex = /\b\w+\b/g;
      const matches = n.matchAll(wordRegex);

      let titleCase = "";
      for (const match of matches) {
        const start = match.index;
        const end = start + match[0].length;

        for (let i = titleCase.length; i < start; ++i) {
          titleCase += n[i];
        }

        titleCase += n[start].toUpperCase();
        for (let i = start + 1; i < end; ++i) {
          titleCase += n[i].toLowerCase();
        }
      }

      for (let i = titleCase.length; i < n.length; ++i) {
        titleCase += n[i];
      }

      n = titleCase;
    }

    // Abbreviate some common words and insert nbsp's into phrases
    return n
      .replace(/\bBus Plaza\b/ig, "Bus\xa0Plaza")
      .replace(/\bTransit Center\b/ig, "Transit\xa0Center")
      .replace(/\bAvenue\b/ig, "Av")
      .replace(/\bBoulevard\b/ig, "Blvd")
      .replace(/\bCenter\b/ig, "Ctr")
      .replace(/\bPark.+Ride\b/ig, "P&R")
      .replace(/\bParkway\b/ig, "Pkwy")
      .replace(/\bPlace\b/ig, "Pl")
      .replace(/\bPlaza\b/ig, "Plz")
      .replace(/\bRoad\b/ig, "Rd")
      .replace(/\bSquare\b/ig, "Sq")
      .replace(/\bStation\b/ig, "Sta")
      .replace(/\bStreet\b/ig, "St")
      .replace(/\bUniversity\b/ig, "Univ")
      ;
  }

  let name = `Route ${routeId}`;
  const route = transitInfo?.routes.find((route) => route.routeId == routeId);
  if (route !== undefined) {
    const dir = route.directions.find((dir) => dir.directionId == directionId);
    if (dir !== undefined) {
      name = abbreviate(dir.name);
    }
  }

  return <>{name}</>;
});
