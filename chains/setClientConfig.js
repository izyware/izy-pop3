var modtask = function(chain) {
  chain([
    ['log', 'entering'],
    function(chain) {
        var parametersJSON = chain.get('parametersJSON');
        var config = chain.get('config');
        var clientConfig = {
            verbose: true,
            user: parametersJSON.user,
            tls: true,
            ip: parametersJSON.ip,
            port: parametersJSON.port,
            pass: parametersJSON.password,
            fakeDataSourceIOMode: config.fakeDataSourceIOMode
        };
        if (!parametersJSON.password) {
            if (!config.passwordLookup) return chain([
                ['set', 'outcome', { reason: 'No password specified via parameters and the internal config does not define passwordLookup. Abort' }],
                ['return']
            ]);
            clientConfig.pass = config.passwordLookup[parametersJSON.user];
        }
        return chain([
          ['set', 'clientConfig', clientConfig]
        ]);
    } 
	]);
}
