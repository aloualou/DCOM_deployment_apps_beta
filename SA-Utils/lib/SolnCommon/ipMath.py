'''
Copyright (C) 2009-2012 Splunk Inc. All Rights Reserved.
'''
import heapq
import re

# convert decimal to binary with at least minDigits number of bits
def DecToBin(number, minBits = 8):

    bin = ''
    
    while number > 0:
        
        j = number & 1
        bin = str(j) + bin
        number >>= 1
    
    while len(bin) < minBits:
        bin = '0' + bin
    
    return bin

# convert dotted ip address to dotted binary
def IPToBin(ip):    

    ipDict = ip.split('.')
    index = 0
    binDict = { }
    
    for x in ipDict:
        
        binDict[index] = DecToBin(int(x))
        index += 1

    binIP = str(binDict[0]) + '.' + str(binDict[1]) + '.' + str(binDict[2])  + '.' + str(binDict[3])
    
    return binIP
    
# convert dotted binary to ip address
def BinToIP(binIP):

    binDict = binIP.split('.')
    index = 0
    ipDict = { }
    
    for x in binDict:
        
        ipDict[index] = int(x, 2)
        index += 1
    
    ip = str(ipDict[0]) + '.' + str(ipDict[1]) + '.' + str(ipDict[2]) + '.' + str(ipDict[3])
    
    return ip


### Conversion functions.
### Note that conversions should perform validation and return None
### in the event of failure.
def IPToLong(value):
    '''Convert dotted ip address to long.'''
    if is_valid_ip(value):
        ip = map(long, value.split('.'))
        return 16777216 * ip[0] + 65536 * ip[1] + 256 * ip[2] + ip[3]
    return None


def LongToIP(value):
    '''Convert long to dotted ip address.'''
    if isinstance(value, int):
        value = long(value)
    if isinstance(value, long):
        return '%d.%d.%d.%d' % ((value >> 24) % 256, (value >> 16) % 256, (value >> 8) % 256, value % 256)
    return None


def CIDRToIPTuple(value):
    '''Convert a CIDR subnet (checked for validity) to IP range.'''

    if is_valid_cidr(value):
        ip, subnet = value.split('/')
        range_low = IPToLong(ip)
        hosts = pow(2, 32 - long(subnet)) - 1
        return (LongToIP(range_low), LongToIP(range_low + hosts))
    return None


def CIDRToLongTuple(value):
    '''Convert a CIDR subnet (checked for validity) to IP range expressed as two long integers.'''

    if is_valid_cidr(value):
        ip, subnet = value.split('/')
        range_low = IPToLong(ip)
        hosts = pow(2, 32 - long(subnet)) - 1
        return (range_low, range_low + hosts)
    return None


### Validation functions
##
##  Validations should ALWAYS return a Boolean value,
##  or a value which can be validated as a Boolean,
##  such as a non-empty list. Exceptions should NOT be
##  raised.
def is_valid_mac(value):
    '''Validate a MAC address.'''
    rx = re.compile('^(([0-9A-Fa-f]{1,2}:){5}[0-9A-Fa-f]{1,2})$')
    try:
        return     rx.match(value.strip())
    except AttributeError:
        # Value was not a string
        return False


def is_valid_ip(value):
    '''Validate an IP address.'''
    rx = re.compile('((?:(?:[0-1]\d{0,2}|2[0-4]\d|25[0-5]|\d{0,2})\.){3})([0-1]\d{0,2}|2[0-4]\d|25[0-5]|\d{1,2})$')
    try:
        return rx.match(value.strip())
    except AttributeError:
        # Value was not a string
        return False


def is_valid_ip_range_str(value):
    '''Validate an IP address range in the format a.b.c.d-e.f.g.h.'''
    try:
        range_low, range_high = value.strip().split('-', 1)
        if is_valid_ip(range_low) and is_valid_ip(range_high):
            range_low = IPToLong(range_low)
            range_high = IPToLong(range_high)
            return range_low <= range_high
    except AttributeError:
        pass
    except ValueError:
        pass
    return False


