
var modtask = {};
modtask.init = function() { 
   // We need to create a 'platform based shell that would automatically do this for windows'
   if (modtask.ldmod("kernel/plat").getOSName() == "windows") {
      modtask.ldmod('net/http').configAsync('sync');
   }
   modtask.groupidobject = { "transportmodule" : false } ; 
} 
modtask.cmdlineverbs = {};
modtask.help = {};
modtask.helpStr = `
Please specifiy arguments. 
	
Example:

node cli.js method serverpop3 port 1110 password 12345 storePath ~/emails [orderBy desc] [commitmode true] [limit 500] [tags unprocessed]
node cli.js method serverpop3 port 1110 password 12345 dataservice https://izyware.com/apps/izyware/ accesstoken xxxx groupid 1 limit 100 commitmode true

node cli.js method clientpop3 ip localhost port 1110 user user pass 12345 testsuite listandquit

node cli.js method querystore dataservice https://izyware.com/apps/izyware/ accesstoken xxxx query 'select id, readBy, channel, channelId, sender, senderId from db.messageextract where body = "body"  limit 1'

node cli.js method test testtype popserver|sessionmanager testtype popserver] [orderBy desc]
node cli.js method test testtype sessionmanager

`;

modtask.help[modtask.helpStr] = true;
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
         modtask.Log(modtask.helpStr);
         break;
   }
}
