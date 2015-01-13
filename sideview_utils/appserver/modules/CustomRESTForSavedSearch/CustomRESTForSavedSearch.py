# Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.
import cherrypy, logging
import controllers.module as module
import splunk.auth as auth
import splunk.entity as entity
import urllib, json
import splunk

logger = logging.getLogger('splunk.modules.CustomRESTForSavedSearch.foo')

SAVED_SEARCHES_PATH = 'saved/searches'

class CustomRESTForSavedSearch(module.ModuleHandler):

    def generateResults(self,app,savedSearchName,serializedContext,editView, **args):
        
        response = {}

        
        currentUser = auth.getCurrentUser()['name']
        sessionKey  = cherrypy.session['sessionKey']
        try :
            ss = entity.getEntity(SAVED_SEARCHES_PATH, savedSearchName, namespace=app, owner=currentUser, sessionKey=sessionKey)
        except Exception, e:
            response["hypothesis"] = "saved search name incorrect"
            response["message"] = str(e)
            response["success"] = False
            return json.dumps(response)
            
        ss["search"] = ss["search"]
        ss["request.ui_context"] = serializedContext
        ss["request.ui_edit_view"] = editView
        
        response["success"] = str(entity.setEntity(ss))

        

        return json.dumps(response)
