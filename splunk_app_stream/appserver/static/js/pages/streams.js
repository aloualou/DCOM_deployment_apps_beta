require.config({
    shim: {
        'app-js/contrib/serialize-object': {
            deps: ['jquery']
        }
    }
});

require([
        "underscore",
        "jquery",
        "backbone",
        "splunkjs/mvc/headerview",
        "splunkjs/mvc/footerview",
        "app-js/contrib/mediator",
        "app-js/collections/Streams",
        "app-js/views/StreamsListView",
        "app-js/views/StreamsListView_CategoriesColumnView",
        "app-js/views/StreamView",
        "app-js/views/AddStreamView",
        "app-js/views/ConfirmView",
        "app-js/views/InfoView",
        "contrib/text!app-js/templates/StreamsList.html",
        "contrib/text!app-js/templates/StreamsList_Categories.html",
        "app-js/collections/Vocabularies",
        "app-js/collections/Terms",
        "app-js/collections/EventTypes",
        "app-js/collections/ComparisonTypes",
        "app-js/models/Vocabulary",
        "app-js/models/Term",
        "splunk.util",
        "app-js/contrib/serialize-object",
        "app-js/collections/SplunkIndexes"
    ],
    function(
        _,
        $,
        Backbone,
        HeaderView,
        FooterView,
        Mediator,
        Streams,
        StreamsListView,
        StreamsListView_CategoriesColumnView,
        StreamView,
        AddStreamView,
        ConfirmView,
        InfoView,
        StreamsListTemplate,
        StreamsListCategoriesTemplate,
        Vocabularies,
        Terms,
        EventTypes,
        ComparisonTypes,
        Vocabulary,
        Term,
        splunk_util,
        SerializeObject,
        IndexesCollection
        ){

        var pageLoading = true;

        /*================================================
        =            Splunk Header and Footer            =
        ================================================*/

        new HeaderView({
            id: 'header',
            section: 'dashboards',
            el: $('.header'),
            acceleratedAppNav: true
        }, {tokens: true}).render();

        new FooterView({
            id: 'footer',
            el: $('.footer')
        }, {tokens: true}).render();

        var app = app || {};
        var splunkd = splunkd || {};

        //defaults
        //not currently used
        var selectedCategory = "protocol";
        var selectedCategoryItem = "all";

        // instantiate a new Mediator
        app.mediator = new Mediator();

        var streamsListView;
        var streamView;

        app.streams         = new Streams();
        app.vocabularies    = new Vocabularies();
        app.terms           = new Terms();
        app.eventTypes      = new EventTypes();
        app.comparisonTypes = new ComparisonTypes();


        /*========================================
        =            Comparison Table            =
        ========================================*/

        // Based on the output of Comparison::writeComparisonsXML() in cm-core-lib (ultimately based on comparison_table[]).
        // TODO: This should probably either go in a separate file or be obtained from streamfwd.
        var comparisonTable = [
            {id: 'false', description:'False', arity: 1, categories: ['generic', 'numeric', 'string', 'date_time', 'date', 'time']},
            {id: 'true', description: 'True', arity: 1, categories: ['generic', 'numeric', 'string', 'date_time', 'date', 'time']},
            {id: 'is-defined', description: 'Is defined', arity: 1, categories: ['generic', 'numeric', 'string', 'date_time', 'date', 'time']},
            {id: 'is-not-defined', description: 'Is not defined', arity: 1, categories: ['generic', 'numeric', 'string', 'date_time', 'date', 'time']},
            {id: 'equals', description: 'Equals', arity: 2, categories: ['numeric']},
            {id: 'not-equals', description: 'Does not equal', arity: 2, categories: ['numeric']},
            {id: 'greater-than', description: 'Greater than', arity: 2, categories: ['numeric']},
            {id: 'less-than', description: 'Less than', arity: 2, categories: ['numeric']},
            {id: 'greater-or-equal', 'description': 'Greater than or equal to', arity: 2, categories: ['numeric']},
            {id: 'less-or-equal', description: 'Less than or equal to', arity: 2, categories: ['numeric']},
            //{id: 'exact-match', description: 'Exactly matches', arity: 2, categories: ['string']},
            //{id: 'not-exact-match', description: 'Does not exactly match', arity: 2, categories: ['string']},
            //{id: 'contains', description: 'Contains', arity: 2, categories: ['string']},
            //{id: 'not-contains', description: 'Does not contain', arity: 2, categories: ['string']},
            //{id: 'starts-with', description: 'Starts with', arity: 2, categories: ['string']},
            //{id: 'not-starts-with', description: 'Does not start with', arity: 2, categories: ['string']},
            //{id: 'ends-with', description: 'Ends with', arity: 2, categories: ['string']},
            //{id: 'not-ends-with', description: 'Does not end with', arity: 2, categories: ['string']},
            //{id: 'ordered-before', description: 'Ordered before', arity: 2, categories: ['string']},
            //{id: 'not-ordered-before', description: 'Not ordered before', arity: 2, categories: ['string']},
            //{id: 'ordered-after', description: 'Ordered after', arity: 2, categories: ['string']},
            //{id: 'not-ordered-after', description: 'Not ordered after', arity: 2, categories: ['string']},
            {id: 'regex', description: 'Regular Expression', arity: 2, categories: ['string']},
            {id: 'not-regex', description: 'Not Regular Expression', arity: 2, categories: ['string']},
            {id: 'exact-match-primary', description: 'Exactly matches', arity: 2, categories: ['string']},
            {id: 'not-exact-match-primary', description: 'Does not exactly match', arity: 2, categories: ['string']},
            {id: 'contains-primary', description: 'Contains', arity: 2, categories: ['string']},
            {id: 'not-contains-primary', description: 'Does not contain', arity: 2, categories: ['string']},
            {id: 'starts-with-primary', description: 'Starts with', arity: 2, categories: ['string']},
            {id: 'not-starts-with-primary', description: 'Does not start with', arity: 2, categories: ['string']},
            {id: 'ends-with-primary', description: 'Ends with', arity: 2, categories: ['string']},
            {id: 'not-ends-with-primary', description: 'Does not end with', arity: 2, categories: ['string']},
            {id: 'ordered-before-primary', description: 'Ordered before', arity: 2, categories: ['string']},
            {id: 'not-ordered-before-primary', description: 'Not ordered before', arity: 2, categories: ['string']},
            {id: 'ordered-after-primary', description: 'Ordered after', arity: 2, categories: ['string']},
            {id: 'not-ordered-after-primary', description: 'Not ordered after', arity: 2, categories: ['string']},
            {id: 'same-date-time', description: 'Same date and time', arity: 2, categories: ['date_time']},
            {id: 'not-same-date-time', description: 'Not the same date and time', arity: 2, categories: ['date_time']},
            {id: 'earlier-date-time', description: 'Earlier date and time', arity: 2, categories: ['date_time']},
            {id: 'later-date-time', description: 'Later date and time', arity: 2, categories: ['date_time']},
            {id: 'same-or-earlier-date-time', description: 'Same or earlier date and time', arity: 2, categories: ['date_time']},
            {id: 'same-or-later-date-time', description: 'Same or later date and time', arity: 2, categories: ['date_time']},
            {id: 'same-date', description: 'Same date', arity: 2, categories: ['date_time', 'date']},
            {id: 'not-same-date', description: 'Not the same date', arity: 2, categories: ['date_time', 'date']},
            {id: 'earlier-date', description: 'Earlier date', arity: 2, categories: ['date_time', 'date']},
            {id: 'later-date', description: 'Later date', arity: 2, categories: ['date_time', 'date']},
            {id: 'same-or-earlier-date', description: 'Same or earlier date', arity: 2, categories: ['date_time', 'date']},
            {id: 'same-or-later-date', description: 'Same or later date', arity: 2, categories: ['date_time', 'date']},
            {id: 'same-time', description: 'Same time', arity: 2, categories: ['date_time', 'time']},
            {id: 'not-same-time', description: 'Not the same time', arity: 2, categories: ['date_time', 'time']},
            {id: 'earlier-time', description: 'Earlier time', arity: 2, categories: ['date_time', 'time']},
            {id: 'later-time', description: 'Later time', arity: 2, categories: ['date_time', 'time']},
            {id: 'same-or-earlier-time', description: 'Same or earlier time', arity: 2, categories: ['date_time', 'time']},
            {id: 'same-or-later-time', description: 'Same or later time', arity: 2, categories: ['date_time', 'time']}
        ];

        _.each(comparisonTable, function(cmp) {
            app.comparisonTypes.add({
                id: cmp.id,
                description: cmp.description,
                arity: cmp.arity,
                categories: cmp.categories
            });
        });

        /*-----  End of Comparison Table  ------*/

        /*===================================================
        =       Async Fetch Vocab & Indexes                 =
        ===================================================*/

        //initialize promises
        var termsFetchDone = $.Deferred();
        var splunkIndexesFetchDone = $.Deferred();

        /*==========  Fetch Vocabularies  ==========*/
        
        $.ajax({ type: 'GET',
            url: Splunk.util.make_url([
                "custom",
                "splunk_app_stream",
                "vocabularies"
            ].join('/')),
            dataType: 'xml',
            success: function(xml) {
                var vocabs = {};

                // From termTypes.json in Stream UI.
                // TODO: This should probably go in a separate file, once we settle on
                // our file organization.
                var termTypeInfo = {
                    'null'        : {description: 'undefined type', category: 'generic'},
                    'object'      : {description: 'event type', category: 'generic'},
                    'int8'        : {description: 'signed int (8-bit)', category: 'numeric'},
                    'uint8'       : {description: 'positive int (8-bit)', category: 'numeric'},
                    'int16'       : {description: 'signed int (16-bit)', category: 'numeric'},
                    'uint16'      : {description: 'unsigned int (16-bit)', category: 'numeric'},
                    'int32'       : {description: 'signed int (32-bit)', category: 'numeric'},
                    'uint32'      : {description: 'unsigned int (32-bit)', category: 'numeric'},
                    'int64'       : {description: 'signed int (64-bit)', category: 'numeric'},
                    'uint64'      : {description: 'unsigned int (64-bit)', category: 'numeric'},
                    'float'       : {description: 'small real number', category: 'numeric'},
                    'double'      : {description: 'medium real number', category: 'numeric'},
                    'longdouble'  : {description: 'large real number', category: 'numeric'},
                    'shortstring' : {description: 'small string', category: 'string'},
                    'string'      : {description: 'medium string', category: 'string'},
                    'longstring'  : {description: 'large string', category: 'string'},
                    'char'        : {description: 'fixed-length string', category: 'string'},
                    'blob'        : {description: 'binary large object', category: 'string'},
                    'zblob'       : {description: 'blob (stored compressed)', category: 'string'},
                    'date'        : {description: 'specific date', category: 'date'},
                    'time'        : {description: 'specific time', category: 'time'},
                    'datetime'    : {description: 'specific time & date', category: 'date_time'}
                };

                $.each($(xml).find("Term"), function(i, item) {
                    var termId = $(item).attr("id");
                    var vocabId = termId.substring(0, termId.indexOf("."));
                    var type = $(item).find("Type").first().text();

                    if (type === "object") {
                        app.eventTypes.add({id: termId});
                    }

                    var comment = $(item).find("Comment").first().text();

                    if (!vocabs[vocabId]) {
                        vocabs[vocabId] = {id: vocabId, name: termId, terms: []};
                    }

                    var term = new Term({
                        id: termId,
                        name: termId.replace(vocabId + '.', ''),
                        type: type,
                        category: termTypeInfo[type].category,
                        comment: comment
                    });
                    vocabs[vocabId].terms.push(term);
                    app.terms.add(term);

                });

                $.each(Object.keys(vocabs), function(i, item) {
                    app.vocabularies.add(vocabs[item]);
                });

                termsFetchDone.resolve();
        }});

        /*==========  Fetch Indexes  ==========*/
        
        var indices = new IndexesCollection();
        indices.fetch({
            success: function(data) {
                var filteredData = filterAndParse(data.toJSON());
                function filterAndParse(array){
                    var results = [];
                    results = _.map(array,function(each) { 
                        var delimitedElements = each.entry[0].id.split("/");
                        var indexName = delimitedElements[delimitedElements.length - 1];
                        return indexName;
                    })
                    return _.filter(results, function(each) { return each[0] !== "_"; });
                }
                splunkIndexesFetchDone.resolve(filteredData);
            },
            error: function() {
                console.log("failure to retrieve splunk indices");
            }
        })      

        /*-----  End of Async Fetch Vocab & Indexes   ------*/

        /*===============================
        =            Utility            =
        ===============================*/

        /*
        Automates the destruction and creation of views
        */
        
        function AppView() {

            this.showViewRight = function(view) {
                if (this.currentView){
                    this.currentView.removeSelf();
                }

                this.currentView = view;
                return this.currentView.render();
            }

            this.showViewLeft = function(view) {
                if (this.currentViewLeft){
                    this.currentViewLeft.removeSelf();
                }

                this.currentViewLeft = view;
                return this.currentViewLeft.render();
            }
        };

        function showAddStreamDialog(stream, userHasChanges, showStreamsList) {
            var addStreamView = new AddStreamView({
                el: '#modal',
                app: app,
                stream: stream,
                userHasChanges: userHasChanges,
                showStreamsList: showStreamsList
            });

            addStreamView.show();
        };

        function showModifyStreamDialog(stream, action, location) {
            var self = this;
            var confirmView = new ConfirmView({
                el: '#modal',
                action: action,
                model: {text: stream.get('id') + ":" + stream.get('name') + " ?"},
                command: function() {
                    $.ajax({ type: 'PUT',
                            url: Splunk.util.make_url([
                                "custom",
                                "splunk_app_stream",
                                "streams",
                                stream.get('id'),
                                action
                            ].join('/')),
                            dataType: 'json',
                            success: function (json) {
                                if ('required_by' in json) {
                                    app.mediator.publish("view:info-dialog", "Stream not disabled",
                                        "You cannot disable this stream because it is required by the following apps: " + json.required_by.join(','));
                                }
                                router.navigate("", {trigger: false});
                                router.navigate(location, {trigger:true});
                            },
                            error: function (err) {
                                alert("Error while modifying stream : " + err);
                            }
                        }
                    );
                }
            });

            confirmView.show();
        };

        function showModifyMultipleStreamsDialog(streams, action, location) {
            var self = this;
            var streamNames = [];
            streams.forEach(function(s) {
               streamNames.push("<tr><td>" + s.get('id') + ":</td><td>" + s.get('name') + "</td></tr>");
            });
            // var message = "Streams: <br>" + streamNames.join("<br>");

            var message = 
                [
                "<div class='bulk-selections-table-container'>",
                    "<table class='bulk-selected-streams-container table'>",
                        "<thead>",
                            "<tr>",
                                "<th>Stream ID</th>",
                                "<th>Stream Description</th>",
                            "<t>",
                        "</thead>",
                        streamNames.join("\n"),
                    "</table>",
                "</div><br>"
                ].join("\n");

            var errStreams = [];
            var requiredStreams = [];

            var requestType = action === 'delete' ? 'DELETE' : 'PUT';
            var urlFragments = [
                    "custom",
                    "splunk_app_stream",
                    "streams"]

            var confirmView = new ConfirmView({
                el: '#modal',
                action: action,
                model: {text: message},
                command: function() {
                    var defArray = [];
                    streams.forEach(function(stream) {
                        var deferred = new $.Deferred();
                        defArray.push(deferred);

                        modUrl = urlFragments.slice(0);
                        modUrl.push(stream.get('id'))
                        if (action !== 'delete') {
                            modUrl.push(action);
                        }

                        $.ajax({ type: requestType,
                                url: Splunk.util.make_url(modUrl.join('/')),
                                dataType: 'json',
                                success: function (json) {
                                    if ('required_by' in json) {
                                        requiredStreams.push(stream.get('name'));
                                    }
                                    deferred.resolve(json);
                                },
                                error: function (err) {
                                    console.log("ERROR during operation on stream");
                                    errStreams.push(stream.get('name'));
                                    deferred.resolve();
                                }
                            }
                        );
                    });

                    $.when.apply($, defArray).done(function(){
                            var results = arguments;

                            if (errStreams.length > 0) {
                                app.mediator.publish("view:info-dialog", "Operation only partially successful!",
                                        "Operation failed for the following streams: " + errStreams.join(','));
                            }
                            if (action == 'disable' && requiredStreams.length > 0) {
                                app.mediator.publish("view:info-dialog", "Some streams were not disabled.",
                                        "Unable to disable the following streams because they are required by other apps: " + 
                                        requiredStreams.join(', '));
                            }
                            router.navigate("", {trigger: false});
                            router.navigate(location, {trigger:true});
                        }
                    );
                }
            });

            confirmView.show();
        };

        function showDeleteStreamDialog(stream,location) {
            var self = this;
            var confirmView = new ConfirmView({
                el: '#modal',
                action: "delete",
                model: {text: stream.get('id') + ":" + stream.get('name')},
                command: function() {
                    stream.destroy({
                        success: function(e){
                            //Backbone router does nothing if a navigate to the same URL is issued.
                            // Force reload if it is the same URL.
                            router.navigate("", {trigger: false});
                            router.navigate(location, {trigger:true});
                        },
                        error: function(e){
                            console.log("Error deleting stream");
                            alert("Error deleting stream");
                        }
                    });
                }
            });

            confirmView.show();
        };

        function showInfoDialog(title, message) {
            var infoView = new InfoView({
                el: '#modal',
                title: title,
                message: message
            });

            infoView.show();
        };

        var appView = new AppView();

        /*=============================================
        =          Router                             =
        =============================================*/

        ConfigRouter = Backbone.Router.extend({
            routes: {
                "" : "showStreams",
                "permanent": "showStreams",
                "permanent/:category" : "showStreamsByCategory",
                "permanent/:category/:categoryItem" : "showStreamsByCategoryItem",
                "permanent/:category/:categoryItem/streamConfig/:streamId": "showStreamDetails",
                "ephemeral": "showEphemeralStreams",
                "ephemeral/:category": "showEphemeralStreams"
            },

            initialize: function(options){
                this.appView = options.appView;
            },

            /*==========  Permanent Streams  ==========*/
            

            createStreams: function(options){

                $("#app-secondary-layout").hide();
                $("#app-main-layout").show();

                $("#permanent-tab").addClass('is-selected');
                $("#ephemeral-tab").removeClass('is-selected');

                //router triggering
                var defaultOptions = {
                    category: 'protocol',
                    categoryItem: 'all'
                }

                $.extend(defaultOptions, options);

                var self = this;
                app.streams.fetch({
                    success: function(streams) {

                        //left column
                        var streamsListView_CategoriesColumnView = new StreamsListView_CategoriesColumnView({
                            collection : streams,
                            category   : defaultOptions.category,
                            el         : '#categories-container',
                            app        : app,
                            appView    : appView,
                            template   : StreamsListCategoriesTemplate,
                            router     : self
                        });

                        self.appView.showViewLeft(streamsListView_CategoriesColumnView);

                        $("#group-by-selection-ephemeral").hide();
                        $("#group-by-selection").show().val(defaultOptions.category);

                        //click to delegate rendering to the view.
                        $("#categories-container").find(".category-value:contains(" + defaultOptions.categoryItem + ")").click()

                    },
                    error: function() {
                        console.log("Error fetching Streams collection from server");
                    }
                });
            },

            showStreams: function() {
                this.createStreams();
            },

            showStreamsByCategory: function(category){
                this.createStreams({category:category});
            },

            showStreamsByCategoryItem: function(category, categoryItem){
                this.createStreams({category:category, categoryItem: categoryItem});
            },

            //shows the configuration for an individual stream
            showStreamDetails: function(category, categoryItem, streamId) {

                var self = this;
                //are the terms even being used here?
                $.when(termsFetchDone.promise(), splunkIndexesFetchDone.promise()).done(function(terms,indices) {

                    $("#app-secondary-layout").show();
                    $("#app-main-layout").hide();

                    //right column (CONFIGURATIONS)
                    var stream = new app.streams.model({id: streamId});
                    stream.fetch({
                        success: function() {
                            streamView = new StreamView({
                                model: stream,
                                el: '#individual-config',
                                app: app,
                                splunkIndices: indices
                            });
                            self.appView.showViewRight(streamView);
                        },
                        error: function() {
                            console.log("Error fetching Stream model from server");
                        }
                    });

                });
            },

            /*==========  Ephemeral Streams  ==========*/   

            showEphemeralStreams: function(categoryItem){
                
                $("#ephemeral-tab").addClass('is-selected');
                $("#permanent-tab").removeClass('is-selected');

                var dest = 'all';//default
                if (categoryItem) { dest = categoryItem; }

                var self = this;
                app.streams.fetch({
                    success: function(streams) {

                        //left column
                        var streamsListView_CategoriesColumnView = new StreamsListView_CategoriesColumnView({
                            collection  : streams,
                            category    : "application",
                            el          : '#categories-container',
                            app         : app,
                            appView     : appView,
                            template    : StreamsListCategoriesTemplate,
                            router      : self,
                            isEphemeral : true
                        });

                        self.appView.showViewLeft(streamsListView_CategoriesColumnView);

                        $("#group-by-selection").hide();
                        $("#group-by-selection-ephemeral").show().val('application');                        
                         
                        //click to delegate rendering to the view.
                        $("#categories-container").find(".category-value:contains(" + dest + ")").click();

                    },
                    error: function() {

                        console.log("Error fetching Streams collection from server");
                    }
                });
            }


        });

        /*-----  End of Router  ------*/
        

        /*=============================================
        =           Initialize App                    =
        =============================================*/

        var router = new ConfigRouter({appView: appView});

        Backbone.history.start();

        app.mediator.subscribe("view:stream-details", function(options){
            var routerString = ["permanent", options.category, options.categoryItem, "streamConfig", options.stream.id].join("/")
            router.navigate(routerString, {trigger: true});
        });

        app.mediator.subscribe("view:streams", function(options){
            var routerString = ["permanent", options.category,options.categoryItem].join("/")
            router.navigate(routerString, {trigger: true});
        });

        app.mediator.subscribe("view:add-stream-dialog", function(stream, userHasChanges, showStreamsList){
            showAddStreamDialog(stream, userHasChanges, showStreamsList);
        });

        app.mediator.subscribe("event:new-stream-added", function(stream){
            app.streams.add(stream);
            // app.mediator.publish("view:stream-details", stream);
            //go to the newly created stream
            var urlFragment = "permanent/protocol/all/streamConfig/" + stream.id;
            router.navigate(urlFragment, {trigger:true});
        });

        /*==========  Actions  ==========*/

        app.mediator.subscribe("view:delete-stream-dialog", function(options){
            showDeleteStreamDialog(options.stream, options.location);
        });

        app.mediator.subscribe("view:enable-stream-dialog", function(options){
            showModifyStreamDialog(options.stream, 'enable', options.location);
        });

        app.mediator.subscribe("view:disable-stream-dialog", function(options){
            showModifyStreamDialog(options.stream, 'disable', options.location);
        });

        /*==========  Bulk Actions  ==========*/

        app.mediator.subscribe("view:bulk-disable-streams-dialog", function(options){
            showModifyMultipleStreamsDialog(options.streams, 'disable', options.location);
        });

        app.mediator.subscribe("view:bulk-enable-streams-dialog", function(options){
            showModifyMultipleStreamsDialog(options.streams, 'enable', options.location);
        });

        app.mediator.subscribe("view:bulk-delete-streams-dialog", function(options){
            showModifyMultipleStreamsDialog(options.streams, 'delete', options.location);
        });

        app.mediator.subscribe("view:info-dialog", function(title, message){
            showInfoDialog(title, message);
        });

        $("title").text("Streams Config");
        pageLoading = false;

        $("body>div.preload").removeClass("preload");

        /*==========  Attach logic to selection dropdown to group by category  ==========*/

        $('#group-by-selection').on('change',function(e) {

            var element    = $(e.currentTarget);
            var category   = $("option:selected", element).val();

            //delegate this rendering to the router
            router.navigate("permanent/" + category, {trigger:true});

        });//---------------------------------------------------------------------------------

        /*==========  Clone Stream moved from child view to here  ==========*/

        $("#cloneStream").click(function() {
            showAddStreamDialog();
        });

    });