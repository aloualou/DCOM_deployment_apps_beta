define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Vocabulary"
], function(
    $,
    _,
    Backbone,
    Vocabulary
    ) {
    return Backbone.Collection.extend({
        model: Vocabulary
    });
});