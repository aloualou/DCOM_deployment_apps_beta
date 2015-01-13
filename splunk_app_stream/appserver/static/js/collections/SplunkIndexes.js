define(
    [
        "app-js/models/SplunkIndex",
        "collections/SplunkDsBase"
    ],
    function(IndexModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: "data/indexes",
            model: IndexModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);