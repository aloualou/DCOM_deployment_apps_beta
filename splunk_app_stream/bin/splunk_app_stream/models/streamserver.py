import logging
import os
import re
import sys
import time
import json
import copy
import splunk
import splunk.rest
from splunk.search import *
from splunk.util import uuid4
import splunk.appserver.mrsparkle.lib.util as util
import ast
from stream_utils import *
import uuid
from operator import itemgetter
from collections import OrderedDict
from types import *

    
logger = setup_logger('streamserver')
streamServersDir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', "streamservers")
streamServersConfig = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', "streamservers", "config")


def create_streamserver(reqJsonData, transaction=False):
    
    logger.info('create streamserver')
    if reqJsonData['name'] and reqJsonData['host']:
        name = reqJsonData['name']
        host = reqJsonData['host']
        port = 8888
        encrypted = False
        try:
            port = reqJsonData['port']
        except:
            reqJsonData['port'] = port
        try:
            encrypted = reqJsonData['encrypted']
        except:
            reqJsonData['encrypted'] = encrypted

        #uid = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(name + time.asctime(time.gmtime(time.time()))).encode("utf-8")))
        uid = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(name + host + str(port) + str(encrypted)).encode("utf-8")))
        logger.info("uid:: %s" % uid)
        reqJsonData['id'] = uid
        
        jsonData = readAsJson(streamServersConfig)
        if jsonData is 'NotFound':
            logger.info("streamServers:: config notfound")
            createDir(streamServersDir + os.sep)
            streamServersConfigList = []
            streamServersConfigList.append(reqJsonData)
            writeListAsJson(streamServersConfig, streamServersConfigList)   
            return 0             
        else:
            try:
                itemIndex = map(itemgetter('id'), jsonData).index(uid)
                return 1
            except:
                for f in jsonData:
                    if f['host'] == host and f['port'] == port:
                        return 1
                jsonData.append(reqJsonData)
                writeListAsJson(streamServersConfig, jsonData)
                return 0
    else:
        return 3


def delete_streamserver(id, transaction=False):
    '''Delete specified streamserver'''

    logger.info('delete streamserver')
    jsonData = readAsJson(streamServersConfig)
    try:
        itemIndex = map(itemgetter('id'), jsonData).index(id)
        logger.info("streamServersById:: DELETE server index %d" % itemIndex)
        del jsonData[itemIndex]
        writeListAsJson(streamServersConfig, jsonData )
    except:
        return False

    return True


def update_streamserver(reqJsonData, id, transaction=False):
    '''Update specified streamserver with attributes set in json_data'''

    logger.info('update streamserver')
    jsonData = readAsJson(streamServersConfig)
    if jsonData is 'NotFound':
        logger.info("streamServersById:: config not found")
        return 2
    else:
        try:
            itemIndex = map(itemgetter('id'), jsonData).index(id)
            logger.info(itemIndex)
            existingHost = jsonData[itemIndex]['host']
            existingPort = jsonData[itemIndex]['port']
            try:
                name = reqJsonData['name']
                if name:
                    jsonData[itemIndex]['name'] = name
            except:
                pass

            try:
                host = reqJsonData['host']
                if host:
                    jsonData[itemIndex]['host'] = host
                    existingHost = host
            except:
                pass

            try:
                port = reqJsonData['port']
                if type(port) is int:
                    jsonData[itemIndex]['port'] = port
                    existingPort = port
            except:
                pass

            try:
                encrypted = reqJsonData['encrypted']
                if type(encrypted) is bool:
                    jsonData[itemIndex]['encrypted'] = encrypted
            except:
                pass

            for f in jsonData:
                if f['host'] == existingHost and f['port'] == existingPort and f['id'] != id:
                    return 1
            logger.info("streamServersById:: PUT server index %d" % itemIndex)
            writeListAsJson(streamServersConfig, jsonData )
            return 0
        except:
            return 2

class StreamServer:
  
    @staticmethod
    def list():
        '''Return list of saved streamservers'''
        jsonData = readAsJson(streamServersConfig)   
        if jsonData is 'NotFound':
            jsonData = []     
        return jsonData
        
    @staticmethod
    def save(req_json_data, id=''):
        '''Update posted streamserver '''        
        if not id:
            result = create_streamserver(req_json_data)
            if result == 0:
                return req_json_data
            elif result == 1:
                return {'success': False, 'error': str("Resource already exists"), 'status': 400}
            else:
                return {'success': False, 'error': str("Bad Request"), 'status': 400}
        else:
            result = update_streamserver(req_json_data, id)
            if result == 0:
                req_json_data['id'] = id
                return req_json_data
            elif result == 1:
                return {'success': False, 'error': str("Resource already exists"), 'status': 400}
            elif result == 2:
                return {'success': False, 'error': str("Resource not found"), 'status': 404}
            else:
                return {'success': False, 'error': str("Bad Request"), 'status': 400}


    @staticmethod
    def delete(id=''):
        '''Delete streamserver '''
        try:
            if not id:
                return {'success': False, 'error': str("Bad request: No Id in request param"), 'status': 400}
            else:
                result = delete_streamserver(id)
        except Exception as e:
            logger.exception(e)
            return {'success': False, 'error': str(e), 'status': 400}
        #update last updated time
        updateAppsMeta()
        if result:
            return {'success': True, 'deleted': str(id)}
        else:
            return {'success': False, 'error': str("Resource not found"), 'status': 404}

    