var http = require("http");

function SocketIO() {
  this.handlers = {
    message: [],
    connect: [],
    send: [],
    handshake: []
  }
};

SocketIO.prototype.on = function(event, cb) {
  var handlers = this.handlers[event];
  if(handlers !== undefined) {
    handlers.push(cb);
  }
}

SocketIO.prototype.handshake = function(host, port) {
  var that = this;
  http.get({host: host, path: "/socket.io/1/websocket", port: port}, function(res) {
    res.on("data", function(chunk) {
      var connInfo = chunk.toString();
      var wsId = connInfo.split(":")[0];
      for(var i = 0; i < that.handlers.handshake.length; ++i) {
        var cb = that.handlers.handshake[i];
        cb("ws://" + host + ":" + port+ "/socket.io/1/websocket/" + wsId);
      }
    });
  }).on('error', function(e) {
    console.log("Got error: " + e.message);
  });
};

SocketIO.prototype.MSG_CONNECT = 1;
SocketIO.prototype.MSG_HEARTBEAT = 2;
SocketIO.prototype.MSG_MESSAGE = 3;
SocketIO.prototype.MSG_JSON = 4;
SocketIO.prototype.MSG_EVENT = 5;
SocketIO.prototype.MSG_ACK = 6;
SocketIO.prototype.MSG_ERROR = 7;
SocketIO.prototype.MSG_NOOP = 8;

SocketIO.prototype.message = function(message) {
  var parts = message.split(":");
  var headerParts = parts.splice(0, 3);
  var msgType = parseInt(headerParts[0]);
  var msgId = parseInt(headerParts[1]);
  var msgEndpoint = headerParts[2];

  var msgData = parts ? parts.join(":") : null;

  if(msgType === this.MSG_HEARTBEAT) {
    this._send(message);
  } else if(msgType === this.MSG_MESSAGE) {
    for(var i = 0; i < this.handlers.message.length; ++i) {
      var cb = this.handlers.message[i];
      cb(msgData);
    }
  } else if (msgType === this.MSG_CONNECT) {
    for(var i = 0; i < this.handlers.connect.length; ++i) {
      var cb = this.handlers.connect[i];
      cb();
    }

  }
}

SocketIO.prototype.send = function(message) {
  this._send(this.MSG_MESSAGE + ":::" + message);
}

SocketIO.prototype._send = function(message) {
  for(var i = 0; i < this.handlers.send.length; ++i) {
    var cb = this.handlers.send[i];
    cb(message);
  }
}

exports.SocketIO = SocketIO;
