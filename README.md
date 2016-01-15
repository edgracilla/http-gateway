# HTTP Gateway

[![Build Status](https://travis-ci.org/Reekoh/http-gateway.svg)](https://travis-ci.org/Reekoh/http-gateway)
![Dependencies](https://img.shields.io/david/Reekoh/http-gateway.svg)
![Dependencies](https://img.shields.io/david/dev/Reekoh/http-gateway.svg)
![Built With](https://img.shields.io/badge/built%20with-gulp-red.svg)

HTTP Gateway for the Reekoh IOT platform.

## Description

This plugin provides a way for devices and/or sensors that are connected to the Reekoh Instance to relay/broadcast messages/command to other connected devices via HTTP.

## Configuration

The following parameters are needed to configure this plugin:

1. Port - The port to use in relaying messages.
2. Data Topic - The topic in which the sent data belongs to(default is reekoh/data).
3. Message Topic - The topic in which the message to be sent belongs to(default is reekoh/messages).
4. Group Message Topic - The topic in which the group message to be sent belongs to(defualt is reekoh/groupmessages).

These parameters are then injected to the plugin from the platform.