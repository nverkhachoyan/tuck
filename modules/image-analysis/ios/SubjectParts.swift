import Foundation

/// How much wider than the neck between them two parts of an instance must
/// both be to be split: a phone lying against a box is many times wider
/// than where they touch, while a head is less than twice as wide as its
/// neck, and a hand as its wrist.
private let NECK_RATIO = 3

/// How many of the instance mask's pixels past a part's outline Vision's
/// mask of it can still reach.
private let EDGE_REACH = 2

private let NEIGHBORS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]

/// Where a pixel of the instance mask leaves the subject alone: 255, except
/// 0 over the parts of the picked instance other than the one picked.
struct PartMask {
	let bytes: [UInt8]
	let width: Int
	let height: Int
}

/// Vision can label subjects that touch as one instance, so a tap on one
/// would take both. This splits instance `label` of an instance mask where
/// it narrows to a neck much thinner than the parts on either side (see
/// `NECK_RATIO`), with a watershed on its distance transform, and masks out
/// every part but the one with the pixel at `column`, `row`. Nil when the
/// instance is all one part.
func otherParts(
	of label: UInt8,
	in labels: UnsafePointer<UInt8>,
	width: Int,
	height: Int,
	rowBytes: Int,
	column: Int,
	row: Int
) -> PartMask? {
	// The instance's box, with a pixel around it where it doesn't meet the
	// image's edge, so its outline is inside the box.
	var left = width, top = height, right = -1, bottom = -1
	for y in 0..<height {
		for x in 0..<width where labels[y * rowBytes + x] == label {
			left = min(left, x)
			right = max(right, x)
			top = min(top, y)
			bottom = max(bottom, y)
		}
	}
	guard right >= 0 else { return nil }
	left = max(0, left - 1)
	top = max(0, top - 1)
	right = min(width - 1, right + 1)
	bottom = min(height - 1, bottom + 1)
	let boxWidth = right - left + 1
	let boxHeight = bottom - top + 1
	let count = boxWidth * boxHeight
	var inside = [Bool](repeating: false, count: count)
	for y in 0..<boxHeight {
		for x in 0..<boxWidth {
			inside[y * boxWidth + x] = labels[(top + y) * rowBytes + left + x] == label
		}
	}

	// Each pixel's distance from the instance's outline, in thirds of a pixel
	// (a 3-4 chamfer). The image's edge isn't an outline: a subject the photo
	// cuts off is no narrower there.
	let far = Int.max / 4
	var depth = inside.map { $0 ? far : 0 }
	for y in 0..<boxHeight {
		for x in 0..<boxWidth where inside[y * boxWidth + x] {
			var d = depth[y * boxWidth + x]
			if x > 0 { d = min(d, depth[y * boxWidth + x - 1] + 3) }
			if y > 0 {
				d = min(d, depth[(y - 1) * boxWidth + x] + 3)
				if x > 0 { d = min(d, depth[(y - 1) * boxWidth + x - 1] + 4) }
				if x < boxWidth - 1 { d = min(d, depth[(y - 1) * boxWidth + x + 1] + 4) }
			}
			depth[y * boxWidth + x] = d
		}
	}
	for y in stride(from: boxHeight - 1, through: 0, by: -1) {
		for x in stride(from: boxWidth - 1, through: 0, by: -1) where inside[y * boxWidth + x] {
			var d = depth[y * boxWidth + x]
			if x < boxWidth - 1 { d = min(d, depth[y * boxWidth + x + 1] + 3) }
			if y < boxHeight - 1 {
				d = min(d, depth[(y + 1) * boxWidth + x] + 3)
				if x < boxWidth - 1 { d = min(d, depth[(y + 1) * boxWidth + x + 1] + 4) }
				if x > 0 { d = min(d, depth[(y + 1) * boxWidth + x - 1] + 4) }
			}
			depth[y * boxWidth + x] = d
		}
	}

	// From the deepest pixels out, each joins the part of its deepest
	// neighbor that's in one already, and parts it touches merge, unless
	// both are far deeper than where they meet: a neck between them.
	let order = (0..<count).filter { inside[$0] }.sorted { depth[$0] > depth[$1] }
	var parent = [Int](repeating: -1, count: count)
	var peak = [Int](repeating: 0, count: count)
	func root(_ pixel: Int) -> Int {
		var pixel = pixel
		while parent[pixel] != pixel {
			parent[pixel] = parent[parent[pixel]]
			pixel = parent[pixel]
		}
		return pixel
	}
	var split = false
	var touched: [Int] = []
	for pixel in order {
		let x = pixel % boxWidth, y = pixel / boxWidth
		let level = depth[pixel]
		touched.removeAll(keepingCapacity: true)
		var into = -1
		var deepest = -1
		for (dx, dy) in NEIGHBORS {
			let nx = x + dx, ny = y + dy
			guard nx >= 0, nx < boxWidth, ny >= 0, ny < boxHeight else { continue }
			let neighbor = ny * boxWidth + nx
			guard parent[neighbor] >= 0 else { continue }
			let part = root(neighbor)
			if !touched.contains(part) { touched.append(part) }
			if depth[neighbor] > deepest {
				deepest = depth[neighbor]
				into = part
			}
		}
		guard into >= 0 else {
			parent[pixel] = pixel
			peak[pixel] = level
			continue
		}
		parent[pixel] = into
		for other in touched where other != into {
			let part = root(other), kept = root(into)
			if part == kept { continue }
			if min(peak[part], peak[kept]) >= NECK_RATIO * level {
				split = true
				continue
			}
			let (big, small) = peak[part] >= peak[kept] ? (part, kept) : (kept, part)
			parent[small] = big
		}
	}
	guard split else { return nil }

	// Vision's mask fades out a little past the instance mask's pixels, so
	// the other parts are masked a little further out, short of the picked one.
	let picked = root((row - top) * boxWidth + column - left)
	let isPicked = (0..<count).map { inside[$0] && root($0) == picked }
	var bytes = [UInt8](repeating: 255, count: width * height)
	for pixel in order where !isPicked[pixel] {
		let x = left + pixel % boxWidth, y = top + pixel / boxWidth
		for ny in max(0, y - EDGE_REACH)...min(height - 1, y + EDGE_REACH) {
			for nx in max(0, x - EDGE_REACH)...min(width - 1, x + EDGE_REACH) {
				let bx = nx - left, by = ny - top
				if bx >= 0, bx < boxWidth, by >= 0, by < boxHeight, isPicked[by * boxWidth + bx] {
					continue
				}
				bytes[ny * width + nx] = 0
			}
		}
	}
	return PartMask(bytes: bytes, width: width, height: height)
}
