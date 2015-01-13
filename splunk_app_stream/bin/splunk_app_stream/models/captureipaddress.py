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

import jsonschema
from jsonschema import *
from jsonschema.validators import *

from IPy import IP

logger = setup_logger('captureipaddress')

capture_addresses_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', "captureipaddresses")
schema_file = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', "blacklist_whitelist_schema")
blacklist_whitelist_schema = None
default_capture_ip_addresses_ids = ['whitelist', 'blacklist']

try:
    schema_data = open( schema_file, 'rb' ).read()
    blacklist_whitelist_schema = dict(json.loads(schema_data.decode("utf-8")))
except Exception as e:
    logger.error("Error reading Blacklist/Whitelist schema file")
    raise

def is_valid_ip_address_list(json_data):
    validator = Draft4Validator(blacklist_whitelist_schema, format_checker=FormatChecker())

    if validator.is_valid(json_data):
        ip_addresses = json_data['ipAddresses']
        invalid_ips = []

        for ip_address in ip_addresses:
            try:
                ip = IP(ip_address)
            except Exception as e:
                # Maybe the ip address has a wildcard
                # The IPy library does not validate with a wildcard. Replace wildcard with a 1 and retry
                if '*' in ip_address:
                    tmp_ip = ip_address.replace('*', '1')
                    try:
                        ip = IP(tmp_ip)
                        return True
                    except Exception as e:
                        invalid_ips.append(ip_address)
                        return False
                else:
                    invalid_ips.append(ip_address)
                    return False

        if invalid_ips:
            logger.info("Validation Error for %s -- "
                        "Invalid IP Addresses found: %s" % (json_data['id'], ', '.join([x for x in invalid_ips])))
            return False
        else:
            return True
    else:
        for error in sorted(validator.iter_errors(json_data), key=str):
            logger.info("Invalid IP Address %s -- "
                        "Validation Error %s" % (json_data['id'], error.message))
        return False

def process_ip_address_list(id):
    json_data = readAsJson(os.path.join(capture_addresses_dir, id))
    if is_valid_ip_address_list(json_data):
        return json_data
    else:
        return {'id': id, 'ipAddresses' : []}

class CaptureIpAddress:

    @staticmethod
    def list():
        '''Return list of captureipaddresses including whiteList and blackList'''
        capture_ip_address_json_list = []
        if os.path.exists(capture_addresses_dir):
            capture_address_ids = next(os.walk(capture_addresses_dir))[2]
            for list_id in default_capture_ip_addresses_ids:
                if list_id in capture_address_ids:
                    capture_ip_address_json_list.append(process_ip_address_list(list_id))
                else:
                    capture_ip_address_json_list.append({'id': list_id, 'ipAddresses' : []})
        else:
            for list_id in default_capture_ip_addresses_ids:
                capture_ip_address_json_list.append({'id': list_id, 'ipAddresses' : []})

        return capture_ip_address_json_list
        
    @staticmethod
    def save(req_body, id=''):
        '''Update posted captureipaddresses '''
        logger.info('save::id %s' % id)
        if id:
            req_dict = ast.literal_eval(req_body)
            req_json_data = {'id': id, 'ipAddresses': req_dict.get('ipAddresses')}
            if is_valid_ip_address_list(req_json_data):
                createDir(capture_addresses_dir + os.sep)
                writeAsJson(os.path.join(capture_addresses_dir, id), req_json_data)
                return req_json_data
            else:
                return {'success': False, 'error': str("Bad Request, invalid ip address(es) found"), 'status': 500}
        else:
            return {'success': False, 'error': str("Bad Request, id required"), 'status': 400}