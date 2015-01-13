define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/EventType"
], function(
    $,
    _,
    Backbone,
    EventType
    ) {
    return Backbone.Collection.extend({
        model: EventType
    });
});