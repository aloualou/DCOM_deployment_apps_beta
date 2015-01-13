define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {
    return Backbone.Model.extend({
        defaults: {
            matchAllComparisons: true,
            comparisons: []
        },
        validate: function(attrs, options) {
            // ???
        }
    });
});
