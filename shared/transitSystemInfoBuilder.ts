import JSZip from "jszip";
import { DirectionId, RouteId, StopId, TransitSystemInfo, TransitSystemRoute } from "./types";

const MAX_COUNT_STOPS_RETURNED = 2;

function rad(degrees: number) {
    return degrees * (Math.PI / 180);
}

function hav(angle: number) {
    return (1.0 - Math.cos(angle)) / 2.0;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const dlat = lat1 - lat2;
    const dlon = lon1 - lon2;
    return hav(dlat) + (Math.cos(lat1) * Math.cos(lat2) * hav(dlon));
}

export default class TransitSystemInfoBuilder {
    readonly latRadians: number;
    readonly lonRadians: number;
    readonly routeNames: Map<string, Map<number, string>> = new Map();
    readonly stops: { stopId: StopId, angle: number }[] = []

    constructor(lat: number, lon: number) {
        this.latRadians = rad(lat);
        this.lonRadians = rad(lon);
    }

    addTripName(routeId: RouteId, directionId: DirectionId, name: string) {
        let directionNames = this.routeNames.get(routeId);
        if (directionNames === undefined) {
            directionNames = new Map();
            this.routeNames.set(routeId, directionNames);
        }

        directionNames.set(directionId, name);
    }

    addStop(stopId: StopId, stopLat: number, stopLon: number) {
        const angle = haversine(this.latRadians, this.lonRadians, rad(stopLat), rad(stopLon));
        this.stops.push({ stopId, angle});
    }

    build(): TransitSystemInfo {
        const routes: TransitSystemRoute[] = [];
        for (const [routeId, directions] of this.routeNames) {
            const route: TransitSystemRoute = { routeId, directions: [] };
            for (const [directionId, name] of directions) {
                route.directions.push({ directionId, name });
            }
            routes.push(route);
        }

        const closestStops: StopId[] = [];
        this.stops.sort((a, b) => a.angle - b.angle);
        for (let i = 0; i < this.stops.length && i < MAX_COUNT_STOPS_RETURNED; ++i) {
            closestStops.push(this.stops[i].stopId);
        }

        return { routes, closestStops };
    }

    static async createFromGtfsZip(lat: number, lon: number, zipDataArrayBuffer: ArrayBuffer): Promise<TransitSystemInfoBuilder> {
        const zipPayload: JSZip = await new JSZip().loadAsync(zipDataArrayBuffer);

        const builder = new TransitSystemInfoBuilder(lat, lon);

        const tripsFile = zipPayload.file("trips.txt");
        if (tripsFile === null) {
            throw new Error("missing trips.txt");
        }

        const tripsCsv: string = await tripsFile.async("string");
        const tripsCsvLines = tripsCsv.split("\n");
        if (tripsCsvLines.length <= 1) {
            throw new Error("trips.txt is malformed");
        }

        {
            const headerFields = tripsCsvLines[0].trim().split(",");
            const routeIdIndex = headerFields.indexOf("route_id");
            const directionIdIndex = headerFields.indexOf("direction_id");
            const tripShortNameIndex = headerFields.indexOf("trip_short_name");
            for (let i = 1; i < tripsCsvLines.length; ++i) {
                const line = tripsCsvLines[i];
                const fields = line.trim().split(",");
                const routeId = fields[routeIdIndex];
                const directionId = parseInt(fields[directionIdIndex]);
                const tripShortName = fields[tripShortNameIndex];
                builder.addTripName(routeId, directionId, tripShortName);
            }
        }

        const stopsFiles = zipPayload.file("stops.txt");
        if (stopsFiles === null) {
            throw new Error("missing stops.txt");
        }

        const stopsCsv: string = await stopsFiles.async("string");
        const stopsCsvLines = stopsCsv.split("\n");
        if (stopsCsvLines.length <= 1) {
            throw new Error("stops.txt is malformed");
        }

        {
            const headerFields = stopsCsvLines[0].trim().split(",");
            const stopIdIndex = headerFields.indexOf("stop_id");
            const stopLatIndex = headerFields.indexOf("stop_lat");
            const stopLonIndex = headerFields.indexOf("stop_lon");
            for (let i = 1; i < stopsCsvLines.length; ++i) {
                const line = stopsCsvLines[i];
                const fields = line.trim().split(",");
                const stopId = fields[stopIdIndex];
                const stopLat = parseFloat(fields[stopLatIndex]);
                const stopLon = parseFloat(fields[stopLonIndex]);
                builder.addStop(stopId, stopLat, stopLon);
            }
        }

        return builder;
    }
}