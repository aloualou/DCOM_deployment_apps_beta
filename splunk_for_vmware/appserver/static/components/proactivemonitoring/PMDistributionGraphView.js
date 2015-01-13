define(["underscore", "jquery", "pm/contrib/d3/d3.amd", "splunkjs/mvc/messages", "splunkjs/mvc/simplesplunkview" ], 
	function (_, $, d3, Messages, SimpleSplunkView) {
		//Define custom messages, override all core messages to be compact
		var custom_messages = {
			'cancelled': {
				icon: "info-circle",
				level: "info",
				message: _("Search was cancelled.").t(),
				compact: true
			},
			'empty': {
				icon: "blank",
				level: "info",
				message: "",
				compact: true
			},
			'unresolved-search': {
				icon: "warning-sign",
				level: "error",
				message: _("Search query is not fully resolved.").t(),
				compact: true
			},
			'no-events': {
				icon: "info-circle",
				level: "info",
				message: _("Search did not return any events.").t(),
				compact: true
			},
			'no-results': {
				icon: "blank",
				level: "info",
				message: _("No results found.").t(),
				compact: true
			},
			'no-search': {
				icon: "info-circle",
				level: "info",
				message: _("No search set.").t(),
				compact: true
			},
			'no-stats': {
				icon: "warning-sign",
				level: "error",
				message: _("Search isn't generating any statistical results.").t(),
				compact: true
			},
			'not-started': {
				icon: "info-circle",
				level: "info",
				message: _("No search started.").t(),
				compact: true
			},
			'waiting': {
				icon: "blank",
				level: "info",
				message: _("Waiting for data...").t(),
				compact: true
			},
			'waiting-queued': {
				icon: "info-circle",
				level: "info",
				message: _("Waiting for search to start: job is queued.").t(),
				compact: true
			},
			'waiting-preparing': {
				icon: "info-circle",
				level: "info",
				message: _("Waiting for search to start: job is preparing.").t(),
				compact: true
			}
		};
		
		var DistributionGraph = SimpleSplunkView.extend({
			className: "proactive-monitoring-distribution-graph",
			tagName: "g",
			output_mode: "json_rows",
			resultOptions: { output_time_format: "%s.%Q" },
			options: {
				data: "preview",
				//The distribution search manager id
				managerid: undefined,
				//If overloaded will set the default message container (default is this.$el)
				message_container: undefined,
				color_scheme: undefined,
				//This is a reference to our chart controller
				chart_controller: undefined
			},
			colors: {
				dark: { 
					inner_fill: "#909090",
					outer_fill: "#7A7A7A"
				}, 
				light: { 
					inner_fill: "#D4D3D4",
					outer_fill: "#ECECEC"
				}
			},
			time_extent: undefined,
			y_extent: undefined,
			initialize: function(options) {
				//Default the color scheme to dark if it is not passed in 
				this.color_scheme = options.color_scheme === "light" ? "light" : "dark";
				this.message_container = options.message_container;
				this.chart_controller = options.chart_controller;
				SimpleSplunkView.prototype.initialize.apply(this, arguments);
			},
			/*
			 * We overload displayMessage to include our own custom messages 
			 * with message text overloading. If you wish to use a message 
			 * template you must pass a text object with keys equal to the 
			 * template tokens to replace.
			 * 
			 * In addition we allow for the control of the message container 
			 * with a default of this.$el. this._viz will not be destroyed if 
			 * container is specified.
			 */
			 displayMessage: function(info, text, container) {
				if (container === null || container === undefined) {
					container = this.$el;
					this._viz = null;
				}
				if (custom_messages.hasOwnProperty(info)) {
					var info_obj = _.clone(custom_messages[info]);
					if (text !== null && text !== undefined) {
						info_obj.message = info_obj.message_template(text, {variable: "text"});
					}
					Messages.render(info_obj, container);
				}
				else {
					Messages.render(info, container);
				}
				
				return this;
			},
			/*
			 * We overload _displayMessage to allow for a default container 
			 * other than our own $el.
			 */
			_displayMessage: function(info, text, container) {
				if ((container === undefined || container === null) && this.message_container !== undefined) {
					container = this.message_container;
				}
				return this.displayMessage(info, text, container);
			},
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
			 * formatData gives us our area shape makers 
			 */
			formatData: function(data) {
				var transformed_data = {parse_error: false};
				/*
				 * Our data must have the following fields:
				 * -> lower_quartile - defines the lower boundary of the inner stream
				 * -> upper_quartile - defines the upper boundary of the inner stream
				 * -> lower_extreme - defines the lower boundary of the outer stream
				 * -> upper_extreme - defines the upper boundary of the outer stream
				 * -> _time - defines the time axis/domain of the data
				 */
				//Get the fields we care about
				var time_index = _.indexOf(data.fields, "_time");
				var upper_quartile_index = _.indexOf(data.fields, "upper_quartile");
				var lower_quartile_index = _.indexOf(data.fields, "lower_quartile");
				var upper_extreme_index = _.indexOf(data.fields, "upper_extreme");
				var lower_extreme_index = _.indexOf(data.fields, "lower_extreme");
				
				var inner_stream_data = [];
				var outer_stream_data = [];
				var ii, row, datum, t, y0, y1;
				for (ii = 0; ii < data.rows.length; ii++) {
					row = data.rows[ii];
					t = row[time_index];
					
					y0 = row[lower_quartile_index];
					y1 = row[upper_quartile_index];
					if (_.isFinite(t) && _.isFinite(y0) && _.isFinite(y1)) {
						inner_stream_data.push([Number(t), Number(y0), Number(y1)]);
					}
					
					y0 = row[lower_extreme_index];
					y1 = row[upper_extreme_index];
					if (_.isFinite(t) && _.isFinite(y0) && _.isFinite(y1)) {
						outer_stream_data.push([Number(t), Number(y0), Number(y1)]);
					}
				}
				
				this.time_extent = d3.extent(outer_stream_data, function(d) { return d[0]; });
				this.y_extent = [_.min(outer_stream_data, function(d) { return d[1]; })[1], _.max(outer_stream_data, function(d) { return d[2]; })[2]];
				this.chart_controller.updateScales();
				
				transformed_data.inner_stream_data = inner_stream_data;
				transformed_data.outer_stream_data = outer_stream_data;
				
				return transformed_data;
			},
			/*
			 * createView sets up a d3 selector for the container g
			 */
			createView: function() {
				var d3stage = d3.select(this.$el.get(0));
				
				d3stage.append("path")
					.attr("class", "pm-distribution-outer-stream")
					.attr("fill", this.colors[this.color_scheme].outer_fill);
				d3stage.append("path")
					.attr("class", "pm-distribution-inner-stream")
					.attr("fill", this.colors[this.color_scheme].inner_fill);
				
				
				return {d3stage: d3stage};
			},
			updateView: function(viz, data) {
				if (data.parse_error) {
					return;
				}
				this._displayMessage("empty");
				//RENDER THE THINGS!
				this.chart_controller.renderGraphs();
			},
			/*
			 * OVERLOADED! 
			 * This method was overloaded to allow for the hiding of the old global chart as a new one is populating. 
			 */
			_onSearchStart: function() {
				if (this._viz !== null && this._viz !== undefined) {
					this._viz.d3stage.select("path.pm-distribution-outer-stream").attr("opacity", 1e-6);
					this._viz.d3stage.select("path.pm-distribution-inner-stream").attr("opacity", 1e-6);
				}
				this._isJobDone = false;
				this._displayMessage('waiting');
			},
			/*
			 * Method called by the chart controller when it is time to render 
			 * the data
			 */
			renderGraph: function() {
				if (this._data === undefined || this._data === null || this._viz === undefined || this._viz === null){
					return;
				}
				
				var chart_controller = this.chart_controller;
				var area = d3.svg.area()
					.x(function(d) { return chart_controller.time_scale(d[0]); })
					.y0(function(d) {return chart_controller.y_scale(d[1]); })
					.y1(function(d) {return chart_controller.y_scale(d[2]); });
				
				this._viz.d3stage.select("path.pm-distribution-outer-stream")
					.datum(this._data.outer_stream_data)
					.attr("d", area)
					.attr("opacity", 1);
				
				this._viz.d3stage.select("path.pm-distribution-inner-stream")
					.datum(this._data.inner_stream_data)
					.attr("d", area)
					.attr("opacity", 1);
			}
		});
		
		//Note you must return your view at the end
		return DistributionGraph;
	}
);