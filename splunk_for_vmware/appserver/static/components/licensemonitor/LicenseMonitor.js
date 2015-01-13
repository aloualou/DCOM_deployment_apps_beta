(function() {
    var createModule = function($) {
        /**
         * Tracks whether the current app's licensing restrictions are satisfied.
         */
        var LicenseMonitor = {
            /**
             * Fetches the current license status.
             * 
             * Fetches are expected to be performed on every page load,
             * so they are designed to generally return quickly, in less than a second.
             */
            fetchStatus: function(callback) {
                LicenseMonitor._fetchOrRefreshStatus(
                    /*isRefresh=*/false,
                    callback);
            },
            
            /**
             * Refreshes the license status, returning the latest status.
             * 
             * Refreshes can take up to a few minutes.
             */
            refreshStatus: function(callback) {
                LicenseMonitor._fetchOrRefreshStatus(
                    /*isRefresh=*/true,
                    callback);
            },
            
            _fetchOrRefreshStatus: function(isRefresh, callback) {
                // JIRA: Workaround lack of API to build URLs that are agnostic
                //       to the root endpoint location and locale. (SPL-91659)
                var PATH_TO_ROOT = '../../..';
                
                $.ajax({
                    type: isRefresh ? 'GET' :
                                      'GET',
                    url: isRefresh ? PATH_TO_ROOT + '/en-US/custom/splunk_for_vmware/license_monitor/refresh_status'
                                   : PATH_TO_ROOT + '/en-US/custom/splunk_for_vmware/license_monitor/get_status'
                }).always(function(data, responseStatus) {
                    var now = new Date().getTime() / 1000;
                    
                    var createErrorStatus = function(messages) {
                        return {
                            'updated': now,
                            'valid': false,
                            'messages': messages,
                            'usage': {
                                'current': 0,
                                'max': -1,
                                'unit': 'GB'
                            },
                            'expires': -1
                        };
                    };
                    
                    var licenseStatus;
                    if (responseStatus === 'success' && data) {
                        licenseStatus = data;
                    } else if (responseStatus === 'success' && !data) {
                        licenseStatus = createErrorStatus([
                            {
                                'severity': 'error',
                                'description': 'License monitor has not finished checking license status.',
                                'type': 'not_ready'
                            }
                        ]);
                    } else {
                        licenseStatus = createErrorStatus([
                            {
                                'severity': 'error',
                                'description': 'Unable to reach license monitor endpoint. Please contact Support.'
                            }
                        ]);
                    }
                    
                    // Invalidate license status if it is too stale
                    var staleness = now - licenseStatus.updated;
                    if (staleness > 24*60*60 * 1.5) {  // 1.5 days
                        licenseStatus.valid = false;
                        licenseStatus.messages = [
                            {
                                'severity': 'error',
                                'description': 'License monitor is disabled or unresponsive. Please contact Support.'
                            }
                        ];
                    }
                    
                    callback(licenseStatus);
                });
            },
            
            /**
             * Applies a demo license with the specified license master
             * username and password, returning any error that occurred,
             * of type null|{'type': str, 'message': str}.
             */
            applyDemoLicense: function(username, password, callback) {
                $.ajax({
                    type: 'GET',
                    url: '/en-US/custom/splunk_for_vmware/license_monitor/apply_demo_license',
                    data: {
                        'username': username,
                        'password': password
                    }
                }).always(function(data, responseStatus) {
                    var applyErrorInfo;
                    if (responseStatus === 'success') {
                        applyErrorInfo = data;
                    } else {
                        applyErrorInfo = {
                            'type': 'unknown',
                            'message': 'Unable to reach license monitor endpoint. Please contact Support.'
                        };
                    }
                    
                    callback(applyErrorInfo);
                });
            }
        };
        
        return LicenseMonitor;
    };
    
    // ----------------------------------------------------------------------
    
    // Call createModule() after loading all dependencies
    var isAlmond = window.SplunkLicenseMonitor && window.SplunkLicenseMonitor.isAdvancedXml;
    if (isAlmond) {
        // Load dependencies manually if running in context of Advanced XML
        // (where only Almond is available, and not full RequireJS)
        
        // NOTE: Assume that JQuery was already <script>-included by
        //       the current page. So don't try to reinclude here.
        
        var loadLoop = function() {
            if (window.$) {
                var module = createModule(window.$);
                
                // Export as SplunkForVmware.LicenseMonitor for non-AMD importers
                window.SplunkLicenseMonitor = window.SplunkLicenseMonitor || {};
                window.SplunkLicenseMonitor.LicenseMonitor = module;
            } else {
                window.setTimeout(loadLoop, 0);
            }
        };
        loadLoop();
    } else {
        // Load dependencies using RequireJS
        
        // Export as module for AMD importers
        define([
            'jquery',
        ], function(
            $
        ) {
            return createModule($);
        });
    }
})();