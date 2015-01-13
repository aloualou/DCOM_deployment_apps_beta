define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/collections/Streams",
    "app-js/views/StreamsListView",
    "contrib/text!app-js/templates/StreamsList.html",
    "app-js/views/EphemeralStreamsView",
    "collections/services/authentication/CurrentContexts"
], function(
    $,
    _,
    Backbone,
    Streams,
    StreamsListView,
    StreamsListTemplate,
    EphemeralStreamsView,
    CurrentContexts
    ) {
    return Backbone.View.extend({

        initialize: function(options){

            console.log('Streams List View Left Column created');

            this.options       = _.extend({}, this.options, options);
            this.app           = this.options.app;
            this.template      = _.template($(this.options.template).html());
            this.categoryItems = [];
            this.parentAppView = this.options.appView;
            this.category      = this.options.category;
            this.parentRouter  = this.options.router;

            //these options are used for rendering the ephermeral streams view
            this.isEphemeral   = this.options.isEphemeral;

            this.createUniqueListOfCategoryItems();

        },

        createUniqueListOfCategoryItems: function() {

            var self = this;

            var cases = {
                "application" : generateUniqueListViaApp,
                "usage"       : generateUniqueListViaUsage,
                "protocol"    : generateUniqueListViaProtocol
            }

            //run function depending on what the category is
            if (cases[self.category]) {
                cases[self.category]();
            } else {
                console.log("case does not exist");
            }

            /*==========  Case Functions  ==========*/

            function generateUniqueListViaApp() {
                self.categoryItems = createUniqueList(function(model) {
                    return model.attributes.app;
                });
            }

            function generateUniqueListViaUsage() {
                self.categoryItems = createUniqueList(function(model) {
                    return model.attributes.category;
                });
            }

            function generateUniqueListViaProtocol() {
                self.categoryItems = createUniqueList(function(model) {
                    return model.attributes.extras.eventType.split(".")[0];
                });
            }

            // function generateUniqueListViaCloned() {
            //     self.categoryItems = ["cloned", "default"];
            // }

            function createUniqueList(accessor){
                var uniqueCategoryItems = []
                self.collection.each(function(model) {
                    uniqueCategoryItems.push(accessor(model));
                })
                //filter to be unique and remove all "undefined" cases.
                return _.filter(_.uniq(uniqueCategoryItems), function(each) {
                    return each;
                })
            }

        },

        events: {

            "click #inner-categories-container .left-column-item-wrapper" : "generateFilteredStreamsList"

        },

        generateFilteredStreamsList : function(e) {

            var self = this;

            var categoryItem = $(e.currentTarget).find(".category-value").text();

            //deselect and select (css) based on what was clicked
            $('#inner-categories-container').find(".left-column-item-wrapper").removeClass("is-selected");
            $(e.currentTarget).addClass("is-selected");

            var cases = {
                "application" : generateAndFilterViaApplication,
                "usage"       : generateAndFilterViaUsage,
                "protocol"    : generateAndFilterViaProtocol
            }

            if (cases[self.category]) {
                cases[self.category]();
            } else {
                console.log("category does not exist");
            }

            /*======================================
            =            Case Functions            =
            ======================================*/

            function generateAndFilterViaApplication(){

                /*=================================
                =            Ephemeral            =
                =================================*/
                
                if (self.isEphemeral){

                    /*==========  Filter Ephemeral  ==========*/
                    
                    var filteredEphemeralModels = _.filter(self.collection.models, function(model) {
                        return ('expirationDate' in model.attributes);
                    });

                    var filteredApplicationModels = filteredEphemeralModels;

                    /*==========  Filter Via Application  ==========*/
                    
                    if (categoryItem !== 'all') {

                        var filteredApplicationModels = _.filter(filteredEphemeralModels, function(model) {
                            var attr = model.attributes.app;
                            return (attr === categoryItem);
                        });

                    }

                    /*==========  Group Things  ==========*/

                    var groupedModels = _.groupBy(filteredApplicationModels,function(model) {
                        return model.attributes.category;
                    })

                    var finalGroups = [];

                    _.each(groupedModels,function(group,key) {

                        /*==========  Find Max/Min  ==========*/
                        

                        var maximum = _.chain(group).map(function(each) {
                            return each.attributes.expirationDate;
                        }).max().value();

                        var minimum = _.chain(group).map(function(each) {
                            return each.attributes.createDate;
                        }).min().value();

                        /*==========  Figure out status of group  ==========*/
                        

                        var status = "Some Enabled/Some Disabled ◐"
                        var allEnabled = _.every(group,function(each){
                                                return each.attributes.enabled === true
                                            });
                        if (allEnabled) {
                            status = "All Enabled ◯";
                        }

                        var allDisabled = _.every(group,function(each){
                                                return each.attributes.enabled === false
                                            });
                        if (allDisabled){
                            status = "All Disabled ⨂";
                        }

                        /*==========  Bind data  ==========*/

                        var thisElement = {};

                        thisElement.models        = _.pluck(group,"attributes");
                        thisElement.earliestTime  = utcToString(minimum);
                        thisElement.latestTime    = utcToString(maximum);
                        thisElement.name          = key;
                        thisElement.numStreams    = thisElement.models.length;
                        thisElement.application   = group[0].attributes.app; //app should be the same for all, just grab first one
                        thisElement.timeRemaining = secondsToString(maximum - Math.floor(Date.now() / 1000));
                        thisElement.status        = status;

                        finalGroups.push(thisElement);

                        /*==========  Helper functions ==========*/

                        function utcToString(seconds){
                            var d = new Date(0);
                            d.setUTCSeconds(seconds);
                            return d.toISOString();
                        }

                        function secondsToString(seconds){
                            var seconds = Number(seconds);
                            var d = Math.floor(seconds / (3600 * 24))
                            var h = Math.floor(seconds % (3600 * 24) / 3600);
                            var m = Math.floor(seconds % 3600 / 60);
                            return ( (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "")); 
                        }

                    })

                    var timezonePromise = $.Deferred();                    
                    var context = new CurrentContexts();
                    context.fetch({
                        success: function(data){
                            var timezone = data.fetchXhr.responseJSON.entry[0].content.tz || null;
                            timezonePromise.resolve(timezone);
                        },
                        error: function() {
                            console.log('failed to get timezone');
                        }
                    })

                    timezonePromise.done(function(timezone) {
                        
                        var ephemeralStreamsView = new EphemeralStreamsView({

                            streamGroups : finalGroups,
                            el           : '#config',
                            app          : self.app,
                            collection   : self.collection,
                            timezone     : timezone

                        });

                        self.parentAppView.showViewRight(ephemeralStreamsView);
                        self.parentRouter.navigate("ephemeral/" + categoryItem , {trigger:false})

                    })

                }

                /*===============================================
                =            Permanent/Non-Ephemeral            =
                ===============================================*/
                
                else {
                    genericFilter(function(model) { 
                        var attr = model.attributes.app;
                        return (attr === categoryItem);
                    })
                }

            }

            function generateAndFilterViaUsage(){
                genericFilter(function(model) {
                    var attr = model.attributes.category
                    return (attr === categoryItem);
                })
            }

            function generateAndFilterViaProtocol() {
                genericFilter(function(model) {
                    var attr = model.attributes.extras.eventType.split(".")[0];
                    return (attr === categoryItem);
                })
            }

            // //for grouping via cloned/non-cloned
            //
            // function generateAndFilterViaCloned() {
            //     genericFilter(function(model) {
                    
            //         //cloned attributes are not locked
            //         //default attributes are
            //         var isLocked = model.attributes.locked;

            //         if (categoryItem === "cloned"){
            //             return (isLocked === false);
            //         }
            //         if (categoryItem === "default"){
            //             return (isLocked === true);
            //         }
            //         else {
            //             console.log("error with clone/default partitioning");
            //         }
            //     })
            // }

            function genericFilter(filterFunction){

                //deep copy the collection
                var collectionCopy = $.extend(true, {}, self.collection);

                //filter out Non-Ephemeral streams
                collectionCopy.models = _.filter(self.collection.models, function(model) {
                    return !('expirationDate' in model.attributes);
                });

                //filter via category item
                if (categoryItem !== 'all') {
                    collectionCopy.models = _.filter(collectionCopy.models, filterFunction);
                }

                var streamsListView = new StreamsListView({
                    collection   : collectionCopy,
                    el           : '#config',
                    app          : self.app,
                    template     : StreamsListTemplate,
                    categoryItem : categoryItem,
                    category     : self.category
                });

                self.parentAppView.showViewRight(streamsListView);

                self.parentRouter.navigate("permanent/" + self.category + "/" + categoryItem , {trigger:false})
            }

        },

        render: function(){
            var self = this;
            var output = self.template({
                "categoryItems": self.categoryItems
            });
            self.$el.append(output);

            return self;
        },

        removeSelf: function () {
            console.log("Removing Stream List View Left Column");
            // empty the contents of the container DOM element without taking it out of the DOM
            this.unbind();
            this.$el.empty();
            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            return this;
        }

    });
});