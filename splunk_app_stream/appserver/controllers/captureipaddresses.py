import logging
import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.captureipaddress import CaptureIpAddress
from stream_utils import *

logger = setup_logger('captureipaddresses')

class CaptureIpAddresses(controllers.BaseController):
    ''' CaptureIpAddresses Controller '''

    @route('/:action')
    @expose_page(must_login=False, methods=['GET']) 
    def list(self, action='list', **kwargs):
        '''Return list of captureipaddresses including whiteList and blackList'''
        captureIpAddressesJsonList = CaptureIpAddress.list()
        return self.render_json(captureIpAddressesJsonList)
        
    @route('/:id/:action')
    @expose_page(must_login=True, methods=['POST', 'PUT'])
    def save(self, id='', action='save', **params):
        '''Update posted captureipaddresses '''
        logger.info('save::id:: %s' % id)
        result = CaptureIpAddress.save(cherrypy.request.body.read(), id)
        logger.info('save::result:: %s', result)
        if 'status' in result:
            cherrypy.response.status = result['status']
        return self.render_json(result)

 

