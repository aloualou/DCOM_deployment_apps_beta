define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Stream",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    Stream,
    splunk_util
    ) {
    return Backbone.Collection.extend({
        model: Stream,
        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "streams"
        ].join('/')),
        comparator: "id"
    });
});