define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.app = this.options.app;
            this.template = _.template($(this.options.template).html());
        },

        render: function(){
            var self = this;
            var output = self.template({"serverMetrics": self.model});
            self.$el.append(output);
            return self;
        },

        removeSelf: function () {
            // empty the contents of the container DOM element without taking it out of the DOM
            this.$el.empty();

            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            return this;
        }

    });
});