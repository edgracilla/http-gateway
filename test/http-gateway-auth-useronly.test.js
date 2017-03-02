/* global describe, it, after, before */
'use strict'

const async = require('async')
const should = require('should')
const request = require('request')

const Broker = require('../node_modules/reekoh/lib/broker.lib')

const PORT = 8183
const PLUGIN_ID = 'demo.gateway'
const BROKER = 'amqp://guest:guest@127.0.0.1/'
const OUTPUT_PIPES = 'demo.outpipe1,demo.outpipe2'
const COMMAND_RELAYS = 'demo.relay1,demo.relay2'

let conf = {
  port: PORT,
  username: 'reekoh',
  dataPath: '/http/data',
  commandPath: '/http/command'
}

let _app = null
let _broker = null

describe('HTTP Gateway - auth username only', () => {
  before('init', function () {
    process.env.BROKER = BROKER
    process.env.PLUGIN_ID = PLUGIN_ID
    process.env.OUTPUT_PIPES = OUTPUT_PIPES
    process.env.COMMAND_RELAYS = COMMAND_RELAYS
    process.env.CONFIG = JSON.stringify(conf)

    _broker = new Broker()
  })

  after('terminate', function () {
    delete require.cache[require.resolve('../app')]
  })

  describe('#start', function () {
    it('should start the app', function (done) {
      this.timeout(10000)

      _app = require('../app')
      _app.once('init', done)
    })
  })

  describe('#test RPC preparation', () => {
    it('should connect to broker', (done) => {
      _broker.connect(BROKER).then(() => {
        return done() || null
      }).catch((err) => {
        done(err)
      })
    })

    it('should spawn temporary RPC server', (done) => {
      _broker.createRPC('server', 'deviceinfo').then((queue) => {
        return queue.serverConsume((msg) => {
          return new Promise((resolve, reject) => {
            async.waterfall([
              async.constant(msg.content.toString('utf8')),
              async.asyncify(JSON.parse)
            ], (err, parsed) => {
              if (err) return reject(err)
              parsed.foo = 'bar'
              resolve(JSON.stringify(parsed))
            })
          })
        })
      }).then(() => {
        // Awaiting RPC requests
        done()
      }).catch((err) => {
        done(err)
      })
    })
  })

  describe('#data', function () {
    it('should return http 401 when username is not specified', function (done) {
      this.timeout(5000)

      request.post({
        url: `http://localhost:${PORT}${conf.dataPath}`,
        body: JSON.stringify({device: '567827489028377', data: 'test data'}),
        headers: {'Content-Type': 'application/json'}
      }, function (error, response, body) {
        should.ifError(error)
        should.equal(401, response.statusCode)
        done()
      })
    })

    it('should process the data', function (done) {
      this.timeout(10000)

      request.post({
        url: `http://localhost:${PORT}${conf.dataPath}`,
        body: JSON.stringify({device: '567827489028375', data: 'test data'}),
        headers: {'Content-Type': 'application/json'},
        auth: {user: conf.username}
      }, function (error, response, body) {
        should.ifError(error)
        should.equal(200, response.statusCode)
        should.ok(body.startsWith('Data Received'))
        done()
      })
    })
  })

  describe('#command', function () {
    it('should be able to send command to device', function (done) {
      this.timeout(10000)

      request.post({
        url: `http://localhost:${PORT}${conf.commandPath}`,
        body: JSON.stringify({
          device: '567827489028376',
          target: '567827489028375',
          deviceGroup: '',
          command: 'TURNOFF'}),
        headers: {'Content-Type': 'application/json'},
        auth: {user: conf.username}
      }, function (error, response, body) {
        should.ifError(error)
        should.equal(200, response.statusCode)
        should.ok(body.startsWith('Message Received'))
        done()
      })
    })
  })

  // NOT TESTABLE YET

  // describe('#groupmessage', function () {
  //   it('should send the group message', function (done) {
  //     this.timeout(5000);

  //     request.post({
  //       url: `http://localhost:${PORT}${GROUPconf.commandPath}`,
  //       body: JSON.stringify({device: '567827489028376', target: 'Bedroom Lights', message: 'TURNOFF'}),
  //       headers: {
  //         'Content-Type': 'application/json'
  //       }
  //     }, function (error, response, body) {
  //       should.ifError(error);
  //       should.equal(200, response.statusCode);
  //       should.ok(body.startsWith('Group Message Received'));
  //       done();
  //     });
  //   });
  // });
})
