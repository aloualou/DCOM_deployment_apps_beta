'''
Copyright (C) 2005 - 2013 Splunk Inc. All Rights Reserved.
'''
import gzip
import StringIO
import struct


class GzipHandler(object):
    '''Class for handling gzip-formatted string content.'''

    # Error messages
    ERR_INVALID_FORMAT = 'File is not gzip format.'
    ERR_SIZE_MISMATCH = 'Gzip file size does not match actual.'

    def __init__(self):
        pass

    @classmethod
    def checkFormat(self, data):
        '''Take a string and validate whether it is in gzip
           format. 
        '''
        # Check for gzip header.
        # Bytes 0 and 1 should be (per RFC 1952):
        # ID1 = 31 (0x1f, \037), ID2 = 139 (0x8b, \213)
        return data[0:2] == '\037\213'

    @classmethod
    def decompress(self, data):
        '''Decompress a string containing gzip-compressed data,
           performing basic validation. Returns the decompressed
           data or raises ValueError with an error string.
        '''

        # 1 - Check format.
        if not self.checkFormat(data):
            raise ValueError(self.ERR_INVALID_FORMAT)

        # 2 -- Read length of file from last four bytes of data.
        # This should be the size of the uncompressed data mod 2^32
        # Note that unpack() always returns a tuple even for one item
        sizeInt, = struct.unpack('i', data[-4:])

        # 3 -- Decompress the string
        decompressor = gzip.GzipFile(fileobj=StringIO.StringIO(data), mode='rb')
        text = decompressor.read()

        # 4 -- Check decompressed size.
        if len(text) != sizeInt:
            raise ValueError(self.ERR_SIZE_MISMATCH)

        return text
