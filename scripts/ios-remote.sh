#!/bin/sh
# Builds the iOS development build on a Mac from this machine's working tree,
# then opens it on the Mac's booted simulator against this machine's Metro.
#
# - TUCK_MAC: the Mac's SSH host (required).
# - TUCK_MAC_DIR: the Mac's copy of the tree, relative to its home (default Dev/tuck-remote).
# - Arguments go to `expo run:ios`, such as `--device <udid>`.
#
# The Mac needs GNU rsync at /opt/homebrew/bin/rsync (`brew install rsync`):
# Apple's openrsync deletes ignored files on `--delete`, node_modules and ios/ among them.
set -eu

mac=${TUCK_MAC:?set TUCK_MAC to the Mac SSH host}
dir=${TUCK_MAC_DIR:-Dev/tuck-remote}
metro="http://$(hostname):${RCT_METRO_PORT:-8081}"

rsync -az --delete --rsync-path=/opt/homebrew/bin/rsync \
	--filter=':- .gitignore' --exclude=.git/ --exclude=mise.local.toml \
	./ "$mac:$dir/"

ssh -t "$mac" "zsh -lc 'cd $dir && pnpm install --frozen-lockfile && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm expo run:ios --no-bundler $*'"

# `run:ios --no-bundler` opens the app against the Mac's own port 8081.
url="exp+tuck://expo-development-client/?url=$(printf %s "$metro" | sed 's/:/%3A/g; s|/|%2F|g')"
ssh "$mac" "xcrun simctl openurl booted '$url'" || true
