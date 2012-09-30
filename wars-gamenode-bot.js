#!/usr/bin/node

var settings = require("./src/settings");
var gamenode = require("gamenode");
var WebSocketClient = require("websocket").client;
var Manager = require("./src/manager").Manager;
var Handler = require("./src/handler").Handler;
var SocketIO = require("./socketio").SocketIO;


// Initialize bot state
function initBot(client) {
  client.stub.newSession({username: settings.username, password: settings.password}, function(result) {
    client.stub.myGames(function(result) {
      for(var i = 0; i < result.games.length; ++i) {
        var game = result.games[i];
        if(game.state != "finished") {
          var handler = new Handler(client, game);
          client.skeleton.handlers[game.gameId] = handler;
        }
      }
    });
  });
}


function connectToServer(host, port, callback) {
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
        try {
          io.message(message.utf8Data);
        } catch(e) {
          console.log(e);
        }
      });

      io.on("send", function(message) {
        connection.send(message);
      });

      var client = new gamenode.Client({crashOnError: true}, io, Manager);

      io.on("message", function(message) {
        try {
          client.handle(message);
        } catch(e) {
          console.log(e);
        }
      });

      client.debug = true;
      client.onMethodListReceived = function() {
        callback(client);
      };

      client.sendMethodListRequest();
    });

    console.log("Connecting to: " + addr);
    ws.connect(addr);
  });

  io.handshake(host, port);
}

connectToServer(settings.server.host, settings.server.port, initBot);