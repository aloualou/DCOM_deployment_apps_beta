#!/bin/bash
# Sets permissions on streamfwd binaries to run as root

# You must run this script as root/sudo
if [[ $EUID -ne 0 ]]; then
  echo "You must run this script as a root user" 2>&1
  exit 1
fi

# Set permissions on file
run_as_root() {
    chown root $1
    chmod 4711 $1
}

# Setup Unix streamfwd's to run as root
run_as_root linux_x86/bin/streamfwd
run_as_root linux_x86_64/bin/streamfwd
run_as_root darwin_x86_64/bin/streamfwd
