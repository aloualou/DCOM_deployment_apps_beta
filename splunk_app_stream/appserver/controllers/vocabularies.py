import logging
import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.vocabulary import Vocabulary
from stream_utils import *
    
logger = setup_logger('streamservers')

class Vocabularies(controllers.BaseController):
    ''' Vocabularies Controller '''

    @route('/:action')
    @expose_page(must_login=False, methods=['GET'])
    def list(self, action='list', **kwargs):
        '''Return list of vocabularies'''                
        content = Vocabulary.list()
        cherrypy.response.headers['Content-Type'] = 'text/xml'
        return content
    

 

