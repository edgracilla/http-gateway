'use strict';

const PORT              = 8080,
	  DATA_PATH         = '/http/data',
	  MESSAGE_PATH      = '/http/message',
	  GROUPMESSAGE_PATH = '/http/groupmessage',
	  DEVICE_ID1        = '567827489028375',
	  DEVICE_ID2        = '567827489028376';

var cp      = require('child_process'),
	assert  = require('assert'),
	request = require('request'),
	gateway;

describe('HTTP Gateway', function () {
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
			});

			gateway.send({
				type: 'ready',
				data: {
					options: {
						port: PORT,
						data_path: DATA_PATH,
						message_path: MESSAGE_PATH,
						groupmessage_path: GROUPMESSAGE_PATH
					},
					devices: [{_id: DEVICE_ID1}, {_id: DEVICE_ID2}]
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {
			this.timeout(5000);

			request.post({
				url: `http://localhost:${PORT}${DATA_PATH}`,
				body: JSON.stringify({device: '567827489028375', data: 'test data'}),
				headers: {
					'Content-Type': 'text/plain'
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
				body: JSON.stringify({device: '567827489028376', target: '567827489028375', message: 'TURNOFF'}),
				headers: {
					'Content-Type': 'text/plain'
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
				body: JSON.stringify({device: '567827489028376', target: 'Bedroom Lights', message: 'TURNOFF'}),
				headers: {
					'Content-Type': 'text/plain'
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