def is_valid_mask(value):
    '''Validate a subnet mask.'''
    try:
        return int(value) >= 0 and int(value) <= 32
    except ValueError:
        return False


def is_valid_cidr(value, delim='/'):
    '''Validate a CIDR address.'''
    try:
        subnet, mask = value.split(delim, 1)
        if is_valid_ip(subnet) and is_valid_mask(mask):
            subnetLong = IPToLong(subnet)
            mask = int(mask)

            # Use floor division to get the number of valid bits that can
            # be specified in the subnet. For instance,
            # 1.1.1.1/24 is not valid; should be 1.1.1.0/24 
            invalidBits = pow(2, ((32 - mask) // 8) * 8) - 1
                
            return not subnetLong & invalidBits
    
    except AttributeError:    
        # Not a string in CIDR format.
        return False
    except ValueError:
        # Not a string in CIDR format.
        return False


def convert_mac_format(value, delim, length):
    '''
    Given a MAC address in the form of a 12 hexadecimal character
    string, output the address in the format specified by (delim, len)
    where:
    
        delim = a delimiter
        length = the desired substring length
        
        Length should be an even factor of 12 (2, 4, 6, 12) for this to make 
        sense for MAC addresses.
    
    If the string is not a hexadecimal match, return it unchanged.
    '''
    
    value = re.sub('[:\.\s-]', '', value)
    if re.match('[0-9a-fA-F]{12}', value):
        return delim.join([value[i:i + length] for i in range(0, len(value), length)])
    else:
        return value
    

def expand_mac_range_to_list(value, formats):
    '''
    Given a string consisting of one MAC address or two hyphen-separated
    MAC addresses defining a range, return a list of all MAC addresses
    in the input range, inclusive.
    
    @param value: A MAC address range.
    @param format: A list of MAC address formats to produce.
    
    @return: A list of MAC addresses in the range.
    
    The input range can be in ANY format. The first 6 bytes are regarded
    as the start of the range, while the last 6 bytes are regarded as the
    end of the range. This is for backwards compatibility with the previous
    behavior of assetLookup.py.
    
    Since this function is primarily used to generate static asset lookup
    tables, to allow flexibility in defining the output format(s),
    a list of formatting tuples can be passed as a parameter. The list must
    consist of tuples in the following format:

        (delim, length)

    Some common values are:

        (':', 2)    for IEEE 802 colon-separated format, 00:11:22:33:44:55
        ('-', 2)    for IEEE 802 hyphen-separated format, 00:11:22:33:44:55
        ('.', 4)    for Cisco-style MAC format, 0000.1234.abcd
        ('', 12)    for condensed MAC format, 00001234abcd

    The length parameter can be any non-zero length up to and including the
    maximum length of the MAC address (12 characters). However, it usually 
    makes more sense to use an even divisor of 12 (e.g., 2, 4, 6).

    The output generated by the function will include all the formats specified, 
    for EVERY address in the range. It is not advisable to use ranges on the four
    most significant hex bytes, as that will cause combinatorial explosion in the
    generated static lookup table.

    For instance:

        00:00:00:EF:FF:FF-00:00:00:FF:FF:FF = 1048756 MAC addresses
        00:00:00:FE:FF:FF-00:00:00:FF:FF:FF = 65536 MAC addresses
        00:00:00:FF:EF:FF-00:00:00:FF:FF:FF = 4096 MAC addresses
        00:00:00:FF:FE:FF-00:00:00:FF:FF:FF = 256 MAC addresses
        00:00:00:FF:FF:EF-00:00:00:FF:FF:FF = 16 MAC addresses    
    
    '''
    
    matches = re.findall('[a-fA-F0-9]{2}', value)
    addresses = []
    if len(matches) == 12:
        # The value is a MAC address range.
        start = long(''.join(matches[0:6]), 16)
        end = long(''.join(matches[6:]), 16)
        
        for address in xrange(start, end):
            for delim, length in formats:
                # TODO: add format validation.
                if length <= 12 and length > 0:
                    # The address is converted to a hex string of 12 characters,
                    # zero-filled from left, before formatting.
                    addresses.extend([convert_mac_format('%012x' % address, delim, length)])
                else:
                    # Invalid length
                    pass
        
    elif len(matches) == 6:
        # The value is a MAC address.
        address = ''.join(matches[0:6])
        for delim, length in formats:
            if length <= 12 and length > 0:
                addresses.extend([convert_mac_format(address, delim, length)])
            else:
                # Invalid length
                pass

    else:
        raise ValueError('Value was not a MAC address or range.')
    
    return addresses


def expand_ip_range_to_cidr(rangeval, clean_single_ips=False, expand_subnets_smaller_than=None):
    '''
    Return a minimal list of CIDR addresses covering the same IPv4 range
    as the input range, inclusive. The input range MUST be one of the formats 
    shown below, representing a range a.b.c.d-e.f.g.h where a.b.c.d < e.f.g.h.
    If this is not true, ValueError will be raised.
    
    @param rangeval: An IP address range in either of the following formats:
        a.b.c.d-e.f.g.h     <string>
        (<int>, <int>)         <tuple>
    @param clean_single_ips: If True, remove "/32" suffix from single IPs.
    @param expand_small_subnets: An integer between 24 and 31, representing the
        level at which a subnet will be expanded into a complete set of IP 
        addresses. If None, no expansion is performed.
    
    Output consists of a list of strings "a.b.c.d[/N]" where 0 <= N <= 32.
    '''
    
    # The output list of subnets.
    subnets = []
    
    RANGE_MIN = 0
    RANGE_MAX = pow(2, 32)
    # Force failure for invalid input.
    rangeStartLong = rangeEndLong = -1
    
    if isinstance(rangeval, tuple) and len(rangeval) == 2:
        rangeStart, rangeEnd = rangeval
    elif isinstance(rangeval, basestring):
        rangeStart, rangeEnd = rangeval.split('-', 1)
    else:
        # Input invalid; will be caught below.
        pass

    if is_valid_ip(rangeStart) and is_valid_ip(rangeEnd):
        rangeStartLong = IPToLong(rangeStart)
        rangeEndLong = IPToLong(rangeEnd)
    elif (isinstance(rangeStart, int) or isinstance(rangeStart, long)) and (isinstance(rangeEnd, int) or isinstance(rangeEnd, long)):
        rangeStartLong = rangeStart
        rangeEndLong = rangeEnd
    else:
        raise ValueError("Value was not an IP address range.")
    
    if (rangeStartLong <= rangeEndLong
        and rangeStartLong >= RANGE_MIN and rangeEndLong >= RANGE_MIN 
        and rangeStartLong <= RANGE_MAX and rangeEndLong <= RANGE_MAX):

        # Begin range-to-CIDR algorithm.
        #
        # This algorithm is based on longest-common-prefix matching. Each subnet 
        # consists of a binary prefix of (32-N) digits, to which are appended
        # ALL binary integers up to N digits in length.
        #
        # 0. Convert rangeStart and rangeEnd to long integers (completed above). 
        # 1. Flip all of the 0 bits at the end of the binary representation
        #    of rangeStartLong to 1. The delta between rangeStartLong and 
        #    last_in_subnet will then represent a maximal block of IP
        #    addresses up to the next CIDR block. The next CIDR block will
        #    begin with a different prefix one bit shorter in length.
        # 2. If the last_in_subnet value is greater than the rangeEndLong value,
        #    our subnet is too large. Calculate the largest subnet (power of 2)
        #    that will fit into the range by using the bit_length() of the 
        #    difference between rangeStartLong and rangeEndLong, plus 1. This will
        #    give us the correct value of last_in_subnet.
        # 3. Emit the current subnet.
        # 4. Set rangeStartLong to the value of last_in_subnet plus 1, and repeat.
        # 5. Upon exiting the loop, rangeStartLong and rangeEndLong will exist
        #    in one of the following relations:
        #    a. rangeStartLong > rangeEndLong
        #       This means that the rangeEndLong matched our final subnet exactly,
        #       and no more coverage is needed.
        #    b. rangeStartLong == rangeEndLong
        #       This means that the subnet left one "dangling" IP, which should
        #       be covered via a /32 subnet.
        #
        # Example:
        #
        #    Given the following
        #
        #      rangeStart = 10.10.10.10, rangeEnd = 10.10.10.20
        #
        #    we have:
        #
        #      bin(rangeStartLong) = '0b1010000010100000101000001010'
        #      bin(rangeendLong)   = '0b1010000010100000101000010100'
        #
        #    This yields the following set of CIDRS covering the addresses
        #    shown in binary, with the common prefix marked by a pipe character:
        #
        #    10.10.10.10/31                 |
        #      '0b1010000010100000101000001010'    <- "0" suffix
        #      '0b1010000010100000101000001011'    <- "1" suffix
        #    10.10.10.12/30                |
        #      '0b1010000010100000101000001100'    <- "00" suffix
        #      '0b1010000010100000101000001101'    <- "01" suffix
        #      '0b1010000010100000101000001110'    <- "10" suffix
        #      '0b1010000010100000101000001111'    <- "11" suffix
        #    10.10.10.16/30              X |
        #      '0b1010000010100000101000010000'
        #      '0b1010000010100000101000010001'
        #      '0b1010000010100000101000010010'
        #      '0b1010000010100000101000010011'
        #    10.10.10.20/32                  |
        #      '0b1010000010100000101000010100'
        #
        #    Note that the subnet 10.10.10.16/30 would have been "reduced"
        #    from an originally calculated mask of /29. The "X" represents
        #    the original guess.
        
        while rangeStartLong < rangeEndLong:
            # Flip the rightmost zero bits; this will be our initial subnet guess.
            # See "Hacker's Delight" pg. 11.
            last_in_subnet = rangeStartLong | (rangeStartLong - 1)
            
            # Handle rollover when rangeStart is '0.0.0.0'
            if last_in_subnet == -1:
                last_in_subnet = 2 ** 32 - 1

            if last_in_subnet > rangeEndLong:
                # reduce to the largest possible size and retry
                diff = rangeEndLong - rangeStartLong + 1
                last_in_subnet = rangeStartLong + 2 ** (diff.bit_length() - 1) - 1

            mask = 32 - (last_in_subnet - rangeStartLong).bit_length()
            # For subnets in the expanded range that are smaller than /24, expand these
            # to their full complement of IP addresses if requested. Note that 
            # this includes x.x.x.0 and x.x.x.255 address, which mimics the
            # behavior of Splunk's "cidrmatch" eval comand.
            if expand_subnets_smaller_than and expand_subnets_smaller_than < 32 and expand_subnets_smaller_than >= 24:
                if mask >= expand_subnets_smaller_than:
                    for i in xrange(0, 2 ** (32 - mask)):
                        if clean_single_ips:
                            subnets.append(LongToIP(rangeStartLong + i))
                        else:
                            subnets.append(LongToIP(rangeStartLong + i) + '/32')
                else:
                    subnets.append('/'.join([LongToIP(rangeStartLong), str(mask)]))
            else:
                subnets.append('/'.join([LongToIP(rangeStartLong), str(mask)]))
            rangeStartLong = last_in_subnet + 1
        
        if rangeStartLong > rangeEndLong:
            pass
        elif rangeStartLong == rangeEndLong:
            # Add the last address
            if clean_single_ips:
                subnets.append(LongToIP(rangeStartLong))
            else:
                subnets.append(LongToIP(rangeStartLong) + '/32')
        else:
            # This should never happen due to the exit condition on the above while loop.
            raise ValueError("Subnet calculation failed unexpectedly.")

    else:
        # Invalid IP range.
        raise ValueError("Invalid IP range specified (perhaps reversed).")

    return subnets


def trim_cidr_list(cidr_list, mask):
    '''Given a list of subnets in CIDR format, trim any subnets that
    have a subnet value greater than or equal to the given mask. For instance given the
    parameters:
    
    cidrlist = [ '1.2.3.4/32', '1.2.3.4/31', '1.2.3.0/24' ]
    mask = 31

    this function would return
    
    new_list = [ '1.2.3.4', '1.2.3.4', '1.2.3.0/24' ]
    
    The most common use of this function is to return /32 CIDR subnets
    in string form.
    
    @param cidr_list: A list of IP subnets in CIDR format
    @param  mask: An integer between 0 and 32 inclusive.
    '''
    rv = []
    
    if mask < 0 or mask > 32:
        raise ValueError('Invalid mask value specified.')
    for cidr in cidr_list:
        if is_valid_cidr(cidr):
            ip, subnet = cidr.split('/')
            if int(subnet) >= mask:
                rv.append(ip)
            else:
                rv.append(cidr)
        else:
            raise ValueError('Value was not a valid CIDR subnet.')
    
    return rv


# convert dotted netmask to cidr
def NetmaskToCIDR(netmask):

    cidr = 0
    binNetmask = IPToBin(netmask)

    for x in binNetmask:
        if x == '1': 
            cidr += 1

    return cidr


# convert cidr to dotted netmask
def CIDRToNetmask(cidr):
    
    netmask = ''

    for x in range(0,cidr):
        netmask += '1'
    
    netmask += '00000000000000000000000000000000'
    netmask = netmask[0:32]
    
    return BinToIP(netmask[0:8] + '.' + netmask[8:16] + '.' + netmask[16:24] + '.' + netmask[24:32])
    
# convert dotted ip and netmask to ip range
def NetmaskToRange(ip, netmask):
    
    baseCIDR = 32
    ipRange = { }
    
    netmaskCIDR = NetmaskToCIDR(netmask)
    hostCount = pow(2, (baseCIDR - netmaskCIDR))

    
    binIP = IPToBin(ip)
    binNetmask = IPToBin(netmask)
    
    longIP = IPToLong(ip)
    
    startAddress = ""
    
    index = 0
    
    for x in binIP:
    
        if x != '.':
            startAddress = startAddress + str( int(x) & int(binNetmask[index]) )
        else:
            startAddress = startAddress + '.'
            
        index += 1
        
    ipRange['startAddress'] = BinToIP(startAddress)    
    ipRange['endAddress'] = LongToIP(IPToLong(ipRange['startAddress']) + hostCount - 1)
    
    return ipRange
    
def CIDRToRange(ipCIDR):

    parts = ipCIDR.split('/')
    if len(parts) == 2:
        baseIP = parts[0]
        subnet = CIDRToNetmask(int(parts[1]))
        ipRange = NetmaskToRange(baseIP, subnet)
        if ipRange:
            return ipRange
        
def convert_mac_to_long(value):
    
    if value is not None:
        new_value = value.replace('-', '')
        new_value = new_value.replace(':', '')
        if len(new_value) > 0:
                return long(new_value, 16)

def convert_long_to_mac(value):

    if value is not None:
        # 1 -- Get a hex version of the number
        basic_hex = hex(value)
        basic_hex = basic_hex.replace('0x', '')
        basic_hex = basic_hex.replace('L', '')
        basic_hex = basic_hex.zfill(12) # Add back the leading zeroes to ensure it is 12 characters long
        
        
        # 2 -- produce a string representing the MAC address with hex digits (uppercase) separated by colons

        #    2.1 -- Parse out the list of bytes
        regex = re.compile('([A-Fa-f0-9]{2,2})')
        match = regex.findall(basic_hex)
        
        final_string = None
        
        #    2.2 -- Append each byte to the final MAC address string
        if match is not None:
            for mac_byte in match:
                if final_string is None:
                    final_string = mac_byte.upper()
                else:
                    final_string =  final_string + ":" + mac_byte.upper() 
        
        return final_string
        
    else:
        return None
