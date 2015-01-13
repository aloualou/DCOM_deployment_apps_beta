'''
Copyright (C) 2005-2013 Splunk Inc. All Rights Reserved.
'''
import os
import sys
import tempfile
import time

import splunk
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

from .error import LookupConversionErrors
from .models import SplunkLookupTableFile
from .models import SplunkLookupTransform


def get_lookup_table_file_update_times(lookup_names, namespace=None, owner=None, session_key=None):
    '''Retrieve the timestamps for the selected lookup names.
    @param lookup_names: A list of lookup names as specified in transforms.conf.
    @param namespace: A Splunk namespace to limit the search to.
    @param owner: A Splunk user.
    @param key: A Splunk session key.

    @return: A list of tuples (lookup_name, path, last_updated).
            - path and last_updated will be None if the lookup does not exist.
            - last_updated will be None if the file update time cannot be
              determined.

    @raise exception: splunk.RESTException
    
    '''
    assert lookup_names is not None
    output = []

    # Create a search string to get all the transforms.conf stanzas by name.
    transforms_search_string = ' OR '.join(['name={}'.format(i) for i in lookup_names])
    # Get the stanzas.
    transforms = SplunkLookupTransform.search(transforms_search_string, sessionKey=session_key)
    # Maintain map of the lookup stanza names to their respective files.
    lookup_name_to_file_map = {i.name: i.filename for i in transforms}
    # Create a search string to get the lookup table file paths.
    lookup_table_files_search = ' OR '.join(['name={}'.format(i) for i in lookup_name_to_file_map.values()])
    # Get the file information.
    lookup_table_files = SplunkLookupTableFile.search(lookup_table_files_search, sessionKey=session_key)
    # Maintain map of lookup stanza names to the respective backing file paths.
    lookup_file_to_path_map = {i.name: i.path for i in lookup_table_files}

    for lookup_name in lookup_names:
        if lookup_name in lookup_name_to_file_map:
            filename = lookup_name_to_file_map[lookup_name]
            try:
                path = lookup_file_to_path_map[filename]
                fstat = os.stat(path)
                output.append((lookup_name, path, fstat.st_mtime))
            except IOError:
                # The lookup file update time could not be determined.
                output.append((lookup_name, path, None))
            except KeyError:
                # The lookup file name could be determined, but the path did not
                # exist (backing file missing)
                output.append((lookup_name, None, None))                
        else:
            # The lookup path could not be determined.
            # Likely cause: no lookup table with this name exists.
            output.append((lookup_name, None, None))
    return output


def get_lookup_transform(lookup_name, namespace, owner, key):
    '''Retrieve a Splunk lookup stanza in transforms.conf by lookup name.
    
    @param lookup_name: The lookup STANZA name (NOT the file name).
    @param namespace: A Splunk namespace to limit the search to.
    @param owner: A Splunk user.
    @param key: A Splunk session key.
    
    @return: The path to the Splunk lookup table.
    '''
    try:
        return SplunkLookupTransform.get(SplunkLookupTransform.build_id(lookup_name, namespace, owner), sessionKey=key)
    except splunk.ResourceNotFound as e:
        sys.stderr.write(LookupConversionErrors.ERR_NO_LOOKUP + ': %s\n' % str(e))
        pass
    except Exception as e:
        sys.stderr.write(LookupConversionErrors.ERR_UNKNOWN_EXCEPTION + ': %s\n' % str(e))
        pass
    
    return None


def get_lookup_table_location(lookup_name=None, namespace=None, owner=None, key=None, fullpath=True, transform=None):
    '''Retrieve the location of a Splunk lookup table file by lookup name.

    @param lookup_name: The lookup STANZA name (NOT the file name).
    @param namespace: A Splunk namespace to limit the search to.
    @param owner: A Splunk user.
    @param key: A Splunk session key.
    
    @param fullpath: Return full path if True, file name alone if False.
    @param transform: An existing lookup object. Other parameters except for 
        fullpath are ignored if this is present.
    
    @return: The path to the Splunk lookup table or None if an error occurs.
    '''
    
    if not transform:
        transform = get_lookup_transform(lookup_name, namespace, owner, key)
    try:
        path = SplunkLookupTableFile.get(SplunkLookupTableFile.build_id(transform.filename, namespace, owner), sessionKey=key).path
        if not fullpath:
            return os.path.basename(path)
        return path
    except splunk.ResourceNotFound as e:
        sys.stderr.write(LookupConversionErrors.ERR_NO_LOOKUP + ': %s\n' % str(e))
        pass
    except Exception as e:
        sys.stderr.write(LookupConversionErrors.ERR_UNKNOWN_EXCEPTION + ': %s\n' % str(e))
        pass

    return None


