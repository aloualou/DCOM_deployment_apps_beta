define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/EditFiltersDialog.html",
    "contrib/text!app-js/templates/ComparisonRow.html",
    "contrib/text!app-js/templates/FilterComparisons.html",
    "views/shared/controls/SyntheticSelectControl",
    "app-js/views/TermSelectorView",
    "app-js/models/Filters",
    "app-js/models/Comparison",
    "jquery.ui.core",
    "jquery.ui.sortable"
], function(
    $,
    _,
    Backbone,
    EditFiltersDialog,
    ComparisonTemplate,
    FilterComparisonsTemplate,
    SyntheticSelectControl,
    TermSelectorView,
    Filters,
    Comparison
    ) {
    return Backbone.View.extend({
        initialize: function(options) {
            this.options = _.extend({}, this.options, options);
            this.command = this.options.command;
            this.template = _.template($(EditFiltersDialog).html());
            this.filterComparisonsTemplate = _.template($(FilterComparisonsTemplate).html());
            this.app = this.options.app;
            this.streamView = this.options.streamView;
            this.comparisonTemplate = _.template($(ComparisonTemplate).html());
            this.newTerm = this.options.newTerm;

            this.useSsc = true; // temporary hack
        },

        events: {
            'click .add-comparison'         : 'addComparison',
            'click .delete-comparison'      : 'deleteComparison',
            'change select.type'            : 'onComparisonTypeChanged',
            'click .save'                   : 'save',
            'keyup .field-search-control'   : 'showMatchingFields',
            'click a.clear'                 : 'resetSearch',
            'click .cancel'                 : 'cancel',
            'click .match-all-comparisons-group': 'toggleMatchAll'
        },

        cancel: function() {
            this.removeSelf();
        },

        toggleMatchAll: function(e) {
            var btnGroup = e.target.parentElement;
            $(btnGroup).find('.btn').toggleClass('active');

            if ($(btnGroup).find('.btn-primary').size()>0) {
                $(btnGroup).find('.btn').toggleClass('btn-primary');
            }
        },

        show: function() {
            var self = this;
            var stream = this.streamView.model;
            var output = this.template({
                filters: stream.get('filters'),
                terms: this.app.terms,
                comparisonTypes: this.app.comparisonTypes,
                stream: stream
            });

            this.$el.empty();
            this.$el.append(output);
            this.$el.addClass('edit-filters-dialog');
            this.renderComparisonsTable();
            this.$el.modal('show');

            //'hide' is also fired when backdrop is clicked. bootstrap default behavior.
            this.$el.on('hide', function() {
                //remove the added class or the css will propogate to the other modal, making it too long
                self.$el.removeClass('edit-filters-dialog');
                self.removeSelf();
            });

            var sortableHelper = function (e, tr) {
                var $originals = tr.children();
                var $helper = tr.clone();
                $helper.children().each(function (index) {
                    $(this).width($originals.eq(index).width())
                });
                return $helper;
            };

            $("#comparisons-table tbody").sortable({
                handle: ".term",
                cursor: "move",
                helper: sortableHelper
            });

        },

        showMatchingFields: function(e) {
            if (e) {
                e.preventDefault();
            }
            var searchString = $(this.el).find('.field-search-control input').val();

            var comparisonRows = $(this.el).find('tr');
            var row, term;
            var regex = new RegExp(searchString);

            for (var i = 1; i < comparisonRows.length; i++) {
                row = $(comparisonRows[i]);
                term = row.find('td.term').text();
                if (!regex.test(term)) {
                    if (!row.hasClass('hidden-row')) {
                        row.addClass('hidden-row');
                    }
                } else {
                    row.removeClass('hidden-row');
                }
            }
        },

        resetSearch: function(e) {
            if (e) {
                e.preventDefault();
            }
            $(this.el).find('.field-search-control input').val('');
            this.showMatchingFields();
        },

        renderComparisonsTable: function() {
            var self = this;
            var output;
            var i;

            var stream = this.streamView.model;

            stream.get('filters')['comparisons'].sort(function(x, y) {
                if (x.name < y.name) return -1;
                if (x.name > y.name) return 1;
                return 0;
            });

            output = this.filterComparisonsTemplate({
                useSsc: this.useSsc,
                filters: stream.get('filters'),
                terms: this.app.terms,
                comparisonTypes: this.app.comparisonTypes,
                stream: this.streamView.model
            });

            $(this.el).find('table.comparisons-table').replaceWith(output);

            if (this.newTerm) {
                $('#edit-filters-dialog tbody').last().append(this.comparisonTemplate({
                    useSsc: this.useSsc,
                    index: stream.get('filters').comparisons.length,
                    terms: this.app.terms,
                    comparison: {term: this.newTerm, type: 'is-defined', value: ''},
                    comparisonTypes: this.app.comparisonTypes
                }));
            }

            if (this.useSsc) {
                this.syntheticSelectControls = {};
                var insertSyntheticSelectControl = function(cmp, identClass) {
                    var compItems = [];
                    var ssc;

                    self.app.comparisonTypes.each(function(type) {
                        var id = type.get('id');
                        var description = type.get('description');
                        var categories = type.get('categories');
                        var termCategory = self.app.terms.get(cmp.term).get('category');
                        if (categories.indexOf(termCategory) != -1) {
                            compItems.push({label: description, value: id});
                        }
                    });
                    ssc = new SyntheticSelectControl({
                        toggleClassName: 'btn-pill',
                        menuWidth: 'narrow',
                        items: compItems
                    });
                    ssc.identClass = identClass;
                    ssc.setValue(cmp.type);

                    // STREAM-1138. In Bubbles, the onComparisonTypeChanged2 event seems to be fired without the
                    // 'ssc' object passed in. In Cupcake the 'ssc' object is passed in fine. Workaround is store the
                    // reference to the parent view in ssc.
                    //ssc.on('change', self.onComparisonTypeChanged2, self);

                    ssc.parent = self;
                    ssc.on('change', self.onComparisonTypeChanged2);

                    $(self.el).find('tr.' + identClass + ' .synth').append(ssc.render().el);
                    self.syntheticSelectControls[identClass] = ssc;
                }
                for (i = 0; i < stream.get('filters').comparisons.length; i++) {
                    var cmp = stream.get('filters').comparisons[i];
                    insertSyntheticSelectControl(cmp, 'comp' + i);
                }
                if (this.newTerm) {
                    insertSyntheticSelectControl({term: this.newTerm, type: 'is-defined'}, 'comp' + i);
                }
            }
        },

        addComparison: function(e) {
            var self = this;

            e.preventDefault();

            var termSelectorView = new TermSelectorView({
                el: '#modal',
                app: this.app,
                callingView: self,
                command: function(selectedTerm) {
                    $('#edit-filters-dialog tbody').last().append(self.comparisonTemplate({
                        terms: self.app.terms,
                        comparison: {term: $(selectedTerm).val(), type: 'is-defined', value: ''},
                        comparisonTypes: self.app.comparisonTypes
                    }));
                }
            });

            termSelectorView.show();
        },

        onComparisonTypeChanged: function(e) {
            var comparisonTypeId = e.target.value;
            var arity = this.app.comparisonTypes.get(comparisonTypeId).get('arity');
            var corrValueCell;

            e.preventDefault();
            corrValueCell = $($(e.target).closest('tr')).find('.value');
            if (arity == 1) {
                corrValueCell.attr('disabled', true)
                corrValueCell.attr('value', '')
            } else {
                corrValueCell.attr('disabled', false)
            }
        },

        onComparisonTypeChanged2: function(value, oldValue) {
            var arity = this.parent.app.comparisonTypes.get(value).get('arity');
            var corrValueCell = $(this.parent.el).find('tr.' + this.identClass + ' .value');
            var corrEditIcon = $(this.parent.el).find('tr.' + this.identClass + ' td.comp-value i');

            if (arity == 1) {
                corrValueCell.attr('disabled', true);
                corrValueCell.attr('value', ' ');
                corrEditIcon.removeClass('icon-pencil');
            } else {
                corrValueCell.attr('disabled', false);
                corrEditIcon.addClass('icon-pencil');
            }
        },

        deleteComparison: function(e) {
            e.preventDefault();
            ($(e.target).closest('tr')).addClass("deleted-row");
        },

        save: function(e) {
            var self = this;
            var stream = this.streamView.model;
            var filters = new Filters(stream.get('filters'));
            var i;
            var comparisonRows = $(this.el).find('tr');
            var row;
            var rowData;
            var identClass;
            var ssc;

            e.preventDefault();

            filters.set('matchAllComparisons', $("#match-all-enabled").is(".active") ? true : false);
            filters.set('comparisons', []);

            for (i = 1; i < comparisonRows.length; i++) {
                row = $(comparisonRows[i]);
                if (!row.hasClass('deleted-row')) {
                    if (this.useSsc) {

                        //identClass = 'comp' + (i - 1);
                        identClass = row.data('ident');
                        ssc = this.syntheticSelectControls[identClass];
                        rowData = {
                            term           : row.find('td.term').text(),
                            type           : ssc.getValue(),
                            value          : row.find('input.value').val(),
                            matchAllValues : row.find('input.match-all-values').is(':checked')
                        };

                    } else {

                        rowData = {
                            term           : row.find('td.term').text(),
                            type           : row.find('select.type').val(),
                            value          : row.find('input.value').val(),
                            matchAllValues : row.find('input.match-all-values').is(':checked')
                        };
                        
                    }
                    filters.get('comparisons').push(rowData);
                }
            }

            if (filters.isValid()) {
                stream.set('filters', filters.toJSON());
            } else {
                // If this doesn't work for Bubbles, see
                // https://git.cloudmeter.com/projects/RND/repos/splunk_app_stream/commits/52615041a28d6b8ba408142de4a96bc43ef45fd4
                alert(filters.validationError);
                return;
            }

            var numFilters = filters.get('comparisons').length;
            $(self.streamView.el).find('div.filter-count').text(numFilters + ' filters configured');

            this.$el.modal('hide');
            this.removeSelf();
            this.streamView.setHasChanges();

        },

        removeSelf: function () {
            // empty the contents of the container DOM element without taking it out of the DOM
            this.$el.empty();

            // clears all callbacks previously bound to the view with delegateEvents method
            // (I would expect stopListening to do the job but it doesn't)
            this.undelegateEvents();

            return this;
        }

    });
});
