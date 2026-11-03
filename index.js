const { InstanceBase, Regex, combineRgb } = require('@companion-module/base')
const osc = require('osc')

const stateNames = ['Ready', 'Playing', 'Paused', 'Stopped']

function valueOf(arg) {
	return arg && typeof arg === 'object' && 'value' in arg ? arg.value : arg
}

function typedArgs(text) {
	if (!text || !text.trim()) return []
	return text.split(',').map((part) => {
		const value = part.trim()
		if (value === 'true' || value === 'false') return { type: 'T', value: value === 'true' }
		if (/^-?\d+$/.test(value)) return { type: 'i', value: Number(value) }
		if (/^-?(?:\d+\.\d*|\.\d+)$/.test(value)) return { type: 'f', value: Number(value) }
		return { type: 's', value }
	})
}

class QPlayerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.port = undefined
		this.config = {}
		this.status = { connected: false, state: 'Ready', cue: '', time: 0, duration: 0 }
	}

	async init(config) {
		await this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = { host: '127.0.0.1', port: 9000, localPort: 8000, ...config }
		this.setActionDefinitions(this.actionDefinitions())
		this.setFeedbackDefinitions(this.feedbackDefinitions())
		this.setVariableDefinitions([
			{ variableId: 'connection', name: 'OSC connection' },
			{ variableId: 'cue', name: 'Last cue ID' },
			{ variableId: 'state', name: 'Last cue state' },
			{ variableId: 'time', name: 'Last cue playback time (seconds)' },
			{ variableId: 'duration', name: 'Last cue duration (seconds)' },
		])
		this.setVariableValues({
			connection: 'Disconnected',
			cue: '',
			state: 'Ready',
			time: '0',
			duration: '0',
		})
		this.setPresetDefinitions([], this.presets())
		await this.openPort()
	}

	async destroy() {
		if (this.port) {
			this.port.close()
			this.port = undefined
		}
		this.status.connected = false
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'QPlayer host',
				width: 6,
				default: '127.0.0.1',
				regex: Regex.IP,
			},
			{
				type: 'number',
				id: 'port',
				label: 'QPlayer OSC RX port',
				width: 3,
				default: 9000,
				min: 1,
				max: 65535,
			},
			{
				type: 'number',
				id: 'localPort',
				label: 'Local OSC RX port',
				width: 3,
				default: 8000,
				min: 1,
				max: 65535,
			},
		]
	}

	async openPort() {
		if (this.port) this.port.close()
		this.port = new osc.UDPPort({
			localAddress: '0.0.0.0',
			localPort: Number(this.config.localPort),
			metadata: true,
		})
		this.port.on('ready', () => {
			this.status.connected = true
			this.updateStatus('ok', `Listening on UDP ${this.config.localPort}`)
			this.setVariableValues({ connection: 'Connected' })
		})
		this.port.on('message', (message) => this.handleMessage(message))
		this.port.on('error', (error) => {
			this.status.connected = false
			this.updateStatus('bad', error.message)
			this.setVariableValues({ connection: `Error: ${error.message}` })
		})
		this.port.open()
	}

	handleMessage(message) {
		if (message.address !== '/qplayer/remote/fb/cue-status') return
		const args = (message.args || []).map(valueOf)
		if (args.length < 3) return
		const state = Number(args[2])
		this.status = {
			...this.status,
			cue: String(args[1]),
			state: stateNames[state] || String(state),
			time: Number(args[3] || 0),
			duration: Number(args[4] || 0),
		}
		this.setVariableValues({
			cue: this.status.cue,
			state: this.status.state,
			time: String(this.status.time),
			duration: String(this.status.duration),
		})
		this.checkFeedbacks('cue_state')
	}

	send(address, args = []) {
		if (!this.port) return
		this.port.send({ address, args }, this.config.host, Number(this.config.port))
	}

	cueOption(label = 'Cue ID', defaultValue = '') {
		return { type: 'textinput', id: 'cue', label, default: defaultValue, regex: Regex.SOMETHING }
	}

	actionDefinitions() {
		const cueAction = (address, label) => ({
			name: label,
			options: [this.cueOption()],
			callback: ({ options }) => this.send(address, [{ type: 's', value: String(options.cue) }]),
		})
		return {
			go: cueAction('/qplayer/go', 'Go cue'),
			stop: cueAction('/qplayer/stop', 'Stop cue'),
			pause: cueAction('/qplayer/pause', 'Pause cue'),
			unpause: cueAction('/qplayer/unpause', 'Unpause cue'),
			select: cueAction('/qplayer/select', 'Select cue'),
			preload: {
				name: 'Preload cue',
				options: [this.cueOption(), { type: 'number', id: 'time', label: 'Preload time (seconds)', default: 0, min: 0 }],
				callback: ({ options }) =>
					this.send('/qplayer/preload', [
						{ type: 's', value: String(options.cue) },
						{ type: 'f', value: Number(options.time) },
					]),
			},
			go_selected: { name: 'Go selected cue', options: [], callback: () => this.send('/qplayer/go') },
			stop_all: { name: 'Stop all cues', options: [], callback: () => this.send('/qplayer/stop') },
			pause_all: { name: 'Pause all cues', options: [], callback: () => this.send('/qplayer/pause') },
			unpause_all: { name: 'Unpause all cues', options: [], callback: () => this.send('/qplayer/unpause') },
			preload_selected: { name: 'Preload selected cue', options: [], callback: () => this.send('/qplayer/preload') },
			up: { name: 'Select previous cue', options: [], callback: () => this.send('/qplayer/up') },
			down: { name: 'Select next cue', options: [], callback: () => this.send('/qplayer/down') },
			save: { name: 'Save project', options: [], callback: () => this.send('/qplayer/save') },
			remote: {
				name: 'Remote cue command',
				options: [
					{ type: 'dropdown', id: 'command', label: 'Command', default: 'go', choices: [
						{ id: 'go', label: 'Go' }, { id: 'pause', label: 'Pause' }, { id: 'unpause', label: 'Unpause' },
						{ id: 'stop', label: 'Stop' }, { id: 'preload', label: 'Preload' }, { id: 'ping', label: 'Ping' },
					] },
					{ type: 'textinput', id: 'target', label: 'Remote node name', default: '' },
					this.cueOption(),
					{ type: 'number', id: 'time', label: 'Preload time (seconds)', default: 0, min: 0 },
				],
				callback: ({ options }) => {
					const args = [{ type: 's', value: String(options.target) }]
					if (options.command !== 'ping') args.push({ type: 's', value: String(options.cue) })
					if (options.command === 'preload') args.push({ type: 'f', value: Number(options.time) })
					this.send(`/qplayer/remote/${options.command}`, args)
				},
			},
			discovery: {
				name: 'Remote discovery',
				options: [{ type: 'textinput', id: 'node', label: 'Node name', default: '' }],
				callback: ({ options }) => this.send('/qplayer/remote/discovery', [{ type: 's', value: String(options.node) }]),
			},
			remote_show_block: {
				name: 'Send remote show-file block',
				options: [
					{ type: 'textinput', id: 'target', label: 'Remote node name', default: '' },
					{ type: 'number', id: 'block', label: 'Block number', default: 0, min: 0 },
					{ type: 'number', id: 'total', label: 'Total blocks', default: 1, min: 1 },
					{ type: 'textinput', id: 'payload', label: 'Block payload (base64)', default: '' },
				],
				callback: ({ options }) => {
					const payload = Buffer.from(String(options.payload), 'base64')
					this.send('/qplayer/remote/update-show', [
						{ type: 's', value: String(options.target) },
						{ type: 'i', value: Number(options.block) },
						{ type: 'i', value: Number(options.total) },
						{ type: 'b', value: payload },
					])
				},
			},
			remote_ack: {
				name: 'Acknowledge remote show-file block',
				options: [
					{ type: 'textinput', id: 'target', label: 'Remote node name', default: '' },
					{ type: 'number', id: 'block', label: 'Block number (-1 = complete)', default: 0 },
				],
				callback: ({ options }) => this.send('/qplayer/remote/update-show-ack', [
					{ type: 's', value: String(options.target) },
					{ type: 'i', value: Number(options.block) },
				]),
			},
			remote_nack: {
				name: 'Reject remote show-file block',
				options: [
					{ type: 'textinput', id: 'target', label: 'Remote node name', default: '' },
					{ type: 'number', id: 'block', label: 'Block number', default: 0, min: 0 },
				],
				callback: ({ options }) => this.send('/qplayer/remote/update-show-nack', [
					{ type: 's', value: String(options.target) },
					{ type: 'i', value: Number(options.block) },
				]),
			},
			raw: {
				name: 'Send raw OSC message',
				options: [
					{ type: 'textinput', id: 'address', label: 'OSC address', default: '/qplayer/go', regex: /^\/.+/ },
					{ type: 'textinput', id: 'args', label: 'Arguments (comma separated; strings, integers, floats, booleans)', default: '' },
				],
				callback: ({ options }) => this.send(options.address, typedArgs(options.args)),
			},
		}
	}

	feedbackDefinitions() {
		return {
			connection: {
				type: 'boolean',
				name: 'OSC connected',
				defaultStyle: { bgcolor: combineRgb(0, 100, 0), color: combineRgb(255, 255, 255) },
				callback: () => this.status.connected,
			},
			cue_state: {
				type: 'boolean',
				name: 'Cue state',
				options: [
					this.cueOption(),
					{ type: 'dropdown', id: 'state', label: 'State', default: 'Playing', choices: stateNames.map((id) => ({ id, label: id })) },
				],
				defaultStyle: { bgcolor: combineRgb(0, 100, 200), color: combineRgb(255, 255, 255) },
				callback: ({ options }) => String(options.cue) === this.status.cue && options.state === this.status.state,
			},
		}
	}

	presets() {
		const button = (name, actionId, style = {}) => ({
			type: 'button',
			category: 'QPlayer',
			name,
			style: { text: name, size: '18', color: combineRgb(255, 255, 255), bgcolor: combineRgb(60, 60, 60), ...style },
			steps: [{ down: [{ actionId, options: {} }], up: [] }],
		})
		return {
			go: button('GO', 'go_selected', { bgcolor: combineRgb(0, 120, 0) }),
			stop: button('STOP', 'stop_all', { bgcolor: combineRgb(150, 0, 0) }),
			pause: button('PAUSE', 'pause_all', { bgcolor: combineRgb(120, 80, 0) }),
			up: button('▲', 'up'),
			down: button('▼', 'down'),
		}
	}
}

module.exports = QPlayerInstance
