require([
    '../app/splunk_for_vmware/components/licensemonitor/LicenseMonitor',
    '../app/splunk_for_vmware/components/licensemonitor/LicenseStatusView'
], function(
    LicenseMonitor,
    LicenseStatusView
) {
    var view = new LicenseStatusView();
    
    view.on('refresh', function() {
        view.clear();
        LicenseMonitor.refreshStatus(function(licenseStatus) {
            view.setStatus(licenseStatus);
        });
    });
    
    view.on('apply_demo_license', function(username, password) {
        view.setCredentialsModalEnabled(false);
        LicenseMonitor.applyDemoLicense(username, password, function(err) {
            view.setCredentialsModalAlert(err ? err['message'] : null);
            view.setCredentialsModalEnabled(true);
            if (!err) {
                view.dismissCredentialsModal();
                
                view.setWaitForLicenseMasterModalVisible(true);
                var refreshLoop = function() {
                    if (!view.getWaitForLicenseMasterModalVisible()) {
                        // User pressed cancel
                        return;
                    }
                    LicenseMonitor.refreshStatus(function(licenseStatus) {
                        // (Leaving this print in because it may be useful for
                        //  support to debug with.)
                        console.log('Got status from license master: ', licenseStatus);
                        if (!licenseStatus['valid']) {
                            window.setTimeout(refreshLoop, 15000);  // poll every 15s
                            return;
                        }
                        
                        view.setWaitForLicenseMasterModalVisible(false);
                        view.setStatus(licenseStatus);
                    });
                };
                refreshLoop();
            }
        });
    });
    
    view.clear();
    LicenseMonitor.fetchStatus(function(licenseStatus) {
        if (licenseStatus.messages.length >= 1 &&
            licenseStatus.messages[0].type === 'not_ready')
        {
            view.trigger('refresh');  // simulate click on "Refresh" button
        } else {
            view.setStatus(licenseStatus);
        }
    });
});