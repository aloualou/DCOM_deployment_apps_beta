define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/IpAddress",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    IpAddress,
    splunk_util
    ) {
    return Backbone.View.extend({

        initialize: function(options){
            this.options = _.extend({}, this.options, options);
            this.ipAddressList = this.options.ipAddressList;
            this.ipAddressView = this.options.ipAddressView;
            this.componentId = this.options.componentId;
            this.app = this.options.app;

            this.ipAddressCollection = new Backbone.Collection();
            var ipAddresses = this.ipAddressList.get('ipAddresses');

            for (var i=0; i<ipAddresses.length; i++) {
                this.ipAddressCollection.add({value: ipAddresses[i]});
            }

            this.listView = new Backbone.ListView({
                collection: this.ipAddressCollection,
                itemView: this.ipAddressView,
                el: this.$el.find('.ipAddressList')[0]
            });

            this.listView.on('item:destroy', function(itemView) {
                this.collection.remove(itemView.model);
            });
        },

        render: function() {
          var self = this;
          self.listView.render();
          self.$el.find(".ipAddressList-controls")[0].innerHTML = "<div id=\"adder\">" +
              "<input type=\"text\" class=\"add-input input-xlarge\" id=\"add-input\" placeholder=\"Add Ip Address\"/>" +
              "<button class=\"btn\" id=\"add-button\">Add</button>" +
              "<button class=\"btn btn-primary save-ip-button\" id=\"save-button\">Save</button>"
              "</div>";
        },

        events: {
            'click #add-button' : 'addIpAddress',
            'click #save-button' : 'saveIpAddresses'
        },

        addIpAddress: function(e) {
            e.preventDefault();
            var self = this;
            var inputVal = self.$el.find("#add-input").val();
            if (inputVal) {
                var ipAddress = new IpAddress({val: inputVal});

                if (ipAddress.isValid()) {
                    self.ipAddressCollection.add({value: inputVal});
                    self.$el.find("#add-input").val('');
                } else {
                    if (ipAddress.validationError)
                        alert(ipAddress.validationError);
                    else
                        alert(ipAddress.validate({val: inputVal}));
                }
            }
        },

        saveIpAddresses: function () {
            var self = this;
            var captureIpAddresses = this.ipAddressList.clone();
            captureIpAddresses.set("ipAddresses", this.ipAddressCollection.pluck('value'));

            captureIpAddresses.save(['id', 'ipAddresses'], {
                type: 'put',
                url: Splunk.util.make_url([
                    "custom",
                    "splunk_app_stream",
                    "captureipaddresses",
                    this.componentId
                ].join('/')),
                success: function (e) {
                    self.app.mediator.publish("view:''");
                    alert("IP Addresses saved successfully");
                },
                error: function (e) {
                    console.log("Error saving IP Addresses");
                    alert("Error saving IP Addresses");
                }
            });
            this.app.mediator.publish(this.componentId + ":save");
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
