#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.

import sys
import splunk
import splunk.entity as en
import splunk.Intersplunk as si
import string
import logging, logging.handlers
import os
from itertools import groupby, izip
from operator import itemgetter
from splunk.entity import Entity
import json
import operator
import bz2,json,contextlib
import urllib2
import time
import splunk.bundle as bundle
import splunk.util as util
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

class Usage(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)

class NoMatch(Exception):
    pass
    
(isgetinfo, sys.argv) = si.isGetInfo(sys.argv)

if isgetinfo:
        si.outputInfo(True, False, True, False, None, False)
        sys.exit(0)

#results = si.readResults(None, None, True)
results,dummyresults,settings = si.getOrganizedResults()

## Get session key
sessionKey = settings.get('sessionKey', None)

# Get the host
host = splunk.getDefault("host")

#splunk_home= os.environ['SPLUNK_HOME']
datastructures_path = make_splunkhome_path(['etc', 'apps', 'splunk_for_vmware', 'local', 'data'])

def setup_logger():
    """
    Setup a logger for the search command
    """
   
    # Do not ship with a DEBUG level. It will overflow customer machines. (TAG-8235)
    logger = logging.getLogger('generateIIT')
    logger.setLevel(logging.INFO) 
   
    file_handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/generateIIT.log' )
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    file_handler.setFormatter(formatter)
   
    logger.addHandler(file_handler)
   
    return logger


def buildPrefixTree(keys, partial_matching, suggestionsLimit):
    """
    /**
     * Builds Prefix tree with all the prefixes
     * for each key in 'keys' added to IIT
     * T 
     */

     """

    iit={}
    allPrefixKeys=[]
    keyIIT={}
    for i in range(0,len(keys)):
        key=keys[i]
        if partial_matching:
            [allprefixTree, keyIIT]=addtoKeyIndex(key, allPrefixKeys, keyIIT, suggestionsLimit)
        for j in range(len(key),0, -1):
            word=key[0:j]
            if(not word in iit ):
                iit[word]=[]
                iit[word].append(i)
            else:
                keyPts=iit[word]
                if len(keyPts)< suggestionsLimit:
                    keyPts.append(i)
                else:
                    break;
    prefixTree={}
    prefixTree['iit']=iit
    prefixTree['allPrefixKeys']=allPrefixKeys
    prefixTree['keyIIT']=keyIIT
    return prefixTree



def addtoKeyIndex(word, allPrefixKeys, keyIIT, suggestionsLimit): 
    """
    /**
     * Add keys to Character level Inverted Index Trees Input
     * word- key that needs to be broken down into substrings
     * Substrings will be added to keyIIT Inverted Index Tree
     */
    """

    allPrefixKeys.append(word)
    localHashForDups={}
    for i in range(1,len(word)-1):
        for j in range(len(word), i, -1):
            substr=word[i:j]
            if(substr in localHashForDups):
               break
            else:
                localHashForDups[substr]=1
            if(not substr in keyIIT):
                keyIIT[substr]=[]
                keyIIT[substr].append(len(allPrefixKeys)-1)
            else:
                if(len(keyIIT[substr])<suggestionsLimit):
                    keyIIT[substr].append(len(allPrefixKeys)-1)
                else:
                    continue
            
    return [allPrefixKeys, keyIIT]
            

def buildEntityIndex(fullPathNames):
    """
    /**
     * Builds Word level Inverted Index Tree from list of
     * Strings. This method splits strings by "/" and put words
     * into the Index tree Input(pathNames): List of Strings
     * where each String
     */
     """
    entityiit = {}
    pathIndex=0;
    for pathName in fullPathNames:
        entityArr=pathName.split("/")
        for entity in entityArr:
            if(entity):
                if(entity in entityiit):
                    locations=entityiit.get(entity)
                    locations.append(pathIndex)
                    entityiit[entity]=locations
                else: 
                    locations=[pathIndex]
                    entityiit[entity]=locations
        pathIndex+=1
    return entityiit
            

def preProcessData(logger,data, pathFields, idFields, partial_matching, suggestionsLimit):
    """Preprocesses the data to and builds the data structure to be used by entity detail views.
    """ 
    logger.debug('key Data', len(data) )
    allKeys={}
    fullPathNames=[]
    selectedTypeHash={}
    idFieldsHash={}
    
    for field in idFields:
        hashName = field + "Hash"
        idFieldsHash[hashName]={}
    for r in data:
        key=""
        #logger.debug('key Name', key )
        allKeys[key]=1
        for field in pathFields:
            if(r[field]!=""):
                allKeys[r[field]]=1
                key+="/"+r[field]
        key+= "/"+ r['name']
        allKeys[r['name']]=1
        fullPathNames.append(key)
    
        # Generate selectedType Hash
        selectedHashKey=""
        for field in idFields:
            hashName = field + "Hash"
            if(selectedHashKey==""):
                selectedHashKey=r[field]
            else:
                selectedHashKey+= "-"+ r[field]
            idFieldsHash[hashName][key]=r[field]
        selectedTypeHash[selectedHashKey]=key
    keys=allKeys.keys()
    prefixTree = buildPrefixTree(keys, partial_matching, suggestionsLimit)
    
    entityiit = buildEntityIndex(fullPathNames)
    processedData={}
    logger.debug("Iterating through Suffix tree")
    for key, value in prefixTree.iteritems():
        processedData[key]=value

    processedData['entityiit']=entityiit
    processedData['selectedTypeHash']=selectedTypeHash
    processedData['keys']=keys
    processedData['fullPathNames']=fullPathNames
    processedData['idFieldsHash']=idFieldsHash
    return processedData

