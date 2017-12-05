var net = require('net');

var N3 = {
    server_name: "localhost",

    /**
     * N3.States -> Object
     *
     * Constants for different states of the current connection. Every state has
     * different possibilities, ie. APOP is allowed only in AUTHENTICATION state
     **/
    States:{
        AUTHENTICATION: 1,
        TRANSACTION:2,
        UPDATE: 3
    },

    /**
     * N3.COUNTER -> Number
     * 
     * Connection counter, every time a new connection to the server is made, this
     * number is incremented by 1. Useful for generating connection based unique tokens
     **/
    COUNTER: 0,
    
    /**
     * N3.authMethods -> Object
     * 
     * Houses different authentication methods for SASL-AUTH as extensions. See
     * N3.extendAuth for additional information 
     **/
    authMethods: {},
    
    /**
     * N3.capabilities -> Object
     * 
     * Prototype object for individual servers. Contains the items that will
     * be listed as an answer to the CAPA command. Individual server will add
     * specific commands to the list by itself.
     **/
    capabilities: {
        // AUTHENTICATION
        1: ["UIDL", "USER", "RESP-CODES", "AUTH-RESP-CODE"],
        // TRANSACTION
        2: ["UIDL", "EXPIRE NEVER", "LOGIN-DELAY 0", "IMPLEMENTATION N3 node.js POP3 server"],
        // UPDATE
        3: []
    },

    /**
     * N3.connected_users -> Object
     * 
     * Keeps a list of all users that currently have a connection. Users are added
     * as keys with a value of TRUE to the list and deleted when disconnecting
     * 
     * Login:
     *     N3.connected_users[username] = true;
     * Logout:
     *     delete N3.connected_users[username]
     * Check state:
     *     if(N3.connected_users[username]);
     **/
    connected_users:{},

    startServer: function(config, modtask, auth, MsgStore, callback) {
        // try to start the server
        net.createServer(this.createInstance.bind(
                this, config, modtask, auth, MsgStore)
            ).listen(config.port, function(err){
                if(err){
                    console.log("Failed starting server");
                    return callback(err);
                }else{
                    console.log("POP3 Server running on port " + config.port)
                    return callback && callback(null);
                }
            });

    },

    createInstance: function(config, modtask, auth, MsgStore, socket){
        new this.POP3Server(socket, config, modtask, auth, MsgStore);
    },
    
    /**
     * N3.extendAUTH(name, action) -> undefined
     * - name (String): name for the authentication method, will be listed with SASL
     * - action (Function): Validates the authentication of an user
     * 
     * Enables extending the SALS AUTH by adding new authentication method.
     * action gets a parameter authObject and is expected to return TRUE or FALSE
     * to show if the validation succeeded or not.
     * 
     * authObject has the following structure:
     *   - wait (Boolean): initially false. If set to TRUE, then the next response from
     *                     the client will be forwarded directly back to the function
     *   - user (String): initially false. Set this value with the user name of the logging user
     *   - params (String): Authentication parameters from the client
     *   - history (Array): an array of previous params if .wait was set to TRUE
     *   - n3 (Object): current session object
     *   - check (Function): function to validate the user, has two params:
     *     - user (String): username of the logging user
     *     - pass (Function | String): password or function(pass){return pass==pass}
     * 
     * See sasl.js for some examples
     **/
    extendAUTH: function(name, action){
        name = name.trim().toUpperCase();
        this.authMethods[name] = action;
    }
}

N3.POP3Server = function(socket, config, modtask, auth, MsgStore){
    this.server_name = config.servername || N3.server_name;
    this.socket   = socket;
    this.state    = N3.States.AUTHENTICATION;
    this.connection_id = ++N3.COUNTER;
    this.UID      = this.connection_id + "." + (+new Date());
    this.authCallback = auth;
    this.MsgStore = MsgStore;
    this.connection_secured = false;
    this.lastItemBeingUploaded = null;
    this.modtask = modtask;

    var dt = modtask.ldmod('core/datetime');
    this.startTime = dt.getDateTime();
    this.Log = function(action, msg) {
        if (!msg) msg = '';
        if (!action) action = '';
        action = action.toUpperCase();
        var i;
        var delta = 30 - action.length;
        action += ' ';
        for(i=0; i < delta; ++i)
            action += '-';
        var now = dt.getDateTime();
        var delta = dt.dateInMilisecs(now) - dt.dateInMilisecs(this.startTime);
        console.log(now + ` [serversession_${this.UID}_${delta}ms] --- ${action}: `, msg);
    }

    // Copy N3 capabilities info into the current object
    this.capabilities = {
        1: Object.create(N3.capabilities[1]),
        2: Object.create(N3.capabilities[2]),
        3: Object.create(N3.capabilities[3])
    }

    this.Log('new client connection', socket.remoteAddress);
    this.response("+OK POP3 Server ready <"+this.UID+"@"+this.server_name+">");
    
    socket.on("data", this.onData.bind(this));
    socket.on("end", this.onEnd.bind(this));
    socket.on("error", this.onError.bind(this));
}
 
