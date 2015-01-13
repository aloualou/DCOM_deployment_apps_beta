require.config({
    paths: {
        text: '../app/SA-Utils/js/lib/text',
        console: '../app/SA-Utils/js/util/Console'
    }
});

define(['underscore', 'splunkjs/mvc', 'jquery', 'splunkjs/mvc/simplesplunkview', 'text!../app/SA-Utils/js/templates/KeyIndicatorResults.html', "css!../app/SA-Utils/css/KeyIndicator.css", "console"],
function(_, mvc, $, SimpleSplunkView, KeyIndicatorTemplate) {
    
    // Assign static variables that indicate the status of the associated search
    var stateNotStarted = 0;
    var stateDispatched = 1;
    var stateRendered = 2;
    var stateError = 3;
     
    // Define the custom view class
    var KeyIndicatorView = SimpleSplunkView.extend({
        className: "KeyIndicatorView",
        
        initialize: function() {
        	this.search = this.options.search;
        	this.result = null;
        	
        	this.state = stateNotStarted;
        	this.isDeleted = false;
        	this.threshold = null; // This is only set if the user has modified the value
        },
        
        events: {
            "click .delete": "remove",
            "blur .threshold": "setThreshold" //Don't use onchange, this breaks Internet Explorer since it won't let users get focus on the input after re-rendering
        },
        
        /**
         * Render the key indicator according to its current state.
         */
        render: function() {
        	
        	// The search is dispatched
        	if( this.state == stateDispatched ){
        		this.renderLoadingContent();
        	}
        	
        	// We got the results, time to render them
        	else if( this.state == stateRendered ){
        		this.renderResultContent();
        	}
        	
        	// The key indicator has not yet been started
        	else if( this.state == undefined || this.state == stateNotStarted ){
        		this.renderPendingContent();
            }
        	
        	// Otherwise, render an error
        	else{
        		this.renderUnableToLoadContent();
        	}
        	
            return this;
        },
        
        /**
         * Determine if the search was dispatched.
         */
        wasDispatched: function(){
        	return this.state >= stateDispatched;
        },
        
        /**
         * Determine if the key indicator was told to get the results.
         */
        gettingResults: function(){
        	return this.wasDispatched();
        },
        
        /**
         * Determine if we are done rendering.
         */
        doneRendering: function(){
        	return this.state >= stateRendered;
        },
        
        /**
         * Get human readable number.
         */
        getHumanReadableNumber: function( num ){
        	
        	var units= "";
        	var num_abs = Math.abs(num);

        	if( num_abs >= 1000000000000 ){
        		num = num / 1000000000000;
        		units="T";
        	}
        	else if( num_abs >= 1000000000 ){
        		num = num / 1000000000;
        		units="B";
        	}
        	else if( num_abs >= 1000000 ){
        		num = num / 1000000;
        		units="M";
        	}
        	else if( num_abs >= 1000 ){
        		num = num / 1000;
        		units="k";
        	}
        	
        	if( num_abs >= 100 ){
        		num = Math.round(num);
        	}
        	else{
        		num = Math.round(num * 10) / 10;
        	}
        	
        	return num + units;
        },
        
        /**
         * Determine if the value is a valid integer
         */
        isValidInteger: function(might_be_number){
        	
        	var reg = /^-?\d+$/;
        	
        	return reg.test(might_be_number);
        	
        },
        
        /**
         * Determine if the threshold that was set from the user-interface is valid.
         */
        isThresholdFormValueValid: function(){
        	
        	// Get the set value
        	var new_threshold = this.getThresholdFormValue();
        	
        	// Validate the value
        	if( new_threshold.length > 0 && !this.isValidInteger(new_threshold) ){
        		return false; //Value did not validate
        	}
        	
        	return true;
        	
        },
        
        /**
         * Get the threshold defined in the editing interface.
         */
        getThresholdFormValue: function(){
        	return $('.threshold', this.$el).val();
        },
        
        /**
         * User has changed the threshold value. When this is changed, this function will:
         * 
         * 1) Validate the value
         * 2) Store the modified value 
         * 3) Re=render the key indicator
         */
        setThreshold: function(){
        	
        	// Persist the value. It may seem to be odd to persist the value before validating it
        	// but we need to do this so that the value will be displayed when we re-render the
        	// interface. We will highlight the fact that the threshold is invalid in the UI and
        	// prevent the value from being saved so storing the value now even if it is invalid
        	// is ok.
        	this.threshold = this.getThresholdFormValue();
        	
        	// Re-render the view so that threshold change is represented in the view (the value changes color)
        	this.render();
        	
        	/*
        	if( $.browser.msie ){
        		// Don't re-render in Internet Explorer. For some reason, IE won't let users click into the input box if the input box is re-rendered.
        		// Instead, just highlight the invalid input
        		this.highlightInvalidInput();
        	}
        	else{
        		this.render();
        	}
        	*/
        	
        },
        
        /**
         * Highlight the input fields as invalid if they are incorrect. Otherwise, hide the text indicating that the input is invalid.
         */
        highlightInvalidInput: function(){
        	
            // Note that the threshold is invalid if it is
        	if( !this.isThresholdFormValueValid() ){
        		$('.threshold-holder', this.$el).addClass('error');
        	}
        	
        	// Otherwise, hide the error
        	else{
        		$('.threshold-holder', this.$el).removeClass('error');
        	}
        },
        
        /**
         * Render content based on the search result
         */
        renderResultContent: function(){
        	
        	fields = this.result.results[0];
        	
        	var threshold = this.getFloatFromActionOrResult("threshold", "action.keyindicator.threshold", this.search, fields, false);
        	var threshold_orig = this.threshold;
        	
        	// If a user-defined threshold was set, then use this value
        	if( this.threshold === null && isNaN(threshold) ){
        		threshold_orig = "";
        	}
        	else if( this.threshold === null ){
        		threshold_orig = threshold;
        	}
        	else if( this.isValidInteger(this.threshold) ){
        		threshold = parseInt(this.threshold, 10);
        	}
        	
            var value_field_name = this.getFromActionOrResult("value", "action.keyindicator.value", this.search, fields, "value");
            var delta_field_name = this.getFromActionOrResult("delta", "action.keyindicator.delta", this.search, fields, "delta");
            var drilldown_uri = this.getFromActionOrResult("drilldown_uri", "action.keyindicator.drilldown_uri", this.search, fields, undefined);
            
            var invert = this.getBooleanFromActionOrResult("invert", "action.keyindicator.invert", this.search, fields, false);
            var title = this.getFromActionOrResult("title", "action.keyindicator.title", this.search, fields, "");
            var subtitle = this.getFromActionOrResult("subtitle", "action.keyindicator.subtitle", this.search, fields, "");
            
            var value_suffix = this.getFromActionOrResult("value_suffix", "action.keyindicator.value_suffix", this.search, fields, "");
            
            var value = "";
            var delta = "";
            
            if( fields != undefined ){
                value = this.getFloatValueOrDefault(fields[value_field_name], "Unknown");
                delta = this.getValueOrDefault(fields[delta_field_name], "");
            }
        	
            // Render the template
            this.$el.html( _.template(KeyIndicatorTemplate,{
    			title: title,
    			subtitle: subtitle,
    			drilldown_uri: drilldown_uri,
    			value_suffix: value_suffix,
    			value: value,
    			value_readable: this.getHumanReadableNumber(value),
    			delta: parseFloat(delta, 10),
    			delta_readable: this.getHumanReadableNumber(parseFloat(delta, 10)),
    			invert: invert,
    			threshold: threshold,
    			threshold_orig: threshold_orig
            }) );
            
            // Note that the threshold is invalid if it is
        	this.highlightInvalidInput();
    		
            // Wire up the delete button
    		$(document).on('click', '#' + this.id + " .delete", function() {
    			this.remove();
    		}.bind(this));

        	
        },
        
        /**
         * Render content indicating that are loading the results from a search.
         */
        renderLoadingContent: function(){
        	this.$el.html( '<div class="KP-holder loading">Loading...</div>' );
        },
        
        /**
         * Render content indicating that the search content could not be loaded
         */
        renderUnableToLoadContent: function(){
        	this.$el.html( '<div class="KP-holder KP-indicators-no-results">Unable to load results</div>' );
        },
        
        /**
         * Render content indicating that we could not load the results
         */
        renderPendingContent: function(){
        	this.$el.html( '<div class="KP-holder pending">Pending...</div>' );
        },
        
        /**
         * Return the the value if it is defined; otherwise, return the default value.
         */
        getValueOrDefault: function( value, default_value){
            
            if( value == undefined ){
                return default_value;
            }
            else{
                return value;
            }
            
        },
        
        /**
         * Return the the value if it is defined; otherwise, return the default value. Also, convert the value to a float.
         */
        getFloatValueOrDefault : function( value, default_value){
            value = this.getValueOrDefault( value, default_value);
            
            return parseFloat( value, 10 );
        },
        
        
        /**
         * Trim whitespace from a string
         */
        trim: function(str) 
        {
        	if( str === undefined || str === null){
        		return str;
        	}
        	else{
        		return String(str).replace(/^\s+|\s+$/g, '');
        	}
        },
        
        /**
         * Return the the value if it is defined; otherwise, return the default value. Also, convert the value to a boolean.
         */
        getBooleanValueOrDefault : function( value, default_value){
            value = this.getValueOrDefault( value, default_value);
            
            
            if( value === true || value === false ){
                return value;
            }
            else if( value === undefined || value === null ){
                return false;
            }
            
            value = this.trim(value).toLowerCase();
            
            if(value == "true" || value == "t" || parseInt(value, 10) > 0){
                return true;
            }
            else{
                return false;
            }
            
        },
        
        /**
         * Substitute items items in the string based on the values in the fields.
         */
        substituteVariablesFromResult : function( str, fields ){
        	
        	// Don't try to perform substitution if the string is not a string
        	if (str === undefined || str === null){
        		return str;
        	}
        	
        	// Substitute the values
        	for (var field in fields) {
        		
        		var value = fields[field];
        		
        		str = str.replace("$" + field + "$", value);
        	}
        	
        	return str;
        	
        },
        
        /**
         * Return the value of the field from either (in order):
         *  1) the key indicator alert action associated with the saved search
         *  2) the field in the results
         *  3) the default value
         */
        getFromActionOrResult : function ( field_name, action_field_name, search, fields, default_value ){
            
        	var value = "";
        	
            if( search.content[action_field_name] !== undefined ){
            	value = search.content[action_field_name];
            }
            else if( fields === undefined ){
                value = default_value;
            }
            else if( fields[field_name] !== undefined ){
            	value = fields[field_name];
            }
            else{
            	value = default_value;
            }
            
            return this.substituteVariablesFromResult(value, fields);
            
        },
        
        /**
         * Same as getFromActionOrResult except that this converts the the returned value to a boolean.
         */
        getBooleanFromActionOrResult : function( field_name, action_field_name, search, fields, default_value ){
            return this.getBooleanValueOrDefault( this.getFromActionOrResult( field_name, action_field_name, search, fields, default_value ), default_value );
        },
        
        /**
         * Same as getFromActionOrResult except that this converts the the returned value to a float.
         */
        getFloatFromActionOrResult : function( field_name, action_field_name, search, fields, default_value ){
        	return this.getFloatValueOrDefault( this.getFromActionOrResult( field_name, action_field_name, search, fields, default_value ), default_value );
        },
        
        /**
         * Get the search results from Splunk and render accordingly
         */
        updateWithResults: function(){
        	
        	// If we don't have a search ID, then don't try to dispatch the search
        	if( this.sid === undefined || this.sid === null ){
        		return;
        	}
        	
    		var params = new Object();
    		params.output_mode = 'json';
    		var uri = Splunk.util.make_url('/splunkd/__raw/services/search/jobs/', this.sid, '/results');
    		uri += '?' + Splunk.util.propToQueryString(params);
    		
    		jQuery.ajax({
    			url:     uri,
    			type:    'GET',
    			cache:    false,
    			success: function(result, textStatus, jqXHR ) {
	    				
	    			    if(result !== undefined && result.isOk === false){
	    			    	alert(result.message);
	    		        }
	    			    else if( result !== undefined && result !== "" && !result.preview && result !== undefined && jqXHR.status == 200 ){
	    			    	this.result = result;
	    			    	this.state = 2;
	    			    	this.render();
	    			    }
    				}.bind(this),
    			error: function(jqXHR,textStatus,errorThrown) {
                        console.warn("Unable to get the search results");
                        this.state = 3;
                        this.render();
                	}.bind(this),
    			async:   true
    		});
        	
        },
        
        /**
         * Get the dispatched search from the history
         */
        getDispatchedSearchFromHistory: function(){
        	
        	var params = new Object();
            params.output_mode = 'json';
            params.count = '1';
            params.search = 'isScheduled=1 AND isDone=1 AND isRealTimeSearch=0'; // Only get completed searches that were scheduled (not ad-hoc)
            
            var uri = Splunk.util.make_url('/splunkd/__raw/services/saved/searches/', encodeURIComponent(this.search.name), '/history');
            uri += '?' + Splunk.util.propToQueryString(params);
            
            var search_results_id = null;
            
            jQuery.ajax({
                url:     uri,
                type:    'GET',
                cache:   false,
                success: function(result) {
                     if(result !== undefined && result.isOk === false){
                         alert(result.message);
                     }
                     else if(result !== undefined){
                         search_results_id = result.entry[0].name;
                     }
                     
                     this.state = 1; //stateDispatched;
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                     sid = null;
                     console.error("Unable to get search results: " + this.search.name);
                     this.state = 3;
                }.bind(this),
                async:   false
            });
            
            return search_results_id;
            
        },
        
        /**
         * Get the existing search results
         */
        getExistingResults: function(){
        	
        	// Determine if the search is scheduled
        	if( this.search.content.is_scheduled ){
        		this.getDispatchedSearchFromHistory();
        	}
        	
        },
        
        /**
         * Kick off the process of getting results
         */
        startGettingResults: function(){
        	
        	var dispatched_search_exists = false;
        	
        	// Determine if the search is scheduled, get the historical results if so
        	if( this.search.content.is_scheduled ){
        		
        		this.sid = this.getDispatchedSearchFromHistory();
        		
        		if(this.sid !== null){
        			console.info("Results for key indicator will be loaded from scheduled search results (" + this.search.name + ")");
        			this.render();
        			return this.sid;
        		}
        	}
        	
        	// No historical search results existed; dispatch the search.
        	return this.dispatchSearch();
        	
        },
        
        /**
         * Dispatch the search so that it can begin obtaining results.
         */
        dispatchSearch: function(){
        	
            var params = new Object();
            params.output_mode = 'json';
            
            var uri = Splunk.util.make_url('/splunkd/__raw/services/saved/searches/', encodeURIComponent(this.search.name), '/dispatch');
            uri += '?' + Splunk.util.propToQueryString(params);

            var sid = null;
            
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                cache:   false,
                success: function(result) {
                     if(result !== undefined && result.isOk === false){
                         alert(result.message);
                     }
                     else if(result !== undefined){
                         this.sid = result.sid; 
                     }
                     
                     this.state = 1; //stateDispatched;
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                     sid = null;
                     console.error("Unable to dispatch search: " + this.search.name);
                     this.state = 3;
                }.bind(this),
                async:   false
            });
            
        	this.render();
            return sid;
        },
        
        /**
         * Remove the given indicator
         */
        remove: function(){
        	this.$el.remove();
        	this.isDeleted = true;
        },
        
        /**
         * Indicates if the indicator is in a state that the value can be saved. This is oftentimes false when the user defined a value in the
         * editing interface is invalid and the user needs to be prompted to change it.
         */
        readyToBeSaved: function(){
        	if( !this.isThresholdFormValueValid() ){
        		return false;
        	}
        	else{
        		return true;
        	}
        }
        
    });
    
    return KeyIndicatorView;
});
