define(["underscore", "jquery", "splunkjs/mvc/d3chart/d3/d3.v2.min",
	"splunkjs/mvc/messages", "splunkjs/mvc/simplesplunkview", 
	"/en-US/static/app/SA-Utils/scripts/contrib/text.js!/en-US/static/app/splunk_for_vmware/components/memoryoverheadinfo/MemoryOverheadInfo.html",
	"css!./MemoryOverheadInfo.css"
	], 
	function (_, $, d3, Messages, SimpleSplunkView, MemInfoTemplate, MemInfoCSS) {
		//Define custom messages
		var custom_messages = {
			//Add a new message that runs as a template
			"invalid-x-field" : {
					icon: "warning-sign",
					level: "error",
					message_template: _.template("Could not find x_field=<%= text.x_field%> in results field set.", null, {variable: "text"}),
					message: "Could not find x_field in results field set."
			},
			//Add a new message
			"no-cheeseburger" : {
					icon: "warning-sign",
					level: "error",
					message: "But... but... i wantz cheeseburger, sad face :("
			},
			//Override a core Message
			"no-results" : {
					icon: "info-circle",
					level: "info",
					message: "Click a thing! CLICK ALL THE THINGS!"
				}
			};
		
		/*
		 * Complile your template for faster rendering (for crazy fast add in a
		 * variable name and use it in your template to avoid _.template's with statement)
		 */ 
		var compiled_template = _.template(MemInfoTemplate);
		
		var MemoryOverheadInfoView = SimpleSplunkView.extend({
			className: "memory-overhead-info",
			/*
			 * output_mode will set the results model's output format it asks
			 * splunkd for. json_rows is recommended since it will reduce the 
			 * response body significantly as it does not contain repeated field
			 * names.
			 * 
			 * resultOptions are sent to the constructor for the model. Typically 
			 * all we want to do is set teh time format so that we can have epoch
			 * instead of ISO. DO NOT configure an output_mode here, only the one
			 * at the root level of the view matters, you can cause weird silent 
			 * errors by setting it in resultOptions. 
			 */
			output_mode: "json_rows",
			resultOptions: { output_time_format: "%s.%Q" },
			/*
			 * Define your configuration options here. By convention, mandatory
			 * config properties should be here as undefined. Things with 
			 * defaults can have the defaults here.
			 */
			options: {
				data: "preview",
				//This will be your main search manager that is hooked into your rendering
				managerid: undefined
			},
			/*
			 * We overload displayMessage to include our own custom messages 
			 * with message text overloading. If you wish to use a message 
			 * template you must pass a text object with keys equal to the 
			 * template tokens to replace.
			 */
			 displayMessage: function(info, text) {
				this._viz = null;
				if (custom_messages.hasOwnProperty(info)) {
					var info_obj = _.clone(custom_messages[info]);
					if (text !== null && text !== undefined) {
						info_obj.message = info_obj.message_template.template(text, {variable: "text"});
					}
					Messages.render(info_obj, this.$el);
				}
				else {
					Messages.render(info, this.$el);
				}
				
				return this;
			},
			/*
			 * Note we overload initialize to shim in our initialization code. 
			 * You MUST still call the parent or you are going to be knee deep
			 * in doodie. Also note that the parent needs to be first.
			 */
			initialize: function() {
				SimpleSplunkView.prototype.initialize.apply(this, arguments);
				//My custom init stuff goes here
			},
			/*
			 * formatResults is called so you can access the resultsModel that
			 * actually talked to splunk. All you want to do here is package up
			 * things you need and return them. Typically you need not do 
			 * anything here, but if you wanted to see search messages and such
			 * this is where you would do it
			 * 
			 * Note we overload this method to include the field list because 
			 * we are using json_rows to save message size in the server 
			 * response. I also introduce the parse_error key to deal with 
			 * situations where you may not want to update based on the search 
			 * messsages.
			 * 
			 * If you use json you may not need this overloaded at all but I 
			 * leave it here for reference.
			 */
			formatResults: function(resultsModel) {
				if (!resultsModel) { 
					return {fields: [],
						rows: [[]],
						parse_error: true
						};
				}
				// First try the legacy one, and if it isn't there, use the real one.
				var outputMode = this.output_mode || this.outputMode;
				var data_type = this.data_types[outputMode];
				var data = resultsModel.data();
				//override to return fields as well, thus our data looks like: {fields: [fieldname1, fieldname2, ...], rows: [row1_array, row2_array, ...]}
				return this.formatData({
						fields: data.fields,
						rows: data[data_type],
						parse_error: false
					});
			},
			/*
			 * formatData accepts the return from formatResults and is meant to 
			 * handle formatting of the raw splunk data before handing it off 
			 * to your update function. 
			 * 
			 * Typical things you use this for would be: transforming splunk 
			 * results into a hierarchical structure, adding or transforming 
			 * the results based on some configuration, setting up subviews, 
			 * etc.
			 * 
			 * The return of this method is what is going to be passed as data 
			 * to updateView below.
			 */
			formatData: function(data) {
				var transformed_data = {parse_error: false};
				//Get the row we care about
				var colNames = ["num_hosts", "p_average_clusterServices_effectivemem_kiloBytes", "mem_consumed_per_vm", "mem_overhead_per_vm", "actual_num_vms", "additional_vms", "name"];
				for (var i=0; i<colNames.length; i++) {
					var index = _.indexOf(data.fields, colNames[i])
					if (index >= 0){
						transformed_data[colNames[i]] = data.rows[0][index];
					} else {
						console.log("Column name " + colNames[i] +" is not found in the resultset")
						transformed_data.parse_error = true;
					}
				}
				return transformed_data;
			},
			/*
			 * createView is called to "initialize your viz library." It's main 
			 * use is to set up some container html that you only want to 
			 * happen once. Note that you should not set up your html in the
			 * intialize as displaying messages will destroy your html. You can
			 * also use this method to save some selectors or other useful 
			 * things.
			 * 
			 * The return of this function will be passed to updateData below 
			 * as viz and stored internall as this._viz. Note that this._viz 
			 * will be overridden any time a message is displayed. Typically 
			 * this is a result of a manager change.
			 */
			createView: function() {
				return {};
			},
			updateView: function(viz, data) {
				if (data.parse_error) {
					return;
				}
				//RENDER THE THINGS!
				this.$el.html(compiled_template(data));
			}
		});
		
		//Note you must return your view at the end
		return MemoryOverheadInfoView;
	}
);