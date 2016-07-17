'use strict';

var platform = require('./platform'),
	isEmpty  = require('lodash.isempty'),
	server;

platform.once('close', function () {
	let d = require('domain').create();

	d.once('error', function (error) {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		server.close(() => {
			server.removeAllListeners();
			platform.notifyClose();
			d.exit();
		});
	});
});

platform.once('ready', function (options) {
	let hpp        = require('hpp'),
		helmet     = require('helmet'),
		config     = require('./config.json'),
		express    = require('express'),
		bodyParser = require('body-parser');

	if (isEmpty(options.data_path))
		options.data_path = config.data_path.default;

	if (isEmpty(options.message_path))
		options.message_path = config.message_path.default;

	if (isEmpty(options.groupmessage_path))
		options.groupmessage_path = config.groupmessage_path.default;

	var app = express();

	app.use(bodyParser.json({
		type: '*/*',
		limit: '5mb'
	}));

	// For security
	app.disable('x-powered-by');
	app.use(helmet.xssFilter({setOnOldIE: true}));
	app.use(helmet.frameguard('deny'));
	app.use(helmet.ieNoOpen());
	app.use(helmet.noSniff());
	app.use(hpp());

	if (!isEmpty(options.username)) {
		let basicAuth = require('basic-auth');

		app.use((req, res, next) => {
			let unauthorized = (res) => {
				res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
				return res.sendStatus(401);
			};

			let user = basicAuth(req);

			if (isEmpty(user))
				return unauthorized(res);
			if (user.name === options.username && isEmpty(options.password))
				return next();
			if (user.name === options.username && user.pass === options.password)
				return next();
			else
				return unauthorized(res);
		});
	}

	app.post((options.data_path.startsWith('/')) ? options.data_path : `/${options.data_path}`, (req, res) => {
		let data = req.body;

		res.set('Content-Type', 'text/plain');

		if (isEmpty(data.device)) {
			platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));
			return res.status(400).send('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.\n');
		}

		platform.requestDeviceInfo(data.device, (error, requestId) => {
			let t = setTimeout(() => {
				res.status(401).send(`Device not registered. Device ID: ${data.device}\n`);
			}, 10000);

			platform.once(requestId, (deviceInfo) => {
				clearTimeout(t);

				if (isEmpty(deviceInfo)) {
					platform.log(JSON.stringify({
						title: 'HTTP Gateway - Access Denied. Unauthorized Device',
						device: data.device
					}));

					return res.status(401).send(`Device not registered. Device ID: ${data.device}\n`);
				}

				platform.processData(data.device, JSON.stringify(data));

				platform.log(JSON.stringify({
					title: 'Data Received.',
					device: data.device,
					data: data
				}));

				res.status(200).send(`Data Received. Device ID: ${data.device}. Data: ${JSON.stringify(data)}\n`);
			});
		});
	});

	app.post((options.message_path.startsWith('/')) ? options.message_path : `/${options.message_path}`, (req, res) => {
		let message = req.body;

		res.set('Content-Type', 'text/plain');

		if (isEmpty(message.device) || isEmpty(message.target) || isEmpty(message.message)) {
			platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "device" ,"target" and "message" fields. "target" is a registered Device ID. "message" is the payload.'));
			return res.status(400).send('Invalid message or command. Message must be a valid JSON String with "device", "target" and "message" fields. "target" is a registered Device ID. "message" is the payload.\n');
		}

		platform.requestDeviceInfo(message.device, (error, requestId) => {
			let t = setTimeout(() => {
				res.status(401).send(`Device not registered. Device ID: ${message.device}\n`);
			}, 10000);

			platform.once(requestId, (deviceInfo) => {
				clearTimeout(t);

				if (isEmpty(deviceInfo)) {
					platform.log(JSON.stringify({
						title: 'HTTP Gateway - Access Denied. Unauthorized Device',
						device: message.device
					}));

					return res.status(401).send(`Device not registered. Device ID: ${message.device}\n`);
				}

				platform.sendMessageToDevice(message.target, message.message);

				platform.log(JSON.stringify({
					title: 'Message Sent.',
					source: message.device,
					target: message.target,
					message: message
				}));

				res.status(200).send(`Message Received. Device ID: ${message.device}. Message: ${JSON.stringify(message)}\n`);
			});
		});
	});

	app.post((options.groupmessage_path.startsWith('/')) ? options.groupmessage_path : `/${options.groupmessage_path}`, (req, res) => {
		let message = req.body;

		res.set('Content-Type', 'text/plain');

		if (isEmpty(message.device) || isEmpty(message.target) || isEmpty(message.message)) {
			platform.handleException(new Error('Invalid group message or command. Group messages must be a valid JSON String with "device", "target" and "message" fields. "target" is a device group id or name. "message" is the payload.'));
			return res.status(400).send('Invalid group message or command. Group messages must be a valid JSON String with "device", "target" and "message" fields. "target" is a device group id or name. "message" is the payload.\n');
		}

		platform.requestDeviceInfo(message.device, (error, requestId) => {
			let t = setTimeout(() => {
				res.status(401).send(`Device not registered. Device ID: ${message.device}\n`);
			}, 10000);

			platform.once(requestId, (deviceInfo) => {
				clearTimeout(t);

				if (isEmpty(deviceInfo)) {
					platform.log(JSON.stringify({
						title: 'HTTP Gateway - Access Denied. Unauthorized Device',
						device: message.device
					}));

					return res.status(401).send(`Device not registered. Device ID: ${message.device}\n`);
				}

				platform.sendMessageToGroup(message.target, message.message);

				platform.log(JSON.stringify({
					title: 'Group Message Sent.',
					source: message.device,
					target: message.target,
					message: message
				}));

				res.status(200).send(`Group Message Received. Device ID: ${message.device}. Message: ${JSON.stringify(message)}\n`);
			});
		});
	});

	app.use((error, req, res, next) => {
		platform.handleException(error);

		res.set('Content-Type', 'text/plain');

		res.status(500).send('An unexpected error has occurred. Please contact support.\n');
	});

	app.use((req, res) => {
		res.set('Content-Type', 'text/plain');
		
		res.status(404).send(`Invalid Path. ${req.originalUrl} Not Found\n`);
	});

	server = require('http').Server(app);

	server.once('error', function (error) {
		console.error('HTTP Gateway Error', error);
		platform.handleException(error);

		setTimeout(() => {
			server.close(() => {
				server.removeAllListeners();
				process.exit();
			});
		}, 5000);
	});

	server.once('close', () => {
		platform.log(`HTTP Gateway closed on port ${options.port}`);
	});

	server.listen(options.port, () => {
		platform.notifyReady();
		platform.log(`HTTP Gateway has been initialized on port ${options.port}`);
	});
});