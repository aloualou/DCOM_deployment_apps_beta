import splunk
import splunk.rest
import logging
import logging.handlers
import json
from splunk_app_stream.models.stream import *
from stream_utils import *

logger = setup_logger('rest_streams')
init_streams_collection() 

class Streams(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        id = ''
        try:
        	id = self.args['id']
        except:
        	pass        
        result = Stream.list(**self.args)
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streams'] = result
        return output
    
    def handle_POST(self):
        form_body = self.request['payload']
        id = ''
        try:
            id = self.args['id']
        except:
            pass
       
        action = ''
        try:
            action = self.args['action']
        except:
            pass
        logger.info("save::id %s action %s", id, action)
        if action in ['enable', 'disable']:
            if not id:
                self.response.status = 400
                raise splunk.RESTException(self.response.status, "Invalid id specified")
            else:
                result = Stream.save('', id, action)
                if 'status' in result:
                    self.response.status  = result['status']
                if self.response.status > 399:
                    raise splunk.RESTException(self.response.status, result['error'])
                output = {}
                output['streams'] = result
                logger.info("save::result %s", result)
                return output

        try:
            data = json.loads(form_body)
            result = Stream.save(data, id)
        except Exception as e:
            output = {}
            output['streams'] = {'success': False, 'error': str(e), 'status': 500}
            raise splunk.RESTException(500, str(e))

        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streams'] = result
        logger.info("save::result %s", result)
        return output

    handle_PUT = handle_POST

    def handle_DELETE(self):
        id = ''
        try:
            id = self.args['id']
        except:
            pass
        logger.info("delete::id %s", id)
        result = Stream.delete(id)
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['streams'] = result
        logger.info("delete::result %s", result)
        return output
        
    	