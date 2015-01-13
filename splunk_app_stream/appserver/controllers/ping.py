import logging
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.ping import Ping as MPing
from stream_utils import *

logger = setup_logger('ping')

class Ping(controllers.BaseController):
    ''' Ping Controller '''

    @route('/:action')
    @expose_page(must_login=False, methods=['GET']) 
    def ping(self, action='ping', **kwargs):
        '''Return last update status and app version''' 
        result = MPing.ping()                   
        return self.render_json(result)
    
        
    

 

