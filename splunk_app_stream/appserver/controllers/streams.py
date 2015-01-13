import logging
import cherrypy
import json
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.stream import *
from stream_utils import *


init_date_last_updated()
init_streams_collection()

logger = setup_logger('streams')

class Streams(controllers.BaseController):
    """Streams Controller """

    @route('/:id/:action')
    @expose_page(must_login=False, methods=['GET']) 
    def list(self, id='', action='get', **kwargs):
        """Return list of saved streams"""
        result = Stream.list(id, **kwargs)
        if 'status' in result:
            cherrypy.response.status = result['status']
        return self.render_json(result)


    @route('/:id/:action')
    @expose_page(must_login=True, methods=['POST', 'PUT'])
    def save(self, id='', action='save', **params):
        """Update posted stream """
        logger.info('save::id %s action %s', id, action)
        if cherrypy.request.method == 'PUT' and action in ['enable', 'disable']:
            if not id:
                cherrypy.response.status = 400
                return self.render_json({'success': False, 'error': str("Invalid id specified")})
            else:
                orig_stream = Stream.save('', id, action)
                logger.info('save::result %s', orig_stream)
                return self.render_json(orig_stream)
        else:
            # read POST data of type application/json
            try:
                json_dict = self.parse_json_payload()
            except Exception as e:
                logger.exception(e)
                cherrypy.response.status = 500
                return self.render_json({'success': False, 'error': str(e), 'status': 400})
            result = Stream.save(json_dict, id)
            if 'status' in result:
                cherrypy.response.status = result['status']
            logger.info('save::result %s', result)
            return self.render_json(result)                


    @route('/:id/:action')
    @expose_page(must_login=True, methods=['DELETE'])
    def delete(self, id='', action='delete', **params):
        """delete posted stream """
        logger.info('delete::id %s', id)
        result = Stream.delete(id)
        if 'status' in result:
            cherrypy.response.status = result['status']
        logger.info('delete::result %s', result)
        return self.render_json(result)
                

    def parse_json_payload(self):
        """Read request payload and parse it as JSON"""
        logger.info("inside ..............parse_json_payload")
        body = cherrypy.request.body.read()
        logger.info("after ..............parse_json_payload read")
        if not body:
            raise Exception('request payload empty')

        try:
            data = json.loads(body)
        except Exception as e:
            raise Exception('could not parse JSON payload')
        return data