def saveIntoFile(processedData, fileName, folderName):
    """
    Saves data into a file with name 'filename' 
    inside 'folderName' folder
    """  
    path=os.path.join(datastructures_path,folderName)  
    logger.debug("FoldePath %s ", path)
    if not os.path.exists(path):
        logger.debug("Creating folder %s", folderName)
        os.makedirs(path)
    model={}
    filePath= os.path.join(path, fileName)
    logger.debug("Processed Data %s", processedData)
    for key, value in processedData.iteritems():
        model[key]=json.dumps(value)
        logger.debug("Model key %s", key)
        logger.debug("Model value %s", model[key])
        with contextlib.closing(bz2.BZ2File(filePath, 'wb',compresslevel=9)) as f:
            json.dump(model, f)
    return True

 
def saveFileIntoVM(fileName, model):
    """
    Used only for saving files into the vm folder
    """
    folderPath= os.path.join(datastructures_path, 'vm')
    filePath= os.path.join(folderPath, fileName)
    if not os.path.exists(folderPath):
        logger.debug("Creating vm folder ")
        os.makedirs(folderPath)
    with contextlib.closing(bz2.BZ2File(filePath, 'wb',compresslevel=9)) as f:
            json.dump(model, f)
if __name__ == '__main__':
    try:
        partial_matching=True
        suggestionsLimit=10
        allKeys={}
        fullPathNames=[]
        selectedTypeHash={} 
        logger = setup_logger()
        logger.debug('Building Inverted Index Trees...')
        logger.debug("Settings %s",settings)
        arguments={}
        arguments=dict(item.split("=") for item in sys.argv[1:])
        logger.debug(arguments)
        if(arguments['partial_matching']=='false'):
            logger.debug(arguments['partial_matching'])
            partial_matching=False
        
        if('suggestionsLimit' in arguments):
            strSuggestionsLimit=arguments['suggestionsLimit']
            logger.debug('suggestionsLimit %s', strSuggestionsLimit)
            suggestionsLimit=int(strSuggestionsLimit)
        # parse results to save hostsystem, vm and clusterdata in different lists
        hostsystemData=[]
        vmData=[]
        clusterData=[]
        for r in results:
            if(r['type']=="HostSystem"):
                hostsystemData.append(r)
            elif(r['type']=="VirtualMachine"):
                vmData.append(r)
            elif(r['type']=='ClusterComputeResource'):
                clusterData.append(r)
        logger.debug(clusterData)
        pathFields=["host","grandParentName","parentName"]
        idFields=["host", "moid"]
        
        # Preprocess hostsystem data and save the data structures to the disk
        logger.debug("Host System Data")
        processedData = preProcessData(logger,hostsystemData, pathFields, idFields, partial_matching,suggestionsLimit)
        
        saveIntoFile(processedData,'hostsystem.bz2', 'hostsystem')
        
        
        processedData = preProcessData(logger,vmData, pathFields, idFields, partial_matching,suggestionsLimit)
        
        
        # VM datastructures can be maasive in size so break down structures and save into different files 
        model={}
        vmdata_path =make_splunkhome_path(['etc', 'apps', 'splunk_for_vmware', 'local', 'data', 'vm'])
        if not os.path.exists(vmdata_path):
            os.makedirs(vmdata_path)
        model['iit']=json.dumps(processedData['iit'])
        saveFileIntoVM('vm_iit.bz2', model)
        
        model={}
        model['entityiit']=json.dumps(processedData['entityiit'])
        saveFileIntoVM('vm_entityiit.bz2', model) 
        
        model={}
        model['allPrefixKeys']=json.dumps(processedData['allPrefixKeys'])
        saveFileIntoVM('vm_allPrefixKeys.bz2', model)
            
        model={}
        model['keyIIT']=json.dumps(processedData['keyIIT'])
        saveFileIntoVM('vm_keyIIT.bz2', model)  
        model={}
        model['fullPathNames']=json.dumps(processedData['fullPathNames'])
        model['keys']=json.dumps(processedData['keys'])
        model['selectedTypeHash']= json.dumps(processedData['selectedTypeHash'])
        model['idFieldsHash']=json.dumps(processedData['idFieldsHash'])
        
        saveFileIntoVM('vm_fullPathNames.bz2', model)            
            
        
        processedData = preProcessData(logger,clusterData, pathFields, idFields, partial_matching,suggestionsLimit)
        saveIntoFile(processedData,'cluster.bz2', 'cluster') 
        
        try:
            # Required to create host path url
            
            # Read the root end point from web.conf
            conf = bundle.getConf("web", sessionKey=sessionKey)
            web_settings = conf.findStanzas("settings")
            data = web_settings.data["settings"]
            root_endpoint = data.get("root_endpoint")
            
            # Check for ssl
            ssl = util.normalizeBoolean(data.get("enableSplunkWebSSL"))
            
            # Fetch the httpport
            port = data.get("httpport")
            
            protocol = "http://"
            logger.debug("SSL %s", ssl)
            if ssl:
                logger.debug("Setting protocol to https")
                protocol="https://"
                
            # Create host URL with root end end point
            host_url = protocol + host +":"+ port +root_endpoint.rstrip("/")
            
            # Append Custom URL
            custom_url= host_url +'/custom/splunk_for_vmware/read_structures_service/splunk_for_vmware/read_structures'
            logger.debug('Custom URL %s', custom_url)
            response = urllib2.urlopen(custom_url)
        except Exception as e:
            logger.exception('Could not complete read_structures action %s', e )
            raise(e)
               
        si.outputResults(results)

    except Usage as e:
        err_results = si.generateErrorResults("Received '%s' arguments. Usage: [generateIIT]" % e)
        si.outputResults(err_results)

    except Exception as e:
        import traceback
        stack =  traceback.format_exc()
        err_results = si.generateErrorResults("Error '%s'" % stack)
        si.outputResults(err_results)
