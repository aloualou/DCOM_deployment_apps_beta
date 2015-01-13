import os
import re
import splunk.clilib.bundle_paths as bundle_paths

def get_session_key(session_key=None, thrown_exception=True):
    
    # Try to get the session key if not provided
    if session_key is None:
        import splunk
        session_key, sessionSource = splunk.getSessionKey(return_source=True)
    
    # Do not continue if we could not get a session key and the caller wants us to thrown an exception
    if session_key is None and thrown_exception:
        raise Exception("Could not obtain a session key")
    
    # Return the session key
    return session_key

def getSplunkAppDir():
    
    # Make sure to use the bundle paths so that this works with search head pooling
    return bundle_paths.get_base_path()

def processDirectory( basedir, fn, logger = None, force = False ):
    
    # Iterate through each directory and run the given function
    for root, dirs, files in os.walk(basedir):
        for file in files:
            fn(root, file, logger, force)
