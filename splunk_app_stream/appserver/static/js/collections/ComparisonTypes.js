define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/ComparisonType"
], function(
    $,
    _,
    Backbone,
    ComparisonType
    ) {
    return Backbone.Collection.extend({
        model: ComparisonType
    });
});
