var net = require('net');

var modtask = function (config) {
	var client = new net.Socket();
	clientLog = function(str) {
		modtask.Log('[CLIENT]: ' + str);
	}
	clientLog('attempting to connect ...');
	client.connect(config.port, config.ip, function() {
		clientLog('connected');
		var mod = modtask.ldmod('rel:../test/sessionmanager');

		if (!config.testsuite) {
			modtask.Log('Please specify testsuite. Values are: ' + Object.keys(mod.testSuits).join(','));
			return modtask.endSession(client);
		}

		var tests = mod.testSuits[config.testsuite];
		tests[2][0] = 'PASS ' + config.pass;
		mod.verifyClientInteractions(client, tests, function(outcome) {
			if (!outcome.success) {
				clientLog('Failed: ' + outcome.reason)
			} else {
				clientLog('Server tests were successful');
			}
			modtask.endSession(client);
		});
	});

	client.on('data', function(data) {
		client.lastStr += data.toString();
	});

	client.on('close', function() {
		clientLog('Connection closed');
	});
};

modtask.endSession = function(client) {
	modtask.Log('initiate kill socket');
	client.destroy();
}