/**
 * N3.POP3Server#destroy() -> undefined
 * 
 * Clears the used variables just in case (garbage collector should
 * do this by itself)
 **/
N3.POP3Server.prototype.destroy = function(){
    if(this.timer)clearTimeout(this.timer);
    this.timer = null;
    this.socket = null;
    this.state = null;
    this.authCallback = null;
    this.user = null;
    this.MsgStore = null;
}

/**
 * 
 **/
// kill client after 10 min on inactivity
N3.POP3Server.prototype.updateTimeout = function(){
    if(this.timer)clearTimeout(this.timer);
    this.timer = setTimeout((function(){
        if(!this.socket)
            return;
        if(this.sate==N3.States.TRANSACTION)
            this.state = N3.States.UPDATE;
        this.Log("Connection closed for client inactivity");
        if(this.user && N3.connected_users[this.user.trim().toLowerCase()])
            delete N3.connected_users[this.user.trim().toLowerCase()];
        this.socket.end();
        this.destroy();
    }).bind(this),10*60*1000); 
}

N3.POP3Server.prototype.afterLogin = function(){
    var messages = false;

    if(this.user && N3.connected_users[this.user.trim().toLowerCase()]){
        this.user = false; // to prevent clearing it with exit
        return "-ERR [IN-USE] You already have a POP session running";
    }

    if(typeof this.MsgStore!="function")
        return false;

    if(this.user && (messages = new this.MsgStore(this.user))){
        this.messages = messages;
        N3.connected_users[this.user.trim().toLowerCase()] = true;
        return true;
    }
    return false;
}

N3.POP3Server.prototype.onData = function(data){
    var request = data.toString("ascii", 0, data.length);
    this.Log('client command', request.trim());
    this.onCommand(request);
}

N3.POP3Server.prototype.onError = function(data) {
    this.Log('Socket onError', JSON.stringify(data));
    this.onEnd(data);
}

N3.POP3Server.prototype.onEnd = function(data) {
    this.Log('Socket onEnd');

    // placeholder
    if (this.lastItemBeingUploaded) {
        this.Log('no client quit. pop3failed', this.lastItemBeingUploaded);
        this.messages.markAs(this.lastItemBeingUploaded, 'pop3failed', function() {});
    }

    if(this.state===null)
        return;
    this.state = N3.States.UPDATE;
    if(this.user && N3.connected_users[this.user.trim().toLowerCase()])
        delete N3.connected_users[this.user.trim().toLowerCase()];
    this.Log('socket end');
    this.socket.end();
    this.destroy();
}

N3.POP3Server.prototype.onCommand = function(request){
    this.Log('onCommand');
    var cmd = request.match(/^[A-Za-z]+/),
        params = cmd && request.substr(cmd[0].length+1);

    this.updateTimeout();

    if(this.authState){
        params = request.trim();
        return this.cmdAUTHNext(params);
    }
    
    if(!cmd) {
        this.Log('malformed command');
        return this.response("-ERR");
    }
    if(typeof this["cmd"+cmd[0].toUpperCase()]=="function"){
        return this["cmd"+cmd[0].toUpperCase()](params && params.trim());
    }

    this.Log('command not found');
    return this.response("-ERR");
}

// Universal commands
    
// CAPA - Reveals server capabilities to the client
N3.POP3Server.prototype.cmdCAPA = function(params){

    if(params && params.length){
        return this.response("-ERR Try: CAPA");
    }

    params = (params || "").split(" ");
    this.response("+OK Capability list follows");
    for(var i=0;i<this.capabilities[this.state].length; i++){
        this.response(this.capabilities[this.state][i]);
    }
    if(N3.authMethods){
        var methods = [];
        for(var i in N3.authMethods){
            if(N3.authMethods.hasOwnProperty(i))
                methods.push(i);
        }
        if(methods.length && this.state==N3.States.AUTHENTICATION)
            this.response("SASL "+methods.join(" "));
    }
    this.response(".");
}

