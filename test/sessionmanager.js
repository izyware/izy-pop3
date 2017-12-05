
var modtask = function (config) {
	modtask.verbose = config.verbose || 0;
	config.port = 19999;
	modtask.startServer(config, function() {
		modtask.Log('testing client connections');
		var i, keys = Object.keys(modtask.testSuits);
		for(i=0; i < keys.length; ++i) {
			modtask.connectAsClient(config.port, modtask.testSuits[keys[i]]);
		}
	});
};

modtask.testSuits = {
	badlogin: [
		[null, '+OK POP3 Server ready'],
		['USER baduser', '+OK User accepted'],
		['PASS badpass', '-ERR [AUTH] Invalid login']
	],
	listandquit: [
		[null, '+OK POP3 Server ready'],
		['USER gooduser', '+OK User accepted'],
		['PASS gooduser', '+OK You are now logged in'],
		['CAPA', '+OK Capability list follows\r\nUIDL'],
		['LIST', '+OK\r\n'],
		['UIDL', '+OK\r\n'],
		['QUIT', '+OK']
	],
	// send pass = user to get logged in
	// This will cause POP3FAILED because the connection is closed before QUIT
	pop3failed: [
		[null, '+OK POP3 Server ready'],
		['USER gooduser', '+OK User accepted'],
		['PASS gooduser', '+OK You are now logged in'],
		['CAPA', '+OK Capability list follows\r\nUIDL'],
		['LIST', '+OK\r\n1 '],
		['UIDL', '+OK\r\n1 ******'],
		['RETR 1', '+OK '] // OK xxx octents\r\n ....
	],
	// send pass = user to get logged in
	// This will cause POP3FAILED because the connection is closed before QUIT
	retrsuccess: [
		[null, '+OK POP3 Server ready'],
		['USER gooduser', '+OK User accepted'],
		['PASS gooduser', '+OK You are now logged in'],
		['CAPA', '+OK Capability list follows\r\nUIDL'],
		['LIST', '+OK\r\n1 '],
		['UIDL', '+OK\r\n1 ******'],
		['RETR 1', '+OK '], // OK xxx octents\r\n ....
		['QUIT', '+OK']
	]
};

modtask.connectAsClient = function(port, testSuit) {
	var net = require('net');
	var clientLog = function(str) {
		modtask.Log('[CLIENT]: ' + str);
	}
try {
	modtask.ldmod('core/datetime')
} catch(e) {
	console.log('dddd');
}
	var client = new net.Socket();
	client.lastStr =  '';
	clientLog('Attempting to connect ...');
	client.connect(port, '127.0.0.1', function() {
		clientLog('Connected');
		modtask.verifyClientInteractions(client, testSuit, function(outcome) {
			if (!outcome.success) {
				clientLog('Failed: ' + outcome.reason)
			} else {
				clientLog('Server tests were successful');
			}
			clientLog('initiate kill socket');
			client.destroy();
		});
	});

	client.on('data', function(data) {
		// clientLog('Received: ' + data);
		client.lastStr += data.toString();
	});

	client.on('close', function() {
		clientLog('Connection closed');
	});
}


/*
	example:

 var testSuit = [
 [null, '+OK POP3 Server ready'],
 ['USER pop3test', '+OK User accepted'],
 ['PASS 12345', '+OK You are now logged in'],
 ['CAPA', '+OK Capability list follows\r\nUIDL'],
 ['LIST', '+OK\r\n1 '],
 ['UIDL', '+OK\r\n1 ******'],
 ['RETR 1', '+OK '] // OK xxx octents\r\n ....
 ];*/

modtask.verifyClientInteractions = function(client, testSuit, mainCb) {

	var verify = function(p1, p2) {
		if (p1.length < p2.length) {
			p2 = p2.substr(0, p1.length);
		}
		if (p1 != p2) {
			for (var i = 0, len = p1.length; i < len; i++) {
				if (p1[i] != p2[i] && p1[i] != '*') {
					return {
						reason: 'verify failed:\n-----------expected----------\n' + JSON.stringify(p1) + '\n--------------actual---------------\n' + JSON.stringify(p2) + '...\n'
					};
				}
			}
		}
		return { success: true };
	}

	var verifyCmd = function(item, cb) {
		var cmd = item[0], response = item[1];
		client.lastStr = '';
		modtask.Log('>>>>>> verifyCmd ' + cmd);
		if (cmd) {
			client.write(cmd);
		}
		var timeout = 2;
		var waitForCompletion = function(sofar) {
			if (!sofar) sofar = 0;
			if (modtask.verbose > 1) modtask.Log('waitForCompletion, time elapsed: ' + sofar);
			var outcome = verify(response, client.lastStr);
			if (outcome.success) {
				modtask.Log('<<<<<< Verified ' + cmd);
				return cb({ success: true });
			}
			if (sofar < timeout) {
				return setTimeout(function() {
					return waitForCompletion(sofar+1);
				}, 1000);
			}
			cb(outcome);
		};
		waitForCompletion(0);
	}

	var iterate = function(list, cb, i) {
		if (i < list.length) {
			verifyCmd(list[i], function (outcome) {
				if (modtask.verbose > 1) modtask.Log('Next item to verify: ' + i);
				if (outcome.success) {
					iterate(list, cb, i + 1);
				} else {
					cb(outcome);
				}
			});
		} else {
			cb({success: true});
		}
	};
	iterate(testSuit, mainCb, 0);
}

modtask.startServer = function(config, cb) {
	modtask.Log('======== testPOPServer ==========');

	function AuthStore(user, auth) {
		var password;
		if(user){
			password = user;
		}
		return auth(password);
	}

	var msgstore = modtask.ldmod('rel:../serverpop3/index').getMessageStoretInstance()(
		modtask, config, modtask.ldmod('rel:fakeStore')(config));

	// startServer: function(port, server_name, auth, MsgStore, callback);
	var server = new modtask.ldmod('rel:../serverpop3/index').getServerObjectInstance().startServer(config,
		modtask,
		AuthStore,
		msgstore,
		cb
	);
}