'use strict';

var platform = require('./platform'),
    isEmpty           = require('lodash.isempty'),
    isPlainObject = require('lodash.isplainobject'),
    clients           = {},
    authorizedDevices = {},
    server;

platform.on('message', function (message) {
    if (clients[message.client]) {
        var client = clients[message.client];

        client.end(new Buffer(message.message));

        platform.sendMessageResponse(message.messageId, 'Message Sent');
        platform.log(JSON.stringify({
            title: 'Message Sent',
            device: message.device,
            messageId: message.messageId,
            message: message.message
        }));
    }
});

platform.on('adddevice', function (device) {
    if (!isEmpty(device) && !isEmpty(device._id)) {
        authorizedDevices[device._id] = device;
        platform.log('Successfully added ' + device._id + ' to the pool of authorized devices.');
    }
    else
        platform.handleException(new Error('Device data invalid. Device not added. ' + device));
});

platform.on('removedevice', function (device) {
    if (!isEmpty(device) && !isEmpty(device._id)) {
        delete authorizedDevices[device._id];
        platform.log('Successfully removed ' + device._id + ' from the pool of authorized devices.');
    }
    else
        platform.handleException(new Error('Device data invalid. Device not removed. ' + device));
});

platform.once('close', function () {
	let d = require('domain').create();

    d.once('error', function(error) {
        console.error(error);
        platform.handleException(error);
        platform.notifyClose();
        d.exit();
    });

    d.run(function() {
        server.exit();
        platform.notifyClose();
        d.exit();
    });
});

platform.once('ready', function (options, registeredDevices) {
    var clone   = require('lodash.clone'),
        domain  = require('domain'),
        indexBy = require('lodash.indexby'),
        config  = require('./config.json'),
        express = require('express'),
        bodyParser = require('body-parser');


    if (!isEmpty(registeredDevices)) {
        var tmpDevices = clone(registeredDevices, true);
        authorizedDevices = indexBy(tmpDevices, '_id');
    }

    if (isEmpty(options.data_topic))
        options.data_topic = config.data_topic.default;

    if (isEmpty(options.message_topic))
        options.message_topic = config.message_topic.default;

    if (isEmpty(options.groupmessage_topic))
        options.groupmessage_topic = config.groupmessage_topic.default;

    server = express();
    server.use(bodyParser.urlencoded({ extended: false }));
    server.use(bodyParser.json());

    server.all('/*', function(request, response){
        var serverDomain = domain.create();

        serverDomain.once('error', function (error) {
            platform.handleException(error);
            response.end(new Buffer('Invalid data sent. Must be a valid JSON String.'));
            serverDomain.exit();
        });

        serverDomain.run(function(){
            var url = request.url.split('/')[1];
            var message;

            if(isPlainObject(request.body))
                message = request.body;
            else
                message = JSON.parse(request.body);

            if(url === options.data_topic){
                platform.processData(message.device, message);
                platform.log(JSON.stringify({
                    title: 'Data Received.',
                    device: message.device,
                    data: message
                }));
                if (isEmpty(clients[message.device])) {
                    clients[message.device] = response;
                }
            }
            else if(url === options.message_topic){
                platform.sendMessageToDevice(message.target, message);

                platform.log(JSON.stringify({
                    title: 'Message Sent.',
                    source: message.device,
                    target: message.target,
                    message: message
                }));

                response.end('Message Sent.');
            }
            else if(url === options.groupmessage_topic){
                platform.sendMessageToGroup(message.target, message);

                platform.log(JSON.stringify({
                    title: 'Message Sent.',
                    source: message.device,
                    target: message.target,
                    message: message
                }));

                response.end('Message Sent.');
            }
            else{
                response.end('Invalid Topic: '+ url);
            }

            serverDomain.exit();
        });

    });

    server.listen(options.port, function(){
        platform.notifyReady();
        platform.log('Gateway has been initialized on port ' + options.port);
    });
});