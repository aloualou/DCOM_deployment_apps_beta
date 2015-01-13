import splunk
import splunk.admin as admin
import splunk.entity as en
import copy
import logging
logger = logging.getLogger('splunk.dbx.sc_rest')
logger.setLevel(logging.DEBUG)

class BaseRestHandler(admin.MConfigHandler):
    
    def __init__(self, *args, **kwargs):
        admin.MConfigHandler.__init__(self, *args, **kwargs)
        
    def model(self):
        return self._model

    def get_method(self, name):
        return getattr(self._model, name, None)
    
    def setup(self):

        if 0 != len(self.customAction):
            # let go while custom action is for acl.
            if self.customAction in ['acl']: return
            
        elif self.requestedAction in [admin.ACTION_CREATE, admin.ACTION_EDIT]:
            for arg in self._required_args:
                self.supportedArgs.addReqArg(arg)

            for arg in self._optional_args + self._transient_args:
                self.supportedArgs.addOptArg(arg)

    def getSortDir(self):
        ''' return correct sort direction '''
        if self.sortAscending.startswith('true'):
            return 'asc'
        else:
            return 'desc'
        
    def makeConfItem(self, name, obj, confInfo):
        
        ''' given a name and entity object, return a confItem '''
        confItem = confInfo[name]

        for key, val in obj.items():
            confItem[key] = str(val)
            
        if hasattr(confItem, "addCustomAction"):
            disabled = str(confItem.get("disabled", False)).lower()
            if disabled in ["0", "false"]:
                confItem.addCustomAction("disable")
            else:
                confItem.addCustomAction("enable")

        acl = {}
        for k, v in obj[admin.EAI_ENTRY_ACL].items():
            if None != v:
                acl[k] = v
        confItem.setMetadata(admin.EAI_ENTRY_ACL, acl)
        
        return confItem

    def handleList(self, confInfo):
        if self.callerArgs.id is None:
            ent = self.all()

            for name, obj in ent.items():
                confItem = self.makeConfItem(name, obj, confInfo)
        else:
            try:
                ent = self.get()
                
                confItem = self.makeConfItem(self.callerArgs.id, ent, confInfo)
            except splunk.ResourceNotFound:
                pass

    def handleACL(self, confInfo):
        try:
            ent = self.get()
            meta = ent[admin.EAI_ENTRY_ACL]
            
            # for POST acl only.
            if self.requestedAction in [admin.ACTION_CREATE, admin.ACTION_EDIT] and len(self.callerArgs.data)>0:
                
                # control only update acl data, no more other fields
                ent.properties = dict()
                
                ent['sharing'] = meta['sharing']
                ent['owner'] = meta['owner']
                
                ent['perms.read'] = [None]
                ent['perms.write'] = [None]
                
                # user should not POST non acl related fields, if so, it will throw errors anyway.
                for k, v in self.callerArgs.data.items():
                    ent[k] = v
                    
                en.setEntity(ent, self.getSessionKey(), uri=ent.id+'/acl')
                ent = self.get()

            confItem = confInfo[self.callerArgs.id]
            acl = copy.deepcopy(meta)
            confItem.actions = self.requestedAction
            confItem.setMetadata(admin.EAI_ENTRY_ACL, acl)

        except splunk.ResourceNotFound as ex:
            logger.exception('handleACL Failed - arguments = %s, exception = %s' % (self.callerArgs, ex))
            
    def handleCreate(self, confInfo):
        logger.debug('handleCreate is called. -- action = %s, id = %s' % (self.customAction, self.callerArgs.id))
        
        try:
            args = self.getCallerArgs()
            if hasattr(self, 'encode'):
                args = self.encode(args)

            self.create(**args)
            self.handleList(confInfo)
        except BaseException as ex:
            logger.exception('handleCreate Failed - arguments = %s, exception = %s' % (self.callerArgs, ex))

    def handleRemove(self, confInfo):
        try:
            self.delete()
        except BaseException as ex:
            logger.exception('handleRemove Failed - arguments = %s, exception = %s' % (self.callerArgs, ex))

    def handleEdit(self, confInfo):
        logger.debug('handleEdit is called. -- action = %s, id = %s' % (self.customAction, self.callerArgs.id))

        try:
            args = self.getCallerArgs()
            if hasattr(self, 'encode'):
                args = self.encode(args)
            
            self.update(**args)
            self.handleList(confInfo)
        except BaseException as ex:
            logger.exception('handleEdit Failed - arguments = %s, exception = %s' % (self.callerArgs, ex))

    def getCallerArgs(self):
        callargs = dict()
        for n, v in self.callerArgs.data.items():
            callargs.update({n : v[0]})
        
        return callargs

    def handleDisableAction(self, confInfo, disabled):
        self.update(disabled=disabled)

    def handleCustom(self, confInfo):
        if self.customAction in ['acl']:
            return self.handleACL(confInfo)
        
        if self.customAction == 'disable':
            self.handleDisableAction(confInfo, '1')
        elif self.customAction == 'enable':
            self.handleDisableAction(confInfo, '0')
        else:
            meth = self.get_method(self.customAction)
            if meth:
                ctx = self.getContext()
                meth(ctx)
                self.makeConfItem(self.callerArgs.id, ctx.entity, confInfo)
            else:
                raise splunk.ResourceNotFound()
        
    def getContext(self):
        ctx = type('Context', (dict, object), {}) ()       
        ctx.entity = self.get()
        ctx.data = self.callerArgs.data
        
        return ctx
        
    @property
    def _endpoint(self):
        return self._model.endpoint
    
    @property
    def _optional_args(self):
        return getattr(self._model, "optional_args", [])

    @property
    def _required_args(self):
        return getattr(self._model, "required_args", [])

    @property
    def _transient_args(self):
        return getattr(self._model, "transient_args", [])
    
    def all(self):
        return en.getEntities(self._endpoint,
                              namespace='-',
                              owner='-',
                              sessionKey=self.getSessionKey(),
                              count=self.maxCount+self.posOffset,
                              sort_key=self.sortByKey,
                              sort_dir=self.getSortDir(),
                              offset=self.posOffset)
    
    def get(self):
        return en.getEntity(self._endpoint, 
                        self.callerArgs.id, 
                        namespace=self.appName,
                        owner=self.userName,
                        sessionKey=self.getSessionKey())

    def create(self, **params):
        new = en.Entity(self._endpoint, 
                        self.callerArgs.id, 
                        namespace=self.appName,
                        owner='nobody')
        
        for arg in self._required_args:
            new[arg] = params[arg]

        for arg in self._optional_args:
            try:
                new[arg] = params[arg]
            except:
                pass

        en.setEntity(new, sessionKey=self.getSessionKey())
    
    def delete(self):
        en.deleteEntity(self._endpoint, 
                        self.callerArgs.id, 
                        namespace=self.appName,
                        owner=self.userName,
                        sessionKey=self.getSessionKey())
             
    def update(self, **params):
        ent = en.getEntity(self._endpoint, 
                           self.callerArgs.id, 
                           namespace=self.appName,
                           owner='nobody',
                           sessionKey=self.getSessionKey())
                                       
        for arg in params.keys():
            if arg in self._required_args + self._optional_args:
                ent[arg] = params[arg] 

        en.setEntity(ent, sessionKey=self.getSessionKey())

# no longer used, but keep it here for compatibility purpose.
class BaseResource(object):
    pass
    
def ResourceHandler(model, handler=BaseRestHandler):
    handler._model = model()
    return type(model.__class__.__name__, (handler, object), {})

