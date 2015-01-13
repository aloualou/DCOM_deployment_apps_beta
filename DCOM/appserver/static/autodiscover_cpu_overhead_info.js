require(
		[
				"jquery",
				"underscore",
				"splunkjs/mvc",
				"splunkjs/mvc/searchmanager",
				"/en-US/static/app/DCOM_S/components/cpuoverheadinfo/CpuOverheadInfoView.js",
				"splunkjs/mvc/simplexml/ready!" ],
		function($, _, mvc, SearchManager, CpuOverheadInfo) {
			var submittedTokens = mvc.Components.getInstance('submitted');
			// Basic search to get safe mem count and host count for all
			// clusters
			var safeAndHostCountSearch = new SearchManager(
					{
						"id" : 'safe-and-hostcount-search2',
						//"search" : '| loadjob savedsearch="admin:SA-VMW-HierarchyInventory:CurrentHierarchy" | search (type="HostSystem" AND uiparentType="ClusterComputeResource") OR type="ClusterComputeResource" | eval uiparent=if(type=="ClusterComputeResource", moid, uiparent) | eventstats dc(moid) as members by uiparent, host | search type="ClusterComputeResource" | dedup moid, host | `SetHandleInfoMaxTimeNow` | lookup TimeClusterServicesAvailability host, moid as uiparent OUTPUT p_average_clusterServices_effectivecpu_megaHertz | eval hasHosts=if(members<2,"False","True") | eval hasClusterServices=if(p_average_clusterServices_effectivecpu_megaHertz=="noClusterServices","False","True") | eval hostCount=(members-1) | eval cluster_id="host=\\""+ "apps-vcenter500.sv.splunk.com" + "\\" ccr=\\""+ "domain-c8" +"\\"" | search moid="domain-c8" host="apps-vcenter500.sv.splunk.com" | rename hostCount as num_hosts2 | eval SafeEffCpu_MHz=floor(p_average_clusterServices_effectivecpu_megaHertz*((num_hosts2-1)/num_hosts2)) | eval p_average_clusterServices_effectivecpu_megaHertz=floor(p_average_clusterServices_effectivecpu_megaHertz) | fields cluster_id name host moid num_hosts2 hasHosts hasClusterServices p_average_clusterServices_effectivecpu_megaHertz SafeEffCpu_MHz',
						  "search" : '| loadjob savedsearch="admin:SA-VMW-HierarchyInventory:CurrentHierarchy" | search (type="HostSystem" AND uiparentType="ClusterComputeResource") OR type="ClusterComputeResource" | eval uiparent=if(type=="ClusterComputeResource", moid, uiparent) | eventstats dc(moid) as members by uiparent, host | search type="ClusterComputeResource" | dedup moid, host | `SetHandleInfoMaxTimeNow` | lookup TimeClusterServicesAvailability host, moid as uiparent OUTPUT p_average_clusterServices_effectivecpu_megaHertz | eval hasHosts=if(members<2,"False","True") | eval hasClusterServices=if(p_average_clusterServices_effectivecpu_megaHertz=="noClusterServices","False","True") | eval hostCount=(members-1) | eval cluster_id="host=\\""+ host +"\\" ccr=\\""+ moid  +"\\"" | eval ccr=moid | search $cluster$ | rename hostCount as num_hosts2 | eval SafeEffCpu_MHz=floor(p_average_clusterServices_effectivecpu_megaHertz*((num_hosts2-1)/num_hosts2)) | eval p_average_clusterServices_effectivecpu_megaHertz=floor(p_average_clusterServices_effectivecpu_megaHertz) | fields cluster_id name host moid num_hosts2 hasHosts hasClusterServices p_average_clusterServices_effectivecpu_megaHertz SafeEffCpu_MHz',
						"status_buckets" : 0,
						"preview" : false,
						"timeFormat" : "%s.%Q",
						"earliest_time" : "$earliest$",
						"latest_time" : "$latest$"
					}, {
						tokens : true
					});

			var resultsModel2 = safeAndHostCountSearch.data("results", {
				output_mode : "json"
			});
			var clusterData = {};
			// Utility to set tokens
			var setTokens = function(clusterData) {
				console.log("CPU.setTokens:");
				var cluster_id = submittedTokens.get("cluster");
				console.log("cluster_id=" + cluster_id);
				console.log("clusterData=" + JSON.stringify(clusterData));
				if (cluster_id === null || cluster_id === undefined || clusterData[cluster_id] === undefined) {
					submittedTokens.set("host", null);
					submittedTokens.set("moid", null);
					submittedTokens.set("name", null);
					submittedTokens.set("num_hosts2", null);
					submittedTokens.set("hasHosts", null);
					submittedTokens.set("hasClusterServices", null);
					submittedTokens.set("p_average_clusterServices_effectivecpu_megaHertz", null)
					submittedTokens.set("SafeEffCpu_MHz", null);
				} else {
					submittedTokens.set("host", clusterData[cluster_id].host);
					submittedTokens.set("moid", clusterData[cluster_id].moid);
					submittedTokens.set("name", clusterData[cluster_id].name);
					submittedTokens.set("num_hosts2", clusterData[cluster_id].num_hosts2);
					submittedTokens.set("hasHosts", clusterData[cluster_id].hasHosts);
					submittedTokens.set("hasClusterServices", clusterData[cluster_id].hasClusterServices);
					submittedTokens.set("p_average_clusterServices_effectivecpu_megaHertz", clusterData[cluster_id].p_average_clusterServices_effectivecpu_megaHertz);
					submittedTokens.set("SafeEffCpu_MHz", clusterData[cluster_id].SafeEffCpu_MHz);
				}
				console.log("/CPU.setTokens");
			}
			var onHostsCountChange = function() {
				console.log("CPU.onHostsCountChange:");
				if (resultsModel2.hasData()) {
					var data = resultsModel2.data();
					var results = data["results"];
					console.log("results=" + JSON.stringify(results));
					clusterData = _.reduce(results, function(memo, row) {
						var cluster_id = row.cluster_id;
						memo[cluster_id] = row;
						return memo;
					}, clusterData);
				}
				;
				// set tokens
				setTokens(clusterData);
				console.log("/CPU.onHostsCountChange");
				return;
			};
			submittedTokens.on('change:cluster',
							_.debounce(function() {
								// set tokens
								setTokens(clusterData);
							}));
			resultsModel2.on("data", onHostsCountChange);

						var clusterMemOverheadSummaryInfo = new SearchManager(
					{
						"id" : 'cluster-cpu-overhead-summaryinfo',
//"search" : '| `tstats` avg(p_average_cpu_usagemhz_megaHertz) avg(p_maximum_cpu_usagemhz_megaHertz) avg(p_minimum_cpu_usagemhz_megaHertz) avg(p_none_cpu_usagemhz_megaHertz) dc(moid) first(ccr) first(host) from vmw_perf_cpu_virtualmachine where * instance="aggregated" ccr="domain-c8" host=apps-vcenter500.sv.splunk.com groupby _time span=1m | timechart minspan=1m avg(p_average_cpu_usagemhz_megaHertz) as avg_usagemhz_megaHertz, avg(p_maximum_cpu_usagemhz_megaHertz) as max_usagemhz_megaHertz, avg(p_minimum_cpu_usagemhz_megaHertz) as min_usagemhz_megaHertz, avg(p_none_cpu_usagemhz_megaHertz) as none_usagemhz_megaHertz dc(moid) as num_vms first(ccr) as moid first(host) as host | lookup TimeClusterServicesAvailability host, moid OUTPUT p_average_clusterServices_effectivecpu_megaHertz | eval AvgCpuPerVM_mhz=coalesce(avg_usagemhz_megaHertz,max_usagemhz_megaHertz,min_usagemhz_megaHertz,none_usagemhz_megaHertz) | eval TotUsg_mhz=AvgCpuPerVM_mhz*num_vms | eval AvgCpuUsg_pct=TotUsg_mhz/p_average_clusterServices_effectivecpu_megaHertz | eval name="Apps-SV5" | stats max(num_vms) as num_vms avg(AvgCpuPerVM_mhz) as cpu_per_vm  first(host) as host first(moid) as moid first(name) as name first(p_average_clusterServices_effectivecpu_megaHertz) as p_average_clusterServices_effectivecpu_megaHertz | eval actual_num_vms=floor(num_vms) | eval cpu_per_vm=if(cpu_per_vm<100,100,cpu_per_vm) | eval num_hosts2=$num_hosts2$ | eval SafeEffCpu_MHz=$SafeEffCpu_MHz$ | eval potential_vm_count=floor($SafeEffCpu_MHz$/cpu_per_vm) | eval additional_vms=potential_vm_count-actual_num_vms | fields name host moid num_hosts2 num_vms p_average_clusterServices_effectivecpu_megaHertz SafeEffCpu_MHz actual_num_vms additional_vms cpu_per_vm',
"search" : '| `tstats` avg(p_average_cpu_usagemhz_megaHertz) avg(p_maximum_cpu_usagemhz_megaHertz) avg(p_minimum_cpu_usagemhz_megaHertz) avg(p_none_cpu_usagemhz_megaHertz) dc(moid) first(ccr) first(host) from vmw_perf_cpu_virtualmachine where * instance="aggregated" ccr=$moid$ host=$host$ groupby _time span=1m | timechart minspan=1m avg(p_average_cpu_usagemhz_megaHertz) as avg_usagemhz_megaHertz, avg(p_maximum_cpu_usagemhz_megaHertz) as max_usagemhz_megaHertz, avg(p_minimum_cpu_usagemhz_megaHertz) as min_usagemhz_megaHertz, avg(p_none_cpu_usagemhz_megaHertz) as none_usagemhz_megaHertz dc(moid) as num_vms first(ccr) as moid first(host) as host | lookup TimeClusterServicesAvailability host, moid OUTPUT p_average_clusterServices_effectivecpu_megaHertz | eval AvgCpuPerVM_mhz=coalesce(avg_usagemhz_megaHertz,max_usagemhz_megaHertz,min_usagemhz_megaHertz,none_usagemhz_megaHertz) | eval TotUsg_mhz=AvgCpuPerVM_mhz*num_vms | eval AvgCpuUsg_pct=TotUsg_mhz/p_average_clusterServices_effectivecpu_megaHertz | eval name="$name$" | stats max(num_vms) as num_vms avg(AvgCpuPerVM_mhz) as cpu_per_vm  first(host) as host first(moid) as moid first(name) as name first(p_average_clusterServices_effectivecpu_megaHertz) as p_average_clusterServices_effectivecpu_megaHertz | eval actual_num_vms=floor(num_vms) | eval cpu_per_vm=if(cpu_per_vm<100,100,cpu_per_vm) | eval num_hosts2=$num_hosts2$ | eval SafeEffCpu_MHz=$SafeEffCpu_MHz$ | eval potential_vm_count=floor($SafeEffCpu_MHz$/cpu_per_vm) | eval additional_vms=potential_vm_count-actual_num_vms | fields name host moid num_hosts2 num_vms p_average_clusterServices_effectivecpu_megaHertz SafeEffCpu_MHz actual_num_vms additional_vms cpu_per_vm',
						"status_buckets" : 0,
						"preview" : false,
						"earliest_time" : "$earliest$",
						"latest_time" : "$latest$",
						"timeFormat" : "%s.%Q"
					}, {
						tokens : true,
						tokenNamespace : "submitted"
					});

			var CpuOverheadInfo = new CpuOverheadInfo({
				el : $(".cpu-overhead-info").first(),
				managerid : "cluster-cpu-overhead-summaryinfo"
			}, {
				tokens : true,
				tokenNamespace : "submitted"
			});
		});