var modtask = function(chain) {
  chain([
    ['log', 'downloading data item ID: ' + chain.get('dataItemId')],
    function(chain) {
      var clientConfig = Object.assign({}, chain.get('clientConfig'));
      clientConfig.cmd = 'retr';
      clientConfig.query = {
          id: chain.get('dataItemId')
      };
      chain(['///izy-pop3/api/client', {
          action: 'runCmd',
          config: clientConfig
      }]);
    },
    ['ROF'],
    function(chain) {
        var outcome = chain.get('outcome');

        var doFingerprintHex = function(data) {
            var crypto = require('crypto')
              , shasum = crypto.createHash('sha1');
            shasum.update(data);
            var result = shasum.digest('hex');
            return result;
        }

        var fingerprintHex = doFingerprintHex(outcome.data);
        chain.set('fingerprintHex', fingerprintHex);
        chain.set('datasize', outcome.data.length);
        chain(['fsstorage.save', {
            config: chain.get('config').storage, // path, etc.
            data: outcome.data,
            fingerprintHex: fingerprintHex
        }]);
    },
    ['ROF'],
    function(chain) {
        var outcome = chain.get('outcome');
        var fingerprintHex = chain.get('fingerprintHex');
        chain(['task.trackdata', {
            dataIdHex: (chain.get('dataItemId')*1).toString(16),
            fingerprintHex: fingerprintHex,
            uri: outcome.data.uri,
            size: chain.get('datasize'),
            datatype: 'email',
            encryptionkey: null
        }]);
    },
    ['ROF']
	]);
}
