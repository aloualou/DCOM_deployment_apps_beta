define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/EphemeralStreamsTemplate.html",
    "contrib/text!app-js/templates/EphemeralStreamsTable.html",
    "app-js/collections/Streams",
    'views/shared/delegates/Popdown',
    "app-js/contrib/jquery.tablesorter.min",
    "app-js/views/DatepickerView",
    "app-js/contrib/moment",
    "app-js/contrib/moment-timezone-with-data"
], function(
    $,
    _,
    Backbone,
    EphemeralStreamsTemplate,
    EphemeralStreamsTableTemplate,
    Streams,
    Popdown,
    Tablesorter,
    DatepickerView,
    Moment,
    moment
    ) {
    return Backbone.View.extend({

        initialize: function(options){

            console.log('Streams List View created');

            this.options         = _.extend({}, this.options, options);
            this.app             = this.options.app;
            this.streamGroups    = this.options.streamGroups;
            this.template        = _.template($(EphemeralStreamsTemplate).html());
            this.collection      = this.options.collection,
            this.ephemCategory   = this.options.ephemCategory
            this.timezone        = this.options.timezone;

        },

        events: {
            'click .icon-chevron-right' : 'toggleExtendedTable',
            'keyup #ephem-search'       : 'showMatchingStreams', 
            'click a.clear'             : 'resetSearch', 

            'click #enableGroup'       : 'enableGroup', 
            'click #disableGroup'      : 'disableGroup',
            'click #editEndTime'       : 'editEndTime',

            'click .ephemeral-streams-select-all' : 'bulkSelectStreams',
            'click #bulkEnableGroup'              : 'bulkEnableGroup',
            'click #bulkDisableGroup'             : 'bulkDisableGroup',
            'click #bulkDeleteGroup'              : 'bulkDeleteGroup' 
        },

        editEndTime: function(e) {

            e.preventDefault();
            var groupId = $(e.target).closest('tr').data('id');

            var thisGroup = _.find(this.options.streamGroups, function(each) {
                return (each.name === groupId);
            })

            var confirmView = new DatepickerView({

                el            : '#modal',
                app           : this.app,
                groupId       : groupId, 
                startTime     : thisGroup.earliestTime,
                endTime       : thisGroup.latestTime,
                countdown     : thisGroup.timeRemaining,
                timezone      : this.timezone
                
            });

            confirmView.show();

        },

        triggerAddStreamDialogEvent: function() {
            this.app.mediator.publish("view:add-stream-dialog");
        },

        toggleExtendedTable: function(e){
            $(e.target).closest("tr").find('.stream-groups').toggle();
        },

        bulkSelectStreams: function(e) {
            if ($(e.target).is(":checked")) {
                $('.ephemeral-stream-select').each(function() {
                    this.checked = true;
                });
            } else {
                $('.ephemeral-stream-select').each(function() {
                    this.checked = false;
                });
            }
        },

        getSelectedStreams: function() {
            var self = this;
            var streams = [];
            $('.ephemeral-stream-select:checked').each(function() {
                var groupId = $(this).closest('tr').data('id');
                var filteredStreams = self.collection.filter(function(each){
                    var isEphemeral = "expirationDate" in each.attributes;
                    var isInCategory = groupId === each.attributes.category;
                    return isEphemeral && isInCategory;
                })  
                streams = streams.concat(filteredStreams);
            });
            return streams;
        },

        bulkEnableGroup: function(e){
            e.preventDefault();
            var streams = this.getSelectedStreams();
            if (streams.length > 0) {
                this.app.mediator.publish("view:bulk-enable-streams-dialog", {
                    streams: streams,
                    location: Backbone.history.fragment
                });
            } else {
                this.app.mediator.publish("view:info-dialog", "No selection made!", "Please select a stream");
            }
        },

        bulkDisableGroup: function(e){
            e.preventDefault();
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

        bulkDeleteGroup: function(e){
            e.preventDefault();
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

        enableGroup: function(e){

            var self = this;
            e.preventDefault();
            var groupId = $(e.target).closest('tr').data('id');

            var filteredStreams = self.collection.filter(function(each){
                var isEphemeral = "expirationDate" in each.attributes;
                var isInCategory = groupId === each.attributes.category;
                return isEphemeral && isInCategory;
            })           

            this.app.mediator.publish("view:bulk-enable-streams-dialog", {
                streams: filteredStreams,
                location: Backbone.history.fragment
            });

        },

        disableGroup: function(e){

            var self = this;
            e.preventDefault();
            var groupId = $(e.target).closest('tr').data('id');

            var filteredStreams = self.collection.filter(function(each){
                var isEphemeral = "expirationDate" in each.attributes;
                var isInCategory = groupId === each.attributes.category;
                return isEphemeral && isInCategory;
            })
          
            this.app.mediator.publish("view:bulk-disable-streams-dialog", {
                streams: filteredStreams,
                location: Backbone.history.fragment
            });

        },

        resetSearch: function(e) {
            e.preventDefault();
            $(this.el).find('.stream-search input').val('');
            this.render();
        },

        showMatchingStreams: function(e) {
            console.log("doing stuff: ");
            e.preventDefault();
            this.renderTable();
        },

        render: function(){
            var self = this;
            var searchString = $(this.el).find('.stream-search input').val();

            var output = self.template({
                searchString: searchString
            });

            this.$el.empty();
            self.$el.append(output);

            self.renderTable();

            /*==========  Popdown  ==========*/
            this.bulkEditPopdown = new Popdown({ 
                el: this.$('.ephemeral-bulk-edit')
            });
            $(".ephemeral-stream-edit").each(function(index, item) {
                new Popdown({ el: $(item) })
            });
            /*==========  Tablesorter  ==========*/
            $.tablesorter.addParser({ 
                   // set a unique id 
                   id: 'countdown', 
                   is: function(s) { 
                       // return false so this parser is not auto detected 
                       return false; 
                   }, 
                   format: function(s) { 
                       var numbers = s.split(" ");
                       var days    = parseInt( numbers[0].slice(0,numbers[0].length-1) );
                       var hours   = parseInt( numbers[1].slice(0,numbers[1].length-1) );
                       var minutes = parseInt( numbers[2].slice(0,numbers[2].length-1) );
                       return days * 24 * 60 + hours * 60 + minutes;
                   }, 
                   // set type, either numeric or text 
                   type: 'numeric' 
            });  
            $("#ephemeral-streams-table").tablesorter({
                headers:{
                    0: { sorter: false },
                    1: { sorter: false },
                    7: { sorter: "countdown"},
                    9: { sorter: false }
                }
            });

            return self;
        },

        renderTable: function(){

            var self = this;

            var tableTemplate  = _.template($(EphemeralStreamsTableTemplate).html());
            var searchString = $(this.el).find('#ephem-search').val();

            var formattedGroups = jQuery.extend(true, [], self.streamGroups);

            _.each(formattedGroups, function(each){
                each.earliestTime = formatTime(each.earliestTime, self.timezone); 
                each.latestTime = formatTime(each.latestTime, self.timezone);
            });

            var output = tableTemplate({
                streamGroups: formattedGroups,
                searchString: searchString
            });

            $("#ephemeral-streams-table").empty();
            $("#ephemeral-streams-table").append(output);

            function formatTime(utcTime, timezone){
                moment.locale(_i18n_locale.locale_name);
                if (timezone)
                    return moment(utcTime).tz(timezone).format("LLL");
                else
                    return moment(utcTime).format("LLL");
            }

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