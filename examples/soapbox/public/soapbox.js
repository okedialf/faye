Soapbox = {
  init: function(comet) {
    var self = this;
    this._comet = comet;
    
    this._login   = $('#enterUsername');
    this._app     = $('#app');
    this._follow  = $('#addFollowee');
    this._post    = $('#postMessage');
    
    this._login.submit(function() {
      self._username = $('#username').val();
      self.launch();
      return false;
    });
  },
  
  launch: function() {
    var self = this;
    this._comet.subscribe('/mentioning/' + this._username);
    
    this._login.fadeOut('slow', function() {
      self._app.fadeIn('slow');
    });
    
    this._follow.submit(function() {
      var follow = $('#followee');
      self._comet.subscribe('/from/' + follow.val());
      follow.val('');
      return false;
    });
    
    this._post.submit(function() {
      var msg = $('#message');
      self.post(msg.val());
      msg.val('');
      return false;
    });
  },
  
  post: function(message) {
    var mentions = [],
        words    = message.split(/\s+/),
        self     = this,
        pattern  = /\@[a-z0-9]+/i;
    
    $.each(words, function(i, word) {
      if (!pattern.test(word)) return;
      word = word.replace(/[^a-z0-9]/ig, '');
      if (word !== self._username) mentions.push(word);
    });
    
    this._comet.batch();
    
    this._comet.publish('/from/' + this._username, message);
    
    $.each(mentions, function(i, name) {
      self._comet.publish('/mentioning/' + name, message);
    });
    
    this._comet.flush();
  }
};

