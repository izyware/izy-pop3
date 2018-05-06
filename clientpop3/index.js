
var modtask = function (config) {
	var mod = modtask.ldmod('rel:sessionmanager')(config);

	var serverInteractions = [
		[null, '+OK Fenix ready.\r\n'],
		['USER ' + config.user + '\r\n', '+OK\r\n'],
		['PASS ' + config.pass + '\r\n', '+OK Logged in. \r\n']
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
			modtask.Log('runApplicationLayerSocket were successful');
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
	var storeConfig = config.mimestore || {};
	if (!storeConfig.modhandler) storeConfig.modhandler = 'fake';
	mimeStore = modtask.ldmod('rel:../mimestore/' + storeConfig.modhandler)(storeConfig);
	if (!mimeStore.success) {
		return modtask.Log('mimeStore failed: ' + mimeStore.reason);
	}

	var expectedLength = -1;
	var lastToken = '\r\n\r\n.\r\n';
	var state = 'firstline';
	var stateData = {
		firstLineEndIndex: -1
	}
	serverInteractions.push(
		['LIST\r\n', function(client, cb) {
			var token = '.\r\n';
			if (client.lastStr.indexOf(token) == client.lastStr.length - token.length) {
				var token = msgId + ' ';
				try {
					expectedLength = client.lastStr.split(msgId + ' ')[1].split('\r\n')[0]*1;
				} catch(e) {}
				console.log('expectedLength for msgId ' + msgId + ': ' + expectedLength);
				return cb({ success: true });
			}
			cb( { reason: 'Waiting for ' + token });
		}]);

	var processState = function(client, cb) {
		var buf = client.lastBuffer;
		switch (state) {
			case 'firstline':
				// we will have +OK \r\n for the first list
				if (buf.indexOf('\r\n') != -1) {
					stateData.firstLineEndIndex = buf.indexOf('\r\n') * 1 + 2;
					state = 'belowthreshold';
					return processState(client, cb);
				}
				break;
			case 'belowthreshold':
				if (buf.length > 0 && stateData.firstLineEndIndex >= 3 && (buf.length >= expectedLength + stateData.firstLineEndIndex)) {
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

				var guid = msgId;
				mimeStore.addItems([{
					messageUTCTimestamp: null,
					sourceid: config.user,
					guid: guid,
					size: buf.length,
					// Is this binary? What is the encoding here?
					payload: buf
				}]);
				return cb({success: true});
		}
		cb( { reason: 'State is ' + state });
	}

	serverInteractions.push(
		['RETR ' + msgId + '\r\n', function(client, cb) {
			var progress = Math.round(client.lastBuffer.length / (expectedLength+1) * 100);
			modtask.Log('state=' + state + ', progress=' + progress + '%');
			processState(client, cb);
		}]);
}
