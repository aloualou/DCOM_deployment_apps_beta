require.config({
    shim: {
        'app-js/views/IpAddressListView': {
            deps: ['app-js/contrib/backbone.listview']
        }
    }
});

require([
        "underscore",
        "jquery",
        "backbone",
        "splunkjs/mvc/headerview",
        "splunkjs/mvc/footerview",
        "app-js/contrib/backbone.listview",
        "app-js/contrib/mediator",
        "app-js/views/IpAddressListView",
        "app-js/views/IpAddressView",
        "app-js/collections/CaptureIpAddresses"
    ],
    function(
        _,
        $,
        Backbone,
        HeaderView,
        FooterView,
        ListView,
        Mediator,
        IpAddressListView,
        IpAddressView,
        CaptureIpAddresses
        ) {

        // SPLUNK HEADER AND FOOTER
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

        // instantiate a new Mediator
        app.mediator = new Mediator();

        var captureIpAddresses = new CaptureIpAddresses();
        var whiteListView;
        var blackListView;

        IpAddressRouter = Backbone.Router.extend({
            routes: {
                "": "showCaptureIps"
            },

            initialize: function(options){
                // fetch returns a jquery promise
                this.fetchingIpAddresses = captureIpAddresses.fetch();
            },

            showCaptureIps: function() {
                var self = this;
                this.fetchingIpAddresses.done(
                    function(data){
                        blackListView = new IpAddressListView({
                            app: app,
                            componentId: 'blacklist',
                            ipAddressList: captureIpAddresses.get("blacklist"),
                            el: '#blacklist',
                            ipAddressView: IpAddressView
                        });

                        whiteListView = new IpAddressListView({
                            app: app,
                            componentId: 'whitelist',
                            ipAddressList: captureIpAddresses.get("whitelist"),
                            el: '#whitelist',
                            ipAddressView: IpAddressView
                        });

                        whiteListView.render();
                        blackListView.render();
                    }
                );
            }
        });

        var router = new IpAddressRouter();
        Backbone.history.start();

        $("title").text("IP Address Filters");
        $("body>div.preload").removeClass("preload");
                                                        
        /**
        * EVENTS
        **/       

        $('#toggle-help').on("click", function(){
            $('#help').fadeToggle();
        });


    });