# izy-pop3
Node.js pop3 server components for Izyware

# INSTALLATION

If you are using npm (the Node.js package manager) always ensure that your npm is up-to-date by running:

`npm update -g npm`  

Then use:

```
npm install izy-pop3;cp -r node_modules/izy-pop3/* .;rm -rf node_modules/izy-pop3;
```

# Command Line Usage


## Server

```
node cli.js method serverpop3 port 1110 password 12345 mimestore.modhandler fake
node cli.js method serverpop3 port 1110 password 12345 mimestore.modhandler cloud mimestore.dataservice xxx mimestore.xxx ....
```

### Notes about port forwarding

If you would like to run the server behind a firewall, you can use port forwarding:

```
ssh -i identity.pem -4 -v -R 1110:localhost:1110 user@your-server.com
```


## Client

To connect using TLS, pass tls true as the config.

```
node cli.js method clientpop3 ip pop.secureserver.net port 995 user user@domain pass 'password' tls true cmd list
node cli.js method clientpop3 ip pop.secureserver.net port 995 user user@domain pass 'password' tls true mimestore.modhandler localfs mimestore.path /tmp/izyware/mimestore cmd retr query 1-10
```

### Server Implementations Workarounds
Some POP3 server implementation do not strictly stick to the standard definition. To workaround those issues, the client uses a state machine to intelligently perform RETR commands.

### Encoding of the POP3 data
All the commands and metadata returned by the POP3 server are encoded using the ASCII character set.

It is worth remembering that the payload returned via the RETR command is binary buffer of octets.

This payload is passed on to the mime store handlers and it is up to the mime-store handler to serialize the data properly:

```
mimeStore.addItems({
	...,
	payload: 'Octet Buffer'

```

For example, when using the `localfs` mimestore implemented in nodejs, you may pass the octet buffer directly to writeFile:

```
fs.writeFile(file, buffer, ...)
```

(The encoding option is ignored if data is a buffer. writeFile will only need encoding if the buffer is a string).

Since .eml files are serialized octets from a RFC822 encoded message, the approach shown above would work perfectly fine and should generate interoperable stores that would work with standard compliant tools from 3rd party vendors.

### TIP
If you need to debug over SSL, use ncat --ssl. i.e.

```
ncat --ssl pop.secureserver.net 995
USER user
PASS pass
LIST
RETR 1
```

## Querying the mime store

If you need to inspect the contents of the mime store you should install the IzyPop3 app via the enterprise accounts dashboard.

## Testing

To make sure that the full stack (client, server, mime store) works, do:

```
node cli.js method test testtype fullclientserver
```

You can test subsystems (mimestore, etc.):

```
node cli.js method test testtype mimestore mimestore.modhandler fake query.limit 2 query.tags abc
node cli.js method test testtype mimestore mimestore.modhandler cloud mimestore.accesstoken xxxx mimestore.dataservice https://yourcloudlocation mimestore.verbose true mimestore.tablename yyy.xxx query.limit 2 query.tags abc
```

 ## NOTE
for more details, visit https://izyware.com
