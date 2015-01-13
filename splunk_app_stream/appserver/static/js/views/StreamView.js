define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/StreamConfig.html",
    "contrib/text!app-js/templates/StreamConfigFields.html",
    "contrib/text!app-js/templates/ConfirmDialog.html",
    "app-js/views/ConfirmView",
    "app-js/views/TermSelectorView",
    "app-js/views/FilterEditorView",
    "contrib/text!app-js/templates/StreamFieldRow.html",
    "app-js/models/Extras",
    "app-js/models/Field",
    "app-js/models/Comparison",
    "splunkjs/mvc/searchmanager",
    'app-js/collections/SplunkIndexes',
    "app-js/contrib/jquery.tablesorter.min"
], function(
    $,
    _,
    Backbone,
    StreamConfigTemplate,
    StreamConfigFieldsTemplate,
    ConfirmDialogTemplate,
    ConfirmView,
    TermSelectorView,
    FilterEditorView,
    StreamFieldTemplate,
    Extras,
    Field,
    Comparison,
    SearchManager,
    IndexesCollection,
    Tablesorter
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            console.log('Stream View created');

            this.options                    = _.extend({}, this.options, options);
            this.app                        = this.options.app;
            this.streamConfigTemplate       = _.template($(StreamConfigTemplate).html());
            this.streamConfigFieldsTemplate = _.template($(StreamConfigFieldsTemplate).html());
            this.streamFieldTemplate        = _.template($(StreamFieldTemplate).html());
            this.userHasChanges             = false;
            this.streamIsOurs               = ! this.model.get('app') || this.model.get('app') === 'Stream';
            this.splunkIndices              = options.splunkIndices;

            //defaults
            this.category     = "protocol";
            this.categoryItem = "all";
            this.findCategoryInfo();
        },

        events: {
            'click #save'                       : 'updateStream',
            'click #delete'                     : 'deleteStream',
            'click #cancel'                     : 'showStreams',        
            'click #field-rows .field-status'   : 'onFieldEnabledModeChange', //clicking the "Enable" check boxes in the table
            'click #aggregated'                 : 'onAggregationModeChange', //clicking the aggregated checkbox
            'click #addStream'                  : 'triggerAddStreamDialogEvent', //clicking the clone button
            'click .enable-stream-button-group' : 'onStreamEnabledModeChange', //clicking on enable/disable
            'click .agg-type .btn-toggle'       : 'onFieldAggTypeChange', //clicking the aggregate toggle
            'click a.edit-filters'              : 'editFilters', //clicking on "view filters"
            'click .add-to-filters'             : 'addToFilters', //clicking on "Add" under "Add to filter"
            'keyup .field-search-control'       : 'showMatchingFields', //typing in search filter
            'click a.clear'                     : 'resetSearch', //cancelling out search filter
            'change .time-interval'             : 'onTimeIntervalChange', //changing the text in 'Time Interval'
            'change #splunkIndicesSelection'    : 'bindNewIndex', //choosing a new index from the select dropdown
            'click .streams-list-link'          : 'goBack',

            //this is commented out in the html thus deactivated
            'click #addField' : 'addNewStreamField', 
            //this is commented out in the html thus deactivated
            'click .delete-field' : 'deleteStreamField'
        },

        findCategoryInfo: function(){
            var fragments = Backbone.history.fragment.split("/");
            if (fragments.length === 5){
                this.category     = fragments[1];
                this.categoryItem = fragments[2];
            }else{
                console.log("incorrect url: grapping 1 and 2 of array: ", fragments);
            }
        },

        bindNewIndex: function(e) {
            var element = $(e.currentTarget);
            var index   = $("option:selected", element).val();
            (index === "default") ? this.model.set("index", null) : this.model.set("index", index);
            this.setHasChanges();
            $("#splunkIndicesSelection").val(index);
        },

        setHasChanges: function() {
            //function is only ran once
            if (!this.userHasChanges){
                this.userHasChanges = true;
                var self = this;
                $(window).on('beforeunload', function(){
                    if (self.userHasChanges){
                        return "You've made some changes, are you sure you want to leave?";
                    }
                });
                this.render();
            }
        },

        goBack: function() {
            var self = this;
            if (this.userHasChanges){
                var confirmView = new ConfirmView({
                    el: '#modal',
                    model: {text: self.model.get('id') + ":" + self.model.get('name')},
                    action: "go back from",
                    warning: "You have unsaved changes",
                    command: function() {
                         self.userHasChanges = false;
                         self.showStreams();
                    }
                });
                confirmView.show();
            }
            else {
                self.showStreams();
            }
        },

        onTimeIntervalChange: function(e) {
            this.model.get('extras')['interval'] = $('.time-interval').val();
            this.setHasChanges();
        },

        onStreamEnabledModeChange: function(e) {
            var dependentApps = this.model.get('required_by');
            var msg = "You cannot disable this stream because it is required by the following apps: ";

            if (dependentApps) {
                // Since the stream is required by another app, it must already be enabled, and can't be disabled.
                // If the user clicked on 'Enable', just ignore it, and if they clicked on 'Disable',
                // let them know why they can't disable the stream.
                if ($(e.target).hasClass('disabled')) {
                    this.app.mediator.publish("view:info-dialog", "Disabling not allowed", msg + dependentApps.join(', '));
                }
            } else {
                this.toggleButtonFromGroup(e);
                this.model.set('enabled', $('#stream-enabled').is('.active'));
                this.setHasChanges();
            }
        },

        toggleButtonFromGroup: function(e) {
            var btnGroup = e.target.parentElement;
            $(btnGroup).find('.btn').toggleClass('active');

            if ($(btnGroup).find('.btn-primary').size()>0) {
                $(btnGroup).find('.btn').toggleClass('btn-primary');
            }
        },

        triggerAddStreamDialogEvent: function(e) {
            e.preventDefault();
            this.app.mediator.publish("view:add-stream-dialog", this.model, this.userHasChanges);
        },

        render: function() {

            var self         = this;
            var extras       = new Extras(this.model.get('extras'));
            var isAggregated = self.model.get('aggregated');
            var searchString = $(this.el).find('.field-search input').val();

            var output = self.streamConfigTemplate({
                stream         : self.model.toJSON(),
                searchString   : searchString,
                userHasChanges : self.userHasChanges,
                streamIsOurs   : self.streamIsOurs,
                splunkIndices  : self.splunkIndices
            });

            this.$el.empty();
            self.$el.append(output);
            this.renderTable();
            
            if (isAggregated) {
                $('#stream').addClass('aggregated');
                $('input.time-interval').attr('value', extras.get('interval'));
            } else {
                $('#stream').removeClass('aggregated');
            }

            //keeps the selected splunk index across renderings
            $("#splunkIndicesSelection").val(function() {
                var index = self.model.get('index');
                return (index === null) ? "default" : index;
            });
            return self;
        },

        renderTable: function() {
            var self = this;
            var isAggregated = self.model.get('aggregated');
            var searchString = $(this.el).find('.field-search input').val();
            var output;

            self.model.get('fields').sort(function(x, y) {
                if (x.enabled && ! y.enabled) return -1;
                if (! x.enabled && y.enabled) return 1;
                if (isAggregated) {
                    if (x.aggType < y.aggType) return -1;
                    if (x.aggType > y.aggType) return 1;
                }
                if (x.name < y.name) return -1;
                if (x.name > y.name) return 1;
                return 0
            });
            output = self.streamConfigFieldsTemplate({
                stream: self.model.toJSON(),
                streamIsOurs: self.streamIsOurs,
                terms: self.app.terms,
                searchString: searchString
            });
            $(this.el).find('table.field-list').replaceWith(output);
            $("#fields").tablesorter({
                headers:{
                    0: { sorter:false },
                    1: { sorter:false },
                    5: { sorter:false }                    
                }
            });
        },

        onFieldEnabledModeChange: function(e) {
            var fieldEnabled = $(e.currentTarget).is(':checked');
            var thisRow = $($(e.target).closest('tr'));
            var termId = thisRow.find('td.term')[0].textContent;
            var streamAggregated = this.model.get('aggregated');
            var field = _.find(this.model.get('fields'), function(field) { return field.term == termId; });
            var dependentApps = field && field.required_by;
            var msg1 = "This stream can't be modified because it was created by another app: ";
            var msg2 = "You cannot disable this field because it is required by the following apps: ";

            e.stopPropagation();

            if (! field) {
                // This shouldn't happen - just ignore it.
                return;
            } else if (! this.streamIsOurs) {
                // undo the change
                $(e.target)[0].checked = field.enabled;

                this.app.mediator.publish("view:info-dialog", "Modification not allowed", msg1 + this.model.get('app'));
            } else if (dependentApps) {
                // undo the change
                $(e.target)[0].checked = true;

                this.app.mediator.publish("view:info-dialog", "Disabling not allowed", msg2 + dependentApps.join(', '));
            } else {
                field.enabled = fieldEnabled;
                if (streamAggregated)
                    field.aggType = 'key';
                this.setHasChanges();
                this.renderTable();
            }
        },

        onFieldAggTypeChange: function(e) {
            var aggType = $(e.target).hasClass('sum')? 'sum' : 'key';
            var thisRow = $($(e.target).closest('tr'));
            var termId = thisRow.find('td.term')[0].textContent;

            _.each(this.model.get('fields'), function(field) {
                if (field.term == termId)
                    field.aggType = aggType;
            });

            this.setHasChanges();
            this.renderTable();
        },

        showStreams: function(e){
            if (e) { e.preventDefault();}
            //unbind event if user clicks cancel
            $(window).off('beforeunload');
            var options = {
                category: this.category,
                categoryItem: this.categoryItem
            }
            this.app.mediator.publish("view:streams", options);
        },

        onAggregationModeChange: function(e) {
            var isAggregated = $(e.currentTarget).is(':checked');

            this.model.set('aggregated', isAggregated);
            if (isAggregated) {
                _.each(this.model.get('fields'), function(field) {
                    field.enabled = false;
                    field.aggType = 'key';
                });
                this.model.set('streamType', 'agg_event');
            } else {
                this.model.set('streamType', 'event');
            }

            this.setHasChanges();
            this.render();
        },

        editFilters: function(e) {
            e.preventDefault();

            var filterEditorView = new FilterEditorView({
                el: '#modal',
                app: this.app,
                streamView: this
            });

            filterEditorView.show();
        },

        addToFilters: function(e) {
            e.preventDefault();

            var corrTermId = $($(e.target).closest('tr')).find('td.term')[0].textContent;

            var filterEditorView = new FilterEditorView({
                el: '#modal',
                app: this.app,
                streamView: this,
                newTerm: corrTermId
            });

            filterEditorView.show();
        },

        showMatchingFields: function(e) {
            e.preventDefault();
            this.renderTable();
        },

        resetSearch: function(e) {
            e.preventDefault();
            $(this.el).find('.field-search input').val('');
            this.renderTable();
        },

        addNewStreamField: function(e) {
            var self = this;
            e.preventDefault();

            var termSelectorView = new TermSelectorView({
                el: '#modal',
                model: {text: "Stream : " + self.model.get('name')},
                app: this.app,
                callingView: self,
                command: function(selectedTerm) {
                    var field = new Field({name : $(selectedTerm).text(),
                                            term: $(selectedTerm).val(),
                                            desc: $(selectedTerm).data("comment"),
                                            aggType: "value",
                                            enabled: true});

                    $('#field-rows').last().append(this.streamFieldTemplate({
                        field: field.toJSON(),
                        terms: self.app.terms
                    }));
                }
            });

            termSelectorView.show();
        },

        deleteStreamField: function(e) {
            $($(e.target).closest("tr"))[0].remove();
        },

        deleteStream: function(e) {
            var self = this;
            e.preventDefault();
            var id = self.model.get('id');

            var confirmView = new ConfirmView({
                el: '#modal',
                model: {text: self.model.get('id') + ":" + self.model.get('name')},
                action: "delete",
                command: function() {
                    self.model.destroy({
                        success: function(e){
                            self.showStreams();
                        },
                        error: function(e){
                            console.log("Error deleting stream");
                            alert("Error deleting stream");
                        }
                    });
                }
            });

            confirmView.show();
        },

        updateStream: function(e) {
            var self = this;
            var form = $(this.el).find('form#stream');
            var stream = this.model;
            var streamAggregated = form.find('#aggregated').is(':checked')? true : false;
            var extras;
            var aggTypes;
            var streamEnabled = $("#stream-enabled").is(".active") ? true : false;
            var i;

            e.preventDefault();
            stream.set('streamType', $('#stream-type').text());
            stream.set('aggregated', streamAggregated);
            stream.set('enabled', streamEnabled);

            if (streamAggregated) {
                extras = new Extras(stream.get('extras'));
                extras.set('interval', form.find('input.time-interval').val());
                if (extras.isValid()) {
                    stream.set('extras', extras);
                } else {
                    // If this doesn't work for Bubbles, see
                    // https://git.cloudmeter.com/projects/RND/repos/splunk_app_stream/commits/52615041a28d6b8ba408142de4a96bc43ef45fd4
                    alert(extras.validationError);
                    return;
                }
            }

            stream.save(null, {
                success: function(e){
                    //set false as changes have been saved
                    self.userHasChanges = false;
                    self.showStreams();
                },
                error: function(e){
                    console.log("Error saving stream");
                    alert("Error saving stream");
                }
            });
            return false;
        },

        removeSelf: function () {
            console.log("Removing StreamView");
            // empty the contents of the container DOM element without taking it out of the DOM
            this.$el.empty();

            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            return this;
        }

    });
});
