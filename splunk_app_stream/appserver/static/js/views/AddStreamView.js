define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Stream",
    "app-js/models/Extras",
    "contrib/text!app-js/templates/AddStreamDialog.html",
    "backbone_validation",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    Stream,
    Extras,
    AddStreamTemplate,
    splunk_util
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.template = _.template($(AddStreamTemplate).html());
            this.app = this.options.app;
            this.selectedStream = this.options.stream;
            this.userHasChanges = this.options.userHasChanges;
            this.showStreamsList = this.options.showStreamsList;
        },

        events: {
            'click .yes': 'yes',
            'click .cancel': 'cancel'
        },

        cancel: function() {
            this.removeSelf();
        },
        
        show: function(){
            var self = this;

            //deep copy the collection
            var collectionCopy = $.extend(true, {}, this.app.streams);

            //filter for non-ephemeral streams that are part of Stream-app
            collectionCopy.models = _.filter(this.app.streams.models, function(model) {
                var isEphemeral = ("expirationDate" in model.attributes);
                return (!isEphemeral && (model.attributes.app === "Stream") ) ;
            });

            var output = this.template({
                            streams         : collectionCopy, 
                            selectedStream  : this.selectedStream,
                            userHasChanges  : this.userHasChanges,
                            showStreamsList : this.showStreamsList
                         });
            
            this.$el.empty();
            this.$el.append(output);     
            this.$el.modal('show');

            this.$el.on('hide', function() {
                //'hide' is also fired when backdrop is clicked. bootstrap default behavior.
                self.removeSelf();
            })
        },
     
        yes: function(e) {
            var self = this;
            var data = this.$('form').serializeObject();
            var streamToClone = this.selectedStream || this.app.streams.get(data.streamId);
            var stream = streamToClone.clone();

            e.preventDefault();

            if (! data.id) {
                alert('Please specify a name for the new stream.');
                return;
            }
            if (! data.id.match(/^\w+$/)) {
                alert("Please specify a name using only letters, digits and underscores ('_').");
                return;
            }

            stream.set('id', data.id);
            stream.set('name', data.name);

            //cloned streams should not be deletable, and should start out disabled
            stream.set('locked', false);
            stream.set('enabled', false);
            stream.set('cloned', true);

            if (stream.isValid(true)) {
                stream.save(null, {
                    type: 'post',
                    url: Splunk.util.make_url([
                        "custom",
                        "splunk_app_stream",
                        "streams"
                    ].join('/')),
                    success: function(e){
                        self.app.mediator.publish("event:new-stream-added", stream);
                        self.$el.modal('hide');
                        $('.modal-backdrop').remove();
                        self.removeSelf();
                    },
                    error: function(obj, err){
                        console.log("Error saving stream");
                        alert("Error saving stream: " + err.responseJSON.error);
                    }
                });
            }
            else {
                this.$('.alert-error').fadeIn();
            }
        },

        removeSelf: function () {
            // empty the contents of the container DOM element without taking it out of the DOM
            this.$el.empty();

            this.unbind();

            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            return this;
        }

    });
});