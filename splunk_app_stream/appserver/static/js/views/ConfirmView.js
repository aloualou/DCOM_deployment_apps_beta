define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/ConfirmDialog.html"
], function(
    $,
    _,
    Backbone,
    ConfirmDialogTemplate
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.command = this.options.command;
            this.template = _.template($(ConfirmDialogTemplate).html());
        },

        events:{
            'click .yes':'yes'
        },
        
        show: function(){
            var self = this;
            this.$el.empty();
            var output = this.template({
                "obj": this.model, 
                "action": this.options.action,
                "warning": this.options.warning || ""
            });
            this.$el.append(output);         
            this.$el.modal('show');

            this.$el.on('hide', function() {
                //remove self on hide else modal behavior will collide.
                self.removeSelf();
            })
            
        },
     
        yes:function(){
            this.command();
            this.$el.modal('hide');
            this.removeSelf();
            return false;
            //this.close();
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