import { type ProcessMemory, readProcessMemory } from "process-memory";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { ImageCacheSnapshot } from "../render/imageCache.ts";
import { formatBytes } from "../shell/formatBytes.ts";

export { formatBytes };

export type DevHudProps = {
	getSnapshot: () => ImageCacheSnapshot;
};

/**
 * Dev-only performance overlay showing frame time, count of decoded images,
 * and estimated bitmap bytes, and on iOS the process footprint and how much
 * more memory it may take before Jetsam.
 */
export function DevHud({ getSnapshot }: DevHudProps) {
	const [metrics, setMetrics] = useState({
		frameTime: 0,
		count: 0,
		bytes: 0,
		memory: null as ProcessMemory | null,
	});

	useEffect(() => {
		let rafId: number;
		let lastTime =
			typeof performance !== "undefined" &&
			typeof performance.now === "function"
				? performance.now()
				: Date.now();
		let frameCount = 0;
		let totalTime = 0;
		let lastUpdate = lastTime;

		const tick = (now: number) => {
			const delta = now - lastTime;
			lastTime = now;

			if (delta > 0 && delta < 1000) {
				totalTime += delta;
				frameCount++;
			}

			if (now - lastUpdate >= 250) {
				const avgFrameTime = frameCount > 0 ? totalTime / frameCount : delta;
				const snapshot = getSnapshot();
				setMetrics({
					frameTime: avgFrameTime,
					count: snapshot.count,
					bytes: snapshot.bytes,
					memory: readProcessMemory(),
				});
				totalTime = 0;
				frameCount = 0;
				lastUpdate = now;
			}

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [getSnapshot]);

	return (
		<View style={styles.hud} pointerEvents="none" testID="dev-hud">
			<Text style={styles.text}>
				{metrics.frameTime.toFixed(1)} ms · {metrics.count}{" "}
				{metrics.count === 1 ? "image" : "images"} ·{" "}
				{formatBytes(metrics.bytes)}
			</Text>
			{metrics.memory && (
				<Text style={styles.text}>
					footprint {formatBytes(metrics.memory.footprint)} ·{" "}
					{formatBytes(metrics.memory.available)} left
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	hud: {
		position: "absolute",
		top: 56,
		left: 12,
		zIndex: 9999,
		backgroundColor: "rgba(0, 0, 0, 0.75)",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
	},
	text: {
		color: "#ffffff",
		fontSize: 11,
		fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
		fontVariant: ["tabular-nums"],
	},
});
