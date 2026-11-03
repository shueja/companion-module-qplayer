# QPlayer for Bitfocus Companion

This module controls [QPlayer](https://github.com/space928/QPlayer) through its
OSC interface.

## Configuration

QPlayer's default OSC ports are RX `9000` and TX `8000`. Configure the QPlayer
host, its OSC RX port, and the local OSC RX port in the Companion connection.
The local port must match QPlayer's OSC TX port to receive cue-status feedback.

## Actions

The module exposes the documented QPlayer endpoints:

- `/qplayer/go`, `/qplayer/stop`, `/qplayer/pause`, `/qplayer/unpause`,
  `/qplayer/preload`, and `/qplayer/select`
- `/qplayer/up`, `/qplayer/down`, and `/qplayer/save`
- `/qplayer/remote/go`, `/qplayer/remote/pause`, `/qplayer/remote/unpause`,
  `/qplayer/remote/stop`, `/qplayer/remote/preload`, and
  `/qplayer/remote/ping`

The **Send raw OSC message** action is included for OSC endpoints added by
future QPlayer versions, including remote discovery and show-file transfer.
Raw arguments are comma-separated and support strings, integers, floats, and
booleans.

Feedback and variables are updated from
`/qplayer/remote/fb/cue-status`. The module also provides connection status
feedback and ready-made transport presets.

## Presets

The **QPlayer** preset category includes buttons for:

- **GO** — go the selected cue
- **STOP** — stop all cues
- **PAUSE** — pause all cues
- **▲** — select the previous cue
- **▼** — select the next cue

These presets are starting points; their actions can be edited after adding
them to a Companion button.

## Feedbacks

- **OSC connected** — active while the local OSC listener is running.
- **Cue state** — active when the selected cue ID and state match the latest
  status received from QPlayer. Available states are `Ready`, `Playing`,
  `Paused`, and `Stopped`.

## Variables

The following variables are populated from QPlayer cue-status feedback:

| Variable | Description |
| --- | --- |
| `connection` | `Connected`, `Disconnected`, or the latest connection error |
| `cue` | Last reported cue ID |
| `state` | Last reported cue state |
| `time` | Last reported playback time, in seconds |
| `duration` | Last reported cue duration, in seconds |

## Development

```sh
npm install
npm test
```