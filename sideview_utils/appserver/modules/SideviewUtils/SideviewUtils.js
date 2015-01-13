// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

var Sideview = {};

Sideview.customBehaviors = {};
Sideview.registeredCustomBehaviors = {};  //DEPRECATED as of 1.3

Sideview.utils = {
    _consoleWindow:null,
    _consoleDocument:null,
    _consoleBody : null,
    _currentVersion : "1.3.5",
    customTimeRanges: [],
    
    endsWith: function(str, pattern) {
        var d = str.length - pattern.length;
        return d >= 0 && str.lastIndexOf(pattern) === d;
    },

    getModule: function(moduleId) {
        try {
            return Splunk.Globals.ModuleLoader.getModuleInstanceById(moduleId);
        } catch(e) {
            console.error(e)
        }
        return false;
    },

    getModuleFromDOMElement: function(el) {
        el = $(el);
        if (el.hasClass("SplunkModule")) {
            return Sideview.utils.getModule(el.attr("id"));
        } else if (el.parent()){
            return Sideview.utils.getModuleFromDOMElement(el.parent());
        }
    },

    /**
     * supercedes Splunk.util.objectSimilarity()
     */
    compareObjects: function(x,y) {
        for(p in y){
            if(typeof(x[p])=='undefined') {return false;}
        }
        for(p in y) {
            if (y[p]) {
                switch(typeof(y[p])) {
                        case 'object':
                                if (typeof(y[p].equals)=="function") {
                                    if (!y[p].equals(x[p])) return false; 
                                } 
                                if (typeof(y[p].join)=="function") {
                                    if (y[p].join("-x-")!=x[p].join("-x-")) return false; 
                                }
                                break;
                        case 'function':
                                if (typeof(x[p])=='undefined' || (p != 'equals' && y[p].toString() != x[p].toString())) return false; 
                                break;
                        default:
                                if (y[p] != x[p]) return false;
                }
            }
            else if (x[p]) {
                return false;
            }
        }
        for(p in x) {
            if(typeof(y[p])=='undefined') return false;
        }
        return true;
    },

    /**
     * given a URL-encoded string, get back a dictionary.
     * Splunk.util queryStringToProp is lame in that it does not account for 
     * multivalued arguments. This does, and that feature is somewhat 
     * essential, eg for prepopulating multiple-selection Pulldown modules.
     */
    stringToDict: function(s) {
        var dict = {};
        if (s.length==0 || s.indexOf("=")==-1) return dict;
        var conjoinedTwins = s.split('&');
        var key, value, twins, heesAlreadyGotOne;
        for (var i=conjoinedTwins.length-1; i>=0; i--) {
            twins = conjoinedTwins[i].split('=');
            key = decodeURIComponent(twins.shift());
            value = decodeURIComponent(twins.shift());
            heesAlreadyGotOne = dict.hasOwnProperty(key);
            if (heesAlreadyGotOne) {
                if (typeof(dict[key])=="object") {
                    dict[key].push(value)
                } else {
                    var old = dict[key]
                    dict[key] = [old,value];
                }
            } else {
                dict[key] = value;
            }
        }
        return dict;
    },

    dictToString: function(dict) {
        var s = [];
        var singleValue, valueArray, i, len;
        for (key in dict) {
            if (dict.hasOwnProperty(key)) {
                if (typeof(dict[key])=="object") {
                    var valueArray = dict[key];
                    for (i=0,len=valueArray.length; i<len; i++) {
                        singleValue = valueArray[i];
                        s.push(encodeURIComponent(key)+"="+encodeURIComponent(singleValue));
                    }
                } else {
                    var singleValue = dict[key];
                    s.push(encodeURIComponent(key)+"="+encodeURIComponent(singleValue));
                }
            }
        }
        return s.join("&");
    },

    contextToQueryString: function(context) {
        var keys = [];
        for (key in context._root) {
            if (context.has(key)) keys.push(key);
        }
        keys = keys.sort();

        var text = [];
        var endsWith = Sideview.utils.endsWith;
        for (var i=0,len=keys.length;i<len;i++) {
            var key = keys[i];
            if ((!key) || key=="search" || key=="autoRun" || key=="search.name") continue;
            if (key.indexOf("search.timeRange.")==0) continue;
            if (endsWith(key,".label") || endsWith(key,".rawValue") || endsWith(key,".element") || endsWith(key,".callback") || endsWith(key,".value") || endsWith(key,".onEditableStateChange") || endsWith(key, ".onSelectionSuccess")) continue;
            
            var value;
            if (context.has(key + ".rawValue")) {
                value = context.get(key + ".rawValue") || "";
            } else {
                value = context.get(key) || "";
            }
            text.push(encodeURIComponent(key.toString()) + "=" + encodeURIComponent(value.toString()));
        }
        return text.join("&");
    },

    contextIsNull: function(context) {
        return $.isEmptyObject(context._root);
    },

    launchConsole: function(focus) {
        focus = focus || false;
        var debugPopup = window.open('about:blank', 'sideview_console', 'toolbar=no, directories=no, location=no, status=yes, menubar=no, resizable=yes, scrollbars=yes, width=1200, height=800');
        debugPopup.document.writeln('<html><head><title>Console</title></head><body onload="opener.Sideview.utils.registerConsole(window,document, \'' + focus + '\')">Loading...</body></html>');
        debugPopup.document.close();
    },

    registerConsole: function(consoleWindow, consoleDocument, focus) {
        if (Splunk.util.normalizeBoolean(focus)) consoleWindow.focus();
        Sideview.utils._consoleWindow   = consoleWindow;
        Sideview.utils._consoleDocument = consoleDocument;
        Sideview.utils._consoleBody = $(consoleDocument).find("body");

        var ml = Splunk.Globals["ModuleLoader"];
        ml._withEachModule(ml._modules, function(module) {
            
            
            $(module.container).mouseover(function(evt) {
                
                var wob = $("<div>");
                var context = module.getContext();
                var modifiedContext = module.getModifiedContext();
                wob.append(
                    $("<h2>").text("Class = " + module.moduleType),
                    $("<h4>").text("Id = " + module.moduleId),
                    $("<h4>").text("parent class = " + ((module.parent) ? module.parent.moduleType : "(has no parent. This is a top level module)"))
                );

                if (module.parent) {
                    wob.append(
                        $("<h4>").text("parent id = " + module.parent.moduleId)
                    );
                }

                wob.append(
                    $("<h4>Search values</h4>")
                );
                var search = context.get("search");
                var text = [];
                text.push("search=" + search.toString());
                var range = search.getTimeRange()
                text.push("timeRange.toConciseString() = " + range.toConciseString());
                text.push("timeRange.earliest = " + range.getEarliestTimeTerms());
                text.push("timeRange.latest = " + range.getLatestTimeTerms());
                if (search.getSavedSearchName()) {
                    text.push("saved search name=" + search.getSavedSearchName());
                }
                wob.append(text.join("<br>"))


                
                var keys = [];
                var modifiedKeys = [];
                
                for (key in context._root) {
                    if (key=="search") continue;
                    if (context.has(key)) {
                        keys.push(key);
                    }
                }
                for (key in modifiedContext._root) {
                    if (key=="search") continue;
                    if (modifiedContext.has(key)) {
                        modifiedKeys.push(key);
                    }
                }
                for (var i=modifiedKeys.length-1;i>=0;i--) {
                    var key = modifiedKeys[i];
                    if (keys.indexOf(key)!=-1) {
                        delete modifiedKeys[i];
                    }
                }

                keys = keys.sort();
                modifiedKeys = modifiedKeys.sort();

                wob.append(
                    $("<h4>Context keys added/modified for downstream modules</h4>")
                );
                
                text = [];
                for (var i=0,len=modifiedKeys.length;i<len;i++) {
                    if (modifiedKeys[i]) {
                        text.push(modifiedKeys[i] + " = " + modifiedContext.get(modifiedKeys[i]));
                    }
                }
                wob.append(text.join("<br>"));

                wob.append(
                    $("<h4>Context values received from upstream</h4>")
                );
                text = [];
                for (var i=0,len=keys.length;i<len;i++) {
                    text.push(keys[i] + " = " + context.get(keys[i]));
                }
                wob.append(text.join("<br>"));

                Sideview.utils.log(wob, true);
            })
        });
    },

    log: function(htmlElement, replaceEntireBody) {
        replaceEntireBody = replaceEntireBody || false;

        if (Sideview.utils._consoleBody) {
            if (replaceEntireBody) Sideview.utils._consoleBody.html('');
            Sideview.utils._consoleBody.append(htmlElement);
            Sideview.utils._consoleBody.append($('<div style="border-top:1px solid #ccc"></div>'));
        } else {
            console.error("SV log called but there's no console");
            console.error(htmlElement);
        }
    },

    getLogger: function() {

        if (typeof(console)!="undefined" && typeof(console.error)!="undefined") {
            if (!console.debug) console.debug = console.info;
            return console;
        } 
        return Sideview.utils.getCustomLogger();
    },

    /** 
     * template method. Override in specific cases as necessary
     */
    getCustomLogger: function() {
        var c = {};
        c.error = c.warn = c.info = c.log = c.debug = function() {};
        return c;
    },

    /**
     * NEW CUSTOMBEHAVIOR METHODS 
     */

    /**
     * Called in the module constructors.  whatever the customBehavior
     * definition (function object) does to the modules will be done then.
     */
    applyCustomBehavior: function(module) {
        var behaviorClass = module.getParam("customBehavior");
        if (!Sideview.customBehaviors.hasOwnProperty(behaviorClass)) {
            Sideview.utils.registerCustomBehavior(module);
            return;
        }
        Sideview.customBehaviors[behaviorClass](module);
    },
    /**
     * NOT TO BE CALLED WITHIN DOCUMENT.READY()
     */ 
    declareCustomBehavior: function(behaviorClass, func) {
        if (Sideview.customBehaviors.hasOwnProperty(behaviorClass)) {
            alert('App error - a customBehavior can only be defined once. Two definitions for ' + behaviorClass + ' are defined in this app');
        }
        else {

            Sideview.customBehaviors[behaviorClass] = func;
        }
    },


    /**
     * LEGACY CUSTOMBEHAVIOR METHODS,  DEPRECATED as of 1.3
     * registerCustomBehavior was designed to be called after document.ready 
     * Unfortunately that also meant that they could be registered after the 
     * autoRun push had begin.  Therefore if you were using a customBehavior 
     * to stitch in special search language, that search language would 
     * "miss the boat" in many cases on the initial autoRun search. 
     * 
     */
    registerCustomBehavior: function(module) {    //DEPRECATED as of 1.3
        var behaviorClass = module.getParam("customBehavior");
        if (!Sideview.registeredCustomBehaviors.hasOwnProperty(behaviorClass)) {
            Sideview.registeredCustomBehaviors[behaviorClass] = [];
        }
        Sideview.registeredCustomBehaviors[behaviorClass].push(module);
    },

    getModulesByCustomBehavior: function(behaviorClass) {  //DEPRECATED as of 1.3
        if (!Sideview.registeredCustomBehaviors.hasOwnProperty(behaviorClass)) {
            alert("developer misconfiguration - there is no custom module behavior named " + behaviorClass + ". Possibly you are trying to get the reference before document.ready().");
            return [];
        }
        return $.extend(true, Sideview.registeredCustomBehaviors[behaviorClass], [])
    },

    forEachModuleWithCustomBehavior: function(behaviorClass, func) {  //DEPRECATED as of 1.3
        var logger = Sideview.utils.getLogger();
        logger.warn("forEachModuleWithCustomBehavior has been deprecated as of 1.3. You should use declareCustomBehavior instead. (customBehavior=" + behaviorClass + ")  See SVU docs.");
        if (Sideview.registeredCustomBehaviors.hasOwnProperty(behaviorClass)) {
            $.each(Sideview.utils.getModulesByCustomBehavior(behaviorClass), function(i, module) {
                func(i,module);
            });
        }
    },

    /**
     * given a template (containing $foo$ tokens), and a context, 
     * populate all the tokens from the context.  Including &name& as this.name
     * and $value$ as the passed value. This treatment of $name$ and $value$
     * is very common across Sideview modules.
     */
    templatize: function(context, template, name, value) {
        if (template && value) {
            var c = context.clone();
            c.set("name", name);
            c.set("value", value);
            c.set(name, value);
            return Sideview.utils.replaceTokensFromContext(template, c);
        } 
        return value;
    },

    escapeBackslashes: function(s) {
        if (!s) return s;
        return s.replace(/\\/g, "\\\\")
    },

    replacePlusSigns: function(s) {
        var decoded = [];
        for (var i=s.length;i>=0;i--) {
            if (s.charAt(i) == "+") {
                if (i>0 && s.charAt(i-1)=="+") {
                    decoded.unshift("+");
                    i--;
                } else {
                    decoded.unshift(" ");
                }
            }
            else decoded.unshift(s.charAt(i));
        }
        return decoded.join("");
    },

    /**
     * given a string containing zero or more "$foo$" tokens, 
     * replace each of the tokens with the context object's value for that 
     * token.  (ie replace $foo$ with context.get("foo"))
     * 
     * "$$" does not trigger dynamic replacement and instead 
     * gets replaced by a single literal "$" in the output.
     */
    replaceTokensFromContext: function(s, context) {
        if (!s) return "";
        var within = false;
        var currentTokenName = [];
        var out = [];
        
        for (var i=0,len=s.length;i<len;i++) {
            var ch = s.charAt(i);
            if (ch=="$") {
                within = !within;
                // check for '$$' to handle all those cases correctly.
                if (!within && i>0 && s.charAt(i-1)=="$") {
                    out.push("$");
                    continue;
                }
                // we just finished the token.
                if (!within) {
                    out.push(context.get(currentTokenName.join("")));
                    currentTokenName = [];
                }
            }
            else if (within) {
                currentTokenName.push(ch);
            }
            else {
                out.push(ch);
            }
        }
        return out.join("")
    },
    
    loadSavedSearch: function(ssWob) {
        var search = new Splunk.Search(ssWob["search"]);
        search.setSavedSearchName(ssWob.name);
        var range = new Splunk.TimeRange(ssWob["dispatch.earliest_time"], ssWob["dispatch.latest_time"]);
        search.setTimeRange(range);
        // NOTE - when we have our own module to replace HiddenSavedSearch
        //        and scheduler-dispatched jobs are coming through here
        //        we'll have to set this to false when we deal with the job
        //        and trigger jobResurrected etc..
        if (search.job) search.job.setAsAutoCancellable(true);

        return search;
    },

    setStandardTimeRangeKeys: function(context, fillExplicitAllTimeArgs, optionalSearch) {
        var search = optionalSearch || context.get("search");
        if (!search) return context;
        var range = search.getTimeRange();
        var earliest = range.getEarliestTimeTerms();
        var latest = range.getLatestTimeTerms();
        if (fillExplicitAllTimeArgs) {
            latest=(!latest)? "all":latest;
            earliest=(!earliest || earliest==0)? "all":earliest;
        }
        context.set("search.timeRange.earliest", earliest);
        context.set("search.timeRange.latest",   latest);

        var stanza, header_label;
        // this loop only seems to add about 0.2ms if anyone else is keeping score.
        for (var i=0,len=Sideview.utils.customTimeRanges.length; i<len; i++) {
            stanza = Sideview.utils.customTimeRanges[i];
            if (stanza["earliest_time"] == earliest 
                    && stanza["latest_time"] == latest
                    && "header_label" in stanza) {
                header_label = stanza["header_label"];
                break;
            }
        }
        if (!header_label) header_label = range.toConciseString();
        context.set("search.timeRange.label", header_label);
        return context;
    },

    setStandardJobKeys: function(context, includePrefix, optionalSearch) {
        var search = optionalSearch || context.get("search");
        if (!search.isJobDispatched()) return context;
        var job = search.job;
        var pfx = (includePrefix && !job.isDone()) ? "&#8805;" : "";
        
        context.set("results.sid", job.getSID());
        
        context.set("results.count",pfx + job.getResultCount());
        context.set("results.eventCount", pfx + job.getEventCount());
        context.set("results.resultCount", pfx + job.getResultCount());
        context.set("results.scanCount", pfx + job.getScanCount());
        context.set("results.eventAvailableCount", pfx + job.getEventAvailableCount());
        context.set("results.eventFieldCount", pfx + job.getEventFieldCount());
        context.set("results.runDuration", (job._runDuration) ? (pfx + job._runDuration): "");
        
        // ugh. Somehow the backend got changed so as of 4.1.something this 
        // will sometimes be an ugly ISO time string. 
        /*
        if (job._createTime) {
            //Splunk.util.getEpochTimeFromISO(job._createTime);
            context.set("results.createTime", job._createTime);
        }
        // in some builds this will be another ISO string - beware.
        //Splunk.util.getEpochTimeFromISO(job.getCursorTime());
        context.set("results.cursorTime", job.getCursorTime());
        */
        
        return context;
    },

    getResultsFromJSON: function(jsonStr) {
        var results = JSON.parse(jsonStr);
        if (results.hasOwnProperty("results")) {
            results = results["results"];
        }
        return results;
    },

    /**
     *  little utility to resubmit the search that the given module is 
     *  loaded with.
     */
    resubmitSearch: function(module) {
        while (module.getContext().get("search").isJobDispatched()) {
            module = module.parent;
        }
        module.pushContextToChildren();
    },


    /**
     * version detection, to be used in the application.js files of dependent apps
     * and/or in the ModuleName.js files of dependent modules.
     * 
     * returns int. 
     * returns 0 if the versions are equal, -1 if v1<v2, and +1 if v1>v2
     */
    compareVersions: function(v1,v2) {
        var c1,c2,
            a1 = v1.split("."),
            a2 = v2.split(".");
        var len = Math.min(a1.length,a2.length);
        for (var i=0;i<len;i++) {
            c1 = parseInt(a1[i]);
            c2 = parseInt(a2[i]);
            if (c1 == c2) continue;
            else if (c1 < c2) return -1;
            else if (c1 > c2) return 1;
        }
        if (a1.length != a2.length) {
            if (a1.length > a2.length) return 1;
            else return -1;
        }
        return 0;
    },
    // USE THIS 98% OF THE TIME
    checkRequiredVersion: function(v2) {
        var ret = Sideview.utils.compareToCurrentVersion(v2);
        if (ret==-1) return false;
        return true;
    },
    // YOU PROBABLY DO NOT WANT TO USE THESE.
    compareToCurrentVersion: function(v2) {
        return Sideview.utils.compareVersions(Sideview.utils._currentVersion,v2);
    },
    getCurrentVersion: function() {
        return Sideview.utils._currentVersion;
    }
}

