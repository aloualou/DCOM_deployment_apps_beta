require(
		[
				"jquery",
				"underscore",
				"splunkjs/mvc",
				"splunkjs/mvc/searchmanager",
				"/en-US/static/app/DCOM_S/components/memoryoverheadinfo/MemoryOverheadInfoView.js",
				"splunkjs/mvc/simplexml/ready!" ],
		function($, _, mvc, SearchManager, MemoryOverheadInfo) { 
			var submittedTokens = mvc.Components.getInstance('submitted');
			// Basic search to get safe mem count and host count for all
			// clusters
			var safeAndHostCountSearch = new SearchManager(
					{
						"id" : 'safe-and-hostcount-search',
						"search" : '| loadjob savedsearch="admin:SA-VMW-HierarchyInventory:CurrentHierarchy" | search (type="HostSystem" AND uiparentType="ClusterComputeResource") OR type="ClusterComputeResource" | eval uiparent=if(type=="ClusterComputeResource", moid, uiparent) | eventstats dc(moid) as members by uiparent, host | search type="ClusterComputeResource" | dedup moid, host | `SetHandleInfoMaxTimeNow` | lookup TimeClusterServicesAvailability host, moid as uiparent OUTPUT p_average_clusterServices_effectivemem_megaBytes | eval hasHosts=if(members<2,"False","True") | eval hasClusterServices=if(p_average_clusterServices_effectivemem_megaBytes=="noClusterServices","False","True") | eval hostCount=(members-1) |  eval SafeEffMem_megaBytes=floor(p_average_clusterServices_effectivemem_megaBytes*((hostCount-1)/hostCount)) | eval cluster_id="host=\\""+host+"\\" ccr=\\""+moid +"\\"" | fields SafeEffMem_megaBytes cluster_id name hostCount hasHosts hasClusterServices p_average_clusterServices_effectivemem_megaBytes',
						"status_buckets" : 0,
						"preview" : false,
						"timeFormat" : "%s.%Q",
						"earliest_time" : "$earliest$",
						"latest_time" : "$latest$"
					}, {
						tokens : true
					});

			resultsModel = safeAndHostCountSearch.data("results", {
				output_mode : "json"
			});
			var clusterData = {};
			// Utility to set tokens
			var setTokens = function(clusterData) {
				var cluster_id = submittedTokens.get("cluster");
				if (cluster_id === null || cluster_id === undefined
						|| clusterData[cluster_id] === undefined) {
					submittedTokens.set("SafeEffMem_megaBytes", null);
					submittedTokens.set("hostCount", null);
					submittedTokens.set("name", null);
					submittedTokens.set("hasHosts", null);
					submittedTokens.set("hasClusterServices", null);
					submittedTokens.set(
							"p_average_clusterServices_effectivemem_megaBytes",
							null)
				} else {
					submittedTokens.set("SafeEffMem_megaBytes",
							clusterData[cluster_id].SafeEffMem_megaBytes);
					submittedTokens.set("hostCount",
							clusterData[cluster_id].hostCount);
					submittedTokens.set("name", clusterData[cluster_id].name);
					submittedTokens.set("hasHosts", clusterData[cluster_id].hasHosts);
					submittedTokens.set("hasClusterServices", clusterData[cluster_id].hasClusterServices);
					submittedTokens
							.set(
									"p_average_clusterServices_effectivemem_megaBytes",
									clusterData[cluster_id].p_average_clusterServices_effectivemem_megaBytes);
				}
			}
			var onHostsCountChange = function() {
				if (resultsModel.hasData()) {
					var data = resultsModel.data();
					var results = data["results"];
					clusterData = _.reduce(results, function(memo, row) {
						var cluster_id = row.cluster_id;
						memo[cluster_id] = row;
						return memo;
					}, clusterData);
				}
				;
				// set tokens
				setTokens(clusterData);
				return;
			};
			submittedTokens.on('change:cluster',
							_.debounce(function() {
								// set tokens
								setTokens(clusterData);
							}));
			resultsModel.on("data", onHostsCountChange);
			

			var clusterMemOverheadSummaryInfo = new SearchManager(
					{
						"id" : 'cluster-mem-overhead-summaryinfo',
//"search" : '|`tstats` avg(p_average_mem_overhead_kiloBytes) avg(p_maximum_mem_overhead_kiloBytes) avg(p_minimum_mem_overhead_kiloBytes) avg(p_none_mem_overhead_kiloBytes) avg(p_average_mem_consumed_kiloBytes) avg(p_maximum_mem_consumed_kiloBytes) avg(p_minimum_mem_consumed_kiloBytes) avg(p_none_mem_consumed_kiloBytes) dc(moid) first(ccr) first(host) from vmw_perf_mem_virtualmachine where $cluster$ | stats avg(p_average_mem_overhead_kiloBytes) as p_average_mem_overhead_kiloBytes,avg(p_maximum_mem_overhead_kiloBytes) as  p_maximum_mem_overhead_kiloBytes, avg(p_minimum_mem_overhead_kiloBytes) as  p_minimum_mem_overhead_kiloBytes, avg(p_none_mem_overhead_kiloBytes) as p_none_mem_overhead_kiloBytes, avg(p_average_mem_consumed_kiloBytes) as p_average_mem_consumed_kiloBytes, avg(p_maximum_mem_consumed_kiloBytes) as p_maximum_mem_consumed_kiloBytes, avg(p_minimum_mem_consumed_kiloBytes) as p_minimum_mem_consumed_kiloBytes, avg(p_none_mem_consumed_kiloBytes) as p_none_mem_consumed_kiloBytes, dc(moid) as num_vms, first(ccr) as moid, first(host) as host |eval AvgOvrhdMemPerVM_KB =coalesce(p_average_mem_overhead_kiloBytes, p_maximum_mem_overhead_kiloBytes, p_minimum_mem_overhead_kiloBytes, p_none_mem_overhead_kiloBytes)| eval AvgConsumMemPerVM_KB = coalesce(p_average_mem_consumed_kiloBytes, p_maximum_mem_consumed_kiloBytes, p_minimum_mem_consumed_kiloBytes, p_none_mem_consumed_kiloBytes)  | eval TotConsum_KB=AvgConsumMemPerVM_KB*num_vms | eval TotOverhd_KB=AvgOvrhdMemPerVM_KB*num_vms | eval p_average_clusterServices_effectivemem_kiloBytes=$p_average_clusterServices_effectivemem_megaBytes$*1024 | eval actual_num_vms=floor(num_vms) | eval potential_vm_count=floor($SafeEffMem_megaBytes$*1024/(AvgConsumMemPerVM_KB+AvgOvrhdMemPerVM_KB))| eval additional_vms=potential_vm_count-actual_num_vms | eval num_hosts=$hostCount$ | rename AvgConsumMemPerVM_KB as mem_consumed_per_vm |  rename AvgOvrhdMemPerVM_KB as mem_overhead_per_vm |  eval num_hosts=if(isnull(num_hosts), "Not Available", num_hosts) | eval p_average_clusterServices_effectivemem_kiloBytes=if(isnull(p_average_clusterServices_effectivemem_kiloBytes), "Not Available", `BytesToGigaBytes(p_average_clusterServices_effectivemem_kiloBytes*1024)` + " GB") | eval additional_vms=if(isnull(additional_vms), "Not Available", additional_vms) | eval  mem_overhead_per_vm=if(isnull(mem_overhead_per_vm), "Not Available",  `BytesToGigaBytes(mem_overhead_per_vm*1024)` + " GB") | eval  mem_consumed_per_vm =if(isnull(mem_consumed_per_vm ), "Not Available",  `BytesToGigaBytes(mem_consumed_per_vm*1024)` + " GB") | eval name="$name$" | eval name=if(isnull(name), "Not found", name)',

//"search" : '| tstats avg(p_average_mem_overhead_kiloBytes) as p_average_mem_overhead_kiloBytes avg(p_maximum_mem_overhead_kiloBytes) as p_maximum_mem_overhead_kiloBytes dc(moid) first(ccr) as moid first(host) as host from vmw_perf_mem_virtualmachine where host="apps-vcenter500.sv.splunk.com" ccr="domain-c8" | eval num_hosts=100 | eval actual_num_vms=100 | eval p_average_clusterServices_effectivemem_kiloBytes=1  | eval mem_consumed_per_vm=1 | eval mem_overhead_per_vm=11 |eval additional_vms=p_average_mem_overhead_kiloBytes |eval name="test" ',

"search" : '| tstats avg(p_average_mem_overhead_kiloBytes) as p_average_mem_overhead_kiloBytes  avg(p_maximum_mem_overhead_kiloBytes) as p_maximum_mem_overhead_kiloBytes avg(p_minimum_mem_overhead_kiloBytes) as p_minimum_mem_overhead_kiloBytes avg(p_none_mem_overhead_kiloBytes) as p_none_mem_overhead_kiloBytes avg(p_average_mem_consumed_kiloBytes) as p_average_mem_consumed_kiloBytes avg(p_maximum_mem_consumed_kiloBytes) as p_maximum_mem_consumed_kiloBytes avg(p_minimum_mem_consumed_kiloBytes) as p_minimum_mem_consumed_kiloBytes avg(p_none_mem_consumed_kiloBytes) as p_none_mem_consumed_kiloBytes dc(moid) as num_vms first(ccr) as moid first(host) as host from vmw_perf_mem_virtualmachine  where $cluster$ | eval AvgOvrhdMemPerVM_KB =coalesce(p_average_mem_overhead_kiloBytes, p_maximum_mem_overhead_kiloBytes, p_minimum_mem_overhead_kiloBytes, p_none_mem_overhead_kiloBytes) | eval AvgConsumMemPerVM_KB = coalesce(p_average_mem_consumed_kiloBytes, p_maximum_mem_consumed_kiloBytes, p_minimum_mem_consumed_kiloBytes, p_none_mem_consumed_kiloBytes)  | eval TotConsum_KB=AvgConsumMemPerVM_KB*num_vms | eval TotOverhd_KB=AvgOvrhdMemPerVM_KB*num_vms | eval p_average_clusterServices_effectivemem_kiloBytes=$p_average_clusterServices_effectivemem_megaBytes$*1024 | eval actual_num_vms=floor(num_vms) | eval potential_vm_count=floor($SafeEffMem_megaBytes$*1024/(AvgConsumMemPerVM_KB+AvgOvrhdMemPerVM_KB)) | eval additional_vms=potential_vm_count-actual_num_vms | eval num_hosts=$hostCount$ | rename AvgConsumMemPerVM_KB as mem_consumed_per_vm |  rename AvgOvrhdMemPerVM_KB as mem_overhead_per_vm | eval num_hosts=if(isnull(num_hosts), "Not Available", num_hosts) | eval p_average_clusterServices_effectivemem_kiloBytes=if(isnull(p_average_clusterServices_effectivemem_kiloBytes), "Not Available", `BytesToGigaBytes(p_average_clusterServices_effectivemem_kiloBytes*1024)` + " GB") | eval additional_vms=if(isnull(additional_vms), "Not Available", additional_vms) | eval  mem_overhead_per_vm=if(isnull(mem_overhead_per_vm), "Not Available",  `BytesToGigaBytes(mem_overhead_per_vm*1024)` + " GB") | eval  mem_consumed_per_vm =if(isnull(mem_consumed_per_vm ), "Not Available",  `BytesToGigaBytes(mem_consumed_per_vm*1024)` + " GB") | eval name="$name$" | eval name=if(isnull(name), "Not found", name) ',

						"status_buckets" : 0,
						"preview" : false,
						"earliest_time" : "$earliest$",
						"latest_time" : "$latest$",
						"timeFormat" : "%s.%Q"
					}, {
						tokens : true,
						tokenNamespace : "submitted"
					});

			var memoryOverheadInfo = new MemoryOverheadInfo({
				el : $(".memory-overhead-info").first(),
				managerid : "cluster-mem-overhead-summaryinfo"
			}, {
				tokens : true,
				tokenNamespace : "submitted"
			});
		});