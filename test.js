
var modtask = function (config) {
	modtask.verbose = config.verbose || 0;
	modtask.Log('Test');
	console.log('Config:', config);

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

	var getStore = function() {
		var persistentStore;
		if (!config.dataservice) {
			persistentStore = require('./persistentStore')(modtask, config);
		} else {
			persistentStore = modtask.ldmod('rel:cloudStore')(config);
		}
		return persistentStore;
	}
	
	var testStore = function() {
		var persistentStore = getStore();

		persistentStore.query(function(result) {
			console.log(result.items);
			console.log('count', result.count);
			console.log('size', result.totalSize);
		}, config.tags, config.limit);
	}

	var test_popserver = function() {
		modtask.Log('======== testPOPServer ==========');
		var persistentStore = getStore();
		var MessageStore = require('./serverpop3/msgstore')(modtask, config, persistentStore);

		var socket = {
			lastStr: '',
			on: function() {},
			write: function(str) {
				this.lastStr += str.toString();
			}
		}
		// new this.POP3Server(socket, server_name, auth, MsgStore);
		var server = new modtask.ldmod('rel:serverpop3').getServerObjectInstance().POP3Server(socket, 'test', { }, MessageStore);
		server.updateTimeout = function() { };

		// verify('+OK POP3 Server ready', socket.lastStr);

		var verifyCmd = function(item, cb) {
			var cmd = item[0], response = item[1];
			socket.lastStr = '';
			modtask.Log('\n\n>>>>>> verifyCmd ' + cmd);
			server.onCommand(cmd);
			var timeout = 2;
			var waitForCompletion = function(sofar) {
				if (!sofar) sofar = 0;
				if (modtask.verbose > 1) modtask.Log('waitForCompletion, time elapsed: ' + sofar);
				var outcome = verify(response, socket.lastStr);
				if (outcome.success) {
					modtask.Log('<<<<<<<<< Verified ' + cmd);
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

		// verifyCmd
		var testSuit = [
			['USER pop3test', '+OK User accepted'],
			['PASS 12345', '+OK You are now logged in'],
			['CAPA', '+OK Capability list follows\r\nUIDL'],
			['LIST', '+OK\r\n1 '],
			['UIDL', '+OK\r\n1 ******'],
			['RETR 1', '+OK '] // OK xxx octents\r\n ....
		];
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
		iterate(testSuit, function(outcome) {
			if (!outcome.success) {
				modtask.Log('Failed: ' + outcome.reason)
			} else {
				modtask.Log('Server tests were successful');
			}
		}, 0);
	}

	switch (config.testtype) {
		case 'popserver':
			test_popserver();
			break;
		case 'sessionmanager':
			modtask.ldmod(`rel:test/${config.testtype}`)(config);
			break;
		default:
			testStore();
			break;
	}
};