/**
 * Patch the Context class to give us a 'remove' method.
 */
Splunk.Context = $.klass(Splunk.Context, {
    logger: Splunk.Logger.getLogger("context.js"),
    _root : {},
    remove: function(key) {
        if (this.has(key)) {
            this.set(key,null);
            delete(this._root[key]);
        }
    }
});

/**
 * Patch the TimeRange class to support an explicit arg of 'all' for all_time
 */
if (Splunk.TimeRange) {
    // annoying static properties have to be preserved.
    var UTCRegex = Splunk.TimeRange.UTCRegex;
    var CORRECT_OFFSET_ON_DISPLAY = Splunk.TimeRange.CORRECT_OFFSET_ON_DISPLAY;
    var relativeArgsToString = Splunk.TimeRange.relativeArgsToString;
    Splunk.TimeRange = $.klass(Splunk.TimeRange, {
        toConciseString: function($super) {
            if (this._constructorArgs[0]=="all" && this._constructorArgs[1]=="all") {
                return _("over all time");
            }
            return $super();
        }
    });
    Splunk.TimeRange.UTCRegex = UTCRegex
    Splunk.TimeRange.CORRECT_OFFSET_ON_DISPLAY = CORRECT_OFFSET_ON_DISPLAY;
    Splunk.TimeRange.relativeArgsToString = relativeArgsToString;
}

