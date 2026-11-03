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

## Development

```sh
npm install
npm test
```