
var modtask = function (config) {

  var persistentStore = null;
  persistentStore = modtask.ldmod('rel:../storage/cloudStore')(config);
  if (!persistentStore.success) {
    return modtask.Log('persistentStore failed: ' + persistentStore.reason);
  }

  var N3 = modtask.getServerObjectInstance();
  var msgstore = modtask.getMessageStoretInstance()(modtask, config, persistentStore);
  server_name = "pop3.server.advanced.cote";

  // Currenlty any user with password specified in the command line will be authenticated successfully
  function AuthStore(user, auth){
    var password;
    if(user){
      password = config.password;
    }
    return auth(password);
  }

  modtask.Log('Starting server on port: ' + config.port);
  N3.startServer(config, modtask, AuthStore, msgstore);
  
  // Custom authentication method: FOOBAR <user> <pass>
  N3.extendAUTH("FOOBAR", function (authObj) {
    var params = authObj.params.split(" "),
      user = params[0],
      pass = params[1];

    console.log(user, pass);
    if (!user) // username is not set
      return "-ERR Authentication error. FOOBAR expects <user> <password>"

    authObj.user = user;
    return authObj.check(user, pass);
  });

}

modtask.getMessageStoretInstance = function() {
  var currentdir = process.cwd();
  return require(currentdir + "/serverpop3/msgstore");
}

modtask.getServerObjectInstance = function() {
  var currentdir = process.cwd();
  return require(currentdir + "/serverpop3/n3").N3;
}
