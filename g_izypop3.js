
var modtask = {};
modtask.init = function() { 
   // We need to create a 'platform based shell that would automatically do this for windows'
   if (modtask.ldmod("kernel/plat").getOSName() == "windows") {
      modtask.ldmod('net/http').configAsync('sync');
   }
   modtask.groupidobject = { "transportmodule" : false } ; 
} 
modtask.cmdlineverbs = {};
modtask.commit = false;
modtask.verbose = false;

modtask.cmdlineverbs.method = function() {
   var config = modtask.ldmod('izymodtask/index').extractConfigFromCmdLine('method');
   var method = config.method;
   delete config.method;
   switch(method) {
      case 'test':
         modtask.ldmod('rel:' + method)(config);
         break;
      case 'querystore':
      case 'serverpop3':
      case 'clientpop3':
         modtask.ldmod('rel:' + method + '/index')(config);
         break;
      default:
         require('fs').readFile('README.md', function(err, data) {
           modtask.Log(data.toString());
         });
         break;
   }
}
