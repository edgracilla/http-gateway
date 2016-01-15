'use strict';

const PORT = 8080,
    DEVICE_ID1 = '567827489028375',
    DEVICE_ID2 = '567827489028376';

var cp     = require('child_process'),
    assert = require('assert'),
    http = require('http'),
    gateway;

describe('Gateway', function () {
    this.slow(5000);

    after('terminate child process', function () {
        setTimeout(function(){
            gateway.kill('SIGKILL');
        }, 5000);

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
                        data_topic: 'httpTestData',
                        message_topic: 'httpTestMessage',
                        groupmessage_topic: 'httpTestGroupMessage'
                    },
                    devices: [{_id: DEVICE_ID1}, {_id: DEVICE_ID2}]
                }
            }, function (error) {
                assert.ifError(error);
            });
        });
    });

    describe('#message', function () {
        it('should process the message', function (done) {
            this.timeout(5000);

            var data = JSON.stringify({device: '567827489028375', data: 'test data'});

            var req = http.request({
                host: '127.0.0.1',
                path: '/httpTestData',
                port: PORT,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, function(response){
                response.on('data', function(chunk){
                    assert.equal(chunk.toString('utf8'), 'TURNOFF');
                    done();
                });
            });
            req.write(data);
            req.end();

            setTimeout(function(){
                gateway.send({
                    type: 'message',
                    data: {
                        client: '567827489028375',
                        messageId: '55fce1455167c470abeedae2',
                        message: 'TURNOFF'
                    }
                });
            }, 2000);
        });
    });
});