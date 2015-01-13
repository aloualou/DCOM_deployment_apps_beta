import logging
import os
import re
import sys
import time
import json
from datetime import datetime as dt
from copy import copy
import splunk
import splunk.rest
from splunk.search import *
from splunk.util import uuid4
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.appserver.mrsparkle.lib.apps as apps
import ast
from stream_utils import *
from ping import Ping 

base_default_streams_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', "streams")
base_local_streams_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', "streams")

# Last updated time used to refresh cache
dateLastUpdated = 0

#
# App Name -> App Location cache
app_locations_map = {}

# Stream Id -> App Location Cache
stream_app_location_map = {}

# Map of all the streams in all the apps keyed by app_id
app_streams = {}

# Stream definitions bundled with splunk_app_stream
base_streams = []
base_stream_ids = []

# Get list of apps installed
apps = apps.local_apps.items()
for app in apps:
    app_name = app[0]
    app_location = app[1]['full_path']
    app_locations_map[app_name] = app_location

logger = setup_logger('stream')

def init_date_last_updated():
    pingData = Ping.ping()
    dateLastUpdated = pingData['dateLastUpdated']

def init_streams_collection():

    global app_streams, stream_app_location_map, base_streams, base_stream_ids
    logger.info('initstreamscollection')
    # Fetch the list of streams defined by splunk_app_stream
    base_streams = read_streams(app_locations_map['splunk_app_stream'], "splunk_app_stream")
    base_stream_ids = []
    base_streams_map = {}
    for base_stream in base_streams:
        base_stream_ids.append(base_stream['id'])
        base_streams_map[base_stream['id']] = base_stream
        stream_app_location_map[base_stream['id']] = app_locations_map['splunk_app_stream']

    logger.info("Base Stream Ids:: %s" % base_stream_ids)

    for app in apps:
        app_name = app[0]
        app_location = app[1]['full_path']

        if app_name != "splunk_app_stream":
            streams = read_streams(app_location, app_name)

            result_streams = []

            if len(streams) != 0:
                for stream in streams:
                    # If a stream with the same id is found.. then treat the external stream defn
                    # as a requirement spec. rather than a new stream
                    # Check underlying stream name and enable if necessary
                    if stream['id'] in base_stream_ids:
                        logger.info("Requirement Spec found for stream with id %s" % stream['id'])

                        if stream['enabled']:
                            base_stream = base_streams_map[stream['id']]
                            if not base_stream['enabled']:
                                base_stream['enabled'] = True
                            update_required_by(base_stream, app_name)

                            base_stream_fields = base_stream['fields']

                            fields = stream['fields']
                            # Do field wise comparison and enable if necessary
                            for field in fields:
                                # Update required_by field
                                if field['enabled']:
                                    for base_stream_field in base_stream_fields:
                                        if base_stream_field['term'] == field['term']:
                                            update_required_by(base_stream_field, app_name)
                                            if not base_stream_field['enabled']:
                                                base_stream_field['enabled'] = True

                    else:
                        # Prepend the stream id with the app field if specified or app_name if not
                        # Only for the external apps
                        if 'app' in stream:
                            stream['id'] = stream['app'] + '_' + stream['id']
                        else:
                            stream['id'] = app_name + '_' + stream['id']

                        #Cache the app_location for the Stream
                        stream_app_location_map[stream['id']] = app_location
                        result_streams.append(stream)

                app_streams[app_name] = result_streams
                logger.info("Streams for App %s are %d" % (app_name, len(streams)))

    app_streams["splunk_app_stream"] = base_streams

# Delete is only allowed for modified streams which are stored
# under local/streams in the stream app.
def delete_stream(stream_id):
    stream_path = os.path.join(base_local_streams_dir, stream_id)
    json_data = read_stream_as_json(stream_id, base_local_streams_dir)
    delete_succeeded = False

    if json_data != "StreamNotFound":
        try:
            is_locked = json_data['locked']
            if not is_locked:
                try:
                    os.remove(stream_path)
                    updateAppsMeta()
                    delete_succeeded = True
                except OSError:
                    pass
        except:
            pass

    return delete_succeeded