/**
 * patch the Search class so that at the last second it doesnt actually send
 * 'all' as the 'all time' values for earliest/latest.  Instead send nothing.
 */
if (Splunk.Search) {
    var resurrectFromSearchId = Splunk.Search.resurrectFromSearchId;
    var resurrect = Splunk.Search.resurrect

    Splunk.Search = $.klass(Splunk.Search, {
        _startTransformedSearch: function($super, searchStr, onSuccess, onFailure, group) {
            var range = this.getTimeRange();
            if (range._constructorArgs[0]=="all" || range._constructorArgs[1]=="all") {
                for (var i=0;i<2;i++) {
                    if (range._constructorArgs[i]=="all") range._constructorArgs[i] = false;
                }
                this.setTimeRange(range.clone());
            }
            $super(searchStr, onSuccess, onFailure, group);
        },
        /**
         * IE is lame. Unless you redeclare toString it somehow wraps the object here 
         * with some internal toString implementation. 
         */
        toString: function() {
            return this._fullSearchWithIntentions || this._baseSearch;
        }
    });
    Splunk.Search.resurrectFromSearchId = resurrectFromSearchId;
    Splunk.Search.resurrect = resurrect;
}


/**
 * In addition to sneaking in the above utils object, we also modify and
 * normalize a couple things from within our module declaration.
 */
Splunk.Module.SideviewUtils = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        var retVal = $super(container);
        this.toneDownJobber();
        Sideview.utils.customTimeRanges = this.getParam("customTimeRanges");
        return retVal;
    },

    /**
     * tone down the Jobber's super aggressive defaults
     */
    toneDownJobber: function() {
        Splunk.Globals['Jobber'].MIN_POLLER_INTERVAL = 500;
        Splunk.Globals['Jobber'].MAX_POLLER_INTERVAL = 1500;
        Splunk.Globals['Jobber'].POLLER_CLAMP_TIME   = 3000;
    }
});

$(document).ready(function() {
    var qsDict = Splunk.util.queryStringToProp(document.location.search);
    if (qsDict.hasOwnProperty("showsvconsole") && Splunk.util.normalizeBoolean(qsDict["showsvconsole"])) {
        window.setTimeout("Sideview.utils.launchConsole(false);",0);
    }
})

// patching so that finally the logger works in Chrome.
if (!console.firebug) {
    Splunk.Logger.getLogger = Sideview.utils.getLogger;
}
