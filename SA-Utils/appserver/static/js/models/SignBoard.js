define([
    'jquery',
    'backbone',
    'underscore',
    'd3',
    'backbone-mediator'
],
function(
    $,
    Backbone,
    _,
    d3
){
    return Backbone.Model.extend({
        defaults: function(){

        },
        initialize: function(){
            Backbone.Mediator.subscribe('selectedEvents:change', this.update, this);
        },
        update: function(events){
            this.set('events', events);
        }
    });
});
