
var modtask = function (config) {
	modtask.config = config;

	return modtask;
};

modtask.showCmds = false;

modtask.runApplicationLayerSocket = function(serverInteractions, mainCb, config) {
	if (!config) config = modtask.config;
	modtask.verbose = config.verbose;
	var clientLog = function(str) {
		modtask.Log('[CLIENT]: ' + str);
	}
	clientLog('attempting to connect ...');
	modtask.createSocketConnection(config, function(client) {
		clientLog('connected');

		client.on('close', function () {
			clientLog('Connection closed');
		});

		modtask.startInteractions(client, serverInteractions, function(outcome) {
				modtask.Log('initiate kill socket');
				client.destroy();
				mainCb(outcome);
			});
	});
}

modtask.startInteractions = function(client, interactions, mainCb) {

	var resetClientState = function() {
		client.lastStr = '';
		client.lastBuffer = Buffer.alloc(0);
		client.timeoutSinceLastDataFromServer = 0;
	}

	client.on('data', function(data) {
		client.timeoutSinceLastDataFromServer = 0;
		client.lastBuffer = Buffer.concat([client.lastBuffer, data]);
		client.lastStr += data.toString();
	});

	var verifyCmd = function(item, cb) {
		var cmd = item[0], response = item[1];
		resetClientState();
		if (modtask.showCmds) modtask.Log('verifyCmd >>>>>>' + JSON.stringify(cmd) + '<<<<<<<< ');
		if (cmd) {
			client.write(cmd);
		}

		var standardCheck = function(client, cb) {
			var outcome = verify(response, client.lastStr);
			cb(outcome);
		}

		var timeout = 5;
		var waitForCompletion = function() {

			var postOutcome = function(outcome) {
				if (outcome.success) {
					if (modtask.verbose > 4) modtask.Log('Server Said: ' + JSON.stringify(client.lastStr));
					if (modtask.showCmds) modtask.Log('<<<<<< Verified ' + cmd);
					return cb({ success: true});
				}
				// hmm, wait longer?
				if (client.timeoutSinceLastDataFromServer < timeout) {
					if (modtask.verbose > 3) modtask.Log('waitForCompletion, time elapsed: ' + client.timeoutSinceLastDataFromServer + ' . Data Recieved ' + client.lastBuffer.length);
					return setTimeout(function () {
						client.timeoutSinceLastDataFromServer++;
						return waitForCompletion();
					}, 1000);
				}
				// well, just fail then
				cb(outcome);
			}

			if (typeof(response) == 'function') {
				return response(client, postOutcome);
			} else {
				standardCheck(client, postOutcome)
			}

		};
		waitForCompletion();

	}

	var iterate = function(list, cb, i) {
		if (i < list.length) {
			verifyCmd(list[i], function (outcome) {
				if (modtask.verbose > 3) modtask.Log('Next item to verify: ' + i);
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
	iterate(interactions, mainCb, 0);
}

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

modtask.createSocketConnection = function(config, cb) {
	if (config.tls) {
		const tls = require('tls');
		var client = tls.connect(config.port, config.ip, function() {
			console.log('client connected', client.authorized ? 'authorized' : 'unauthorized');
			cb(client);
		});
	} else {
		var net = require('net');
		var client = new net.Socket();
		client.connect(config.port, config.ip, function() {
			cb(client);
		});
	}
}