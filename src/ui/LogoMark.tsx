import {
	Canvas,
	Circle,
	Group,
	Path,
	Rect,
	RoundedRect,
	vec,
} from "@shopify/react-native-skia";
import { View } from "react-native";
import { colors } from "@/theme";

// Drawn on a square this many units across, scaled to `size`.
const UNITS = 100;
// The pen's metal: its nib and the band on its barrel.
const STEEL = "#C9C9CE";
const PRINT_TILT = (-7 * Math.PI) / 180;
const PEN_ANGLE = -Math.PI / 4;

/**
 * The app's mark: a photo print being signed, the last touch before it's
 * done. `size` is its bounding square.
 */
export function LogoMark({ size }: { size: number }) {
	return (
		<View
			style={{ width: size, height: size }}
			accessibilityRole="image"
			accessibilityLabel="Tuck"
		>
			<Canvas style={{ width: size, height: size }}>
				<Group transform={[{ scale: size / UNITS }]}>
					<Group
						origin={vec(UNITS / 2, UNITS / 2)}
						transform={[{ rotate: PRINT_TILT }]}
					>
						<RoundedRect
							x={18}
							y={18}
							width={64}
							height={64}
							r={5}
							color={colors.highlight}
						/>
						<Circle
							cx={63}
							cy={35}
							r={5.8}
							color={colors.onHighlight}
							opacity={0.25}
						/>
						<Path
							path="M21.8 82 L41 60.2 L60.2 82 Z"
							color={colors.onHighlight}
							opacity={0.25}
						/>
					</Group>
					{/* The signature, trailing from the pen's tip. */}
					<Path
						path="M24 74 C 29 64, 33 82, 38 72 S 44 69, 47 70"
						style="stroke"
						strokeWidth={4}
						strokeCap="round"
						color={colors.textPrimary}
					/>
					{/* Drawn pointing along +x from its tip, then laid down on the print. */}
					<Group
						transform={[
							{ translateX: 47 },
							{ translateY: 70 },
							{ rotate: PEN_ANGLE },
						]}
					>
						<Path path="M0 0 L13 -6 L13 6 Z" color={STEEL} />
						<Path path="M0 0 L5 -2.3 L5 2.3 Z" color={colors.onHighlight} />
						<RoundedRect
							x={13}
							y={-7}
							width={46}
							height={14}
							r={3}
							color={colors.textPrimary}
						/>
						<Rect x={44} y={-7} width={4} height={14} color={STEEL} />
					</Group>
				</Group>
			</Canvas>
		</View>
	);
}
