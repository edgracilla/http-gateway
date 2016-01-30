'use strict';

var platform          = require('./platform'),
	isEmpty           = require('lodash.isempty'),
	authorizedDevices = {},
	server;

platform.on('adddevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		authorizedDevices[device._id] = device;
		platform.log(`Successfully added ${device._id} to the pool of authorized devices.`);
	}
	else
		platform.handleException(new Error(`Device data invalid. Device not added. ${device}`));
});

platform.on('removedevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		delete authorizedDevices[device._id];
		platform.log(`Successfully added ${device._id} from the pool of authorized devices.`);
	}
	else
		platform.handleException(new Error(`Device data invalid. Device not removed. ${device}`));
});

platform.once('close', function () {
	let d = require('domain').create();

	d.once('error', (error) => {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(() => {
		server.close(() => {
			d.exit();
		});
	});
});

platform.once('ready', function (options, registeredDevices) {
	let hpp        = require('hpp'),
		domain     = require('domain'),
		keyBy      = require('lodash.keyby'),
		config     = require('./config.json'),
		express    = require('express'),
		bodyParser = require('body-parser');

	if (!isEmpty(registeredDevices))
		authorizedDevices = keyBy(registeredDevices, '_id');

	if (isEmpty(options.data_path))
		options.data_path = config.data_path.default;

	if (isEmpty(options.message_path))
		options.message_path = config.message_path.default;

	if (isEmpty(options.groupmessage_path))
		options.groupmessage_path = config.groupmessage_path.default;

	var app = express();

	app.disable('x-powered-by');

	app.use(bodyParser.text({
		type: '*/*'
	}));

	app.use(bodyParser.urlencoded({
		extended: true
	}));

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
		let d = domain.create();

		d.once('error', (error) => {
			platform.handleException(error);
			res.status(400).send(new Buffer('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));
			d.exit();
		});

		d.run(() => {
			if (isEmpty(req.body)) {
				platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

				return d.exit();
			}

			let data = JSON.parse(req.body);

			if (isEmpty(data.device)) {
				platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

				return d.exit();
			}

			platform.processData(data.device, req.body);

			platform.log(JSON.stringify({
				title: 'Data Received.',
				device: data.device,
				data: data
			}));

			res.sendStatus(200);

			d.exit();
		});
	});

	app.post((options.message_path.startsWith('/')) ? options.message_path : `/${options.message_path}`, (req, res) => {
		let d = domain.create();

		d.once('error', (error) => {
			platform.handleException(error);
			res.end(new Buffer('Invalid data sent. Must be a valid JSON String.'));

			d.exit();
		});

		d.run(() => {
			if (isEmpty(req.body)) {
				platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the a registered Device ID. "message" is the payload.'));

				return d.exit();
			}

			let message = JSON.parse(req.body);

			if (isEmpty(message.target) || isEmpty(message.message)) {
				platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the a registered Device ID. "message" is the payload.'));

				return d.exit();
			}

			platform.sendMessageToDevice(message.target, message.message);

			platform.log(JSON.stringify({
				title: 'Message Sent.',
				source: message.device,
				target: message.target,
				message: message
			}));

			res.sendStatus(200);

			d.exit();
		});
	});

	app.post((options.groupmessage_path.startsWith('/')) ? options.groupmessage_path : `/${options.groupmessage_path}`, (req, res) => {
		let d = domain.create();

		d.once('error', (error) => {
			platform.handleException(error);
			res.end(new Buffer('Invalid data sent. Must be a valid JSON String.'));

			d.exit();
		});

		d.run(() => {
			if (isEmpty(req.body)) {
				platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the a registered Device ID. "message" is the payload.'));

				return d.exit();
			}

			let message = JSON.parse(req.body);

			if (isEmpty(message.target) || isEmpty(message.message)) {
				platform.handleException(new Error('Invalid group message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the the group name. "message" is the payload.'));

				return d.exit();
			}

			platform.sendMessageToGroup(message.target, message.message);

			platform.log(JSON.stringify({
				title: 'Group Message Sent.',
				source: message.device,
				target: message.target,
				message: message
			}));

			res.sendStatus(200);

			d.exit();
		});
	});

	server = require('http').Server(app);

	server.once('close', () => {
		console.log(`HTTP Gateway closed on port ${options.port}`);
		platform.notifyClose();
	});

	server.listen(options.port);

	platform.notifyReady();
	platform.log(`HTTP Gateway has been initialized on port ${options.port}`);
});