'use strict';

const PORT              = 8081,
	  DATA_PATH         = '/http/data',
	  MESSAGE_PATH      = '/http/message',
	  GROUPMESSAGE_PATH = '/http/groupmessage',
	  USERNAME          = 'reekoh',
	  DEVICE_ID1        = '567827489028377',
	  DEVICE_ID2        = '567827489028378';

var cp      = require('child_process'),
	assert  = require('assert'),
	request = require('request'),
	gateway;

describe('HTTP Gateway Auth - User Only', function () {
	this.slow(5000);

	after('terminate child process', function (done) {
		this.timeout(5000);

		gateway.send({
			type: 'close'
		});

		setTimeout(function () {
			gateway.kill('SIGKILL');
			done();
		}, 4000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(gateway = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			gateway.on('message', function (message) {
				if (message.type === 'ready')
					done();
				else if (message.type === 'requestdeviceinfo') {
					if (message.data.deviceId === DEVICE_ID1 || message.data.deviceId === DEVICE_ID2) {
						gateway.send({
							type: message.data.requestId,
							data: {
								_id: message.data.deviceId
							}
						});
					}
				}
			});

			gateway.send({
				type: 'ready',
				data: {
					options: {
						port: PORT,
						data_path: DATA_PATH,
						message_path: MESSAGE_PATH,
						groupmessage_path: GROUPMESSAGE_PATH,
						username: USERNAME
					}
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should return http 401 when username and password is not specified', function (done) {
			this.timeout(5000);

			request.post({
				url: `http://localhost:${PORT}${DATA_PATH}`,
				body: JSON.stringify({device: '567827489028377', data: 'test data'}),
				headers: {
					'Content-Type': 'text/plain'
				}
			}, function (error, response, body) {
				assert.ifError(error);
				assert.equal(401, response.statusCode);
				assert.equal('Unauthorized', body);
				done();
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {
			this.timeout(5000);

			request.post({
				url: `http://localhost:${PORT}${DATA_PATH}`,
				body: JSON.stringify({device: '567827489028377', data: 'test data'}),
				headers: {
					'Content-Type': 'text/plain'
				},
				auth: {
					user: USERNAME
				}
			}, function (error, response, body) {
				assert.ifError(error);
				assert.equal(200, response.statusCode);
				assert.equal('Data Received', body);
				done();
			});
		});
	});

	describe('#message', function () {
		it('should send the message', function (done) {
			this.timeout(5000);

			request.post({
				url: `http://localhost:${PORT}${MESSAGE_PATH}`,
				body: JSON.stringify({device: '567827489028378', target: '567827489028377', message: 'TURNOFF'}),
				headers: {
					'Content-Type': 'text/plain'
				},
				auth: {
					user: USERNAME
				}
			}, function (error, response, body) {
				assert.ifError(error);
				assert.equal(200, response.statusCode);
				assert.equal('Message Received', body);
				done();
			});
		});
	});

	describe('#groupmessage', function () {
		it('should send the group message', function (done) {
			this.timeout(5000);

			request.post({
				url: `http://localhost:${PORT}${GROUPMESSAGE_PATH}`,
				body: JSON.stringify({device: '567827489028378', target: 'Bedroom Lights', message: 'TURNOFF'}),
				headers: {
					'Content-Type': 'text/plain'
				},
				auth: {
					user: USERNAME
				}
			}, function (error, response, body) {
				assert.ifError(error);
				assert.equal(200, response.statusCode);
				assert.equal('Group Message Received', body);
				done();
			});
		});
	});
});