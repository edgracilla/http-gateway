'use strict'

const reekoh = require('reekoh')
const plugin = new reekoh.plugins.Gateway()

const isEmpty = require('lodash.isempty')
const isPlainObject = require('lodash.isplainobject')

let server = null

plugin.once('ready', () => {
  let hpp = require('hpp')
  let helmet = require('helmet')
  let config = require('./config.json')
  let express = require('express')
  let bodyParser = require('body-parser')

  let options = plugin.config
  let app = express()
  let msgStr = ''

  if (isEmpty(options.dataPath)) options.dataPath = config.dataPath.default
  if (isEmpty(options.commandPath)) options.commandPath = config.commandPath.default

  app.use(bodyParser.json({
    type: '*/*',
    limit: '5mb'
  }))

  // For security
  app.disable('x-powered-by')
  app.use(helmet.xssFilter({setOnOldIE: true}))
  app.use(helmet.frameguard('deny'))
  app.use(helmet.ieNoOpen())
  app.use(helmet.noSniff())
  app.use(hpp())

  if (!isEmpty(options.username)) {
    let basicAuth = require('basic-auth')

    app.use((req, res, next) => {
      let unauthorized = (res) => {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
        return res.sendStatus(401)
      }

      let user = basicAuth(req)

      if (isEmpty(user)) {
        return unauthorized(res)
      }
      if (user.name === options.username && isEmpty(options.password)) {
        return next()
      }
      if (user.name === options.username && user.pass === options.password) {
        return next()
      } else {
        return unauthorized(res)
      }
    })
  }

  app.post((options.dataPath.startsWith('/')) ? options.dataPath : `/${options.dataPath}`, (req, res) => {
    let data = req.body

    res.set('Content-Type', 'text/plain')

    if (isEmpty(data.device)) {
      msgStr = 'Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'
      plugin.logException(new Error(msgStr))
      return res.status(400).send(`${msgStr}\n`)
    }

    plugin.requestDeviceInfo(data.device).then((deviceInfo) => {
      if (isEmpty(deviceInfo)) {
        plugin.log(JSON.stringify({
          title: 'HTTP Gateway - Access Denied. Unauthorized Device',
          device: data.device
        }))

        return res.status(401).send(`Device not registered. Device ID: ${data.device}\n`)
      }

      return plugin.pipe(data).then(() => {
        res.status(200).send(`Data Received. Device ID: ${data.device}. Data: ${JSON.stringify(data)}\n`)
        return plugin.log(JSON.stringify({
          title: 'Data Received.',
          device: data.device,
          data: data
        }))
      })
    }).catch((err) => {
      console.log(err)
      plugin.logException(err)

      if (err.message === 'Request for device information has timed out.') {
        res.status(401).send(`Device not registered. Device ID: ${data.device}\n`)
      }
    })
  })

  app.post((options.commandPath.startsWith('/')) ? options.commandPath : `/${options.commandPath}`, (req, res) => {
    let message = req.body

    res.set('Content-Type', 'text/plain')

    if (isEmpty(message.device) || isEmpty(message.target) || isEmpty(message.command)) {
      msgStr = 'Invalid message or command. Message must be a valid JSON String with "device" ,"target" and "message" fields. "target" is a registered Device ID. "message" is the payload.'
      plugin.logException(new Error(msgStr))
      return res.status(400).send(`${msgStr}\n`)
    }

    plugin.requestDeviceInfo(message.device).then((deviceInfo) => {
      if (isEmpty(deviceInfo)) {
        plugin.log(JSON.stringify({
          title: 'HTTP Gateway - Access Denied. Unauthorized Device',
          device: message.device
        }))

        return res.status(401).send(`Device not registered. Device ID: ${message.device}\n`)
      }

      let ret = null

      if (isPlainObject(message.command)) {
        ret = plugin.relayCommand(JSON.stringify(message.command), message.target, message.deviceGroup)
      } else {
        ret = plugin.relayCommand(message.command, message.target, message.deviceGroup)
      }

      return ret.then(() => {
        res.status(200).send(`Message Received. Device ID: ${message.device}. Message: ${JSON.stringify(message)}\n`)

        return plugin.log(JSON.stringify({
          title: 'Message Sent.',
          source: message.device,
          target: message.target,
          command: message.command
        }))
      })
    }).catch((err) => {
      console.log(err)
      plugin.logException(err)

      if (err.message === 'Request for device information has timed out.') {
        res.status(401).send(`Device not registered. Device ID: ${message.device}\n`)
      }
    })
  })

  app.use((error, req, res, next) => {
    plugin.logException(error)

    res.set('Content-Type', 'text/plain')
    res.status(500).send('An unexpected error has occurred. Please contact support.\n')
  })

  app.use((req, res) => {
    res.set('Content-Type', 'text/plain')
    res.status(404).send(`Invalid Path. ${req.originalUrl} Not Found\n`)
  })

  server = require('http').Server(app)

  server.once('error', function (error) {
    console.error('HTTP Gateway Error', error)
    plugin.logException(error)

    setTimeout(() => {
      server.close(() => {
        server.removeAllListeners()
        process.exit()
      })
    }, 5000)
  })

  server.once('close', () => {
    plugin.log(`HTTP Gateway closed on port ${options.port}`)
  })

  server.listen(options.port, () => {
    plugin.emit('init')
    plugin.log(`HTTP Gateway has been initialized on port ${options.port}`)
  })
})

module.exports = plugin