// QUIT - Closes the connection
N3.POP3Server.prototype.cmdQUIT = function() {
    this.lastItemBeingUploaded = null;
    if(this.state==N3.States.TRANSACTION){
        this.state = N3.States.UPDATE;
        this.messages.removeDeleted();
    }
    this.response("+OK N3 POP3 Server signing off");
    this.socket.end();
}

// AUTHENTICATION commands

// AUTH auth_engine - initiates an authentication request
N3.POP3Server.prototype.cmdAUTH = function(auth){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    
    if(!auth)
        return this.response("-ERR Invalid authentication method");
    
    var parts = auth.split(" "),
        method = parts.shift().toUpperCase().trim(),
        params = parts.join(" "),
        response;
    
    this.authObj = {wait: false, params: params, history:[], check: this.cmdAUTHCheck.bind(this), n3: this};
    
    // check if the asked auth methid exists and if so, then run it for the first time
    if(typeof N3.authMethods[method]=="function"){
        response = N3.authMethods[method](this.authObj);
        if(response){
            if(this.authObj.wait){
                this.authState = method;
                this.authObj.history.push(params);
            }else if(response===true){
                response = this.cmdDoAUTH();
            }
            this.response(response);
        }else{
            this.authObj = false;
            this.response("-ERR [AUTH] Invalid authentication");
        }
    }else{
        this.authObj = false;
        this.response("-ERR Unrecognized authentication type");
    }
}

N3.POP3Server.prototype.cmdDoAUTH = function(){
    var response;
    this.user = this.authObj.user;
    if((response = this.afterLogin())===true){
        this.state = N3.States.TRANSACTION;
        response = "+OK You are now logged in";
    }else{
        response = response || "-ERR [SYS] Error with initializing";
    }
    this.authState = false;
    this.authObj = false;
    return response;
}

N3.POP3Server.prototype.cmdAUTHNext = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    this.authObj.wait = false;
    this.authObj.params = params;
    this.authObj.n3 = this;
    var response = N3.authMethods[this.authState](this.authObj);
    if(!response){
        this.authState = false;
        this.authObj = false;
        return this.response("-ERR [AUTH] Invalid authentication");
    }
    if(this.authObj.wait){
        this.authObj.history.push(params);
    }else if(response===true){
        response = this.cmdDoAUTH();
    }
    this.response(response);
}

N3.POP3Server.prototype.cmdAUTHCheck = function(user, passFn){
    if(user) this.authObj.user = user;
    if(typeof this.authCallback=="function"){
        if(typeof passFn=="function")
            return !!this.authCallback(user, passFn);
        else if(typeof passFn=="string" || typeof passFn=="number")
            return !!this.authCallback(user, function(pass){return pass==passFn});
        else return false;
    }
    return true;
}

// APOP username hash - Performs an APOP authentication
// http://www.faqs.org/rfcs/rfc1939.html #7

// USAGE:
//   CLIENT: APOP user MD5(salt+pass)
//   SERVER: +OK You are now logged in

N3.POP3Server.prototype.cmdAPOP = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    
    params = params.split(" ");
    var user = params[0] && params[0].trim(),
        hash = params[1] && params[1].trim().toLowerCase(),
        salt = "<"+this.UID+"@"+this.server_name+">",
        response;

    if(typeof this.authCallback=="function"){
        if(!this.authCallback(user, function(pass){
            return md5(salt+pass)==hash;
        })){
            return this.response("-ERR [AUTH] Invalid login");
        }
    }
    
    this.user = user;
    
    if((response = this.afterLogin())===true){
        this.state = N3.States.TRANSACTION;
        return this.response("+OK You are now logged in");
    }else
        return this.response(response || "-ERR [SYS] Error with initializing");
}

// USER username - Performs basic authentication, PASS follows
N3.POP3Server.prototype.cmdUSER = function(username){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");

    this.user = username.trim();
    if(!this.user)
        return this.response("-ERR User not set, try: USER <username>");
    return this.response("+OK User accepted");
}

