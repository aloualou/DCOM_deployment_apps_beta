import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import netflow_appname

SMPL_HEADER = "exp_ip,flow_smpl_id,smpl_int,_time\n,,unknown,unknown"
EXPDEV_HEADER = "exp_ip,management_ip,device_group\n*,*,*\n"
WATCHEDIF_HEADER = "management_ip,if_name\n*,*\n"
IFGROUPS_HEADER = "management_ip,if_name,if_group\n*,*,*\n"
INTERFACES_HEADER = "management_ip,snmp_index,if_name,if_speed\n*,*,*,*\n"
SNMP_INTERFACE_NAME_HEADER = "management_ip,snmp_index,if_name\n*,*,*\n"
SNMP_INTERFACE_SPEED_HEADER = "management_ip,snmp_index,if_speed\n*,*,*\n"

class CSVChecker():
    def create_content(self, full_path, header):
        f = open(full_path, 'w')
        f.write(header)
        f.close()

    def update_content(self, full_path, header):
        f = open(full_path, 'r')
        number_of_lines = len(f.readlines())
        f.close()
        if number_of_lines <= 1:
            self.create_content(full_path, header)

    def define_path(self, filename):
        return os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'lookups', filename)

    def check_csv(self, filename, header):
        full_path = self.define_path(filename)
        if filename == "exporters-devices.csv":
            man_ip_csv = self.define_path('management-ip.csv')
            exp_grp_csv = self.define_path('exporter-groups.csv')
            if not os.path.exists(full_path):
                exp_dev_csv = []
                if os.path.exists(man_ip_csv):
                    man_ip_txt = [ line.rstrip().split(',') for line in open(man_ip_csv) ]
                    if len(man_ip_txt) > 1:
                        for line in man_ip_txt[1:]:
                            line.append('*')
                            exp_dev_csv.append(line)
                if os.path.exists(exp_grp_csv):
                    exp_grp_txt = [ line.rstrip().split(',') for line in open(exp_grp_csv) ]
                    if len(exp_grp_txt) > 1:
                        for line in exp_dev_csv:
                            exp_ips = list(line[0] for line in exp_dev_csv)
                        for line in exp_grp_txt[1:]:
                            if line[0] not in exp_ips:
                                line.insert(1, '*')
                                exp_dev_csv.append(line)
                            else:
                                for str_i,str_val in enumerate(exp_dev_csv):
                                    if line[0] == str_val[0]:
                                        exp_dev_csv[str_i][2] = line[1]
                if len(exp_dev_csv) >= 1:
                    asterisks = ['*', '*', '*']
                    if asterisks in exp_dev_csv:
                        exp_dev_csv.remove(asterisks)
                    f = open(full_path, 'w')
                    f.write(header)
                    for line in exp_dev_csv:
                        f.write(",".join(line))
                        f.write("\n")
                    f.close()
                else:
                    # If there are no data in old cvs-s (they are empty somehow) 
                    # then we just write standart header
                    self.create_content(full_path, header)
            else:
                # if new exporters-devices.csv exists, then we just check its content
                # to determine whether we need to write standart header or not
                self.update_content(full_path, header)
        elif filename == "interfaces.csv":
            #if this file does not exist, then we just create it
            if not os.path.exists(full_path):
                self.create_content(full_path, header)
            else:
                f = open(full_path)
                old_new = f.readline().split(",")
                f.close()
                if old_new[0] == "management_ip" and len(old_new) == 4:
                    # If the file is new, then just pass this file for
                    # checking it content and updationg it if it needs to be.
                    self.update_content(full_path, header)
                elif old_new[0] == "exp_ip" and len(old_new) == 5:
                    # if the file is old
                    old_txt = [ line.rstrip().split(',') for line in open(full_path) ]
                    if len(old_txt) > 1:
                        new_txt = []
                        # deleting unnecessary col
                        for line in old_txt[1:]:
                            line.remove(line[3])
                            new_txt.append(line)
                        f = open(full_path, 'w')
                        # rewriting header in new-style
                        f.write("management_ip,snmp_index,if_name,if_speed\n")
                        # populating file
                        for line in new_txt:
                            f.write(",".join(line))
                            f.write("\n")
                        f.close()
                    else:
                        # If there are no data in old csv
                        self.create_content(full_path, header)
                else:
                    # If that file is empty or invalid, then just create clean file
                    self.create_content(full_path, header)
        else:
            # this block is used for all other CSVs than exporters-devices.csv or interfaces.csv
            if not os.path.exists(full_path):
                self.create_content(full_path, header)
            else:
                self.update_content(full_path, header)
    def check(self, **kwargs):
        self.check_csv('sampling.csv', SMPL_HEADER)
        self.check_csv('interfaces.csv', INTERFACES_HEADER)
        self.check_csv('exporters-devices.csv', EXPDEV_HEADER)
        self.check_csv('watched-interfaces.csv', WATCHEDIF_HEADER)
        self.check_csv('interface-groups.csv', IFGROUPS_HEADER)
        self.check_csv('snmp-interface-name.csv', SNMP_INTERFACE_NAME_HEADER)
        self.check_csv('snmp-interface-speed.csv', SNMP_INTERFACE_SPEED_HEADER)
        return 'Done!'
