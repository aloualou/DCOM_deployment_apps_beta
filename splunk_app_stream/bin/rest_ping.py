from splunk_app_stream.models.ping import Ping as MPing
import splunk.rest
from stream_utils import *

logger = setup_logger('rest_ping')


class Ping(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return last update status and app version''' 
        output = {}
        output['ping'] = MPing.ping()                   
        return output
    