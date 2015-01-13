import sys
import os
import json
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'bin')))
import netflow_appname
import netflow_config_tool

class ConfigHandler(controllers.BaseController):
    @expose_page(must_login=True, methods=['GET'])
    def get_key(self, **kwargs):
        ct = netflow_config_tool.ConfigTool()
        return ct.get_key(**kwargs)

    @expose_page(must_login=True, methods=['GET'])
    def set_multiple_keys(self, **kwargs):
        ct = netflow_config_tool.ConfigTool()
        return ct.set_multiple_keys(**kwargs)

