import splunk.rest
import json
from splunk_app_stream.models.streamserver import StreamServer
from stream_utils import *

logger = setup_logger('rest_streamservers')

	
class StreamServers(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        id = ''
        try:
        	id = self.args['id']
        except:
        	pass
        result = StreamServer.list()
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streamservers'] = result
        return output

    def post_put(self):
        form_body = self.request['payload']        
        id = ''
        try:
            id = self.args['id']
        except:
            pass
        try:
            data = json.loads(form_body)
            result = StreamServer.save(data, id)
        except Exception as e:
            output = {}
            output['streamservers'] = {'success': False, 'error': str(e)}
            return output
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streamservers'] = result
        return output
    
    def handle_POST(self):
        return self.post_put()
 
    def handle_PUT(self):
        return self.post_put()

    def handle_DELETE(self):
        id = ''
        try:
            id = self.args['id']
        except:
            pass            
        result = StreamServer.delete(id)
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streamservers'] = result
        return output
        
    	