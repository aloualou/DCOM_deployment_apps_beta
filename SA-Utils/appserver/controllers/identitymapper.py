import cherrypy
import itertools
import logging
import sys
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib import jsonresponse
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
from splunk.appserver.mrsparkle.lib.decorators import expose_page
import splunk.search

sys.path.append(make_splunkhome_path(["etc", "apps", "SA-Utils", "lib"]))
from SolnCommon.log import setup_logger
logger = setup_logger('identitymapper', level=logging.INFO)


class IdentityMapper(controllers.BaseController):
    '''IdentityMapper Controller'''

    CONSTRAINT_METHOD_ASSET = 0
    CONSTRAINT_METHOD_IDENTITY = 1
    CONSTRAINT_METHOD_DEFAULT = 2
    
    CONSTRAINT_METHODS = {'reverse_asset_lookup': CONSTRAINT_METHOD_ASSET,
                   'reverse_identity_lookup': CONSTRAINT_METHOD_IDENTITY,
                   'string': CONSTRAINT_METHOD_DEFAULT}
    
    ASSET_SUBJECT_FIELDS = ['src', 'dest', 'dvc', 'host', 'orig_host']
    IDENTITY_SUBJECT_FIELDS = ['user', 'src_user']
    
    ASSET_RESULT_FIELDS = ['ip', 'nt_host', 'dns', 'mac']
    IDENTITY_RESULT_FIELDS = ['identity']

    REVERSE_ASSET_SEARCH_TEMPLATE = '| `reverse_asset_lookup("{}")`'
    REVERSE_IDENTITY_SEARCH_TEMPLATE = '| `reverse_identity_lookup("{}")`'

    def render_error_json(self, msg):
        """
        Render an error such that it can be returned to the client as JSON.
        
        Arguments:
        msg -- A message describing the problem (a string)
        """
        
        output = jsonresponse.JsonResponse()
        output.data = []
        output.success = False
        output.addError(msg)
        return self.render_json(output, set_mime='text/json')

    def result_to_dict(self, resultset):
        '''Take a splunk.search.ResultSet object and turn it into a dictionary
        that has a simple representation.
        
        Return: A dictionary of field values.
        '''
        result = {}
        for key, multivalued_field in resultset.fields.iteritems():
            result[key] = [str(field) for field in multivalued_field]
        return result
    
    def get_clause(self, value, constraint_method, subject_fields):
        '''Generate a new Splunk search clause, by conducting a reverse lookup
        on the input value.
        
        Arguments:
        
            value -- The asset or identity string.
            qtype -- A constant indicating whether the reverse lookup is for an
                asset, identity, or default.
            subject_fields -- The set of subject fields to include in the
                generated clause.
        
        Returns:
        
            An OR-separated search clause suitable for use in a "tstats" 
            search .
        
        Throws:
            ValueError -- if constraint_method is not one of the accepted constants.
            splunk.SearchException -- if the search fails.
        
        '''
        
        cleaned_value = value.strip()
        
        count = 0
        clauses = []
        records = []

        # Note that the object returned by a search is a ResultSet with ResultField(s).
        # ResultFields are iterable and thus handle multivalued fields via iteration.
        # They do not need to be split into strings, although when printed they
        # appear as CSV strings - this is misleading.
        if constraint_method == self.CONSTRAINT_METHOD_ASSET:
            # Conduct reverse asset lookup.
            srch = splunk.search.dispatch(self.REVERSE_ASSET_SEARCH_TEMPLATE.format(cleaned_value))
            for result in srch.results:
                count += 1
                clauses.append(' OR '.join(['{}="{}"'.format(s, asset) for k, v in result.fields.iteritems() if k in self.ASSET_RESULT_FIELDS for asset in v for s in subject_fields]))
                records.append(self.result_to_dict(result))
        elif constraint_method == self.CONSTRAINT_METHOD_IDENTITY:
            # Conduct reverse entity lookup.
            srch = splunk.search.dispatch(self.REVERSE_IDENTITY_SEARCH_TEMPLATE.format(cleaned_value))
            for result in srch.results:
                count += 1
                clauses.append(' OR '.join(['{}="{}"'.format(s, identity) for k, v in result.fields.iteritems() if k in self.IDENTITY_RESULT_FIELDS for identity in v for s in subject_fields]))
                records.append(self.result_to_dict(result))
        elif constraint_method == self.CONSTRAINT_METHOD_DEFAULT:
            # Construct the default clause. This is regarded as a success so we return
            # a count of 1 result.
            count = 1
            clauses.append(' OR '.join(['{}="{}"'.format(field, value) for field in subject_fields]))
        else:
            # Should never get here.
            raise ValueError('Invalid constraint method')

        if count == 0:
            # A reverse asset or identity lookup returned no results.
            # Return a default search clause.
            clauses.append(' OR '.join(['{}="{}"'.format(field, value) for field in subject_fields]))

        # Make sure to account for the fact that "join" on an empty list returns
        # an empty string - these are not valid clauses and will be eliminated.
        return count, ['{}'.format(clause) for clause in clauses if clause], records

    def get_subject_fields(self, fields, constraint_method):
        '''Filter the list of fields by validity. Only certain fields known as 
        "subject" fields can be included in a reverse lookup search string.
        
        Arguments:
        fields -- A field or list of fields.
        constraint_method -- The type of reverse lookup requested. Should be one of:
            reverse_asset
            reverse_identity
            string
        
        Returns: A tuple (list of fields, normalized_constraint_method).
        
        Throws: AttributeError, TypeError, or ValueError if the input parameters are ill-formed.
        '''
        
        # Normalize the input fields to a list, stripping quotes and spaces.
        # Also handle instances where the "fields" parameter is comma-separated.
        # Exceptions here should be caught by the caller.
        if isinstance(fields, basestring):
            # URI had only one "fields" parameter, possibly comma-separated.
            fields = set([field.strip('" ') for field in fields.split(',')])
        elif isinstance(fields, list):
            # URI had multiple "fields" parameters, each possibly comma-separated.
            fields = set([j.strip('" ') for j in [itertools.chain.from_iterable([i.split(',') for i in fields])]])
        else:
            # Should never get here.
            raise ValueError('Field arguments invalid.')
        
        # Normalize the constraint method
        if constraint_method:
            normalized_constraint_method = self.CONSTRAINT_METHODS.get(constraint_method.strip('" '), self.CONSTRAINT_METHOD_DEFAULT)
        else:
            raise ValueError('Constraint method invalid')
        
        # For each field, check that the field is not zero-length and is valid for the constraint method.
        # Invalid fields are discarded. Valid fields are returned in subject_fields.
        subject_fields = []
        for field in filter(lambda x: x, fields):
            
            if normalized_constraint_method == self.CONSTRAINT_METHOD_DEFAULT:
                # Default behavior is to accept all fields. This allows the 
                # construction of arbitrary key=value search strings. Templating
                # of the generated search clause is not currently supported.
                subject_fields.append(field)
            else:
                # Validate the fields if a reverse asset or identity lookup was 
                # requested.

                try:
                    # Handle fields in object_name.field format.
                    object_name, subject_field = field.rsplit('.', 1)
                except ValueError:
                    # Normal fields were requested (no object_name)
                    subject_field = field

                if normalized_constraint_method == self.CONSTRAINT_METHOD_ASSET and subject_field in self.ASSET_SUBJECT_FIELDS:
                    subject_fields.append(field)
                elif normalized_constraint_method == self.CONSTRAINT_METHOD_IDENTITY and subject_field in self.IDENTITY_SUBJECT_FIELDS:
                    subject_fields.append(field)
                else:
                    # Invalid field requested for the constraint method.
                    pass

        return subject_fields, normalized_constraint_method

    @expose_page(must_login=True, methods=['GET']) 
    def reverse_lookup(self, value, constraint_fields, constraint_method, **kwargs):
        """
        Arguments:
        value -- An identifier.
        constraint_fields -- A list of fields to use in the generated search (WARNING: might be a single item)
        constraint_method -- The type of reverse lookup (reverse_asset_lookup, reverse_identity_lookup, or string).
        
        Returns: A JSON object containing a Splunk search string.
        """

        try:
            subject_fields, method = self.get_subject_fields(constraint_fields, constraint_method)
        except (AttributeError, TypeError, ValueError):
            msg = 'Invalid arguments: constraint_fields="{}" constraint_method="{}"'.format(constraint_fields, constraint_method)
            logger.exception(msg)
            cherrypy.response.status = 400
            return self.render_error_json(_(msg))

        if value and subject_fields:
            methods_by_value = {v: k for k, v in self.CONSTRAINT_METHODS.iteritems()}
            logger.info('Performing reverse lookup: value="{}" method="{}" subject_fields="{}"'.format(value, methods_by_value.get(method), subject_fields))
            try:
                count, clauses, records = self.get_clause(value, method, subject_fields)
            except Exception as exc:
                msg = 'Reverse lookup failed: value="{}" subject_fields="{}" exc="{}"'.format(value, subject_fields, exc)
                logger.exception(msg)
                cherrypy.response.status = 500
                return self.render_error_json(_(msg))

            return self.render_json({
                                      'clauses': clauses,
                                      'count': count,
                                      'original_value': value,
                                      'records': records,
                                      'requested_subject_fields': constraint_fields,
                                      'success': True,
                                      'valid_subject_fields': subject_fields,
                                  })
        else:
            msg = 'Invalid request: value="{}" fields="{}" method="{}"'.format(value, constraint_fields, constraint_method)
            logger.error(msg)
            cherrypy.response.status = 400
            return self.render_error_json(_(msg))
