import sys
import os
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'bin')))
import netflow_appname
import netflow_nav_builder

class NavHandler(controllers.BaseController):
    @expose_page(must_login=True, methods=['GET'])
    def rebuild_nav(self, **kwargs):
        nb = netflow_nav_builder.NavBuilder()
        return nb.rebuild_nav(**kwargs)

