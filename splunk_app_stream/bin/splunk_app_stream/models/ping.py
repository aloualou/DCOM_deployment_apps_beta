import logging
import splunk.appserver.mrsparkle.lib.util as util
from stream_utils import *

localDir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local')
logger = setup_logger('ping')

class Ping:

    @staticmethod
    def ping():
        '''Return last update status and app version'''
        createDir(localDir + os.sep)
        jsonData = readAsJson(appsMetaFile)
        if jsonData is 'NotFound':
            jsonData = updateAppsMeta()
                    
        return jsonData
        