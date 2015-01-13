require([
	"splunkjs/mvc",
	"splunkjs/mvc/utils",
	"splunkjs/mvc/tokenutils",
	"underscore",
	"jquery",
	"splunkjs/mvc/simplexml",
	"splunkjs/mvc/headerview",
	"splunkjs/mvc/footerview",
	"splunkjs/mvc/simpleform/input/dropdown",
	"splunkjs/mvc/simpleform/input/timerange",
	"splunkjs/mvc/simpleform/input/submit",
	"splunkjs/mvc/searchmanager",
	"splunkjs/mvc/postprocessmanager",
	"splunkjs/mvc/simplexml/urltokenmodel",
	"pm/PMLayoutView", 
	"pm/ThresholdCollection",
	"pm/contrib/d3/d3.amd",
	"pm/PMPinboardView",
	"pm/PMTreeView"
	],
	function(
		mvc,
		utils,
		TokenUtils,
		_,
		$,
		DashboardController,
		HeaderView,
		FooterView,
		DropdownInput,
		TimeRangeInput,
		SubmitButton,
		SearchManager,
		PostProcessManager,
		UrlTokenModel,
		PMLayout,
		ThresholdCollection,
		d3,
		PMPinboard,
		PMTree
		) {
		
		// Load dashboard.js to perform the license check
		var dynamicRequire = require;	// NOTE: Assignment prevents optimizer from inlining
		dynamicRequire(["../../static/app/splunk_for_vmware/dashboard.js"]);

		var pageLoading = true;


		// 
		// TOKENS
		//
		
		// Create token namespaces
		var urlTokenModel = new UrlTokenModel();
		mvc.Components.registerInstance('url', urlTokenModel);
		var defaultTokenModel = mvc.Components.getInstance('default', {create: true});
		var submittedTokenModel = mvc.Components.getInstance('submitted', {create: true});


		// Initialize tokens
		defaultTokenModel.set(urlTokenModel.toJSON());
		var defaultUpdate = {};

		var submitTokensSoon = _.debounce(function(replaceState) {
			submittedTokenModel.set(defaultTokenModel.toJSON());
			urlTokenModel.saveOnlyWithPrefix('form\\.', defaultTokenModel.toJSON(), {
				replaceState: replaceState
			});
		});

		var submitTokens = function() {
			submitTokensSoon(pageLoading);
		};

		urlTokenModel.on('url:navigate', function() {
			defaultTokenModel.set(urlTokenModel.toJSON());
			if (!_.isEmpty(urlTokenModel.toJSON()) && !_.all(urlTokenModel.toJSON(), _.isUndefined)) {
				submitTokens();
			} else {
				submittedTokenModel.clear();
			}
		});


		//
		// SEARCH MANAGERS
		//
		
		// Base Populating search for fields 'field2' and 'field3'
		var metrics_search = new SearchManager({
			"id": "metrics_search",
			"latest_time": "2",
			"earliest_time": "1",
			"search": "| inputlookup VMWPerformanceMetrics",
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"cache": 6000,
			"preview": false
		}, {tokens: true});
		
		
		
		// Populating search for field 'field2'
		var search1 = new PostProcessManager({
			"managerid": "metrics_search",
			"id": "search1",
			"latest_time": "$latest$",
			"search": "search entity=$entity_type$ | dedup perftype | table perftype",
			"earliest_time": "$earliest$",
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"preview": true
		}, {tokens: true});

		
		// Populating search for field 'field3'
		var search2 = new PostProcessManager({
			"managerid": "metrics_search",
			"id": "search2",
			"latest_time": "$latest$",
			"search": "search entity=$entity_type$ perftype=$perf_type$ | table metric",
			"earliest_time": "$earliest$",
			"cancelOnUnload": true,
			"status_buckets": 0,
			"app": utils.getCurrentApp(),
			"auto_cancel": 90,
			"preview": true
		}, {tokens: true});



		//
		// SPLUNK HEADER AND FOOTER
		//

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

		//
		// VIEWS: FORM INPUTS
		//

		var field1 = new DropdownInput({
			"id": "field1",
			"choices": [
				{"value": "virtualmachine", "label": "Virtual Machine"},
				{"value": "hostsystem", "label": "Host System"}
			],
			"default": "virtualmachine",
			"seed": "virtualmachine",
			"value": "$form.entity_type$",
			"showClearButton": false,
			"el": $('#field1')
		}, {tokens: true}).render();

		field1.on("change", function(value, input, options) {
			if (!field1.hasValue()) {
				defaultUpdate['field1'] = true;
				this.val(field1.settings.get("default"));
				return;
			}
			
			var newValue = field1.val() || field1.settings.get("default");
			var newComputedValue = newValue;

			// Update computed value
			defaultTokenModel.set("entity_type", newComputedValue);
		});
		defaultUpdate['field1'] = true;
		field1.trigger("change", field1.val(), field1);

		var field2 = new DropdownInput({
			"id": "field2",
			"choices": [],
			"default": "cpu",
			"seed": "cpu",
			"labelField": "perftype",
			"valueField": "perftype",
			"value": "$form.perf_type$",
			"showClearButton": false,
			"managerid": "search1",
			"el": $('#field2')
		}, {tokens: true}).render();

		field2.on("change", function(value, input, options) {
			if (!field2.hasValue()) {
				defaultUpdate['field2'] = true;
				this.val(field2.settings.get("default"));
				return;
			}
			
			var newValue = field2.val() || field2.settings.get("default");
			var newComputedValue = newValue;

			// Update computed value
			defaultTokenModel.set("perf_type", newComputedValue);
		});
		defaultUpdate['field2'] = true;
		field2.trigger("change", field2.val(), field2);

		var field3 = new DropdownInput({
			"id": "field3",
			"choices": [],
			"valueField": "metric",
			"labelField": "metric",
			"value": "$form.metric$",
			"managerid": "search2",
			"showClearButton": false,
			"width": 350,
			"el": $('#field3')
		}, {
			tokens: true
		}).render();

		field3.on("change", function(value, input, options) {
			if (!field3.hasValue()) {
				defaultUpdate['field3'] = true;
				this.val(field3.settings.get("default"));
				return;
			}
			
			var newValue = field3.val() || field3.settings.get("default");
			var newComputedValue = newValue;

			// Update computed value
			defaultTokenModel.set("metric", newComputedValue);
		});
		defaultUpdate['field3'] = true;
		field3.trigger("change", field3.val(), field3);
		//$("#field3 .select2-container").first().width(250);
		

		var field4 = new TimeRangeInput({
			"id": "field4",
			"default": {"latest_time": "now", "earliest_time": "-24h@h"},
			"earliest_time": "$earliest$",
			"latest_time": "$latest$",
			"el": $('#field4')
		}, {tokens: true}).render();


		field4.on("change", function(value, input, options) {
			if (!field4.hasValue()) {
				defaultUpdate['field4'] = true;
				field4.updateValueWithDefault();
				return;
			}

			// Submit the token only if it wasn't from setting the default
			if (defaultUpdate['field4']) {
				defaultUpdate['field4'] = false;
			} else {
				submitTokens();
			}
		});
		defaultUpdate['field4'] = true;
		field4.trigger("change", field4.val(), field4);



		// 
		// SUBMIT FORM DATA
		//
		
		var submit = new SubmitButton({
			id: 'submit',
			el: $('#search_btn')
		}, {tokens: true}).render();

		submit.on("submit", function() {
			//FIXME: make this alerting sexier
			var field3_val = field3.val();
			
			//In cupcake search results are stored at <view>.visualization._data, in bubbles they are at <view>.select._data, fun right?
			var viz = field3.select || field3.visualization;
			
			if (field3_val === undefined || _.find(viz._data, function(result) { return result.metric === field3_val; }) === undefined) {
				alert("You must select a metric to kick off performance searches!");
			}
			else {
				submitTokens();
			}
		});

		if (!_.isEmpty(urlTokenModel.toJSON())){
			submitTokens();
		}


		//
		// DASHBOARD READY
		//

		DashboardController.ready();
		pageLoading = false;
		
		//We good to go bro!
		$("body").removeClass("preload");
		
		//
		// Proactive Monitoring Render
		//
		var main_container = $(".proactive-monitoring-container").first();
		//
		// Layout Creation
		//
		var layout = new PMLayout({el: main_container});
		layout.render();
		
		//
		// Threshold Data Bindings
		//
		var thresholds = new ThresholdCollection();
		//Keep modified threshold data on hand any time it changes (i.e. when it arrives)
		//FIXME: there is a race condition here if the dynamic tokens are somehow set, may be possible via uri string
		var submitted_tokens = mvc.Components.get('submitted');
		var threshold_data = {};
		thresholds.on("sync", function() {
			threshold_data = this.reduce(function(memo, model) {
					var entitytype = model.entry.content.attributes.entitytype.toLowerCase();
					if (!memo.hasOwnProperty(entitytype)) {
						memo[entitytype] = {};
					}
					memo[entitytype][model.entry.content.attributes.metric] = model.entry.content.attributes;
					return memo;
				}, threshold_data);
			submitted_tokens.trigger('change:metric');
		}, thresholds);
		thresholds.fetch({
			data: {
				app: "splunk_for_vmware",
				search: "p_*",
				count: "0"
			}
		});
		
		
		//Bind to the change in metric to get our thresholding search proper
		submitted_tokens.on('change:metric', _.debounce(function () {
			var cur_metric = submitted_tokens.get("metric");
			var entitytype = submitted_tokens.get("entity_type");
			var entity_thresholds = threshold_data[entitytype] || {};
			if (cur_metric !== null && cur_metric !== undefined && entity_thresholds.hasOwnProperty("p_" + cur_metric)) {
				var threshold = entity_thresholds["p_" + cur_metric];
				var snippet = "eval threshold_severity=case(avg_metric" + threshold.comparator + threshold.critical + ', "critical", avg_metric' + threshold.comparator + threshold.warning + ', "warning", isnotnull(avg_metric), "normal", 1==1, "unknown")';
				snippet = snippet + ' | eval threshold_index=case(threshold_severity=="critical", 0, threshold_severity=="warning", 1, threshold_severity=="normal", 2, threshold_severity=="unknown", 3) ';
				submitted_tokens.set("threshold_snippet", snippet);
			}
			else {
				submitted_tokens.set("threshold_snippet", 'eval threshold_severity="unknown" | eval threshold_index=3');
			}
		}));
		
		
		//
		// Search Managers
		//
		var vm_hierarchy_search = new SearchManager({
			id : "virtualmachine-hierarchy",
			earliest_time: "-8h",
			latest_time: "now",
			preview : false,
			cache : 600,
			search : 'sourcetype=vmware:inv:hierarchy earliest=-8h latest=now "\\"type\\": \\"VirtualMachine\\"" OR "\\"type\\": \\"RootFolder\\"" OR "\\"type\\": \\"HostSystem\\"" OR "\\"type\\": \\"ClusterComputeResource\\"" | spath changeSet.runtime.host.moid output=vmhost | spath moid output=moid | spath type output=type | spath changeSet.name output=name | search type="HostSystem" OR type="VirtualMachine" OR type="ClusterComputeResource" OR type="RootFolder" | spath changeSet.parent.moid output=parent   | spath changeSet.parent.type output=parentType   | spath rootFolder.moid output=rootFolderMoid   | eval parent=if(type="VirtualMachine", vmhost, if(parentType="ComputeResource" OR parentType="Folder", rootFolderMoid, parent)) | eval parentType=if(type="VirtualMachine", "HostSystem", if(parent=rootFolderMoid, "RootFolder", parentType))  | stats first(name) as name first(type) as type first(parent) as parent first(parentType) as parentType by host, moid | eval moid=if(type="RootFolder", "*", moid) | eval parent=if(parentType="RootFolder", "*", parent)',
			time_format : "%s.%Q"
		}, {tokens: true, tokenNamespace: "submitted"});
		
		var host_hierarchy_search = new SearchManager({
			id : "hostsystem-hierarchy",
			earliest_time: "-8h",
			latest_time: "now",
			preview : false,
			cache : 600,
			search : 'sourcetype=vmware:inv:hierarchy earliest=-8h latest=now "\\"type\\": \\"RootFolder\\"" OR "\\"type\\": \\"HostSystem\\"" OR "\\"type\\": \\"ClusterComputeResource\\"" | spath moid output=moid | spath type output=type | spath changeSet.name output=name | search type="HostSystem" OR type="ClusterComputeResource" OR type="RootFolder" | spath changeSet.parent.moid output=parent   | spath changeSet.parent.type output=parentType   | spath rootFolder.moid output=rootFolderMoid | eval parent=if(parentType="ComputeResource" OR parentType="Folder", rootFolderMoid, parent) | eval parentType=if(parent=rootFolderMoid, "RootFolder", parentType) | stats first(name) as name first(type) as type first(parent) as parent first(parentType) as parentType by host, moid | eval moid=if(type="RootFolder", "*", moid) | eval parent=if(parentType="RootFolder", "*", parent)',
			time_format : "%s.%Q"
		}, {tokens: true, tokenNamespace: "submitted"});
		
		var leaf_performance_search = new SearchManager({
			id: "leaf-performance",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			cache: 600,
			status_buckets: 0,
			search : '| `tstats` avg(p_$metric$) max(p_$metric$) from vmw_perf_$perf_type$_$entity_type$ where instance="aggregated" groupby host, moid | stats avg(p_$metric$) AS avg_metric max(p_$metric$) as max_metric by host, moid | $threshold_snippet$',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		var performance_distribution_search = new SearchManager({
			id: "leaf-performance-distribution",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			cache: 600,
			status_buckets: 0,
			search : '| `tstats` median(p_$metric$) perc25(p_$metric$) perc75(p_$metric$) perc95(p_$metric$) min(p_$metric$) from vmw_perf_$perf_type$_$entity_type$ where instance="aggregated" p_$metric$>=0 groupby _time span=1m | timechart minspan=1m median(p_$metric$) AS center perc25(p_$metric$) as lower_quartile perc75(p_$metric$) as upper_quartile perc95(p_$metric$) as upper_extreme min(p_$metric$) as lower_extreme',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		/*
		 * Alternate Distribution searches:
		 * BOX AND WHISKER
		 * | `tstats` median($metric$) perc25($metric$) perc75($metric$) perc95($metric$) min($metric$) from vmw_perf_$perf_type$_$entity_type$ where instance="aggregated" $metric$>=0 groupby _time span=1m | timechart minspan=1m median($metric$) AS center perc25($metric$) as lower_quartile perc75($metric$) as upper_quartile perc95($metric$) as upper_extreme min($metric$) as lower_extreme
		 * 
		 * NORMAL CURVE
		 * | `tstats` avg($metric$) stdev($metric$) from vmw_perf_$perf_type$_$entity_type$ where  instance="aggregated" $metric$>=0 groupby _time span=1m | timechart minspan=1m avg($metric$) AS avg_metric stdev($metric$) as sigma | eval plus_sigma=avg_metric+sigma | eval plus_2sigma=avg_metric+sigma+sigma | eval minus_sigma=avg_metric-sigma | eval minus_2sigma=avg_metric-sigma-sigma | fields - sigma | rename minus_2sigma AS lower_extreme plus_2sigma AS upper_extreme plus_sigma AS upper_quartile minus_sigma AS lower_quartile avg_metric AS center
		 * 
		 */
		
		var specific_performance_search = new SearchManager({
			id: "specific-node-performance",
			earliest_time: "$earliest$",
			latest_time: "$latest$",
			preview: false,
			cache: 600,
			status_buckets: 0,
			search : '| `tstats` avg(p_$metric$) from vmw_perf_$perf_type$_$entity_type$ where (moid="$tooltip_node$" AND host="$tooltip_tree$") OR (hs="$tooltip_node$" AND host="$tooltip_tree$") OR (ccr="$tooltip_node$" AND host="$tooltip_tree$") instance="aggregated" p_$metric$>=0 groupby _time span=1m | timechart minspan=1m avg(p_$metric$) AS metric',
			time_format : "%s.%Q"
		}, {tokens:true, tokenNamespace: "submitted"});
		
		//
		// Main View Controllers
		//
		
		var pinboard = new PMPinboard({
			el: layout.$sidebar
		});
		pinboard.render();
		
		var tree = new PMTree({
			el: layout.$main_stage,
			managerid: "$entity_type$-hierarchy",
			leaf_type: "$entity_type$",
			metric: "$metric$",
			threshold_data: threshold_data,
			perf_managerid: "leaf-performance",
			perf_message_container: $("#search_processing_indicator"),
			tooltip_distribution_managerid: "leaf-performance-distribution",
			tooltip_specific_managerid: "specific-node-performance",
			tooltip_tree_token: "$tooltip_tree$",
			tooltip_node_token: "$tooltip_node$",
			tooltip_earliest: "$earliest$",
			tooltip_latest: "$latest$"
		}, {tokens: true, tokenNamespace: "submitted"});
		
	
		//Christmas Tree Easter Egg, yes mixing holidays there
		window.xmasMode = function() {
			window.mode = 1;
			return window.setInterval(function() {
					if (window.mode === 1) {
						d3.selectAll("circle").attr("opacity", 1);
						window.mode = 2;
					}
					else if (window.mode === 2) {
						d3.selectAll("circle").each(function(d, i) {
							if (i % 2 === 0) {
								d3.select(this).attr("opacity", 1);
							}
							else {
								d3.select(this).attr("opacity", 1e-6);
							}
						});
						window.mode = 3;
					}
					else if (window.mode === 3) {
						d3.selectAll("circle").each(function(d, i) {
							if (i % 2 === 1) {
								d3.select(this).attr("opacity", 1);
							}
							else {
								d3.select(this).attr("opacity", 1e-6);
							}
						});
						window.mode = 4;
					}
					else {
						d3.selectAll("circle").attr("opacity", 1e-6);
						window.mode = 1;
					}
				}, 500);
		};
	}
);
