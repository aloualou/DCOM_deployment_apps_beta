define([
    "jquery",
    "underscore",
    "backbone",
    "contrib/text!app-js/templates/SelectTermDialog.html"
], function(
    $,
    _,
    Backbone,
    SelectTermDialog
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.command = this.options.command;
            this.template = _.template($(SelectTermDialog).html());
            this.app = this.options.app;
            this.callingView = this.options.callingView;
        },

        events:{
            'click .yes':'yes',
            'click #vocabularies': 'onVocabularySelected',
            'click #terms': 'onTermSelected'
        },

        onVocabularySelected: function(e) {
            var vocabId = e.target.value;
            var vocab = this.app.vocabularies.get(vocabId);
            $('#terms').empty();
            $.each(vocab.get('terms'), function(i, term) {
                $('#terms').append('<option data-comment="' + term.get('comment') + '" value=' + term.get("id") +
                    '>' + term.get("name") + '</option>');
            });
            this.selectFirstTerm();
        },

        onTermSelected: function(e) {
            var term = e.target.value;
            var comment = e.target.dataset.comment;
            $('.term-description').text(comment);
        },
        
        show: function(){
            this.$el.empty();
            var output = this.template({"vocabularies": this.app.vocabularies});
            this.$el.append(output);
            $("#vocabularies").val($("#vocabularies option:first").val());
            this.selectFirstTerm();
            this.$el.modal('show');
        },
     
        yes: function(e) {
            e.preventDefault();
            var selectedTerm = this.$("#terms").find(":selected")[0];
            this.command.call(this.callingView, selectedTerm);
            this.$el.modal('hide');
            this.removeSelf();
        },

        selectFirstTerm: function() {
            var firstTerm = $("#terms option:first")[0];
            $("#terms").val(firstTerm.value);
            $(".term-description").text(firstTerm.dataset.comment);
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