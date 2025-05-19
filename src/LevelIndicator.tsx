import green_circle_color_svg from "/emoji/green_circle_color.svg?url";
import yellow_circle_color_svg from "/emoji/yellow_circle_color.svg?url";
import orange_circle_color_svg from "/emoji/orange_circle_color.svg?url";
import red_circle_color_svg from "/emoji/red_circle_color.svg?url";
import purple_circle_color_svg from "/emoji/purple_circle_color.svg?url";

import "./LevelIndicator.css";

export default function LevelIndicator({ level }: { level: "good" | "low" | "moderate" | "high" | "very_high" }) {
    let svg;
    switch (level) {
        case "good":
            svg = green_circle_color_svg;
            break;
        case "low":
            svg = yellow_circle_color_svg;
            break;
        case "moderate":
            svg = orange_circle_color_svg;
            break;
        case "high":
            svg = red_circle_color_svg;
            break;
        case "very_high":
            svg = purple_circle_color_svg;
            break;
        default:
            level satisfies never;
    }

    return <img className="level-indicator" src={svg} />;
}