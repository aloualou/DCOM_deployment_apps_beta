__version__ = "0.0.2"
__status__ = "Beta"

# version 0.0.2 adds support for spaces in strGroupOUs variable, line folding of LDAP output, and handling of spaces in found DNs

from commands import getoutput

#### ten setup/input parameters ####
# (1) Name of computer on which to execute query
strComputer = '50.57.84.53' #gogo
# (2) User Account to use for query
strUser = 'cn=svc_test,cn=users,dc=tryfoo,dc=com'
# (3) Password to use for query
strPassword = '1234qwerASDF'
# (4) semi-colon separated list of group DNs to query
strGroupOUs = ''.join(['cn=b,cn=users,dc=tryfoo,dc=com;',
                       'cn=a,cn=users,dc=tryfoo,dc=com'])
# remove spaces in list, escape spaces in DNs, and don't escape and escaped space in the DN...
strGroupOUs = strGroupOUs.replace('; ',';').replace(' ','\\ ').replace('\\\\ ','\\ ')
# (5) file in which to store results
strResults = '../lookups/departments.csv'
# (6) headers for outfile
strHeaders = ''.join(["\"user_id\",","\"department\"\n"])
# (7) port to use
strPort = '389'
# (8) group name attribute
groupNameAttribute = 'name'
# (9) group member attribute
groupMemberAttribute = 'member'
# (10) member name attribute
memberNameAttribute = 'name'
# create file for writing
f=open(strResults,'w')
f.write(strHeaders)

# parse out groups
groupDNs = strGroupOUs.split(';')

# query each group for members
for groupDN in groupDNs:
    #print 'groupDN',groupDN
    #print ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + groupDN.strip() + " | grep -i ^" + groupNameAttribute + ":")
    groupName = getoutput ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + groupDN.strip() + " | grep -i ^" + groupNameAttribute + ":")
    # v.0.0.2
    # Line folding for long LDIF results per  RFC2849 means we can't pipe to grep.  Instead we just capture all output and do our own parsing...
    # v.0.0.1 method...
    # groupMembers = getoutput ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + groupDN.strip() + " " + groupMemberAttribute + " | grep -i ^" + groupMemberAttribute + ":")

    # v.0.0.2 method...
    groupMembers = getoutput ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + groupDN.strip() + " " + groupMemberAttribute) 

    # v.0.0.2
    # setup variables necessary to unfold folded results
    prev_character=''
    line = ''
    members_of_group = ''
    # v.0.0.2
    # parse through each character and unfold folded lines (if next line has a space, it is continued from previous line, so we join them back together)
    for character in groupMembers:
        if prev_character=='\n':
            if character==' ':
                character=''
            else:
                members_of_group = ''.join([members_of_group,line,prev_character])
                line = ''
        else:
            line = ''.join([line,prev_character])
        prev_character = character
    # add ending piece that was not processed as we were writing based on prev_character and therefore missed the final 'character'
    # we also need to add the line to the results as well as it was never added as it was waiting for a line break that it never encountered

    members_of_group = ''.join([members_of_group,line,character])
    # v.0.0.2
    # since we can't pipe to grep (due to line folding), we now parse the DNs from the member lines ourselves...
    lines = members_of_group.split('\n')
    groupMembers = []
    # if line contains group member attribute, grab the DN for downstream use
    for line in lines:
        try:
            if str(line.split(":")[0]).lower() == groupMemberAttribute.lower():
                line = str(line.split(":")[1]).strip().replace(' ','\\ ')
                groupMembers.append(line)
        except:
            pass

    # v.0.0.2
    # due to manual line unfolding vs. previous grep solution, we no longer need to break on line feed but instead parse existing list...
    # v.0.0.1 method...
    #memberList = groupMembers.split('\n')
    # v.0.0.2 method...
    memberList = groupMembers
    # query each member for name
    for memberDN in memberList:
        try:   
            # v.0.0.2
            # we no longer need below line to do this as we manager the parsing ourselves above (manual line unfolding vs. previous grep solution)
            # v.0.0.1 method...
            #memberDN = memberDN.split(':')[1].strip()
            #print ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + memberDN + " | grep -i ^" + memberNameAttribute + ":")
            memberName = getoutput ("ldapsearch -h " + strComputer + " -p " + strPort + " -D \"" + strUser + "\" -w '" + strPassword + "' -x -b " + memberDN + " | grep -i ^" + memberNameAttribute + ":")
            #print memberName
            # write name and group to file
            #print(''.join(["\"", memberName.split(':')[1].strip(),"\",\"",groupName.split(':')[1].strip(),"\"\n"]))
            f.write(''.join(["\"", memberName.split(':')[1].strip(),"\",\"",groupName.split(':')[1].strip(),"\"\n"]))
        except:
            pass
# close file
f.close()

