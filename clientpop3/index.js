
var sampleListResponse = '+OK \r\n1 101\r\n2 102\r\n.\r\n'
var CRLF = '\r\n';

var modtask = function (config, _mainCb) {
	var fakeDataSourceIOMode = !!config.fakeDataSourceIOMode;
	if (fakeDataSourceIOMode) {
		sampleListResponse = '+OK ' + CRLF;
		var i;
		for(i=0; i < 1000; ++i) {
			sampleListResponse += i + ' ' + i + CRLF;
		}
	}
	var finalOutcome = {};
	if (!_mainCb) {
		_mainCb = function(outcome) {
			if (!outcome.success) {
				modtask.Log('Failed: ' + outcome.reason)
			} else {
				modtask.Log('client was successful');
			}
		};
	}
	var mod = modtask.ldmod('rel:sessionmanager')(config);

	var standardOK = function(client, cb) {
		var str = client.lastBuffer.toString(); // pop3 servers always use ascii for server response, so this should be ok
		if (modtask.detectStandardOK(str)) {
			return cb({success: true});
		} else {
			cb({reason: 'Waiting for standard OK, but got ' + str });
		}
	}

	var serverInteractions = [
		// null means just wait for server to write back
		[null, standardOK],
		['USER ' + config.user + CRLF, standardOK],
		['PASS ' + config.pass + CRLF, standardOK]
	];

	switch(config.cmd) {
		case 'list':
			if (fakeDataSourceIOMode) {
				modtask.parseListCommand(sampleListResponse, finalOutcome);
				return _mainCb(finalOutcome);
			}
			modtask.cmdList(serverInteractions, finalOutcome);
			break;
		case 'retr':
			if (!config.query) {
				return _mainCb({ reason: 'please specify query' });
			}
			var id = config.query.id;
			if (!id) {
				return _mainCb({ reason: 'please specify query.id with the id of the item to get' });
			}

			if (fakeDataSourceIOMode) {
				finalOutcome.success = true;
				finalOutcome.data = Buffer.from('sample payload for ' + id, 'ascii')
				return _mainCb(finalOutcome);
			}
			modtask.cmdRetr(serverInteractions, id, config, finalOutcome);
			break;
		default:
	}

	serverInteractions.push(['QUIT' + CRLF, '+OK']);
	mod.runApplicationLayerSocket(serverInteractions, function(outcome) {
		if (!outcome.success) return _mainCb(outcome);
		_mainCb(finalOutcome);
	});
};

modtask.detectStandardOK = function(str) {
	return (str.toLowerCase().indexOf('+ok') == 0 && str.indexOf(CRLF) > 0);
}

modtask.parseListCommand = function(str, outcome) {
	var outcome = outcome || {};
	if (!modtask.detectStandardOK(str)) {
		outcome.reason = 'expected OK at the begining of command but got ' + str;
		return;
	}
	var items = str.split(CRLF);
	outcome.success = true;
	outcome.data = {
		items: [],
		idIndexHash: {}
	};
	var i;
	var item ;
	for(i=1; i < items.length; ++i) {
		item = items[i];
		if (item.indexOf(' ') >= 0) {
			item = item.split(' ');
			var obj = {id: item[0], size: item[1] };
			outcome.data.idIndexHash[obj.id] = outcome.data.items.length;
			outcome.data.items.push(obj);
		}
	}
}

modtask.cmdList = function(serverInteractions, finalOutcome) {
	serverInteractions.push(
		['LIST' + CRLF, function(client, cb) {
			var token = '.' + CRLF;
			if (client.lastStr.indexOf(token) == client.lastStr.length - token.length) {
				delete finalOutcome.reason;
				modtask.parseListCommand(client.lastStr, finalOutcome);
				return cb({ success: true });
			}
			finalOutcome.success = false;
			finalOutcome.reason =  'Waiting for ' + token;
			cb( { reason: 'Waiting for ' + token });
		}]
	);
}

modtask.cmdRetr = function(serverInteractions, msgId, config, finalOutcome) {
	var expectedLength = -1;
	var lastToken = CRLF + '.' + CRLF;
	var state = 'firstline';
	var stateData = {
		firstLineEndIndex: -1
	}
	serverInteractions.push(
		['LIST' + CRLF, function(client, cb) {
			var token = '.' + CRLF;
			if (client.lastStr.indexOf(token) == client.lastStr.length - token.length) {
				var token = msgId + ' ';
				try {
					expectedLength = client.lastStr.split(CRLF + msgId + ' ')[1].split(CRLF)[0]*1;
				} catch(e) {}
				i
				if (isNaN(expectedLength)) {
					return cb({ reason: 'cannot determine expectedLength for ' + msgId });
				}
				return cb({ success: true });
			}
			cb( { reason: 'Waiting for ' + token });
		}]);

	var processState = function(client, cb) {
		var buf = client.lastBuffer;
		switch (state) {
			case 'firstline':
				// we will have +OK \r\n for the first list
				if (buf.indexOf(CRLF) != -1) {
					stateData.firstLineEndIndex = buf.indexOf(CRLF) * 1 + CRLF.length;
					state = 'belowthreshold';
					return processState(client, cb);
				}
				break;
			case 'belowthreshold':
				if (buf.length > 0 // data recieved
					&& stateData.firstLineEndIndex >= 3 // first line recieved already
					&& buf.length >= expectedLength + CRLF.length*2 // the expected lenght plus at aleasy two CRLF
				) {
					state = 'waitforlastline';
					return processState(client, cb);
				}

				// Sometimes the server sends the wrong size for the message. If we have been waiting too long and serverTimeoutExpired
				// At least try to see if the lastline is there?
				if (client.serverTimeoutExpired) {
					state = 'waitforlastline';
					return processState(client, cb);
				}
				break;
			case 'waitforlastline':
				var lastPart = buf.slice(buf.length - lastToken.length, buf.length);
				if (lastPart.toString() == lastToken) {
					state = 'complete';
					return processState(client, cb);
				}
				break;
			case 'complete':
				buf = buf.slice(stateData.firstLineEndIndex);
				buf = buf.slice(0, buf.length - lastToken.length);
				if (client.serverTimeoutExpired) {
					finalOutcome.reason = 'serverTimeoutExpired';
				} else {
					finalOutcome.success = true;
					finalOutcome.data = buf;
				}
				return cb({success: true});
		}
		cb( { reason: 'State is ' + state });
	}

	serverInteractions.push(
		['RETR ' + msgId + CRLF, function(client, cb) {
			var progress = Math.round(client.lastBuffer.length / (expectedLength+1) * 100);
			modtask.Log('state=' + state + ', progress=' + progress + '% expectedLength=' + expectedLength + ' sofar=' +  client.lastBuffer.length);
			processState(client, cb);
		}]);
}
