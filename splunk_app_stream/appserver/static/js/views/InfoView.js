define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/InfoDialog.html"
], function(
    $,
    _,
    Backbone,
    InfoDialogTemplate
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.command = this.options.command;
            this.template = _.template($(InfoDialogTemplate).html());
        },

        events:{
            'click .ok':'ok'
        },

        ok:function(){
            this.$el.modal('hide');
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
            this.removeSelf();
            //this.close();
        },

        show: function(){
            this.$el.empty();
            var output = this.template({"title": this.options.title, "message": this.options.message});
            this.$el.append(output);         
            this.$el.modal('show');
        },

        removeSelf: function () {
            // empty the contents of the container DOM element without taking it out of the DOM
            this.$el.empty();

            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            this.$el.removeClass('fade');

            return this;
        }

    });
});