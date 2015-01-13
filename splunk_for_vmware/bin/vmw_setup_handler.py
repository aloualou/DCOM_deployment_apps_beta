'''
Copyright (C) 2005-2012 Splunk Inc. All Rights Reserved.
'''
import splunk.admin as admin
import splunk.entity as en
import logging
from logging import handlers
import os.path
import datetime
import base64
import sys
import re
import platform
import shutil
from lxml import etree
import os
from stat import *

from install.vmwinstaller import VMWInstaller

class ConfigVMWApp(admin.MConfigHandler):
    
    '''
    Set up supported arguments
    '''
    def setup(self):
        if self.requestedAction == admin.ACTION_EDIT:
            for arg in ['VMW_do_install', 'VMW_delete_da']:
                self.supportedArgs.addOptArg(arg)
                
    '''
    Lists configurable parameters
    '''
    def handleList(self, confInfo):
        
        stanza = "general_settings"
        
        confInfo[stanza].append('VMW_do_install', '1')
        confInfo[stanza].append('VMW_delete_da', '1')
        
    '''
    Controls parameters
    '''
    def handleEdit(self, confInfo):
        name = self.callerArgs.id
        args = self.callerArgs
        
        if self.callerArgs.data['VMW_delete_da'][0] in [1,'1']:
            do_delete = True
        else:
            do_delete = False
        if self.callerArgs.data['VMW_do_install'][0] in [1,'1']:
            # Run the installer  
            VMWInstaller.doInstall(do_delete, sessionKey=self.getSessionKey())
        
        ## reload the app to trigger splunkd restart
        #self.handleReload()


    def handleReload(self, confInfo=None):
        """
        Handles refresh/reload of the configuration options
        """
        try:
            refreshInfo = en.refreshEntities('apps/local/splunk_for_vmware', sessionKey=self.getSessionKey())
        except Exception as e:
            raise
        
        
# initialize the handler
admin.init(ConfigVMWApp, admin.CONTEXT_NONE)