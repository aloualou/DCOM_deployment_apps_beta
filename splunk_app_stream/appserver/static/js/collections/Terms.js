define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Term",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    Term,
    splunk_util
    ) {
    return Backbone.Collection.extend({
        model: Term,
        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "vocabularies"
        ].join('/'))
    });
});