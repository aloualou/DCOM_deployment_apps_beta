#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import logging
import os
import sys

import cherrypy
import splunk.entity as en

from splunk import AuthorizationFailed as AuthorizationFailed
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
import splunk.bundle as bundle

from splunk.util import normalizeBoolean as normBool 

from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

dir = os.path.join(util.get_apps_dir(), __file__.split('.')[-2], 'bin')
if not dir in sys.path:
    sys.path.append(dir)
    
from sa_threshold.models.SAThresholdStanza import SAThresholdStanza

logger = logging.getLogger('splunk')

def isValidAdmin(user=None, session_key=None):
	roles = []
	## Get user info			  
	try:
		if user is not None:
			logger.info('Retrieving role(s) for current user: %s' % (user))
			userDict = en.getEntities('authentication/users/%s' % (user), count=-1, sessionKey=session_key)
	
			for stanza, settings in userDict.items():
				if stanza == user:
					for key, val in settings.items():
						if key == 'roles':
							logger.info('Successfully retrieved role(s) for user: %s' % (user))
							roles = val
		logger.info('Current user roles: %s' % roles)
	
		if any("admin" in role for role in roles):
			logger.info('Current user is a valid admin, returning True')
			return True
		else:
			logger.info('Current user is NOT a valid admin, returning False')
			return False
	except Exception as e:
		logger.error("Failed to get role information, Exception: %s " % e)
		return False

class SA_ThresholdConfig(controllers.BaseController):
    '''SA-Threshold Configuration Controller'''

    @route('/:app/:action=show')
    @expose_page(must_login=True, methods=['GET']) 
    def show(self, app, action, **kwargs):
        ''' shows configuration page '''
        logger.setLevel(logging.INFO)
        form_content = {}
        user = cherrypy.session['user']['name'] 
        
        thresholds = SAThresholdStanza.all()
        thresholds = thresholds.filter_by_app(app)
        return self.render_template('/SA-Threshold:/templates/sa_threshold_conf_show.html',
                                    dict(form_content=form_content, thresholds=thresholds, app=app))

    @route('/:app/:action=success')
    @expose_page(must_login=True, methods=['GET']) 
    def success(self, app, action, **kwargs):
        ''' render configuration success page '''
        
        host_app = cherrypy.request.path_info.split('/')[3]

        return self.render_template('/%s:/templates/success.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=failure')
    @expose_page(must_login=True, methods=['GET']) 
    def failure(self, app, action, **kwargs):
        ''' render configuration failure page '''
        
        host_app = cherrypy.request.path_info.split('/')[3]

        return self.render_template('/%s:/templates/failure.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=unauthorized')
    @expose_page(must_login=True, methods=['GET']) 
    def unauthorized(self, app, action, **kwargs):
        ''' render configuration unauthorized page '''

        host_app = cherrypy.request.path_info.split('/')[3]

        return self.render_template('/%s:/templates/401.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=save')
    @expose_page(must_login=True, methods=['POST']) 
    def save(self, app, action, **kwargs):
        ''' save the posted vmware stanza conf content '''
        logger.info("threshold conf save attempting...")
        
        host_app = cherrypy.request.path_info.split('/')[3]
        user = cherrypy.session['user']['name']
        
        threshold = SAThresholdStanza(app,user,kwargs.get('name'))
        threshold.metadata.sharing = 'app'
        logger.info("threshold creating new stanza with name %s..." % kwargs.get('name'))
        threshold.name = kwargs.get('name')
        threshold.disabled = normBool(kwargs.get('disabled'))
        threshold.description = kwargs.get('description')
        threshold.metric = kwargs.get('metric')
        threshold.perftype = kwargs.get('perftype')
        threshold.critical = kwargs.get('critical')
        threshold.warning = kwargs.get('warning')
        threshold.entitytype = kwargs.get('entitytype')
        threshold.comparator = kwargs.get('comparator')
        try:
            logger.info("SA-Threshold saving conf...")
            if not threshold.passive_save():
                logger.error('Error saving conf values for stanza %s' % (tgtApp.name))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)
        except AuthorizationFailed:
            logger.error('User %s is unauthorized to perform vmware conf change' % (user))
            raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized'), 401)
        except Exception, ex:
            logger.debug(ex)
            logger.error('Failed to save vmware conf for app %s' % (tgtApp.name))
            raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)
        logger.info('SA-Threshold stanza save successful')
        
    
    @route('/:app/:action=delete')
    @expose_page(must_login=True, methods=['POST']) 
    def delete(self, app, action, **kwargs):
        ''' delete the posted threshold stanza '''
        logger.info('Attempting to delete threshold conf stanza...')
        DeleteTargets = SAThresholdStanza.all()
        DeleteTargets = DeleteTargets.filter_by_app(app)
        DeleteTargets = DeleteTargets.filter(name=kwargs.get('name'))
        logger.info('Removing threshold ID %s from conf' % kwargs.get('name'), DeleteTargets)
        for item in DeleteTargets:
            try:
                if not item.delete():
                    logger.error('Error removing stanza %s' % (item.name))
                    raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)
            except AuthorizationFailed:
                logger.error('User %s is unauthorized to perform vmware conf change' % (user))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized'), 401)
            except Exception, ex:
                logger.debug(ex)
                logger.error('Failed to delete vmware conf for app %s' % app)
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)

    @route('/:app/:action=disable')
    @expose_page(must_login=True, methods=['POST']) 
    def disable(self, app, action, **kwargs):
        ''' disable the posted threshold stanza '''
        logger.info("threshold disable attempting...")
        DisabledTargets = SAThresholdStanza.all()
        DisabledTargets = DisabledTargets.filter_by_app(app)
        DisabledTargets = DisabledTargets.filter(name=kwargs.get('name'))
        for item in DisabledTargets:
            item.disabled = normBool('True')
            try:
                logger.info("SA-Threshold saving disabled stanza...")
                if not item.passive_save():
                    logger.error('Error saving conf values for stanza %s' % (item.name))
                    raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)
            except AuthorizationFailed:
                logger.error('User %s is unauthorized to perform vmware conf change' % (user))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized'), 401)
            except Exception, ex:
                logger.debug(ex)
                logger.error('Failed to save vmware conf for app %s' % (item.name))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)

    @route('/:app/:action=enable')
    @expose_page(must_login=True, methods=['POST']) 
    def enable(self, app, action, **kwargs):
        ''' enable the posted threshold stanza '''
        logger.info("threshold disable attempting...")
        thresholds = SAThresholdStanza.all()
        thresholds = thresholds.filter_by_app(app)
        thresholds = thresholds.filter(name=kwargs.get('name'))
        for item in thresholds:
            item.disabled = normBool('False')
            try:
                logger.info("SA-Threshold saving enabled stanza...")
                if not item.passive_save():
                    logger.error('Error saving conf values for stanza %s' % (item.name))
                    raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)
            except AuthorizationFailed:
                logger.error('User %s is unauthorized to perform vmware conf change' % (user))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized'), 401)
            except Exception, ex:
                logger.debug(ex)
                logger.error('Failed to save vmware conf for app %s' % (item.name))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'), 303)


    def _redirect(self, app, endpoint):
        ''' convienience wrapper to make_url() '''
        #return self.make_url(['custom', 'sa_threshold', 'sa_threshold_conf_service', app, endpoint])
        return self.make_url(['custom', 'SA-Threshold', 'sa_threshold_conf_service', app, endpoint])
