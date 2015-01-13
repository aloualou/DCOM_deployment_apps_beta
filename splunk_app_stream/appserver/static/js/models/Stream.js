define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Field",
    "app-js/models/Filters",
    "app-js/models/Extras",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    Field,
    Filters,
    Extras,
    splunk_util
    ) {
    return Backbone.Model.extend({
        urlRoot: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "streams"
        ].join('/')),

        defaults: {
            id: "",
            streamType: "event",
            name: '',
            enabled: true,
            aggregated: false,
            cloned: false,
            locked: false,
            extras: {},
            fields: [],
            index: null,

            // TODO: The Stream model should use the Filters model, e.g.
            // filters: new Filters()
            // However, this will require some research on how to handle nested models.
            filters: {matchAllComparisons: true, comparisons: []}
        },
        validation: {
            name: {
                required: true,
                msg: 'Please provide a name'
            },
            id: {
                required: true,
                msg: 'Please provide a valid id'
            },
            eventType: {
                required: true,
                msg: 'Please provide a valid event type'
            }
        }
    });
});
