#!/bin/bash
# compose.sh <out dir> <width> <height> <radius> <top> <size> <raw prefix> [width share] [rows to trim]
# Renders each scene's headline over its raw screenshot (out/raw/<prefix>-<scene>.png)
# with compose.html. See docs/store-listing.md for the steps around it.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; W="$2"; H="$3"; R="$4"; TOP="$5"; SIZE="$6"; P="$7"; SHARE="${8:-0.84}"; TRIM="${9:-0}"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# `compose.sh content` renders the pictures the projects are made from:
# the invented screenshots at an iPhone's 3x, and the illustration.
if [ "$1" = content ]; then
	mkdir -p "$here/out/content"
	for name in chat settings scene; do
		if [ "$name" = scene ]; then size=1080,1350; scale=1; else size=393,852; scale=3; fi
		"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=$scale \
			--window-size=$size --screenshot="$here/out/content/$name.png" \
			"file://$here/content/$name.html" 2>/dev/null
		sips -s format jpeg -s formatOptions 92 "$here/out/content/$name.png" \
			--out "$here/out/content/$name.jpg" >/dev/null
		echo "$here/out/content/$name.jpg"
	done
	exit
fi
mkdir -p "$out"
enc() { python3 -c 'import sys,urllib.parse as u;print(u.quote(sys.argv[1]))' "$1"; }

scenes=(
	"1-redact|<mark>Hide</mark> what you'd<br>rather not share|"
	"2-find|Tap Find, then<br><mark>pick</mark> what to hide|Faces and text, found on your device."
	"3-caption|<mark>Captions</mark> that<br>read on anything|"
	"4-markup|<mark>Point out</mark><br>what matters|"
	"5-crop|<mark>Crop</mark> to the<br>part that counts|"
	"6-home|<mark>Nothing</mark> leaves<br>your device|No account. No uploads. No watermark."
)
for scene in "${scenes[@]}"; do
	IFS="|" read -r name head sub <<<"$scene"
	raw="$here/out/raw/$P-$name.png"
	[ -f "$raw" ] || { echo "skip $name (no $raw)"; continue; }
	"$C" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
		--virtual-time-budget=3000 --force-device-scale-factor=1 --window-size="$W,$H" \
		--screenshot="$out/$name.png" \
		"file://$here/compose.html?w=$W&h=$H&radius=$R&top=$TOP&size=$SIZE&width=$SHARE&trim=$TRIM&shot=$raw&head=$(enc "$head")&sub=$(enc "$sub")" 2>/dev/null
	# The stores take JPEG or PNG; JPEG keeps the set small.
	sips -s format jpeg -s formatOptions 90 "$out/$name.png" --out "$out/$name.jpg" >/dev/null
	rm "$out/$name.png"
	echo "$out/$name.jpg"
done
