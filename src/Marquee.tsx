import "./Marquee.css"

export default function Marquee(props: React.PropsWithChildren) {
    return <div className="marquee">{props.children}</div>;
}