define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Term"
], function(
    $,
    _,
    Backbone,
    Term
    ) {
    return Backbone.Model.extend({
        defaults: {
            id: "",
            comment : "",
            name : '',
            terms : []
        }
    });
});
