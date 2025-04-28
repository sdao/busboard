import { WeatherConditions } from "../shared/types";

export default function WeatherShortDesc({ current }: { current: WeatherConditions }) {
  function getShortDesc(text: string) {
    if (text.includes(" and ")) {
      return text.split(" and ")[0];
    }
    return text;
  }

  if (current.description.length !== 0) {
    return <div>{getShortDesc(current.description)}</div>;
  }
  else {
    return <></>;
  }
}
