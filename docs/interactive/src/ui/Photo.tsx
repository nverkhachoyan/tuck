import { useId } from "react";

const palettes = {
	day: {
		sky: ["#7DB4F5", "#F6D9B8"],
		hills: "#6F8F7A",
		ground: "#E2C38E",
		sun: "#FF9F43",
	},
	dusk: {
		sky: ["#3B3F7A", "#E58C8A"],
		hills: "#2F4A4F",
		ground: "#B07A5A",
		sun: "#FFD6A0",
	},
};

/**
 * A stand-in photo `width` by `height`, centered on its origin like an image
 * layer's content. Lopsided, so a turn, a stretch, or a flip is easy to read.
 */
export function Photo({
	width,
	height,
	palette = "day",
}: {
	width: number;
	height: number;
	palette?: keyof typeof palettes;
}) {
	const sky = useId();
	const colors = palettes[palette];
	const w = width / 2;
	const h = height / 2;
	return (
		<g>
			<defs>
				<linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={colors.sky[0]} />
					<stop offset="1" stopColor={colors.sky[1]} />
				</linearGradient>
			</defs>
			<rect x={-w} y={-h} width={width} height={height} fill={`url(#${sky})`} />
			<polygon
				points={[
					[-w, h * 0.4],
					[-w * 0.3, -h * 0.27],
					[w * 0.15, h * 0.27],
					[w * 0.5, -h * 0.07],
					[w, h * 0.33],
					[w, h],
					[-w, h],
				]
					.map((point) => point.join(","))
					.join(" ")}
				fill={colors.hills}
			/>
			<rect
				x={-w}
				y={h * 0.53}
				width={width}
				height={h * 0.47}
				fill={colors.ground}
			/>
			<circle
				cx={-w * 0.6}
				cy={-h * 0.5}
				r={Math.min(w, h) * 0.23}
				fill={colors.sun}
			/>
		</g>
	);
}
