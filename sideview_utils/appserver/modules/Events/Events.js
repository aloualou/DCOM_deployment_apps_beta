// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.Events= $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.numberOfLayers = 5;
        this.numberOfEventsPerLayer = 10;
        this.requestThresholdInPixels = 100;
        this.inFlight = false;
        this.bottomLayerIndex = 0;
        this.topLayerIndex    = 0;
        this.bottomEventIndex = -1;
        this.topEventIndex = -1;
        this.hitBottom = false;
        this.layers = [];
        this.valuesToCheck = {};
        this.workflowActionsXHR = false;
        this.menuContainer = $(".workflowActionsMenu", this.container);
        this.menuLoadingHTML  = this.menuContainer.html();
        this.keysThatRequireReflow = ["results.displayRowNumbers", "results.segmentation","results.maxLines","results.fields"];

        
        // build our ring of layers.
        this.initLayers();

        // event handling.
        this.bindEventListeners();
        
        this.setupStandardResizeBehavior();
        
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    /********************************
     * EXTENDED SETUP STUFF
     *******************************/
    bindEventListeners: function() {
        this.container.scroll(this.checkSeams.bind(this));
        if (Splunk.util.normalizeBoolean(this.getParam("allowTermClicks"))) {
            this.container.mouseover(this.onMouseover.bind(this));
            this.container.mouseout(this.onMouseout.bind(this));
            this.container.click(function(evt) {
                var target  =  $(evt.target);
                if (target.hasClass("actions")) {
                    this.getMenuItems(target);
                    return false;
                }
                else if (target.get(0).tagName=="EM") {
                    return this.runInternalSearch(evt,target);
                }
            }.bind(this));
        } else {
            this.container.addClass("termClickingDisabled");
            this.container.click(function(evt) {
                var target  =  $(evt.target);
                if (target.hasClass("actions")) {
                    this.getMenuItems(target);
                    return false;
                }
            }.bind(this));
        }
        this.container.click(function(evt) {
            var target  =  $(evt.target);
            if (target.hasClass("showinline")) {
                this.onShowHideAllLines(target);
                return false;
            }
        }.bind(this));
        $(document).click(this.onDocumentClick.bind(this));
    },

    setupStandardResizeBehavior: function() {
        if (this.getParam("resizeMode")=="auto") {
            $(document.body).css("overflow","hidden");
            if (this.getParam("height") && this.getParam("height").length>0) alert("error: events module configured in resizeMode auto, but also with fixed height=" + this.getParam("height"));
            $(window).resize(this.realign.bind(this));
            this.realign();
        } 
        else if (this.getParam("resizeMode")=="fixed") {
            if (this.getParam("height")) {
                this.container.css("height", this.getParam("height"));
            } else {
                alert("error: events module configured with resizeMode fixed but no height param is given.");
            }
        }
        else if (this.getParam("resizeMode")=="custom") {
            if (!this.getParam("customBehavior")) {
                this.logger.error("warning: events module configured in resizeMode custom, but no customBehavior param is set");
            }
        }
    },
    
    /********************************
     * SPLUNK MODULE FRAMEWORK - GENERAL
     *******************************/
    
    /**
     * patch so that getParam("fields") returns an array, and always the 
     * "right" array too.
     */
    getParam: function($super, key, fallbackValue) {
        var superValue = $super(key,fallbackValue);
        if (key=="fields") {
            try {
                var tokenized     = Sideview.utils.replaceTokensFromContext(superValue || "", this.getContext())
                var loadFields    = Splunk.util.stringToFieldList(tokenized);
                var runtimeFields = this.getContext().get("results.fields") || [];
                if (loadFields.length > 0 && runtimeFields.length > 0) {
                    this.logger.warn("Overspecification of 'fields' in the Events module.  The local 'fields' param will be ignored because the value is also set from upstream.");
                }
                else if (runtimeFields.length > 0) return runtimeFields;
                else if (loadFields.length > 0) return loadFields;
                return [];
            } 
            catch(e) {
                this.logger.error("unexpected error reconciling loadtime fields and runtime fields config.")
                this.logger.error(e);
                return Splunk.util.stringToFieldList(superValue);
            }
        }
        return superValue;
    },

    /**
     * method we need to implement to trigger dispatches when timerange is 
     * 'half-restricted' eg by a FlashTimeline module.
     */
    requiresTransformedResults: function() {return true;},

    /**
     * gotta implement resetUI to avoid console noise.
     */
    resetUI: function() {},

    /**
     * tell the framework about the fields we need, and that we'll need events
     */
    onBeforeJobDispatched: function(search) {
        search.setMinimumStatusBuckets(1);
        var fields = this.getParam("fields");
        if (fields.length>0) search.setRequiredFields(fields);
    },

    contextRequiresNewEvents: function(context) {
        var requiresNewEvents = false;
        var plainKeys = this.keysThatRequireReflow;
        var search = context.get("search");
        if (!this.valuesToCheck.hasOwnProperty("sid")  || 
            search.job.getSearchId() != this.valuesToCheck["sid"]) {
            requiresNewEvents = true;
        }
        for (var i=0;!requiresNewEvents && i<plainKeys.length;i++) {
            var k = plainKeys[i];
            if (this.valuesToCheck.hasOwnProperty(k) && 
                this.valuesToCheck[k] != context.get(k)) {
                requiresNewEvents = true;
            }
        }
        // update the recent values.
        this.valuesToCheck["sid"] = search.job.getSearchId();
        for (var i=0;i<plainKeys.length;i++) {
            this.valuesToCheck[plainKeys[i]] = context.get(plainKeys[i]);
        }
        return requiresNewEvents;
    },

    /**
     * standard method that runs when we receive new context data from 
     * upstream. Often this means a new job as well but not necessarily.
     */
    onContextChange: function() {
        var context = this.getContext();
        var search = context.get("search");
        
        if (!search || !search.isJobDispatched()){
            this.logger.error("Assertion failed - Events module has been given an undispatched search.");
        }
        if (context.has("results.softWrap")){
            if (context.get("results.softWrap")) this.container.addClass("softWrap");
            else this.container.removeClass("softWrap");
        }
        if (this.contextRequiresNewEvents(context)) {
            this.resetLayers();
            if (search.job.isDone() || (search.job.getEventAvailableCount() > 0)) {
                this.getResults("down");
            }
        }
        else {
            this.realign();
            
        }
    },
    
    /**
     * standard method that runs when a running job gets new events
     */
    onJobProgress: function() {
        if (this.bottomEventIndex==-1) {
            this.getResults("down");
        } 
        else {
            // make sure the "bottom" didn't get any deeper on us.
            if (this.hitBottom) {
                var search  = this.getContext().get("search");
                if (search.job.getEventAvailableCount() > this.bottomEventIndex) {
                    this.hitBottom=false;
                }
            }
            this.checkSeams();
        }
    },


    /********************************
     * SPLUNK MODULE FRAMEWORK - HTTP HANDLING FOR EVENTS
     *******************************/
    getResults: function($super,upOrDown) {
        this.inFlight = upOrDown;
        return $super()
    },
    
    /**
     * Sneaky or lazy. You decide.
     */
    getResultURL: function($super, params) {
        this.moduleType = "Splunk.Module.EventsViewer";
        var retVal = $super(params);
        this.moduleType = "Splunk.Module.Events";
        return retVal;
    },

    getResultParams: function($super){
        var params = $super();
        var context = this.getContext();
        var search  = context.get("search");
        
        params.sid = search.job.getSearchId();
        // TODO - add support for results_preview vs events vs results.
        params.entity_name  = "events";
        params.segmentation = context.get("results.segmentation");
        params.display_row_numbers = Splunk.util.normalizeBoolean(context.get("results.displayRowNumbers")) ? 1:0;

        // very weird. but we duplicate what EventsViewer does here just in case it's not a mistake. 
        params.min_lines = 10;
        if (context.get("results.maxLines")) {
            params.max_lines = context.get("results.maxLines");
        }
        params.max_lines_constraint = 500;
        // TODO - pass enable_event_actions and enable_field_actions flags

        params.count = this.numberOfEventsPerLayer;
        if (this.inFlight=="up") {
            if (this.topEventIndex - this.numberOfEventsPerLayer<0) {
                this.logger.error("getResultParams, on an 'up' request, calculated a negative offset.");
            }
            params.offset = Math.max(this.topEventIndex - this.numberOfEventsPerLayer,0);
        } else if (this.inFlight=="down") {
            params.offset = Math.max(this.bottomEventIndex,0);
        } else {
            params.offset = 0;
            this.logger.warn('inFlight flag is ' + this.inFlight + ', during getResultParams call');
        }
        //this.logger.log("getResultParams - current frame is " + this.topEventIndex + "," + this.bottomEventIndex + " and params.offset=" + params.offset);

        // TODO - invert offset for realtime and events and no explicit sort field. 

        // the endpoint expects this when appropriate. Lets hope it does something.
        if ($.browser.msie) params.replace_newlines = 1;

        var postProcess = search.getPostProcess();
        if (postProcess) params.post_process = postProcess;
        var fields = this.getParam("fields");
        if (fields.length > 0) params["field_list"] = fields;
        return params;
    },

    renderResults: function(htmlFragment){
        var newLayerIndex;
        if (this.inFlight=="up") {
            // old top
            var previousTopLayer = this.getTopmostLayer();

            // new top
            this.topLayerIndex = (this.topLayerIndex + (this.numberOfLayers-1)) % this.numberOfLayers;
            var newLayer = this.getTopmostLayer();

            // bookkeeping on bottom side if the two sides of the ring now touch.
            if (this.topLayerIndex == this.bottomLayerIndex) {
                var aboutToObliterateCount = $("li.item", newLayer).length;
                this.bottomEventIndex = Math.max(this.bottomEventIndex,0) - aboutToObliterateCount;
                this.bottomLayerIndex = (this.bottomLayerIndex + (this.numberOfLayers-1)) % this.numberOfLayers;
                this.hitBottom = false;
            }
            
            // copy it in.
            newLayer.html(htmlFragment);

            //position it.
            newLayer.css("top", previousTopLayer.get(0).offsetTop - newLayer.get(0).offsetHeight);

            // bookkeeping on top side.
            var newlyRenderedCount = $("li.item", newLayer).length;
            this.topEventIndex = Math.max(this.topEventIndex,0) - newlyRenderedCount;
            this.inFlight = false;
            // check whether we're still showing an open range.
            this.logger.debug("render from going up. checking seams again on the tail end");
            this.checkSeams();
        }
        else if (this.inFlight=="down") {
            // old bottom
            var previousBottomLayer = this.getBottommostLayer();
            
            // new bottom
            this.bottomLayerIndex = (this.bottomLayerIndex+1) % this.numberOfLayers;
            var newLayer = this.getBottommostLayer();
            
            // bookkeeping on top side if the two sides of the ring now touch.
            if (this.bottomLayerIndex == this.topLayerIndex) {
                var aboutToObliterateCount = $("li.item", newLayer).length;
                this.topEventIndex = Math.max(this.topEventIndex,0) + aboutToObliterateCount;
                this.topLayerIndex = (this.topLayerIndex+1) % this.numberOfLayers;
            }

            // copy it in.
            newLayer.html(htmlFragment);

            //position it.
            newLayer.css("top", previousBottomLayer.get(0).offsetTop + previousBottomLayer.get(0).offsetHeight);

            // bookkeeping on bottom side.
            var newlyRenderedCount = $("li.item", newLayer).length;
            this.bottomEventIndex = Math.max(this.bottomEventIndex,0) + newlyRenderedCount;
            this.inFlight = false;
            // check whether we're still showing an open range.
            if (newlyRenderedCount == this.numberOfEventsPerLayer) {
                this.checkSeams();
            } else {
                this.hitBottom = true;
            }
        }
        else this.logger.error("renderResults called but inFlight flag is null");
        this.checkAlignmentWithOrigin();
        
        $("a.fm",newLayer).addClass("actions");
    },



    onShowHideAllLines: function(link) {
        var eventContainer = link.parents().filter("li.item");
        link.html("");
        link.before($("<b>").html(_("Loading lines...")));
        $.ajax({
            type: "GET",
            dataType: "html",
            url: link.attr("href"),
            error: function(jqXHR, textStatus, errorThrown) {
                this.logger.error("error loading " + link.attr("href"));
                this.logger.error(errorThrown);
            }.bind(this),
            complete: function(jqXHR, textStatus) {
                if (jqXHR.status==200) {
                    eventContainer.html(jqXHR.responseText);
                    this.realign();
                } else {
                    eventContainer.html(_("Unexpected error loading lines - ") + "status=" + jqXHR.status + " textStatus=" + textStatus);
                }
            }.bind(this)
        });
        return false;
    },
    


    /********************************
     * LAYER MANAGEMENT METHODS
     *******************************/
    getBottommostLayer : function() {
        return this.layers[this.bottomLayerIndex];
    },

    getTopmostLayer : function() {
        return this.layers[this.topLayerIndex];
    },

    getLowestEventInLayer: function(layer) {
        return $("em.pos:first", layer).text()
    },

    getOnscreenLayerIndex: function() {
        var topOfViewport = this.container.scrollTop();
        var i = this.topLayerIndex;
        do {
            var bottomEdge = this.layers[i].get(0).offsetTop + this.layers[i].get(0).offsetHeight;
            if (bottomEdge >= topOfViewport) return i
            i = (i+1)% this.numberOfLayers;
        } 
        while (i!=this.bottomLayerIndex);
        return i;
    },

    /**
     * builds our ring of layers.
     */
    initLayers: function() {
        
        for (var i=0;i<this.numberOfLayers;i++) {
            var layer = $('<div class="eventLayer">');
            this.layers.push(layer);
            this.container.append(layer);
        }
        this.resetLayers();
    },

    resetLayers: function() {
        $(".eventLayer",this.container).html("").css("top", 0);
        this.bottomLayerIndex = 0;
        this.topLayerIndex    = 0;
        this.bottomEventIndex = -1;
        this.topEventIndex = -1;
        this.hitBottom = false;
    },

    


    checkSeams: function() {
        this.logger.debug("check seams");
        var context = this.getContext();
        var search  = context.get("search");
        if (!search || !search.isJobDispatched()) return false;

        var bottomLayer = this.getBottommostLayer();
        var topLayer    = this.getTopmostLayer();

        var topOfViewport = this.container.scrollTop();
        var topOfTopmost = topLayer.get(0).offsetTop;

        var bottomOfViewport = topOfViewport + this.container.get(0).offsetHeight;
        var bottomOfBottommost = bottomLayer.get(0).offsetTop + bottomLayer.get(0).offsetHeight;

        if (this.inFlight) {
            this.logger.debug("check seams, sees inFlight flag. reutrning false;");
            return;
        }

        if (topOfViewport>=0 && this.topEventIndex>0 && topOfTopmost+this.requestThresholdInPixels > topOfViewport) {
            this.logger.log('checkSeams - GOING UP, topOfViewport=' + topOfViewport);
            this.getResults("up");
            
        }
        else if (!this.hitBottom && bottomOfBottommost-this.requestThresholdInPixels < bottomOfViewport) {
            this.logger.log('checkSeams - GOING DOWN');
            this.getResults("down");
            
        }
        else {
            this.logger.log("checkSeams - do nothing");
        }
    },

    realign: function() {
        var onscreenLayerIndex = this.getOnscreenLayerIndex();

        this.realignAroundLayer(onscreenLayerIndex);
        
        if (this.getParam("resizeMode")=="auto") {
            var autoResizeLevel = this.getParam("autoResizeLevel");
            if (parseInt(autoResizeLevel,10)>-1) {
                var elementToAlignWith = this.container;
                for (var i=0;i<autoResizeLevel;i++) {
                    elementToAlignWith = elementToAlignWith.parent();    
                }
                var bottomOfFooter = elementToAlignWith.position().top + elementToAlignWith.outerHeight(true);
                var bottomOfViewPort = $(document).scrollTop() + $(window).height() - parseInt(this.getParam("extraMargin"),10);
                var currentContainerHeight = this.container.height();
                this.container.height(currentContainerHeight + bottomOfViewPort - bottomOfFooter);
            } 
        }
        this.checkSeams();
    },
    
    shiftAllLayers: function(delta) {
        for (var i=0;i<this.numberOfLayers;i++) {
            this.layers[i].css("top", this.layers[i].get(0).offsetTop + delta);
        }
        this.container.scrollTop(Math.max(this.container.scrollTop() + delta,0))
    },

    checkAlignmentWithOrigin: function() {
        var topLayer = this.getTopmostLayer();
        var topOfTopmost = topLayer.get(0).offsetTop;

        if (this.topEventIndex==0) {
            if (topOfTopmost==0) return;
            else {
                this.logger.debug("checkAlignmentWithOrigin condition 1 " + (-topOfTopmost));
                return this.shiftAllLayers(-topOfTopmost);
            } 
        } else if (topOfTopmost<=Math.max(this.topEventIndex,0) * 25) {
            var delta = Math.max(this.topEventIndex,0) * 25 - topOfTopmost;
            this.logger.debug("checkAlignmentWithOrigin condition 2 " + (delta));
            return this.shiftAllLayers(delta);
        }
    },

    realignAroundLayer: function(layerIndex) {
        var fixedLayerIndex = this.getOnscreenLayerIndex();
        var fixedLayer = this.layers[fixedLayerIndex];
        if (this.topLayerIndex==-1 || this.bottomLayerIndex==-1) {
            this.logger.debug("realignAroundLayer - aborting - (" + this.topLayerIndex + ", " + this.bottomLayerIndex + ")");
            return;
        }
        //this.printState();

        var top = fixedLayer.get(0).offsetTop;

        for (var i=(fixedLayerIndex+this.numberOfLayers-1)%this.numberOfLayers;(i+1)%this.numberOfLayers!=this.topLayerIndex; i=(i+this.numberOfLayers-1) % this.numberOfLayers) {
            top = top - this.layers[i].get(0).offsetHeight;
            this.layers[i].css("top", top);
        }
        var top = fixedLayer.get(0).offsetTop + fixedLayer.get(0).offsetHeight;
        for (var i=(fixedLayerIndex+1)%this.numberOfLayers; i!=(this.bottomLayerIndex+1)%this.numberOfLayers; i=(i+1) % this.numberOfLayers) {
            this.layers[i].css("top", top);
            top += this.layers[i].get(0).offsetHeight;
        }
        this.checkAlignmentWithOrigin()
        

    },


   
    

    

    /********************************
     * TERM HIGHLIGHTING/CLICKING
     *******************************/
    
    getTermToHighlight: function(sg) {
        var parent = sg.parent();
        // if the segment is the last segment in the parent segment, walk up to the parent. 
        if (parent.hasClass("t") && $("em.t",parent).last().get(0) == sg.get(0) && parent.hasClass("t")) {
            sg = parent;
        }
        // this will now have walked up to the correct segment, even in the 
        // 'full' case.
        return $(sg);
    },
    /**
     * because of the needs of 'full' segmentation, within the pre tag we 
     * cant do it with just an em:hover rule.
     */
    needsExplicitMouseover: function(target) {
        return (target.get(0).tagName=="EM" && target.parents().filter("pre.event").length>0); 
    },
    
    onMouseover: function(evt) {
        if (!this.needsExplicitMouseover($(evt.target))) return;
        var sg = this.getTermToHighlight($(evt.target));
        sg.addClass("h");
    },

    onMouseout: function(evt) {
        if (!this.needsExplicitMouseover($(evt.target))) return;
        var sg = this.getTermToHighlight($(evt.target));
        sg.removeClass("h");
    },

    getLegacyIntention:function(evt,value,key) {
        var intentionName = (evt.altKey)? "negateterm" : "addterm";
        var intention = {
            name: intentionName,
            arg:{}
        };
        if (key) intention.arg[key] = value;
        else intention.arg = value;
        return intention;
    },

    /********************************
     * WORKFLOW ACTION MENUS
     *******************************/
    showMenu: function(menuLink) {
        var top = menuLink.offset().top + menuLink.get(0).offsetHeight + this.container.scrollTop();
        var left = menuLink.offset().left;
        top -= this.container.offset().top;
        left -= this.container.offset().left;
        this.menuContainer.css("top", top);
        this.menuContainer.css("left", left);
        this.menuContainer.html(this.menuLoadingHTML);
        this.menuContainer.show();
    },

    hideMenu: function() {
        this.menuContainer.hide();
        this.menuContainer.css("left", -2000);
    },

    getMenuItems: function(menuLink) {
        var context = this.getContext();
        var search = context.get("search");
        var sid = search.job.getSearchId();

        var rowOffset = menuLink.parents().filter("li.item").attr("s:offset");

        var uri = sprintf(
            "/api/field/actions/%(app)s/%(sid)s/%(offset)s", 
            {  
                app: encodeURIComponent(Splunk.util.getCurrentApp()), 
                sid: encodeURIComponent(sid), 
                offset: rowOffset
            }
        );
        uri  = Splunk.util.make_url(uri);
        var args = {
            "maxLines": context.get("results.maxLines"),
            "view": Splunk.util.getCurrentView()
        }
        var timeRange = search.getTimeRange();
        if (timeRange.isSubRangeOfJob()) {
            args["latest_time"] = timeRange.getLatestTimeTerms();
            args["earliest_time"] = timeRange.getEarliestTimeTerms();
        }
        
        var fieldName = menuLink.parent().find("em.k").text();
        var fieldValue = menuLink.parent().find("em.v").text();
        if (fieldName) args["field_name"] = fieldName;
        if (fieldValue) args["field_value"] = fieldValue;
        
        this.showMenu(menuLink);
        
        if (this.workflowActionsXHR) {
            try {
                this.workflowActionsXHR.abort();
                this.logger.info("XHR aborted.");
            } 
            catch(e){
                this.logger.warn("XHR abort failed");
            }
            this.workflowActionsXHR = null;
        }
        this.workflowActionsXHR = $.ajax({
            type: "GET",
            dataType: "text",
            url: uri + "?" + Sideview.utils.dictToString(args),
            error: function(){
                this.logger.error("field actions menu XHR sadness - hit xhr error handler");
            }.bind(this),
            complete: function(jqXHR, textStatus){
                this.renderMenu(jqXHR,menuLink);
            }.bind(this)
        });
    },
    
   
    addCustomMenuItems: function(menuLink, items) {
        var fieldName = menuLink.parent().find("em.k").text();
        var fieldValue = menuLink.parent().find("em.v").text();
        var tagPopupLabel = sprintf(_("Tag %s=%s"), fieldName,fieldValue);
        if (menuLink.hasClass("fm")) {
            var tagItem = {
                type : "callback",
                label: tagPopupLabel,
                callback: function() {
                    foo = new Splunk.Popup.createTagFieldForm($(".taggingLayer", this.container), _("Tag This Field"), fieldName, fieldValue, function(){this.resetLayers();this.onContextChange()}.bind(this));
                    return false;
                }.bind(this)
            };
            items.push(tagItem);
            var reportItem = {
                type : "callback",
                label: _("Report on field"),
                callback: function(evt){
                    var search  = this.getContext().get("search");
                    var baseSearchId = search.job.getSearchId();
                    search.abandonJob();
                    search.addIntention({
                        name: "plot", 
                        arg: {
                            mode: "timechart", 
                            fields: [["count", "__events"]], 
                            splitby: fieldName
                        }
                    });
                    search.sendToView("report_builder_format_report", {base_sid: baseSearchId}, true, true, {autosize: true});
                    return false;
                }.bind(this)
            }
            items.push(reportItem);

        }

    },

    renderMenu: function(response, menuLink)  {
        try {
            var envelope = JSON.parse(response.responseText);
        } catch(e) {
            this.logger.error("field actions menu XHR sadness - on render");
            return;
        }
        if (response.status==200 && envelope.success) {
            this.menuContainer.html("");
            var ul = $("<ul>");
            var items = envelope.data;

            this.addCustomMenuItems(menuLink, items);

            for (var i=0,len=items.length;i<len;i++) {
                var itemDict = items[i];
                var itemElement;
                if (itemDict["type"]=="search") {
                    itemDict["link.target"] = itemDict["search.target"];
                    var app  = itemDict["search.app"]  || Splunk.util.getCurrentApp();
                    var view = itemDict["search.view"] || Splunk.util.getCurrentView();
                    var url = Splunk.util.make_url("/app",app,view);
                    var args = {
                        "q" : Splunk.util.addLeadingSearchCommand(itemDict["search.search_string"])
                    }
                    if (Splunk.util.normalizeBoolean(itemDict["search.preserve_timerange"])) {
                        var context = this.getContext();
                        var range = context.get("search").getTimeRange();
                        args["earliest"] = range.getEarliestTimeTerms();
                        args["latest"] = range.getLatestTimeTerms();
                    } else {
                        args["earliest"] = itemDict["search.earliest"];
                        args["latest"] = itemDict["search.latest"];
                    }
                    itemDict["link.uri"] = url + "?" + Sideview.utils.dictToString(args);

                    // the circle is complete. 
                    itemDict["type"] = "link";
                }
                if (itemDict["type"]=="link") {
                    itemElement = $("<a>")
                        .attr("href", itemDict["link.uri"])
                        .attr("target", itemDict["link.target"])
                        .text(itemDict["label"])
                }
                else if (itemDict["type"]=="callback") {
                    itemElement = $("<a>")
                        .attr("href", "#")
                        .text(itemDict["label"])
                        .click(itemDict["callback"]);
                }
                else {
                    this.logger.debug("unsupported type " + itemDict["type"]);
                    continue;
                }
                ul.append($("<li>").append(itemElement));
            }
            this.menuContainer.append(ul);
        }
    },

    runInternalSearch: function(evt,sg) {
        var upwardContext = new Splunk.Context();
        var upwardSearch  = new Splunk.Search("*");
        sg = this.getTermToHighlight(sg);
        if (sg.hasClass("time")) {
            var e =  parseInt(sg.attr("s:epoch"),10);
            upwardSearch.setTimeRange(new Splunk.TimeRange(e,  e+1));
        }
        else {
            var key = sg.parent().find("em.k").text();
            if (sg.hasClass("tg")) key = "tag::" + key;
            var intention = this.getLegacyIntention(evt, sg.text(),key); 
            upwardSearch.addIntention(intention);
        }
        upwardContext.set("search", upwardSearch);
        this.passContextToParent(upwardContext);
    },

    onDocumentClick: function(evt) {
        var target  =  $(evt.target);
        if (!target.hasClass("actions") || 
            target.parents().filter("div.Events").get(0) != this.container.get(0)) {
            this.hideMenu();
        }
    },


    /********************************
     * DEBUGGING
     *******************************/
    printState: function() {
        var positions = [];
        for (var i=0;i<this.numberOfLayers;i++) {
            var top = this.layers[i].get(0).offsetTop;
            var bottom = top + this.layers[i].get(0).offsetHeight;
            var entry = "layer #" + i + " at: (" + top + " - " + bottom + ")"

            entry += " with events (" + $("em.pos:first", this.layers[i]).text() + " - " + $("em.pos:last", this.layers[i]).text() + ")";
            positions.push(entry);
        }
        this.logger.log("current state - all positions\n" + positions.join("\n"));
    }

});
