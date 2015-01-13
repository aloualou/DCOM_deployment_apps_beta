require([
         "jquery",
         "splunkjs/ready!"
         ], function(mvc) {
	var highCpuUsage = $('#highCpuUsage');
	var highMemoryUsage = $('#highMemoryUsage');
	var highCpuSumReady = $('#highCpuSumReady');
	var highCpuUsageParent = highCpuUsage.parent();
	var highMemoryUsageParent = highMemoryUsage.parent();
	var highCpuSumReadyParent = highCpuSumReady.parent();
	highCpuUsageParent.append(highMemoryUsage);
	highCpuUsageParent.append(highCpuSumReady);
	highCpuUsageParent.addClass("grouped");
	highCpuUsageParent.addClass("customParent");
	highMemoryUsageParent.remove();
	highCpuSumReadyParent.remove();
	highCpuUsage.addClass('customElement');
	highMemoryUsage.addClass('customElement');
	highCpuSumReady.addClass('customElement');

	var hostHighMemoryBallooning = $('#hostHighMemoryBallooning');
	var hostHighMemorySwapping = $('#hostHighMemorySwapping');
	var hostHighCpuUsage = $('#hostHighCpuUsage');
	var hostHighMemoryBallooningParent = hostHighMemoryBallooning.parent();
	var hostHighMemorySwappingParent = hostHighMemorySwapping.parent();
	var hostHighCpuUsageParent = hostHighCpuUsage.parent();
	hostHighMemoryBallooningParent.append(hostHighMemorySwapping);
	hostHighMemoryBallooningParent.append(hostHighCpuUsage);
	hostHighMemoryBallooningParent.addClass("grouped");
	hostHighMemoryBallooningParent.addClass("customParent");
	hostHighMemorySwappingParent.remove();
	hostHighCpuUsageParent.remove();
	hostHighMemoryBallooning.addClass('customElement');
	hostHighMemorySwapping.addClass('customElement');
	hostHighCpuUsage.addClass('customElement');

	$("div.single").css("min-width", "50px");
	
vmUrl = "/app/splunk_for_vmware/proactive_monitoring"
	highCpuUsage.on('click', function(){
		window.location = vmUrl + "?form.entity_type=virtualmachine&form.perf_type=cpu&earliest=-4h&latest=now&form.metric=average_cpu_usage_percent";    
	});
	highMemoryUsage.on('click', function(){
	   window.location = vmUrl + "?form.entity_type=virtualmachine&form.perf_type=mem&earliest=-4h&latest=now&form.metric=average_mem_usage_percent";    
	});
	highCpuSumReady.on('click', function(){
	   window.location = vmUrl + "?form.entity_type=virtualmachine&form.perf_type=cpu&earliest=-4h&latest=now&form.metric=summation_cpu_ready_millisecond";    
	});
	hostHighMemoryBallooning.on('click', function(){
	   window.location = vmUrl + "?form.entity_type=hostsystem&form.perf_type=mem&earliest=-4h&latest=now&form.metric=average_mem_vmmemctl_kiloBytes";
	});
	hostHighMemorySwapping.on('click', function(){
	   window.location = vmUrl + "?form.entity_type=hostsystem&form.perf_type=mem&earliest=-4h&latest=now&form.metric=average_mem_llSwapUsed_kiloBytes";
	});
	hostHighCpuUsage.on('click', function(){
	   window.location = vmUrl + "?form.entity_type=hostsystem&form.perf_type=cpu&earliest=-4h&latest=now&form.metric=average_cpu_usage_percent";
	});
});


