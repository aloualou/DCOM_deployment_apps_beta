define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {
    return Backbone.Model.extend({
        validate: function(attrs, options) {
            var matches;
            var i;
            var prefixSize;
            var octet;
            var group;
            var numNonMaskedGroups;
            var numMaskedBitsInPartiallyMaskedGroup;
            var N;

            if (matches = attrs.val.match(/^([^.]+)\.([^.]+)\.([^.]+)\.([^.\/]+)(\/(\d+))?$/)) {
                for (i = 1; i <= 4; ++i) {
                    octet = matches[i];
                    if (octet != '*') {
                        if (! octet.match(/^\d+$/))
                            return "IPv4 octets must be decimal numbers (or wildcards)";
                        if (parseInt(octet) > 255)
                            return "IPv4 octets must be <= 255";
                    }
                }
                if (matches[5]) {
                    // A bitmask was found.
                    prefixSize = parseInt(matches[6]);
                    if (prefixSize <= 0)
                        return 'IPv4 prefix size must be > 0';
                    if (prefixSize > 32)
                        return 'IPv4 prefix size must be <= 32';

                    // Check that the last (32 - prefixSize) bits are 0's.
                    if (prefixSize == 32)
                        return;
                    N = parseInt(matches[1]);
                    N = (N << 8) + parseInt(matches[2]);
                    N = (N << 8) + parseInt(matches[3]);
                    N = (N << 8) + parseInt(matches[4]);
                    if (N << prefixSize)
                        return 'Non-masked bits must be all zeros.';
                }
            } else if (matches = attrs.val.match(/^([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^:\/]+)(\/(\d+))?$/)) {
                for (i = 1; i <= 8; ++i) {
                    group = matches[i];
                    if (! group.match(/^[0-9a-fA-F]{4}$/))
                        return "IPv6 groups must be 4 hexadecimal characters";
                }
                if (matches[9]) {
                    // A bitmask was found.
                    prefixSize = parseInt(matches[10]);
                    if (prefixSize <= 0)
                        return 'IPv6 prefix size must be > 0';
                    if (prefixSize > 128)
                        return 'IPv6 prefix size must be <= 128';

                    // Check that the last (128 - prefixSize) bits are 0's.
                    // First, check that all the fully non-masked groups are 0.
                    numNonMaskedGroups = (128 - prefixSize) >> 4;
                    for (i = 0; i < numNonMaskedGroups; ++i)
                        if (matches[8-i] != '0000')
                            return 'Non-masked bits must be all zeros.';

                    // Finally, if there is a partially masked group...
                    if (numMaskedBitsInPartiallyMaskedGroup = prefixSize % 16) {
                        // ... then convert the hexadecimal string for that group to an integer, ...
                        N = parseInt(matches[8-i], 16);
                        // ... then remove the masked bits and check whether the remainder is all zeros.
                        if ((N << numMaskedBitsInPartiallyMaskedGroup) % 0x10000)
                            return 'Non-masked bits must be all zeros.';
                    }
                }
            } else {
                return 'Not a valid IPv4 or IPv6 address';
            }
        }
    });
});
