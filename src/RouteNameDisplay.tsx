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

    // Pick enough words until we have > 5 chars
    const words = n.split(" ");
    let abbreviated = "";
    for (let i = 0; i < words.length && abbreviated.length < 5; ++i) {
      if (words[i].length > 0) {
        if (abbreviated.length > 0) {
          abbreviated += " ";
        }
        abbreviated += words[i];
      }
    }

    return abbreviated;
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
