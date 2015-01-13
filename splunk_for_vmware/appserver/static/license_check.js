// NOTE: This script can be executed via either a bare <script> tag or RequireJS
(function() {
    var run = function(LicenseMonitor) {
        var PAGES_TO_CONSIDER_FOR_LICENSE_CHECKS = '/app/splunk_for_vmware/';
        
        var PAGES_EXEMPT_FROM_LICENSE_CHECKS = [
            // Anything in the Settings nav menu
            '/app/splunk_for_vmware/config',
            '/app/splunk_for_vmware/collection_config',
            '/app/splunk_for_vmware/install_health',
            '/app/splunk_for_vmware/license_status',
            '/app/splunk_for_vmware/vmware_license_health',
        ];
        
        var currentPageIsExemptFromLicenseCheck = false;
        for (var i = 0; i < PAGES_EXEMPT_FROM_LICENSE_CHECKS.length; i++) {
            var urlFragment = PAGES_EXEMPT_FROM_LICENSE_CHECKS[i];
            if (window.location.href.indexOf(urlFragment) !== -1) {
                currentPageIsExemptFromLicenseCheck = true;
            }
        }
        
        // If being invoked from an Advanced XML context (via application.js),
        // it is possible that we are on a manager page outside the app like
        // /en-US/manager/splunk_for_vmware/distsearch. In such a case we
        // should never perform license checks or redirections. (SOLNVMW-3881)
        if (window.location.href.indexOf(PAGES_TO_CONSIDER_FOR_LICENSE_CHECKS) === -1) {
            currentPageIsExemptFromLicenseCheck = true;
        }
        
        // Redirect to license status page if unlicensed
        // unless current page is exempt from license checks
        if (!currentPageIsExemptFromLicenseCheck) {
            LicenseMonitor.fetchStatus(function(licenseStatus) {
                if (!licenseStatus.valid) {
                    window.location.replace('license_status');
                }
            });
        }
    };
    
    // ----------------------------------------------------------------------
    
    // Call run() after loading all dependencies
    var isAlmond = window.SplunkLicenseMonitor && window.SplunkLicenseMonitor.isAdvancedXml;
    if (isAlmond) {
        // Load dependencies manually if running in context of Advanced XML
        // (where only Almond is available, and not full RequireJS)
        
        var loadScriptAsync = function(scriptUrl) {
            var scriptLoader = document.createElement('script');
            scriptLoader.type = 'text/javascript';
            scriptLoader.src = scriptUrl;
            document.body.appendChild(scriptLoader);
        };
        
        loadScriptAsync('/en-US/static/app/splunk_for_vmware/components/licensemonitor/LicenseMonitor.js');
        
        var loadLoop = function() {
            if (window.SplunkLicenseMonitor && window.SplunkLicenseMonitor.LicenseMonitor) {
                run(window.SplunkLicenseMonitor.LicenseMonitor);
            } else {
                window.setTimeout(loadLoop, 0);
            }
        };
        loadLoop();
    } else {
        // Load dependencies using RequireJS
        require([
            '../app/splunk_for_vmware/components/licensemonitor/LicenseMonitor',
        ], function(
            LicenseMonitor
        ) {
            run(LicenseMonitor);
        });
    }
})();
