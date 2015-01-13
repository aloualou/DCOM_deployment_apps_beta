define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {

Backbone.View.prototype.close = function(){
    this.$el.empty();
    //this.remove();
    this.undelegateEvents();
    this.unbind();
    if (this.onClose){
        this.onClose();
    }
};
});