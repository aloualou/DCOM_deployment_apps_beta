define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Field"
], function(
    $,
    _,
    Backbone,
    Field
    ) {
    return Backbone.Collection.extend({
        model: Field
    });
});