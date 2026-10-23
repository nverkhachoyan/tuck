/**
 * A JPEG of the lessons' stand-in photo, as a blob URL: the app's renderer
 * draws image layers from real files, decoded by Skia, so the photo the
 * other chapters draw in SVG is painted to a file here once.
 */
export async function makePhotoFile(width: number, height: number) {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("No 2D canvas to paint the photo with.");
	const sky = context.createLinearGradient(0, 0, 0, height);
	sky.addColorStop(0, "#7DB4F5");
	sky.addColorStop(1, "#F6D9B8");
	context.fillStyle = sky;
	context.fillRect(0, 0, width, height);

	const w = width / 2;
	const h = height / 2;
	const at = (x: number, y: number): [number, number] => [w + x, h + y];
	context.fillStyle = "#6F8F7A";
	context.beginPath();
	context.moveTo(...at(-w, h * 0.4));
	context.lineTo(...at(-w * 0.3, -h * 0.27));
	context.lineTo(...at(w * 0.15, h * 0.27));
	context.lineTo(...at(w * 0.5, -h * 0.07));
	context.lineTo(...at(w, h * 0.33));
	context.lineTo(...at(w, h));
	context.lineTo(...at(-w, h));
	context.fill();

	context.fillStyle = "#E2C38E";
	context.fillRect(0, h * 1.53, width, h * 0.47);
	context.fillStyle = "#FF9F43";
	context.beginPath();
	context.arc(...at(-w * 0.6, -h * 0.5), Math.min(w, h) * 0.23, 0, Math.PI * 2);
	context.fill();

	// Kites in the sky, so a pixelation has detail to hide.
	const kites = ["#FF5C8A", "#2F6BFF", "#FFFFFF", "#7A4DFF"];
	for (let i = 0; i < 8; i++) {
		context.fillStyle = kites[i % kites.length];
		const x = width * 0.64 + (i % 4) * width * 0.07;
		const y = height * 0.1 + Math.floor(i / 4) * height * 0.11;
		context.beginPath();
		context.moveTo(x, y - 34);
		context.lineTo(x + 22, y);
		context.lineTo(x, y + 34);
		context.lineTo(x - 22, y);
		context.fill();
	}

	const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
	return URL.createObjectURL(blob);
}
