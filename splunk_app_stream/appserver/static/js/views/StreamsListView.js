define([
    "jquery",
    "underscore",
    "backbone",
    'views/shared/delegates/Popdown',
    "jquery.sparkline",
    "contrib/text!app-js/templates/RegularStreamsTableTemplate.html",
    "splunkjs/mvc/searchmanager",
    "app-js/contrib/jquery.tablesorter.min"
], function(
    $,
    _,
    Backbone,
    Popdown,
    Sparklines,
    RegularStreamsTableTemplate,
    SearchManager,
    Tablesorter
    ) {
    return Backbone.View.extend({

        initialize: function(options){

            console.log('Streams List View created');

            var viewRef       = this;
            this.options      = _.extend({}, this.options, options);
            this.app          = this.options.app;
            this.template     = _.template($(this.options.template).html());
            this.category     = this.options.category;
            this.categoryItem = this.options.categoryItem;

            this.collection.comparator = function( model ) {
                return model.get( 'id' );
            };
        },

        events: {
            'click .stream-id'          : 'showStreamDetails',
            'keyup .stream-search'      : 'showMatchingStreams',
            'click a.clear'             : 'resetSearch',
            'click #bulkDelete'         : 'bulkDelete',
            'click #bulkDisable'        : 'bulkDisable',
            'click #bulkEnable'         : 'bulkEnable',
            'click .streams-select-all' : 'bulkSelectStreams',
            'click .stream-clone'       : 'cloneStream',
            'click .stream-disable'     : 'disableStream',
            'click .stream-enable'      : 'enableStream',
            'click .stream-delete'      : 'deleteStream'
        },

        deleteStream: function(e) {
            e.preventDefault()
            var streamId = $(e.target).closest('td').data('id');
            this.app.mediator.publish("view:delete-stream-dialog", {
                stream: this.collection.get(streamId),
                location: Backbone.history.fragment
            });
        },

        disableStream: function(e) {
            e.preventDefault()
            var streamId = $(e.target).closest('td').data('id');
            this.app.mediator.publish("view:disable-stream-dialog", {
                stream: this.collection.get(streamId),
                location: Backbone.history.fragment
            });
        },

        enableStream: function(e) {
            e.preventDefault()
            var streamId = $(e.target).closest('td').data('id');
            this.app.mediator.publish("view:enable-stream-dialog", {
                stream: this.collection.get(streamId),
                location: Backbone.history.fragment
            });
        },

        cloneStream: function(e) {
            var streamId = $(e.target).closest('td').data('id');
            this.app.mediator.publish("view:add-stream-dialog", this.collection.get(streamId));
        },

        bulkSelectStreams: function(e) {
            if ($(e.target).is(":checked")) {
                $('.stream-select').each(function() {
                    this.checked = true;
                });
            } else {
                $('.stream-select').each(function() {
                    this.checked = false;
                });
            }
        },

        getSelectedStreams: function() {
            var self = this;
            var streams = [];
            $('.stream-select:checked').each(function() {
                var streamId = $(this).closest('tr').data('id');
                var stream = self.collection.get(streamId);
                //Exclude streams from external apps.
                if (stream.get('app') && stream.get('app') === 'Stream') {
                    streams.push(stream);
                }
            });
            return streams;
        },

        bulkDelete: function(e) {
            e.preventDefault()
            var streams = this.getSelectedStreams();
            if (streams.length > 0) {
                this.app.mediator.publish("view:bulk-delete-streams-dialog", {
                    streams: streams,
                    location: Backbone.history.fragment
                });
            } else {
                this.app.mediator.publish("view:info-dialog", "No selection made!", "Please select a stream");
            }
        },

        bulkDisable: function(e) {
            e.preventDefault()
            var streams = this.getSelectedStreams();
            if (streams.length > 0) {
                this.app.mediator.publish("view:bulk-disable-streams-dialog", {
                    streams: streams,
                    location: Backbone.history.fragment
                });
            } else {
                this.app.mediator.publish("view:info-dialog", "No selection made!", "Please select a stream");
            }
        },

        bulkEnable: function(e) {
            e.preventDefault()
            var streams = this.getSelectedStreams();
            if (streams.length > 0) {
                this.app.mediator.publish("view:bulk-enable-streams-dialog",{
                    streams: streams,
                    location: Backbone.history.fragment
                });
            } else {
                this.app.mediator.publish("view:info-dialog", "No selection made!", "Please select a stream");
            }
        },

        resetSearch: function(e) {
            e.preventDefault();
            $(this.el).find('.stream-search input').val('');
            this.render();
        },

        showMatchingStreams: function(e) {
            e.preventDefault();
            this.renderTable();
        },

        render: function(){
            var self = this;
            var searchString = $(this.el).find('.stream-search input').val();

            var output = self.template({
                streams      : self.collection.toJSON(),
                category     : this.category,
                categoryItem : this.categoryItem,
                searchString : searchString
            });

            this.$el.empty();
            self.$el.append(output);

            self.renderTable();

            this.bulkEditPopdown = new Popdown({
                el: this.$('.bulk-edit')
            });

            $(".stream-edit").each(function(index, item) {
                new Popdown({ el: $(item) })
            });

            $("#config-page-streams-table").tablesorter({
                headers:{
                    0: { sorter:false },
                    5: { sorter:false },
                    6: { sorter:false },
                    7: { sorter:false }
                }
            });

            //set the cursor back into the search box
            //else it is cancelled when page re-renders
            var input = $(".stream-search input");
            input[0].selectionStart = input[0].selectionEnd = input.val().length;

            this.showSparklines();

            return self;
        },

        renderTable: function(){

            var self = this;

            var tableTemplate  = _.template($(RegularStreamsTableTemplate).html());
            var searchString = $(this.el).find('#reg-stream-search').val();

            var output = tableTemplate({
                streams: self.collection.toJSON(),
                searchString: searchString
            });

            $("#config-page-streams-table").empty();
            $("#config-page-streams-table").append(output);

        },

        showSparklines: function() {

            var self = this;
            
            /*==========  Create Promise  ==========*/
            
            var streamIDs = _.pluck(self.collection.toJSON(), "id");
            var searchPromise = $.Deferred();

            var bindPromiseEvents = function(results) {

                $("#totalSparklineContainer  .loadingMsg").hide();
                $(".stream-row .loadingMsg").hide();

                var fields = results.fields;
                var rows = results.rows;
                //array of 0s
                var totalData = zeroArray(rows.length);

                /*==========  Create Individual Sparklines  ==========*/
                $(".sparkline").each(function(index, eachSparkline) {

                    var streamId =  $(eachSparkline).closest("tr").data("id");
                    var streamIndex = fields.indexOf("stream:" + streamId);

                    var data = [];

                    /*==========  Determine data  ==========*/                    
                    if (streamIndex === -1){
                        //fill w/ zeroes if no data
                        data = zeroArray(rows.length);
                    } else {
                        //keep track of current data as well as totalData for the large sparkline
                        _.each(rows,function(eachRow, index_num) {
                            if (eachRow[streamIndex]){
                                var value = roundNplaces(eachRow[streamIndex],2);
                                data.push(value);
                                totalData[index_num] += parseFloat(value);
                            }
                            else { data.push(0); }
                        });
                    }

                    /*==========  Create Sparklines  ==========*/                   
                    $(eachSparkline).sparkline(data,{
                        width: "100%",
                        fillColor: "#CDDEFE",
                        lineColor: "#A8BBD5",
                        spotColor: false,
                        minSpotColor: false,
                        maxSpotColor: false,
                        numberFormatter: function(num) {
                            return self._bitsFormatter(roundNplaces(num * 8,2), true);
                        },
                        lineWidth: 1,
                        height: "25px"
                    });
                        
                });

                /*==========  Create the Total Traffic Sparkline  ==========*/
                $("#totalSparkline").sparkline(totalData,{
                    width: "100%",
                    fillColor: "#CDDEFE",
                    lineColor: "#A8BBD5",
                    minSpotColor: false,
                    maxSpotColor: false,
                    numberFormatter: function(num) {
                        return self._bitsFormatter(roundNplaces(num * 8,2), true);
                    },
                    height: "80px",
                    lineWidth: 1
                });

                /*==========  Calculate the Avg Traffic  ==========*/
                var sumData = _.reduce(totalData, function(memo, next) {
                    return memo + next;
                })

                //for per second
                var avgTraffic = sumData/60;
                var formattedTrafficValue = "~ " + self._bitsFormatter(roundNplaces(avgTraffic * 8,2), true) + "/s";
                $("#avgTraffic").html(formattedTrafficValue);
                

                function zeroArray(N) {
                    return Array.apply(null, new Array(N)).map(Number.prototype.valueOf,0);
                }
                function roundNplaces(num, N) {
                    var rounder = Math.pow(10,N);
                    return Math.round((num * rounder)/rounder);
                }
               
            }//end bindPromiseEvents function

            //has to be placed after the function definition else promise is 
            //passed an empty function and nothing happens
            searchPromise.done(bindPromiseEvents);
               
            /*==========  Create Search Manager and resolve promise  ==========*/
            // http://docs.splunk.com/DocumentationStatic/WebFramework/1.0/compref_searchmanager.html
            // http://dev.splunk.com/view/SP-CAAAEU6

            var sparklineSearch = splunkjs.mvc.Components.getInstance("sparklineSearch") || new SearchManager({
                id             : "sparklineSearch",
                earliest_time  : "-60s",
                latest_time    : "now",
                max_time       : 10,  
                search         : "sourcetype=stream* | timechart sum(eval(bytes_in + bytes_out)) as sum by sourcetype"
            });

            //specify count 0 to fetch all data. default is only 100
            var sparklineResults = sparklineSearch.data("results", {count: 0});

            sparklineSearch.on("search:done", function(state, job) {

                /*==========  If data is found  ==========*/

                if (state.content.resultCount > 0){

                    //if results are assured, then start waiting for data.
                    sparklineResults.on("data", function() {

                        var data = {
                            fields : sparklineResults.data().fields,
                            rows   : sparklineResults.data().rows
                        }

                        searchPromise.resolve(data);
                        rerunSearch();
                    })
                }
              
                /*==========  If no data is found  ==========*/
                
                else{
                    //resolve it with 0 data
                    var data = {
                        fields : [0,0,0,0],
                        rows   : [0,0,0,0]
                    }
                    searchPromise.resolve(data);
                    rerunSearch();
                }

                function rerunSearch(){
                    setTimeout(function() {
                        sparklineSearch.startSearch();
                        //reset and rebind promise
                        searchPromise = $.Deferred();
                        searchPromise.done(bindPromiseEvents);
                    }, 10000)
                }

            });// End SearchManager Logic ========================
            
        },

        _bitsFormatter: function(bits, si) {
            var thresh = si ? 1000 : 1024;
            if(bits < thresh) return bits + ' B';
            var units = si ? ['kb','Mb','Gb','Tb','Pb','Eb','Zb','Yb'] : ['Kib','Mib','Gib','Tib','Pib','Eib','Zib','Yib'];
            var u = -1;
            do {
                bits /= thresh;
                ++u;
            } while(bits >= thresh);
            return bits.toFixed(1)+' '+units[u];
        },

        showStreamDetails: function(e){
            e.preventDefault();
            var id = $(e.currentTarget).data("id");
            var item = this.collection.get(id);
            var options = {
                stream       : item,
                category     : this.category,
                categoryItem : this.categoryItem
            }
            this.app.mediator.publish("view:stream-details", options);
        },

        removeSelf: function () {
            console.log("Removing StreamListView");
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