def update_lookup_table(filename, lookup_file, namespace, owner, key):
    '''Update a  Splunk lookup table file with a new file.
    
    @param filename: The full path to the replacement lookup table file.
    @param lookup_file: The lookup FILE name (NOT the stanza name)
    @param namespace: A Splunk namespace to limit the search to.
    @param owner: A Splunk user.
    @param key: A Splunk session key.
    
    @return: Boolean success status.
    
    WARNING: "owner" should be "nobody" to update
    a public lookup table file; otherwise the file will be replicated
    only for the admin user.
    
    Also, the temporary CSV file MUST be located in the following directory:
    
        $SPLUNK_HOME/var/run/splunk/lookup_tmp
        
    This staging area is hard-coded as a "safe" area in the
    LookupTableConfPathMapper.
    
    '''
    try:
        # Owner passed in should be nobody, otherwise the lookup table will
        # end up in a user's personal directory.
        id_val = SplunkLookupTableFile.build_id(lookup_file, namespace, owner)
        lookup_table_file = SplunkLookupTableFile.get(id_val, sessionKey=key)
        entity = lookup_table_file.manager()._put_args(id=id_val, postargs={'eai:data': filename}, sessionKey=key)
        if entity is not None:
            return True
    except splunk.ResourceNotFound as e:
        sys.stderr.write(LookupConversionErrors.ERR_NO_LOOKUP + ': %s\n' % str(e))
        pass
    except Exception as e:
        sys.stderr.write(LookupConversionErrors.ERR_UNKNOWN_EXCEPTION + ': %s\n' % str(e))
        pass

    return False


def get_temporary_file(prefix=None, basedir=None):
    '''Create a temporary file in a directory relative to $SPLUNK_HOME, and 
    return the filehandle.
    
    Exceptions will be passed to caller.

    @param prefix: A prefix for the file.
    @param basedir: The base directory for the file relative to $SPLUNK_HOME.
    '''
    
    if prefix is None:
        prefix = '_'.join([prefix, str(os.getpid()), time.strftime('%Y%m%d_%H%M%S_')])
    
    if basedir is None:
        raise ValueError('Base directory for temporary files must be specified.')

    splunk_home = make_splunkhome_path([''])
    if os.path.commonprefix([splunk_home, basedir]):
        if not os.path.isdir(basedir):
            os.mkdir(basedir)

        if os.path.isdir(basedir):
            return tempfile.NamedTemporaryFile(prefix=prefix,
                suffix='.txt',
                dir=basedir,
                delete=False)
        else:
            return None
    else:
        raise ValueError('Temporary files can only be created beneath SPLUNK_HOME.')


def get_temporary_lookup_file():
    '''Create a temporary file for staging a lookup table, and return the filehandle.

    Any exceptions raised will be passed to caller.
    
    @param prefix: A prefix for the file (default is "lookup_gen_<date>_<time>_")
    @param basedir: The base directory for the file (default is $SPLUNK_HOME/var/run/splunk/lookup_tmp,
        the staging directory for use in creating new lookup table files).
    '''
    return get_temporary_file('lookup_conv', 
        make_splunkhome_path(['var', 'run', 'splunk', 'lookup_tmp']))
    

def get_temporary_checkpoint_file(prefix, basedir):
    '''Create a temporary checkpoint file for a modular input, and return the filehandle.

    Any exceptions raised will be passed to caller.
    
    @param prefix: A prefix for the file.
    @param basedir: The base directory for the file, usually the modular input name.
    '''

    return get_temporary_file(prefix, 
        make_splunkhome_path(['var', 'lib', 'splunk', 'modinputs', basedir]))
