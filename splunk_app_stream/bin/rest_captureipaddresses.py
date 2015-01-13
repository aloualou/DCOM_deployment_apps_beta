import splunk.rest
from splunk_app_stream.models.captureipaddress import CaptureIpAddress
from stream_utils import *

logger = setup_logger('rest_captureipaddresses')


class CaptureIpAddresses(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return list of vocabularies'''
        output = {}
        output['captureipaddresses'] = CaptureIpAddress.list()                 
        return output

    def handle_POST(self):
        form_body = self.request['payload']
        id = ''
        try:
            id = self.args['id']
        except:
            pass
        logger.info('save::id %s', id)
        result = CaptureIpAddress.save(form_body, id)
        if 'status' in result:
            self.response.status  = result['status']
        if self.response.status > 399:
            raise splunk.RESTException(self.response.status, result['error'])
        output = {}
        output['captureipaddresses'] = result
        logger.info('save::result %s', result)
        return output

    handle_PUT = handle_POST