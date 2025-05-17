import "./Marquee.css"

export function Marquee(props: React.PropsWithChildren) {
    return <div className="marquee">{props.children}</div>;
}