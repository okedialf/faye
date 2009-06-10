Faye.Client = Faye.Class({
  _UNCONNECTED:  {},
  _CONNECTING:   {},
  _CONNECTED:    {},
  
  DEFAULT_ENDPOINT:   '<%= Faye::App::DEFAULT_ENDPOINT %>',
  
  initialize: function(endpoint) {
    this._endpoint  = endpoint || this.DEFAULT_ENDPOINT;
    this._transport = Faye.Transport.get(this);
    this._state     = this._UNCONNECTED;
    this._outbox    = [];
    
    Faye.Event.on(Faye.ENV, 'unload', this.disconnect, this);
  },
  
  generateId: function(bitdepth) {
    bitdepth = bitdepth || 32;
    return Math.floor(Math.pow(2,bitdepth) * Math.random()).toString(16);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  // * add timeouts
  handshake: function(callback, scope) {
    if (this._state !== this._UNCONNECTED) return;
    this._state = this._CONNECTING;
    
    var id = this.generateId();
    
    this._transport.send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes(),
      id:           id
      
    }, function(message) {
      if (message.id !== id) return;
      if (!message.successful) return;   // TODO retry
      
      this._state     = this._CONNECTED;
      this._clientId  = message.clientId;
      this._transport = Faye.Transport.get(this, message.supportedConnectionTypes);
      
      if (callback) callback.call(scope);
    }, this);
  },
  
  connect: function(callback, scope) {
    if (!this._clientId) return this.handshake(function() {
      this.connect(callback, scope);
    }, this);
    
    if (this._state !== this._CONNECTED) return;
    
    if (this._connectionId) return;
    this._connectionId = this.generateId();
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType,
      id:             this._connectionId
      
    }, function(message) {
      if (message.id !== this._connectionId) return;
      delete this._connectionId;
      this.connect();
    }, this);
    
    if (callback) callback.call(scope);
  },
  
  // TODO
  // * handle errors
  disconnect: function() {
    if (this._state === this._UNCONNECTED) return;
    this._state = this._UNCONNECTED;
    
    this._transport.send({
      channel:  Faye.Channel.DISCONNECT,
      clientId: this._clientId
    });
  },
  
  subscribe: function(channels, callback, scope) {
    if (this._state !== this._CONNECTED) return;
    
    channels = [].concat(channels);
    var id = this.generateId();
    
    Faye.each(channels, function(channel) {
      if (!Faye.Channel.valid(channel))
        throw '"' + channel + '" is not a valid channel name';
    });
    
    this._transport.send({
      channel:      Faye.Channel.SUBSCRIBE,
      clientId:     this._clientId,
      subscription: channels,
      id:           id
      
    });
  },
  
  // TODO support anonymous publishing
  publish: function(channel, data) {
    if (this._state !== this._CONNECTED) return;
    if (!Faye.Channel.valid(channel))
      throw '"' + channel + '" is not a valid channel name';
    
    this.enqueue({
      channel:      channel,
      data:         data,
      clientId:     this._clientId
    });
    if (!this._batching) this.flush();
  },
  
  enqueue: function(message) {
    this._outbox.push(message);
  },
  
  batch: function() {
    this._batching = true;
  },
  
  flush: function() {
    this._batching = false;
    this._transport.send(this._outbox);
    this._outbox = [];
  },
  
  // TODO might be better as a retry loop
  handleAdvice: function(advice) {
    var client = this;
    switch (advice.reconnect) {
      case 'retry':     setTimeout(function() {
                          client.connect();
                        }, advice.interval || Faye.Client.BACKOFF);
                        break;
      case 'handshake': client.handshake();
                        break;
      case 'none':
      default:          break;
    }
  }
});

Faye.extend(Faye.Client, {
  BACKOFF:  5000
});

