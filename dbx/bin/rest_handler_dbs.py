# Copyright (C) 2005-2013 Splunk Inc. All Rights Reserved.

import splunk.admin as admin
from dbx_rest import ResourceHandler, BaseRestHandler
from spp.java.bridge import executeBridgeCommand
from spp.util import encrypt_config_value
import logging

logger = logging.getLogger('splunk.dbx.databases')

class DatabaseConfHandler(BaseRestHandler):
    
    def handleReload(self, confInfo):
        logger.debug("DBX databases reload called")
        executeBridgeCommand("com.splunk.bridge.cmd.Reload", args=["databases"], checkStatus=True)

    def handleRemove(self, confInfo):
        logger.debug("DBX databases remove called")
        self.delete()
        executeBridgeCommand("com.splunk.bridge.cmd.Reload", args=["databases"], checkStatus=True)

    def handleCreate(self, confInfo):
        logger.debug("DBX databases create called")
        self.check_validate()
        BaseRestHandler.handleCreate(self, confInfo)
        executeBridgeCommand("com.splunk.bridge.cmd.Reload", args=["databases"], checkStatus=True)

    def handleDisableAction(self, confInfo, disabled):
        self.update(disabled=disabled)
        executeBridgeCommand("com.splunk.bridge.cmd.Reload", args=["databases"], checkStatus=True)

    def encode(self, dic):
        return dict([(n, encrypt_config_value(v)) if n=='password' else (n, v) for n, v in dic.items()])
    
    def handleEdit(self, confInfo):
        self.check_validate()
        BaseRestHandler.handleEdit(self, confInfo)
        executeBridgeCommand("com.splunk.bridge.cmd.Reload", args=["databases"], checkStatus=True)
        
    def check_validate(self):
        args = self.getCallerArgs()
        if args.has_key('validate') and args['validate'] in ['1', 1, True, 'true', 'True']:
            validation_args = []
            for k, v in args.items():
                validation_args.append("%s=%s" % (k, v if v is not None else ''))
            
            logger.debug("Executing database validate: com.splunk.dbx.sql.validate.DatabaseValidator %s",
                         " ".join(validation_args))
            
            (ret, out, err) = executeBridgeCommand("com.splunk.dbx.sql.validate.DatabaseValidator", args=validation_args
                , fetchOutput=True)
            
            if not ret is 0:
                raise admin.ArgValidationException(
                    out and out.strip() or "Unknown error while validating database connection")
                        
        
class DatabaseConfRes(object):
    endpoint      = '/admin/conf-database'
    optional_args = ['password', 'disabled', 'port', 'arg.ssl', 'isolation_level', 'arguments']
    required_args = ['database', 'host', 'type', 'username', 'readonly']
    transient_args = ['validate']

if __name__ == "__main__":
    admin.init(ResourceHandler(DatabaseConfRes, handler=DatabaseConfHandler), admin.CONTEXT_NONE)
    

