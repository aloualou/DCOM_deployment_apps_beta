import logging
import cherrypy
import json
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.streamserver import StreamServer
from stream_utils import *
    

logger = setup_logger('streamservers')

class StreamServers(controllers.BaseController):
    ''' StreamServers Controller '''

    @route('/:action') 
    @expose_page(must_login=False, methods=['GET'])
    def list(self, action='list', **kwargs):
        '''Return list of saved streamservers'''
        result = StreamServer.list() 
        return self.render_json(result)
        
    @route('/:id/:action')
    @expose_page(must_login=True, methods=['POST', 'PUT'])
    def save(self, id='', action='save', **params):
        '''Update posted streamserver '''     
        logger.info('save::id %s', id)
        # read POST data of type application/json
        try:
            reqJsonData = self.parse_json_payload()
        except Exception as e:
            logger.exception(e)
            cherrypy.response.status = 400
            return self.render_json({'success': False, 'error': str(e), 'status': 400})
        result = StreamServer.save(reqJsonData, id)
        if 'status' in result:
            cherrypy.response.status = result['status']
        logger.info('save::result %s', result)
        return self.render_json(result)

    @route('/:id/:action')
    @expose_page(must_login=True, methods=['DELETE'])
    def delete(self, id='', action='delete', **params):
        '''Delete streamserver '''
        logger.info('delete::id %s', id)
        result = StreamServer.delete(id)
        if 'status' in result:
            cherrypy.response.status = result['status']
        logger.info('delete::result %s', result)
        return self.render_json(result)

    def parse_json_payload(self):
        '''Read request payload and parse it as JSON'''
        logger.info("inside ..............parse_json_payload")
        body = cherrypy.request.body.read()
        logger.info("after ..............parse_json_payload read")
        logger.info(body)
        if not body:
            raise Exception('request payload empty')
        try:
            data = json.loads(body)
        except Exception as e:
            raise Exception('could not parse JSON payload')
       
        return data