def read_stream_as_json(stream_id, streams_dir):
    stream_path = os.path.join(streams_dir, stream_id)
    #logger.info("read_stream_as_json:: %s" % stream_path)
    try:
        f = open( stream_path, 'r' )
    except:
        return 'StreamNotFound'
    else:
        data = f.read()
        json_stream = json.loads(data, object_pairs_hook=OrderedDict)
        if json_stream['id'] == stream_id:
            f.close()
            return json_stream
        else:
            logger.error("Invalid Stream definition -- Id does not match file name at :: %s" % stream_path)
            return 'InvalidStreamDefinition'

def write_json_to_stream(stream_id, json_data):
    stream_path = os.path.join(base_local_streams_dir, stream_id)
    logger.info("write_json_to_stream:: %s" % stream_path)
    createDir(base_local_streams_dir + os.sep)
    try:
        f = open( stream_path, 'w' )
    except:
        return 'StreamNotFound'
    else:
        #json_data["updatedBy"] = request.user.username
        #json_data["dateLastUpdated"] = time.asctime(time.gmtime(time.time()))
        f.write(json.dumps(json_data, sort_keys=True, indent=2))
        f.close()
        updateAppsMeta()
        return 'StreamFound'


def update_field(json_data, req_json_data, field):
    try:
        json_data[field] = req_json_data[field]
    except:
        pass

def update_list_field(json_data, req_json_data_dict, field, itemIndex):
    try:
        json_data["fields"][itemIndex][field] = req_json_data_dict[field]
    except:
        pass

def get_stream_dirs_for_app(app_location):
    default_streams_dir = os.path.join(app_location, 'default', "streams")
    local_streams_dir = os.path.join(app_location, 'local', "streams")
    return default_streams_dir, local_streams_dir

def get_stream_ids_for_app(app_location):
    default_stream_ids = []
    local_stream_ids = []

    default_streams_dir, local_streams_dir = get_stream_dirs_for_app(app_location)

    logger.info("DefaultDir %s, LocalDir %s" % (default_streams_dir, local_streams_dir))

    if os.path.exists(default_streams_dir):
        default_stream_ids = filter(lambda(x): not x.startswith('.'), next(os.walk(default_streams_dir))[2])

    if os.path.exists(local_streams_dir):
        local_stream_ids = filter(lambda(x): not x.startswith('.'), next(os.walk(local_streams_dir))[2])

    return default_stream_ids, local_stream_ids

def read_streams(app_location, app_name):
    default_streams_dir, local_streams_dir = get_stream_dirs_for_app(app_location)
    (default_stream_ids, local_stream_ids) = get_stream_ids_for_app(app_location)

    streams_json_list = []
    for id in default_stream_ids:
        #logger.info("default stream %s" % id)
        if id in local_stream_ids:
            #logger.info("local stream %s" % id)
            json_data = read_stream_as_json(id, local_streams_dir)
        else:
            json_data = read_stream_as_json(id, default_streams_dir)

        if not (json_data == "StreamNotFound" or json_data == "InvalidStreamDefinition"):
            streams_json_list.append(json_data)

    for id in local_stream_ids:
        #logger.info("local stream %s" % id)
        if id not in default_stream_ids:
            #logger.info("local stream not in default %s" % id)
            json_data = read_stream_as_json(id, local_streams_dir)

            stream_expired = False

            logger.info("JSON DATA:: %s" % json_data)

            if not (json_data == "StreamNotFound" or json_data == "InvalidStreamDefinition"):
                if not json_data['locked']:
                    if 'expirationDate' in json_data:
                        #expirationDate is expected in seconds since epoch time
                        if dt.fromtimestamp(json_data['expirationDate']) < dt.now():
                            logger.info("Stream %s expired...deleting it" % id)
                            #Only delete if app is stream..else ignore!
                            if app_name == "splunk_app_stream":
                                delete_stream(id)
                            stream_expired = True

                if not stream_expired:
                    streams_json_list.append(json_data)

    return streams_json_list

def update_required_by(object, app_name):
    if 'required_by' in object:
        object['required_by'].append(app_name)
    else:
        object['required_by'] = [app_name]

def sanitize_stream_json(stream_json):
    if 'required_by' in stream_json:
        del stream_json['required_by']
    fields = stream_json['fields']
    for f in fields:
        if 'required_by' in f:
            del f['required_by']

    #sort for consistency (to make comparing stored streams easier)
    fields.sort(key=lambda f: f['term']);

    return stream_json