// PASS - Performs basic authentication, runs after USER
N3.POP3Server.prototype.cmdPASS = function(password){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    if(!this.user) return this.response("-ERR USER not yet set");
    
    if(typeof this.authCallback=="function"){
        if(!this.authCallback(this.user, function(pass){
            return pass==password;
        })){
            delete this.user;
            return this.response("-ERR [AUTH] Invalid login");
        }
    }
    
    var response;
    if((response = this.afterLogin())===true){
        this.state = N3.States.TRANSACTION;
        return this.response("+OK You are now logged in");
    }else
        return this.response(response || "-ERR [SYS] Error with initializing");
}

// TRANSACTION commands

// NOOP - always responds with +OK
N3.POP3Server.prototype.cmdNOOP = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    this.response("+OK");
}
    
// STAT Lists the total count and bytesize of the messages
N3.POP3Server.prototype.cmdSTAT = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");

    this.messages.stat((function(err, length, size){
        if(err){
            this.response("-ERR STAT failed")
        }else{
            this.response("+OK "+length+" "+size);
        }
    }).bind(this));
    
}

// LIST [msg] lists all messages
N3.POP3Server.prototype.cmdLIST = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");

    this.messages.list(msg, (function(err, list){
        if(err){
            return this.response("-ERR LIST command failed")
        }
        if(!list)
            return this.response("-ERR Invalid message ID");
        
        if(typeof list == "string"){
            this.response("+OK "+list);
        }else{
            this.response("+OK");
            for(var i=0;i<list.length;i++){
                this.response(list[i]);
            }
            this.response(".");
        }
    }).bind(this));
}

// UIDL - lists unique identifiers for stored messages
N3.POP3Server.prototype.cmdUIDL = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    this.messages.uidl(msg, (function(err, list){
        if(err){
            return this.response("-ERR UIDL command failed")
        }

        if(!list)
            return this.response("-ERR Invalid message ID");
        
        if(typeof list == "string"){
            this.response("+OK "+list);
        }else{
            this.response("+OK");
            for(var i=0;i<list.length;i++){
                this.response(list[i]);
            }
            this.response(".");
        }
    }).bind(this));
}


N3.POP3Server.prototype.response = function(message){
    var response;
    if(typeof message == "string"){
        response = new Buffer(message + "\r\n", "utf-8");
    } else {
        response = Buffer.concat([message, new Buffer("\r\n", "utf-8")]);
    }
    this.Log('socket.write', response.length);
    if (this.socket) {
        this.socket.write(response);
    } else {
        this.Log('socket.write', 'ignored since socket is null (connection closed?)');
    }
}

// RETR msg - outputs a selected message
N3.POP3Server.prototype.cmdRETR = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");


    var _this = this;
    var myResponse = function(message, socket, cb) {
        var encoding = "utf-8";
        var response;
        if(typeof(message) == "string") {
            response = new Buffer(message + "\r\n", encoding);
        } else {
            response = Buffer.concat([message, new Buffer("\r\n", encoding)]);
        }
        _this.Log('socket.write', response.length)

        if (socket) {
            return socket.write(response, encoding, cb);
        } else {
            _this.Log('socket.write', 'ignored since socket is null (connection closed?)');
        }
    } 

    this.lastItemBeingUploaded = null;
    this.messages.retr(msg, (function(err, message) {
        if(err) {
            return this.response("-ERR RETR command failed")
        }
        if(!message){
            return this.response("-ERR Invalid message ID");
        }
        /*
        this.response("+OK "+message.length+" octets");
        this.response(message);
        this.response(".");
        */
        this.lastItemBeingUploaded = msg;
        this.Log('start transfer', msg);
        var _this = this;
        var ret = myResponse("+OK " + message.length + " octets" + '\r\n' + message + '\r\n' + '.', this.socket, function() {
            _this.Log('complete transfer', msg);
        });
        this.Log('socket write result', ret);
    }).bind(this));

}

// DELE msg - marks selected message for deletion
N3.POP3Server.prototype.cmdDELE = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    this.messages.dele(msg, (function(err, success){
        if(err){
            return this.response("-ERR RETR command failed")
        }
        if(!success){
            return this.response("-ERR Invalid message ID");
        }else{
            this.response("+OK msg deleted");
        }
    }).bind(this));

}

// RSET - resets DELE'ted message flags
N3.POP3Server.prototype.cmdRSET = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    this.messages.rset();
    this.response("+OK");
}


// UTILITY FUNCTIONS

// Creates a MD5 hash
function md5(str){
    var hash = crypto.createHash('md5');
    hash.update(str);
    return hash.digest("hex").toLowerCase();
}

// EXPORT
this.N3 = N3;


