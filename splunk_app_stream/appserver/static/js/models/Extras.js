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
            interval: 60
        },
        validate: function(attrs, options) {
            if (! attrs.interval.match(/^[1-9]\d*$/)) {
                return 'Time interval must be a positive integer.';
            }
            this.set('interval', parseInt(attrs.interval));
        }
    });
});
