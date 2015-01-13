// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.




$(document).ready(function() {
    var views = [   "home",
                "framework_intro",
                "search1_intro",
                "pulldown1_static",
                "pulldown2_dynamic",
                "pulldown3_dynamic_templated",
                "pulldown4_dynamic_postprocess",
                "pulldown5_dynamic_noall_notoken",
                "pulldown6_dynamic_multipleselect",
                "text_field1",
                "linking" ,
                "linking1_pulldowns" ,
                "linking2_tables",
                "back_button1",
                "post_process1_static",
                "post_process2_dynamic",
                "html1_static",
                "html2_dynamic_ui_tokens",
                "html3_dynamic_results",
                "html4_external",
                "html5_replacing_singlevalue",
                "pager1",
                "pager2_postprocess",
                "events1_intro",
                "checkbox1",
                "tools",
                "comparison1_overview",
                "detecting_sideview_utils"
];
    var loc = document.location.pathname.toString();
    var currentView = loc.substring(loc.lastIndexOf("/")+1);
    // dont run this in manager.  (it can show up in the 'view' section)
    if (loc.indexOf("/manager/")!=-1) return;

    var nextView = null;
    var located = false;
    var linkText = "";
    for (var i=0,len=views.length;i<len; i++) {
        var view = views[i];
        if (located) {
            nextView = view
                i=len-1;
        }
        else if (currentView == view) {
            located = true;
            if (i==0) linkText = "On to the Examples";
            else if (i==len-1) {
                linkText = "Return Home";
                nextView = views[0];
            }
            else linkText = "Next Page (" + (i+1) + " of " + (len-1) + ")";
        }
    }
    if (nextView) {
        nextView +=  document.location.search;
        var nextLink = $("<a>")
            .attr("href",nextView)
            .html(linkText + " &raquo ")
            .css("font-size", "14px")

        $(".viewHeader h1")
            .before(nextLink.clone()
                .css("float","right")
                .css("margin","3px 10px 0px 10px")
            );
        $("body")
            .append(nextLink.clone()
                .css("display","block")
                .css("margin","10px")
             );
        $("ol.notesList")
            .append($("<li>")
                .append(nextLink.clone())
            );

    }
});



if (typeof(Sideview)!="undefined") {
    $(document).bind("allModulesInitialized",function() {
        /**
         * custom behaviors used to automate part of the pulldown-load-time
         * benchmark test.
         */
        if (Splunk.util.getCurrentView().indexOf("comparison")==0) {

            var timeStarted;
            var timeEnded;
            var deltas = [];

            Sideview.utils.declareCustomBehavior("startTimer", function(searchModule) {
                searchModule.onContextChange = function() {
                    timeStarted = new Date();
                }
            });

            Sideview.utils.declareCustomBehavior("endTimer", function(searchModule) {
                searchModule.onContextChange = function() {
                    timeEnded = new Date();
                    var diff = (timeEnded.valueOf() - timeStarted.valueOf()) / 1000;
                    deltas.push(diff);
                    $("#elapsedTime").text(diff);
                    $("#numberOfMeasurements").text(deltas.length);
                    var total = 0;
                    for (var i=0;i<deltas.length; i++) {
                        total += deltas[i];
                    }
                    $("#averageTime").text(total / deltas.length);

                }.bind(searchModule);
            });
            

        }

        /**
         * logic for the TextField's testcase view.
         */
        Sideview.utils.declareCustomBehavior ("sendContextKeysUpstream", function(htmlModule) {
            $(htmlModule.container).click(function(evt) {
                var a = $(evt.target);
                var href = a.attr("href").substring(a.attr("href").indexOf("#")+1);
                var pair = href.split("=");

                var context = new Splunk.Context();
                context.set(pair[0], pair[1]);
                htmlModule.passContextToParent(context);
                return false;
            });

        });

        /**
         * logic for the back button testcase views.
         */
        Sideview.utils.declareCustomBehavior ("countPushes", function(module) {
            module.onContextChange = function() {
                this.show();
                if (this.isFake) return;
                var pushes = this.pushes || 1;
                this.pushes = ++pushes;
                this.container.html("pushed: " + this.pushes  + " times")
            }

        });

        Sideview.utils.declareCustomBehavior ("displayBumpOnlyForOlderSplunkVersions", function(module) {
            var v = Splunk.util.getConfigValue("VERSION_LABEL");
            if (Sideview.utils.compareVersions) {
                if (Sideview.utils.compareVersions(v, "4.2.3")<0) {
                    $("#bumpContent",module.container).show();
                }
            }
        });


        Sideview.utils.declareCustomBehavior ("customInputValidation", function(textFieldModule) {
            var messenger = Splunk.Messenger.System.getInstance();
            textFieldModule.validate = function() {
                var v = this.input.val();
                return (Splunk.util.isInt(v) && parseInt(v)>=0 && parseInt(v)<=100);
            };
            textFieldModule.onValidationFail = function() {
                messenger.send("info","*", "Note: percentiles must be between 0 and 100");
            };
            textFieldModule.onValidationPass = function() {
                messenger.clear();
            };
            
        });

        
        Sideview.utils.declareCustomBehavior("endlessScrollerResize", function(eventsModule) {
            var leftNav = $(".sidebar")
                .css("overflow","auto")
                .css("margin-bottom","0px")
                .css("padding-bottom","0px")
           $(".FieldPicker .inlineHeader").width(145);
            var events = eventsModule.container;

            
            $('body').css('overflowY', 'hidden');

            var resizeHandler = function() {
                
                var topOfEvents = events.offset().top;
                var topOfSidebar = leftNav.offset().top;

                var bottomOfViewPort = $(window).height();

                var newEventsHeight  = bottomOfViewPort - topOfEvents;
                var newSidebarHeight = bottomOfViewPort - topOfSidebar;
                
                var damnExtraPadding = 10;
                events.height(newEventsHeight - damnExtraPadding);
                leftNav.css("min-height",newSidebarHeight + "px");
                leftNav.css("height",newSidebarHeight + "px");
            }
            setTimeout(resizeHandler, 1000);
            $(window).resize(resizeHandler);
        });

        





    });
}