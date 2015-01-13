import cherrypy
import splunk
from decorator import decorator

def require_app_access(write_access=False):
    '''
    require that a valid user has app access. default access is 'read'.
    if you need write access, set write_access=True
    '''
    want_access = 'write' if write_access else 'read'
    @decorator
    def check_access(fn,self,*args,**kwargs):
        sessionKey = cherrypy.session.get('sessionKey')
        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]
        app = splunk.entity.getEntity('apps/local', host_app, sessionKey=sessionKey)
        context = splunk.entity.getEntity('authentication/users', user, sessionKey=sessionKey)
        need_roles = app['eai:acl']['perms'][want_access]
        have_roles = context['roles']
        
        # access is granted if the intersection of required roles and possessed
        # roles is not empty
        granted = bool(set(need_roles) & set(have_roles))

        if not granted:
            raise cherrypy.HTTPError(401)

        return fn(self,*args,**kwargs)
    return check_access
