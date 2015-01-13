# Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

import cherrypy
import controllers.module as module
import splunk.appserver.mrsparkle.lib.paginator as paginator
import splunk

class Pager(module.ModuleHandler):

    def addPreviousNextLinks(self, pager, d) :
        if pager.previous_exists():
            d['previousPageOffset'] = pager.previous_offset()
        if pager.next_exists():
            d['nextPageOffset'] = pager.next_offset()

    def addPageLinks(self, pager, d) :
        d['pages'] = []
        for pageNumber in pager.page_range:
            page = {
                'number' : pageNumber,
                'offset' : pager.page_item_offset(pageNumber)
            }
            if (pager.is_active_page(pageNumber)) :
                page['selected'] = True

            d['pages'].append(page)


    def generateResults(self, totalCount, count=10, offset=0, maxPages=10, **args):

        pager = paginator.Google(int(totalCount), int(count), max_pages=int(maxPages), item_offset=int(offset))
        
        templateDict = {
            "totalCount": totalCount, 
            "count"     : count, 
            "maxPages"  : maxPages, 
            "offset"    : offset,
            "app"       : args['app']
        }

        self.addPreviousNextLinks(pager, templateDict)
        self.addPageLinks(pager, templateDict)

        return self.controller.render_template('Pager/Pager_template.html', templateDict)

