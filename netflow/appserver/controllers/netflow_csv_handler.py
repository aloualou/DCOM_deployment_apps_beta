import sys
import os
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'bin')))
import netflow_appname
import netflow_csv_checker

class CSVHANDLER(controllers.BaseController):
    @expose_page(must_login=True, methods=['GET'])
    def check(self, **kwargs):
        cc = netflow_csv_checker.CSVChecker()
        return cc.check(**kwargs)