def get_stream_by_id(id):
    found_stream = None

    if id not in stream_app_location_map:
        init_streams_collection()

    if id in stream_app_location_map:
        app_location = stream_app_location_map[id]
        app_id = app_location.split(os.sep)[-1]
        logger.info("app_location %s, app_id %s" % (app_location, app_id))

        if app_id in app_streams:
            streams = app_streams[app_id]
            for stream in streams:
                if stream['id'] == id:
                    found_stream = stream
                    break

    return found_stream

class Stream:

    @staticmethod
    def list(id='', **kwargs):
        """Return list of saved streams"""   
        global dateLastUpdated    
        logger.info("stream id is %s" % id)

        #refresh cache if timestamp is different
        try:
            appsMeta = Ping.ping()
            if appsMeta['dateLastUpdated'] != dateLastUpdated:
                logger.info("cachedateLastUpdated:: %d" % dateLastUpdated)
                logger.info("appsDateLastUpdated:: %d" % appsMeta['dateLastUpdated'])
                init_streams_collection()
                dateLastUpdated = appsMeta['dateLastUpdated']
        except Exception as e:
            # Exception happens as appsMeta file is in the process of getting written to.
            # Do Nothing and return existing cache.
            logger.exception("Exception caught:: " + str(e))

        #Check cache for expired streams and delete
        base_streams = app_streams['splunk_app_stream']
        #logger.info(base_streams)
        for base_stream in base_streams:
            if 'expirationDate' in base_stream:
                #expirationDate is expected in seconds since epoch time
                if dt.fromtimestamp(base_stream['expirationDate']) < dt.now():
                    logger.info("Stream %s expired...deleting it" % id)
                    delete_stream(base_stream['id'])
                    base_streams.remove(base_stream)
        #If no id is specified, list all streams
        if not id:
            #Check if there is a valid groupby criteria
            if 'groupby' in kwargs and (kwargs['groupby'] == 'app'):
                result = []
                for app_id in app_streams:
                    result.append({"app_id": app_id, "streams": app_streams[app_id]})
                return result
            else:
                # Return a flattened list of streams
                return_streams = []
                for app_id in app_streams:
                    return_streams += app_streams[app_id]
                return return_streams
        else:
            found_stream = get_stream_by_id(id)

            if found_stream:
                return found_stream
            else:
                return {'success': False, 'error': str("Stream with specified id not found"), 'status': 404}


    @staticmethod
    def save(json_data, id='', action=''):
        """Update posted stream """
        if action == 'enable' or action == 'disable':
            found_stream = get_stream_by_id(id)
            if found_stream:
                found_stream['enabled'] = action == 'enable'
                orig_stream = copy.deepcopy(found_stream)
                write_json_to_stream(id, sanitize_stream_json(found_stream))
                #Update app_streams cache
                streams = app_streams['splunk_app_stream']
                for stream in streams:
                    if stream['id'] == id:
                        streams.remove(stream)
                streams.append(orig_stream)
                return orig_stream
            else:
                return {'success': False, 'error': str("Stream with specified id not found"), 'status': 404}

        # read POST data of type application/json            
        try:
            if not id:
                id = json_data['id']
                logger.info("stream id from json_data: %s" % id)
                if id in base_stream_ids:
                    return {'success': False, 'error': str("Stream with the same id aready exists"), 'status': 400}
                else:
                    json_data['locked'] = False
                    stream_json = json_data
            else:
                stream_json = json_data
                logger.info("stream id passed as arg: %s" % id)
                if not id in base_stream_ids:
                    json_data['locked'] = False
        except Exception as e:
            logger.exception(e)
            return {'success': False, 'error': str(e), 'status': 500}

        origJson = copy.deepcopy(stream_json)
        write_json_to_stream(id, sanitize_stream_json(stream_json))
        #Update app_streams cache
        streams = app_streams['splunk_app_stream']
        for stream in streams:
            if stream['id'] == id:
                streams.remove(stream)

        streams.append(origJson)
        stream_app_location_map[id] = app_locations_map['splunk_app_stream']
        return origJson

    @staticmethod
    def delete(id=''):
        """delete posted stream """
                
        try:
            if not id:
                return {'success': False, 'error': str("Invalid Request Data"), 'status': 400}
            else:
                if delete_stream(id):
                    init_streams_collection()
                    return {'success': True, 'deleted': str(id)}
                else:
                    return {'success': False, 'error': str("Delete failed"), 'status': 400}
        except Exception as e:
            logger.exception(e)
            return {'success': False, 'error': str(e), 'status': 500}
