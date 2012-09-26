#!/usr/bin/node

var gamenode = require("gamenode");
var WebSocketClient = require("websocket").client;
var Manager = require("./src/manager").Manager;
var SocketIO = require("./socketio").SocketIO;

var io = new SocketIO();


io.on("handshake", function(addr) {
  var ws = new WebSocketClient();

  ws.on("connectFailed", function(error) {
    console.log("Connect Error: " + error.toString());
  });

  ws.on("connect", function(connection) {
    connection.on("error", function(error) {
      console.log("Connection Error: " + error.toString());
    });
    connection.on("close", function() {
      console.log("Connection closed");
    });
    connection.on("message", function(message) {
      console.log(message.utf8Data);
      io.message(message.utf8Data);
    });

    io.on("send", function(message) {
      connection.send(message);
    });

    var client = new gamenode.Client({crashOnError: true}, io, Manager);

    io.on("message", function(message) {
      client.handle(message);
    });

    client.debug = true;
    client.onMethodListReceived = function() {
      console.log("got method list");
      client.skeleton.login();
    };

    client.sendMethodListRequest();
  });

  console.log("Connecting to: " + addr);
  ws.connect(addr);
});

io.handshake("localhost", 8888);
