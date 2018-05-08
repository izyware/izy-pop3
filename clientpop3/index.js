
var modtask = function (config) {
	var mod = modtask.ldmod('rel:sessionmanager')(config);

	var standardOK = function(client, cb) {
		var str = client.lastBuffer.toString(); // pop3 servers always use ascii for server response, so this should be ok
		if (str.toLowerCase().indexOf('+ok') == 0 && str.indexOf('\r\n') > 0) {
			return cb({success: true});
		} else {
			cb({reason: 'Waiting for standard OK, but got ' + str });
		}
	}

	var serverInteractions = [
		// null means just wait for server to write back
		[null, standardOK],
		['USER ' + config.user + '\r\n', standardOK],
		['PASS ' + config.pass + '\r\n', standardOK]
	];

	switch(config.cmd) {
		case 'list':
			modtask.cmdList(serverInteractions);
			break;
		case 'retr':
			var range = config.query.split('-');
			if (range.length != 2)
				return modtask.Log('Please specifiy the query range start-end');
			var i;
			for(i=range[0]*1; i <= range[1]*1; ++i) {
				modtask.cmdRetr(serverInteractions, i, config);
			}
			break;
		default:
	}

	serverInteractions.push(['QUIT\r\n', '+OK']);

	mod.runApplicationLayerSocket(serverInteractions, function(outcome) {
		if (!outcome.success) {
			modtask.Log('Failed: ' + outcome.reason)
		} else {
			modtask.Log('client was successful');
		}
	});
};

modtask.cmdList = function(serverInteractions) {
	serverInteractions.push(
		['LIST\r\n', function(client, cb) {
			var token = '.\r\n';
			if (client.lastStr.indexOf(token) == client.lastStr.length - token.length) {
				console.log(client.lastStr);
				return cb({ success: true });
			}
			cb( { reason: 'Waiting for ' + token });
		}]
	);
}

modtask.cmdRetr = function(serverInteractions, msgId, config) {
	var mimeStore = null;
	var CRLF = '\r\n';

	serverInteractions.push([null, function(client, cb) {
		var storeConfig = config.mimestore || {};
		if (!storeConfig.modhandler) storeConfig.modhandler = 'fake';
		mimeStore = modtask.ldmod('rel:../mimestore/' + storeConfig.modhandler)(storeConfig);
		// mimeStore.success, ..
		cb(mimeStore);
	}]);

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

				var reasonCode = 0;
				if (client.serverTimeoutExpired) {
					reasonCode = 1;
				}
				
				var guid = msgId;
				mimeStore.addItems([{
					messageUTCTimestamp: null,
					sourceid: config.user,
					guid: guid,
					size: buf.length,
					// Is this binary? What is the encoding here?
					payload: buf,
					metadata: {
						reasonCode: reasonCode
					}
				}]);
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
