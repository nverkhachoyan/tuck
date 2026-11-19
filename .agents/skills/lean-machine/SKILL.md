---
name: lean-machine
description: >-
  Garbage collector mode: for the rest of the session, the agent may stop
  stray processes that hold memory or CPU its work needs (idle Gradle and
  Kotlin daemons, unused simulators and emulators, orphaned dev servers and
  headless Chrome), not only the ones it started. Lists what it may stop, how
  to stop each kind cleanly, and what stays off limits. Only the user turns
  it on.
disable-model-invocation: true
---

# Lean machine

The Mac has 16 GB, and a build, a simulator, and Metro together fill it.
Normally AGENTS.md lets an agent stop only processes it started. Invoking
this skill widens that for the rest of the session: stop whatever is idle
and in the way, without asking each time, and report what went.

It doesn't override the protected list below, and it doesn't carry into
other sessions.

## When to sweep

- Once when the skill is invoked.
- Before anything heavy: a native build, booting a simulator or emulator,
  starting Metro, or a web export.
- When something fails or crawls in a way memory explains: Metro running out
  of memory, a build killed by Jetsam, the simulator stalling, swap filling.

## Measure

`ps` RSS leaves out compressed memory, so an idle daemon can show 28 MB while
Activity Monitor shows 2 GB. Read memory the way Activity Monitor does:

```bash
top -l 1 -o mem -n 25 -stats pid,ppid,mem,cmprs,cpu,time,command
memory_pressure -Q | tail -1
```

For each candidate, read its full command line and where it runs before
deciding:

```bash
ps -p <pid> -o pid,ppid,etime,args
lsof -a -p <pid> -d cwd
lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN
```

## What may go

Stop a process when nothing in the current task needs it and none of the
protected list applies. Prefer the tool's own shutdown to a signal.

| Process | How it shows | Stop with |
| --- | --- | --- |
| Gradle daemon | `java` running `gradle-daemon-main-*.jar`, often PPID 1 | `./gradlew --stop` in `android/` if it exists, else `kill <pid>` |
| Kotlin compile daemon | `java` running `KotlinCompileDaemon` | `kill <pid>` |
| Android emulator | `qemu-system-*`, `emulator` | `adb -s <serial> emu kill` |
| iOS simulators | booted devices in `xcrun simctl list devices booted`, with `launchd_sim` and many `*.appex` processes under one parent | `xcrun simctl shutdown <udid>` (never `kill` a sim's processes one by one) |
| Orphaned dev servers | `node` running Metro, Expo, Vite, or `serve` on an agent port (8082–8099, 5180–5189), PPID 1 or its session gone | `kill <pid>` |
| Headless Chrome | Chrome with `--remote-debugging-port=933x` or a scratchpad `--user-data-dir` | `kill <pid>`, then delete the profile directory |
| Test and type-check leftovers | `jest`/`node --test` workers, `tsc --watch`, `biome` with PPID 1 | `kill <pid>` |
| Xcode leftovers with Xcode closed | `SourceKitService`, `XCBBuildService`, an `xcodebuild` no build is running | `kill <pid>` |

Each stop is by PID, after reading that PID's command line: never `pkill`,
`killall`, `kill $(lsof -ti …)`, or a pattern. Send `SIGTERM`, wait about five
seconds, and use `SIGKILL` only if it's still there. Check it's gone.

## Protected

Never stop these, even in this mode:

- **Port 8081 and whatever holds it.** It's the user's Metro (AGENTS.md).
- **Other live agent sessions and their servers.** A server whose parent
  session is still running belongs to that session. Only orphans (PPID 1, or
  a parent that's no longer an agent session) count as stray.
- **Claude itself**: the desktop app, its helpers, `claude` processes, and
  MCP servers it started.
- **Apps the user works in**: any app with a window, such as Safari, Xcode,
  editors, iPhone Mirroring, Activity Monitor, or chat. They may hold unsaved
  work. If one is the problem, name it and its memory, and ask.
- **VMs and containers** (OrbStack, Docker, UTM): they may hold data or
  services the user runs. Ask.
- **The system**: anything owned by root or `_`-prefixed users,
  `WindowServer`, `kernel_task`, `launchd`, `mds*`, `photoanalysisd`,
  on-device intelligence services, and `watchman` while a Metro uses it.
- **Anything the current task needs**: the simulator or emulator being
  tested, the build in progress, the device connection.

When unsure whether something is stray, leave it and list it.

## Report

After a sweep, say in a few lines what was stopped, roughly how much it held,
and anything large left alone with why (protected, or needs the user). Don't
report a sweep that found nothing worth stopping.
