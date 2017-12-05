
module.exports = function(modtask, config, persistentStore) {

  function MessageStore(user){
    console.log("MessageStore created");
    this.user = user;
    var curtime = new Date().toLocaleString();
    this.messages = [];
    if(typeof this.registerHook == "function")
      this.registerHook();
  }

  MessageStore.prototype.registerHook = null;

  MessageStore.prototype.length = 0;
  MessageStore.prototype.size = 0;
  MessageStore.prototype.messages = [];
  MessageStore.prototype.counter = 0;

  MessageStore.prototype.addMessage = function(message){
    message = message || {};
    if(!message.date)
      message.date = +new Date();
    message.uid = "uid"+(++this.counter)+(+new Date());

    message.size = this.buildMimeMail(message).length;
    this.messages.push(message);
    this.length++;
    this.size += message.size;
  };

  MessageStore.prototype.stat = function(callback){
    callback(null, this.length, this.size);
  }

  MessageStore.prototype.rset = function(){
    for(var i=0, len = this.messages.length; i<len;i++){
      if(this.messages[i].deleteFlag){
        this.messages[i].deleteFlag = false;
        this.length++;
        this.size += this.messages[i].size;
      }
    }
  }

  MessageStore.prototype.removeDeleted = function(){
    for(var i=this.messages.length-1; i>=0;i--){
      if(this.messages[i].deleteFlag){
        this.messages.splice(i,1);
        console.log("Deleted MSG #"+(i+1));
      }
    }
  }

  var items = [];

  MessageStore.prototype.markAs = function(msg, tag, cb) {
    var index = parseInt(msg)*1-1;
    var item = items[index];
    persistentStore.markAs(item, tag, cb);
  }

  MessageStore.prototype.list = function(msg, callback) {
    persistentStore.query(function(result) {
      if (!result.success) {
        modtask.Log('WARNING: return zero for list since persistentStore.query failed: ' + result.reason);
        return callback(null, []);
      }
      items = result.items;
      var ret = [];
      for(var i=0; i < items.length ; i++ ) {
        ret.push( (i+1) + " " + items[i].size)
      }
      callback(null, ret);
    }, config.tags, config.limit);
  }

  MessageStore.prototype.retr = function(msg, callback){
    var index = parseInt(msg)*1-1;
    var item = items[index];
    persistentStore.consumeItem(item, function(contents) {
      callback(null, contents);
    });
  }

  MessageStore.prototype.dele = function(msg, callback) {
    // function(err, success)
    callback(null, true);
  } 

  MessageStore.prototype.uidl = function(msg, callback){
    /*var result = [];
    if(msg){
      if(isNaN(msg) || msg<1 || msg>this.messages.length ||
        this.messages[msg-1].deleteFlag)
        callback(null, false);
      callback(null, msg+" "+this.messages[msg-1].uid);
    }*/

    var ret = [];
    for(var i=0; i < items.length ; i++ ) {
      // if(!this.messages[i].deleteFlag)
      ret.push((i+1) + " " + items[i].guid);
    }
    modtask.Log('UIDL ' + JSON.stringify(ret));
    callback(null, ret);
  }

  return MessageStore;
}