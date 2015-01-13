import splunk.rest
from splunk_app_stream.models.vocabulary import Vocabulary
from stream_utils import *

logger = setup_logger('rest_vocabularies')

class Vocabularies(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return list of vocabularies'''
        output = {}
        output['vocabularies'] = Vocabulary.list()                 
        return output
    