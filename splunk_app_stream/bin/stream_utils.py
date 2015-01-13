import json
import time
import logging
from collections import OrderedDict
import os
import ConfigParser
import StringIO
import splunk.appserver.mrsparkle.lib.util as util
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

currentDir = os.path.dirname(__file__)
appsMetaFile = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local') + os.sep + "apps"

def readAsJson(resourceLocation):
    logger.info("utils::readAsJson:: %s" % resourceLocation)
    try:
        f = open( resourceLocation, 'r' )
    except:
        return 'NotFound'
    else:
        data = f.read()
        jsonResource = json.loads(data, object_pairs_hook=OrderedDict)
        f.close()
        return jsonResource

def writeAsJson(resourceLocation, jsonData):
    logger.info("utils::writeAsJson:: %s" % resourceLocation)
    try:
        f = open( resourceLocation, 'w+' )
    except:
        return 'NotFound'
    else:
        updateAppsMeta()
        #jsonData["updatedBy"] = request.user.username
        #jsonData["dateLastUpdated"] = time.asctime(time.gmtime(time.time()))
        f.write(json.dumps(jsonData, sort_keys=True, indent=2))
        f.close()
        return 'Found'

def writeListAsJson(resourceLocation, jsonData):
    logger.info("utils::writeAsJson:: %s" % resourceLocation)
    try:
        f = open( resourceLocation, 'w+' )
    except:
        return 'NotFound'
    else:
    	updateAppsMeta()
        f.write(json.dumps(jsonData, sort_keys=True, indent=2))
        f.close()
        return 'Found'

def updateField(jsonData, req_json_data, field):
    try:
        jsonData[field] = req_json_data[field]
    except:
        pass

def updateListDictField(jsonData, req_json_data_dict, field, listField, itemIndex):
    try:
        jsonData[listField][itemIndex][field] = req_json_data_dict[field]
    except:
        pass

def createDir(dirName):
    logger.info("create dir %s" % dirName)
    d = os.path.dirname(dirName)
    if not os.path.exists(d):
        os.makedirs(d)
        
def updateAppsMeta():
    logger.info("utils::updateAppsMeta:: %s" % appsMetaFile)
    try:
        f = open( appsMetaFile, 'w+' )
    except:
        return 'NotFound'
    else:
    	jsonData = {}
    	jsonData["dateLastUpdated"] = int(round(time.time() * 1000))
        jsonData["version"] = getAppVersion()      
        f.write(json.dumps(jsonData, sort_keys=True, indent=2))
        f.close()
        return jsonData

def getAppVersion():
	appConf = os.path.abspath(os.path.join(os.path.dirname( __file__ ), '..', 'default')) + "/app.conf"
	ini_str = '[comments]\n' + open(appConf, 'r').read()
	ini_fp = StringIO.StringIO(ini_str)
	config = ConfigParser.RawConfigParser(allow_no_value=True)
	config.readfp(ini_fp)	
	logger.info("utils::getAppVersion:: %s" % appConf)
	version = config.get('launcher', 'version')
	logger.info("utils::getAppVersion:: %s" % version)
	return version

def setup_logger(modulename):
    logger = logging.getLogger(modulename)
    logger.propagate = False # Prevent the log messages from being duplicated in the python.log file
    logger.setLevel(logging.DEBUG)

    try:
        SPLUNK_HOME_LOG_PATH = make_splunkhome_path(["var", "log", "splunk"])     
        LOG_FILENAME = ''
        # check to see if the SPLUNK_HOME based log path exists
        if not os.path.exists(SPLUNK_HOME_LOG_PATH): 
            # check to see if the relative path based log path exists
            SPLUNK_BASE = os.path.abspath(os.path.join(os.path.dirname( __file__ ), '..', '..', '..', '..'))
            SPLUNK_BASE_LOG_PATH = os.path.join(SPLUNK_BASE, 'var', 'log', 'splunk')        
            if not os.path.exists(SPLUNK_BASE_LOG_PATH): 
                # disable logging with noop handler
                logger.addHandler(logging.NullHandler())
                return logger        
            else:
                LOG_FILENAME = os.path.join(SPLUNK_BASE_LOG_PATH, 'splunk_app_stream.log')               
        else:
            LOG_FILENAME = os.path.join(SPLUNK_HOME_LOG_PATH, 'splunk_app_stream.log')

        # valid log file path exists and rotate at 10 MB
        file_handler = logging.handlers.RotatingFileHandler(LOG_FILENAME, maxBytes=10240000, backupCount=10)
        LOGGING_FORMAT = "%(asctime)s %(levelname)-s\t%(name)s:%(lineno)d - %(message)s"
        file_handler.setFormatter(logging.Formatter(LOGGING_FORMAT))
        logger.addHandler(file_handler)

        return logger
    except:
        # disable logging with noop handler
        logger.addHandler(logging.NullHandler())
        return logger


logger = setup_logger('streams_utils')