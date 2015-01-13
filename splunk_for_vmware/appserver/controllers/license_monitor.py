import json
import os
import os.path
import sys

import cherrypy
import splunk
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
# JIRA: Must use private API to construct paths inside $SPLUNK_HOME that are
#       resilient to Splunk being configured for search head pooling. (SPL-91730)
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

sys.path.append(make_splunkhome_path(
    ['etc', 'apps', 'SA-VMW-Licensecheck', 'bin']))
from vmware_licensecheck import VMwareLicenseCheck


LICENSE_STATUS_FILEPATH = make_splunkhome_path([
    'etc', 'apps', 'splunk_for_vmware',
    'bin', 'LicenseStatus.json'])


# JIRA: Must use private API (splunkweb controllers) for server-side
#       endpoint due to lack of public API. (SPL-90798)
class LicenseMonitorService(controllers.BaseController):
    @expose_page(must_login=True, methods=['GET'])
    def get_status(self, **kwargs):
        """
        Returns current status of license monitor, or None if it isn't running.
        """
        if os.path.exists(LICENSE_STATUS_FILEPATH):
            with open(LICENSE_STATUS_FILEPATH, 'rb') as f:
                license_status = f.read()
        else:
            license_status = json.dumps(None)
        
        cherrypy.response.headers['Content-Type'] = 'text/json'
        return license_status
    
    # NOTE: Should only allow POST but @expose_page(methods=['POST'])
    #       results in endpoint incorrectly giving HTTP 405 Method Not Allowed.
    @expose_page(must_login=True, methods=['GET'])
    def refresh_status(self, **kwargs):
        """
        Synchronously refreshes the status of the license monitor,
        returning the new status.
        """
        license_checker = self._create_license_checker()
        license_checker.runLicenseCheck()
        
        return self.get_status()
    
    # NOTE: Should only allow POST but @expose_page(methods=['POST'])
    #       results in endpoint incorrectly giving HTTP 405 Method Not Allowed.
    @expose_page(must_login=True, methods=['GET'])
    def apply_demo_license(self, username, password, **kwargs):
        """
        Applies a demo license to the current license master.
        If the license master is remote, the provided credentials
        will be used to authenticate to it.
        
        Returns None if success or a {"type": str, "message": str} if error.
        """
        license_checker = self._create_license_checker()
        result = license_checker.tryDeployDemoLicense(username, password)
        
        cherrypy.response.headers['Content-Type'] = 'text/json'
        return json.dumps(result)
    
    # === Utility ===
    
    def _create_license_checker(self):
        license_checker = VMwareLicenseCheck()
        license_checker.local_session_key = cherrypy.session.get('sessionKey')
        license_checker.local_server_uri = '%s://%s:%s' % (
            splunk.getDefault('protocol'),
            splunk.getDefault('host'),
            splunk.getDefault('port')
        )
        return license_checker
