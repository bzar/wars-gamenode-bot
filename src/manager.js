var settings = require("./settings");

exports.Manager = function(client) {
  this.client = client;
};

exports.Manager.prototype.login = function() {
  this.client.stub.newSession({username: settings.username, password: settings.password}, function(result) {
    console.log(result);
  });
};