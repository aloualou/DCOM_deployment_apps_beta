define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/IpAddressList",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    IpAddressList,
    splunk_util
    ) {
    return Backbone.Collection.extend({
        model: IpAddressList,
        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "captureipaddresses"
        ].join('/'))
    });
});