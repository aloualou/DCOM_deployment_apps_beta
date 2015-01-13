// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.Pulldown= $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.name = this.getParam("name");
        this.allowsMultiple = (parseInt(this.getParam("size")) > 1)
        
        this.searchFields = this.getParam('searchFieldsToDisplay') || [];
        this.staticFields = this.getParam('staticFieldsToDisplay') || this.getDefaultStaticFields();
        // we use this flag to keep track of whether we're still loading data.
        this.inFlight = this.searchFields.length > 0;
        this.hasClearedURLLoader = false;

        this._selectedValueToApply = false;

        this.select = $('select', this.container)
            .bind("change", this.onChange.bind(this));
        
        this.initialSelection = this.select.val();

        // local properties used if/when we display progress
        this.selectWidth  = 0;
        this.progressBar  = $(".progressTop", this.container);

        this.setFloatingBehavior();
        this.checkConfig();
        
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },


    
    /**
     * certain templates are encoded such that '+' signs are interpreted as
     * spaces.  This is to workaround a problem in splunk's view config system
     * whereby leading and trailing spaces will be trimmed on module params.
     */
    getParam: function($super, name) {
        if (name=="outerTemplate" || name=="separator") {
            var orig = $super(name);
            if (!orig) return orig;
            return Sideview.utils.replacePlusSigns(orig);
        }
        return $super(name);
    },

    /**
     * overall function to check for configuration errors.
     */
    checkConfig: function() {
        this.checkNameConfig();
        this.checkFieldsConfig();
        this.checkMultipleSelectionConfig();
    },

    /**
     * make sure the 'name' param is OK.
     */
    checkNameConfig: function() {
        if (this.name=="search") alert(this.moduleType + " Error - you do not want to set Pulldown's 'name' param to a value of 'search' as this will disrupt underlying functionality in Splunk.");
    },
    
    /**
     * make sure the fields params are OK.
     */
    checkFieldsConfig: function() {
        try {
            if (this.searchFields.length==0 && this.staticFields.length ==0) {
                alert("ERROR - Pulldown MUST be configured with at least one static or dynamic value.");
            } else if (this.staticFields.length==1 && this.searchFields.length==0) {
                alert("ERROR - Pulldown is configured statically but with only a single static option.");
            } else if (this.searchFields.length==0 && this.getParam("postProcess")) {
                alert("ERROR - Pulldown is configured with a postProcess param but no search fields. One of these is a mistake.");
            }
        } catch(e) {
            alert("ERROR - unexpected exception during Pulldown.checkFieldsConfig. Look for typos in searchFieldsToDisplay or staticFieldsToDisplay.");
            console.error(e);
        }
    },

    /**
     * Certain params only take effect if size>1.  Make sure they're not set 
     * otherwise.
     */
    checkMultipleSelectionConfig: function() {
        if (this.allowsMultiple) {
            var p = ["outerTemplate", "separator"];
            for (var i=0,len=p.length;i<p;i++) {
                if (this.getParam(p[i])) {
                    alert("ERROR - in the Pulldown module, the " + p[i] + " param is only applicable when size is set to 2 or greater.  Since size is currently set to " + this.getParam("size") + ", you should omit this parameter.")
                }
            }
            if (!this.getParam("outerTemplate") || ("" + this.getParam("outerTemplate")).length==0) {
                alert("ERROR - you do not want to set Pulldown's outerTemplate param to an empty string as this means the Pulldown will never output any value besides emptystring. ");
            }
        }
    },

    /**
     * sets floats and clears as determined by the config.
     */
    setFloatingBehavior: function() {
        // unfortunately a module's mako template cannot control its *own* 
        // container div.  So we are forced to float it here.
        if (this.getParam("float")) {
            $(this.container).css("margin-right", "10px");
            $(this.container).css("float", this.getParam("float"));
        }
        if (this.getParam("clear")) {
            $(this.container).css("clear", this.getParam("clear"));
        }
    },

    /**
     * if the module is configured dynamically then we have to trigger 
     * a new dispatched search. Note that we actually defer to 
     * DispatchingModule to calculate it.
     */
    requiresDispatch: function($super, context) {
        if (this.searchFields.length==0) return false;
        else return $super(context);
    },

    /** 
     * see comment on DispatchingModule.requiresTransformedResults
     */
    requiresTransformedResults: function() {
        return true;
    },

    /**
     * If the configuration refers to a field, and we're triggering a dispatch, 
     * we tell the framework to put the field(s) into the requiredFields list 
     * on the job before it gets kicked off.
     */
    onBeforeJobDispatched: function(search) {
        var fieldsStr = this.getParam("requiredFields");
        var fields = [];
        if (fieldsStr || this.searchFields.length>0) {
            var c = this.getContext().clone();
            c.set("name", this.getParam("name"));
            if (fieldsStr) {
                fields = Sideview.utils.replaceTokensFromContext(fieldsStr, c).split(",");
            } else {
                var value = Sideview.utils.replaceTokensFromContext(this.searchFields[0].value, c);
                var label = Sideview.utils.replaceTokensFromContext(this.searchFields[0].label, c);
                fields.push(value);
                if (label && fields.indexOf(label)==-1) {
                    fields.push(label);
                }
            }
        }
        if (fields.length>0) {
            search.setMinimumStatusBuckets(1);
            search.setRequiredFields(fields);
        }
    },

    /**
     * pulled out as a template method partly so that it can be easily 
     * overridden if necessary in custom config.
     */
    getDefaultStaticFields: function() {
        return [{label:"All", value:"*"}];
    },

    /** 
     * get a dictionary of our search fields. keys are 'label' and 'value'.
     */
    getFields: function() {
        if (this.searchFields.length>0) {
            var value = this.searchFields[0].value;
            var label = this.searchFields[0].label || value;

            // do a quick token replacement.
            var c = this.getContext().clone();
            c.set("name", this.name);
            value = Sideview.utils.replaceTokensFromContext(value, c);
            label = Sideview.utils.replaceTokensFromContext(label, c);

            return {
                "value" : value,
                "label" : label
            }
        }
        return {};
    },

    /** 
     * This template method in the module framework allows us to tell the 
     * framework that we are "not ready" and so it will defer the push of 
     * our data to downstream modules until we ARE ready.
     */
    isReadyForContextPush: function($super) {
        if (this.inFlight) return Splunk.Module.DEFER;
        return $super();
    },

    /**
     * tell the URLLoader that we've absorbed their value so they dont keep 
     * telling us (and reselecting the value) over and over.
     */
    clearURLLoader: function(context) {
        context = context || this.getContext();
        // only do this once 
        if (!this.hasClearedURLLoader && context.has("sideview.onSelectionSuccess")) {
            var callback = context.get("sideview.onSelectionSuccess");
            callback(this.name, this);
            this.hasClearedURLLoader = true;
        }
    },

    setSelection: function(val) {
        if (val =="" && ($("option:first", this.select).val()=="")) {
            $("option:first", this.select).attr("selected","selected");
        } else this.select.val(val);
    },

    resetToDefault: function() {
        this.setSelection(this.initialSelection);
    },

    resetUI: function() {},
    
    setToContextValue: function(c) {
        var value = c.get(this.name + ".rawValue") || c.get(this.name);
        if (!value && value!="") return;
        if (this.searchFields.length>0) {
            this.select.val(value);
            if (this.select.val() != value) {
                this._selectedValueToApply = value;
            }
        } else {
            this.setSelection(value);
        }
    },

    /**
     * called when a module from upstream changes the context data
     */
    onContextChange: function() {
        var context = this.getContext();

        // handles purely dynamic config as well as the mixed case. 
        if (this.searchFields.length>0) {   
            var selectedOption = $('option:selected', this.select);
            // if a valid dynamic value is selected, we preserve the selection
            if (selectedOption.attr("value") && selectedOption.hasClass("dynamic")) {
                this._selectedValueToApply = this.select.val();
            }
            // if a valid static value was selected it's ok; it'll remain
            // selected in the DOM until renderResults and survive that too.

            // clear all the old dynamic options.
            this.select.find("option[class=dynamic]").remove();
            
            // add in our 'Loading...' text.
            var loadingOption = $("<option>")
                .addClass("dynamic")
                .text(_("Loading..."))
                .attr("value","")
            if (!this.allowsMultiple) {
                loadingOption.attr("selected", "selected")
            }
            this.select.append(loadingOption);

            this.selectWidth = this.getSelectWidth();
            
            // go get the fresh data.
            if (context.get("search").job.isDone()) {
                this.getResults();
            } else {
                this.inFlight = true;
            }
        // purely static configuration.
        } else {
            this.setToContextValue(context);
            this.clearURLLoader(context);
            
        }
        // if the label param contains $foo$ tokens we rewrite the label accordingly
        if (this.getParam("label") && this.getParam("label").indexOf("$")!=-1) {
            context.set("name", this.getParam("name"));
            var labelTemplate = this.getParam("label");
            $("label", this.container).text(Sideview.utils.replaceTokensFromContext(labelTemplate, context));
        }
    },

    

    /**
     * Given all the template, size, separator, outerTemplate params we might 
     * be dealing with, what is the final string value to send downstream.
     */
    getStringValue: function(context) {
        var template = this.getParam("template");
        
        if (this.allowsMultiple) {
            var values = this.select.val() || [];
            var templatizedValues = [];
            var value, templatizedValue;
            for (var i=0,len=values.length;i<len;i++) {
                // input from the user always gets backslash-escaped
                // when we assume it's destined for searches 
                value = Sideview.utils.escapeBackslashes(values[i]);
                templatizedValue = Sideview.utils.templatize(context, template, this.name, value);
                templatizedValues.push(templatizedValue);
            }
            var separator = this.getParam("separator") || "";
            var gluedValue = templatizedValues.join(separator);
            var outerTemplate = this.getParam("outerTemplate");
            // we do not escape slashes in the outer template. It's not input 
            // from the user. And to the extent that other $foo$ tokens will
            // be in here, they will have been backslashed upstream.
            return Sideview.utils.templatize(context, outerTemplate, this.name, gluedValue);
        } 
        else {
            var value = this.select.val() || "";
            // input from the user always gets backslash-escaped
            // when we assume it's destined for searches
            value = Sideview.utils.escapeBackslashes(value);
            if (!template || value=="") return value;
            return Sideview.utils.templatize(context, template, this.name, value);
        }
    },

    /**
     * called when a module from downstream requests new context data
     */
    getModifiedContext: function(context) {
        var context = context || this.getContext();
        
        context.set(this.name + ".label", $('option:selected', this.select).text());
        context.set(this.name + ".element", this.select);
        // we do not backslash escape rawValue, because we assume it is NOT 
        // destined for searches.  rawValue is for QS args and for labels.
        context.set(this.name + ".rawValue", this.select.val());

        var value = this.getStringValue(context);
        context.set(this.name + ".value", value);
        context.set(this.name, value);

        return context;
    },
    
    /**
     * called when we have to send new context data to downstream modules.
     */
    pushContextToChildren: function($super, explicitContext) {
        /* see notes in Checkbox.js */
        this.withEachDescendant(function(module) {
            module.dispatchAlreadyInProgress = false;
        });
        return $super(explicitContext);
    },
    
    onPassiveChange: function() {
        var context = this.getContext();
        if (context.has("sideview.onEditableStateChange")) {
            var callback = context.get("sideview.onEditableStateChange");
            callback(this.name, this.select.val(), this);
        }
    },

    /**
     * called when the user changes the pulldown's selected value.
     */
    onChange: function(evt) {
        if (this.isPageLoadComplete()) {
            // multiple selects are actually capable of actively selecting 
            // 'nothing' so make sure to 'forget' the last known selection.

            if (this.allowsMultiple && !this.select.val()) {
                this._selectedValueToApply = false;
            }
            this.onPassiveChange();
            this.pushContextToChildren();
        }
        this.clearURLLoader();
    },

    /*********************************
     * Methods about showing job progress
     *********************************/
    getSelectWidth: function() {
        var w = this.select.width();
        w += parseInt(this.select.css("padding-left"));
        w += parseInt(this.select.css("padding-right"));
        return w;
    },
    renderProgress: function(p) {
        this.progressBar.width(p * this.selectWidth);
        var offset = this.select.offset();
        this.progressBar.offset(offset);
    },
    onJobProgress: function() {
        this.progressBar.show();
        var search = this.getContext().get("search");

        this.renderProgress(search.job.getDoneProgress());
    },

    /**
     * called when the currently running job completes.
     */
    onJobDone: function() {
        if (this.searchFields.length>0) {
            this.getResults();
        }
        $(".progressTop").hide();
    },

    /** 
     * template method we expose that is to be called after rendering completes. 
     * this greatly simplifies some custom wiring use cases.
     */
    onRendered: function() {

    },

    /**
     * Goes and gets new results that we'll turn into our <option> values.
     */
    getResults: function($super) {
        this.inFlight = true;
        return $super()
    },

    /**
     * returns the URL used by the module to GET its results.
     */
    getResultURL: function(params) {
        var context = this.getContext();
        var search  = context.get("search");
        // sadly the getUrl method has a bug where it doesnt handle params
        // properly in the 'results' endpoint.
        var url = search.getUrl("results");
        params["count"] = this.getParam("count");

        if (this.getParam("postProcess")) {
            // we sneak in our own name so it can be referred to 
            // as $name$ in the postProcess param's value
            context.set("name", this.name);
            context.set("postProcess", search.getPostProcess() || "");
            var p = Sideview.utils.replaceTokensFromContext(this.getParam("postProcess"), context);
            params["search"] = p;
        }
        params["outputMode"] = "json";
        return url + "?" + Splunk.util.propToQueryString(params);
    },

    /**
     * We just use splunkWeb's proxy to splunkd, so the results will come back 
     * in XML format.  This method builds out <option> elements from that XML.
     */
    buildOptionListFromResults: function(jsonStr) {
        if (!jsonStr) {
            this.logger.warn("empty string returned in " + this.moduleType + ".renderResults ("+this.name+")");
            this.logger.debug(jsonStr);
            return;
        }
        // always returns a 2 element dictionary with 'label' and 'value'.
        var fieldDict = this.getFields();

        var results = Sideview.utils.getResultsFromJSON(jsonStr);
        var row, value, label;
        for (var i=0,len=results.length;i<len;i++) {
            row = results[i];
            value = row[fieldDict["value"]];
            label = row[fieldDict["label"]];
            if (!value && value!="") {
                this.logger.error("ERROR - a Pulldown (" + this.moduleId + ") received a result row that had no value for the value field (" + fieldDict["value"] + ").");
                value="";
                label="(no value found)";
            }
            else if (!label && label!="") {
                this.logger.warn("Pulldown received a result row that had no value for the label field (" + fieldDict["label"] + ").  Using the value field instead (" + fieldDict["value"] + ").");
                label = value;
            }
            
            this.select.append($("<option>")
                .addClass("dynamic")
                .text(label)
                .attr("value",value)
            );
        };
    },

    /** 
     * called each time we render our pulldown data from the server.
     */
    renderResults: function(jsonStr) {
        var context = this.getContext();
        // remember which value was selected before.

        // .val() gets a little too clever and evals to true, 
        // so we check for this and flatten it to a string
        var fValue = this.select.val();
        if (fValue && fValue.toString()=="") fValue="";

        var value = this._selectedValueToApply 
             || fValue
             || context.get(this.name + ".rawValue") 
             || context.get(this.name)

        // clear the old dynamic options again. Although in practice this just
        // clears out the 'Loading...' option because the others will already 
        // have been cleared during getResults.
        this.select.find("option[class=dynamic]").remove();
        var runSelectWidthPatchForIE = ($.browser.msie && !this.getParam("width"));
        if (runSelectWidthPatchForIE) {
            this.select.css("width", "auto");
        }
        this.buildOptionListFromResults(jsonStr);
        if (value) {
            this.select.val(value);
            if (this.select.val() == this._selectedValueToApply || this.select.val()==value) {
                this.clearURLLoader(context);
                this._selectedValueToApply = false;

            } 
        }
        this.inFlight = false;
        if (runSelectWidthPatchForIE) {
            this.select.width(this.select.width()+10);
        }
        this.onRendered();
        this.pushContextToChildren();
    },

    /**
     * called when a module receives new context data from downstream. 
     * This is rare, and only happens in configurations where custom behavior
     * logic is sending values upstream during interactions, for TextField
     * and Pulldown instances to 'catch'. 
     */
     applyContext: function(context) {
        if (!this.isPageLoadComplete()) {
            this.logger.error(this.moduleType + " is not designed to work with the oldschool Search resurrection system.");
        }
        if (this.isPageLoadComplete() && context.has(this.name)) {
            var oldValue = this.select.val();
            var newValue = context.get(this.name);
            this.select.val(newValue);
            if (this.select.val() == newValue) {
                context.remove(this.name);
                this.onPassiveChange();
                if (Sideview.utils.contextIsNull(context)) {
                    this.pushContextToChildren();
                    // stop the upward-travelling context.
                    return true;

                }
            } else {
                this.select.val(oldValue);
            }
        }
     }
});
